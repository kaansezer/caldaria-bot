const { PermissionFlagsBits } = require('discord.js');
const logger = require('./logger');
const { getGuildSetting, setGuildSetting } = require('./settings');

// Mod-log kanali ayari guild_settings tablosunda saklanir (kalici, sunucu bazli).
const MOD_LOG_SETTING_KEY = 'mod_log_channel_id';
// Bot-log (fallback) kanali ayari. Mod-log gonderilemezse bu kanala uyari yazilir.
const BOT_LOG_SETTING_KEY = 'bot_log_channel_id';

// Ayarlanmamissa /sunucukur tarafindan olusturulan mod-log kanali geriye donuk uyumluluk icin aranir.
const FALLBACK_CHANNEL_NAMES = ['📋・mod-log', '📜・mod-log'];

// Botun mod-log kanalinda sahip olmasi gereken izinler.
const REQUIRED_PERMISSIONS = [
  PermissionFlagsBits.ViewChannel,
  PermissionFlagsBits.SendMessages,
  PermissionFlagsBits.EmbedLinks,
];

// Guild'in ayarlanmis mod-log kanal ID'sini dondurur (yoksa null).
function getConfiguredModLogChannelId(guildId) {
  const raw = getGuildSetting(guildId, MOD_LOG_SETTING_KEY, '');
  return raw && raw.trim().length > 0 ? raw.trim() : null;
}

// Guild'in ayarlanmis bot-log (fallback) kanal ID'sini dondurur (yoksa null).
function getConfiguredBotLogChannelId(guildId) {
  const raw = getGuildSetting(guildId, BOT_LOG_SETTING_KEY, '');
  return raw && raw.trim().length > 0 ? raw.trim() : null;
}

// Botun verilen kanalda mod-log icin gerekli izinleri var mi?
function canBotLogInChannel(guild, channel) {
  if (!channel) return false;
  const botMember = guild.members.me;
  if (!botMember) return false;
  const perms = botMember.permissionsIn(channel);
  return REQUIRED_PERMISSIONS.every((flag) => perms.has(flag));
}

// Mod-log kanalini cozer. Sira: DB ayari -> fallback kanal aramasi.
// Ayarlanan kanal silinmis/gecersizse DB ayari temizlenir.
function resolveModLogChannel(guild) {
  const configuredId = getConfiguredModLogChannelId(guild.id);

  if (configuredId) {
    const channel = guild.channels.cache.get(configuredId);
    if (channel && channel.isTextBased() && !channel.isThread()) {
      return channel;
    }
    logger.warn(
      `[MOD-LOG] ${guild.name}: ayarlanan mod-log kanali (${configuredId}) bulunamadi; ayar temizlendi.`
    );
    setGuildSetting(guild.id, MOD_LOG_SETTING_KEY, '');
    return null;
  }

  return (
    guild.channels.cache.find(
      (channel) =>
        FALLBACK_CHANNEL_NAMES.includes(channel.name) && channel.isTextBased() && !channel.isThread()
    ) || null
  );
}

// Merkezi mod-log gonderici. Tum moderasyon komutlari bu fonksiyonu kullanir.
// Mod-log ayari yoksa veya hata olursa islem ENGELLENMEZ, bot asla kapanmaz.
// Basarisizlikta bot-log (fallback) kanali ayarliysa oraya bilgi gonderilir.
// Donus: { sent: boolean, reason: 'ok' | 'no_channel' | 'missing_permissions' | 'error', fallback: object|null }
async function sendModLog(guild, embed) {
  let result;
  try {
    const channel = resolveModLogChannel(guild);
    if (!channel) {
      logger.warn(`[MOD-LOG] ${guild.name} sunucusunda mod-log kanali bulunamadi.`);
      result = { sent: false, reason: 'no_channel' };
    } else if (!canBotLogInChannel(guild, channel)) {
      logger.warn(`[MOD-LOG] ${guild.name}: mod-log kanalinda botun gerekli izinleri yok.`);
      result = { sent: false, reason: 'missing_permissions' };
    } else {
      await channel.send({ embeds: [embed] });
      result = { sent: true, reason: 'ok' };
    }
  } catch (error) {
    logger.error('[MOD-LOG] Mod-log mesaji gonderilemedi:', error.message);

    // Silinmis kanal (10003) veya erisim hatasi (50001): ayari temizle.
    if (error.code === 10003 || error.code === 50001) {
      setGuildSetting(guild.id, MOD_LOG_SETTING_KEY, '');
      logger.warn(`[MOD-LOG] ${guild.name}: gecersiz mod-log kanali ayari temizlendi.`);
    }
    result = { sent: false, reason: 'error' };
  }

  // Fallback: mod-log gonderilemediyse bot-log kanalina uyari yaz.
  if (!result.sent) {
    result.fallback = await sendBotLog(guild, {
      text: `⚠️ Mod-log mesajı gönderilemedi (sebep: ${result.reason}).`,
    });
  } else {
    result.fallback = null;
  }

  return result;
}

// Bot-log (fallback) kanalina duz metin gonderir. Donus: { sent: boolean }
async function sendBotLog(guild, { text }) {
  try {
    const botLogChannel = resolveBotLogChannel(guild);
    if (!botLogChannel) return { sent: false, reason: 'no_channel' };
    if (!canBotLogInChannel(guild, botLogChannel)) {
      return { sent: false, reason: 'missing_permissions' };
    }
    await botLogChannel.send(text);
    return { sent: true, reason: 'ok' };
  } catch (error) {
    logger.error('[MOD-LOG] Bot-log mesaji gonderilemedi:', error.message);
    return { sent: false, reason: 'error' };
  }
}

// Bot-log kanalini cozer. Sira: DB ayari -> fallback 'bot-log' isimli kanal.
function resolveBotLogChannel(guild) {
  const configuredId = getConfiguredBotLogChannelId(guild.id);

  if (configuredId) {
    const channel = guild.channels.cache.get(configuredId);
    if (channel && channel.isTextBased() && !channel.isThread()) {
      return channel;
    }
    logger.warn(
      `[MOD-LOG] ${guild.name}: ayarlanan bot-log kanali (${configuredId}) bulunamadi; ayar temizlendi.`
    );
    setGuildSetting(guild.id, BOT_LOG_SETTING_KEY, '');
    return null;
  }

  return (
    guild.channels.cache.find(
      (channel) => channel.name.includes('bot-log') && channel.isTextBased() && !channel.isThread()
    ) || null
  );
}

// Bot-log ayarini kaydeder / gunceller. Donus: { ok: boolean, message: string }
function setBotLogChannel(guild, channel) {
  if (!canBotLogInChannel(guild, channel)) {
    return {
      ok: false,
      message: '❌ Botun bu kanala mesaj göndermek için gerekli izinleri yok.',
    };
  }
  setGuildSetting(guild.id, BOT_LOG_SETTING_KEY, channel.id);
  return { ok: true, message: null };
}

// Bot-log ayarini kaldirir.
function clearBotLogChannel(guildId) {
  setGuildSetting(guildId, BOT_LOG_SETTING_KEY, '');
}

// Bot-log durumunu okur: { configuredId, channel, active }
function getBotLogStatus(guild) {
  const configuredId = getConfiguredBotLogChannelId(guild.id);
  const channel = configuredId
    ? guild.channels.cache.get(configuredId)
    : resolveBotLogChannel(guild);

  if (!channel || !channel.isTextBased() || channel.isThread()) {
    return { configuredId: configuredId || null, channel: null, active: false };
  }
  return { configuredId, channel, active: true };
}

// Mod-log ayarini kaydeder / gunceller. Donus: { ok: boolean, message: string }
function setModLogChannel(guild, channel) {
  if (!canBotLogInChannel(guild, channel)) {
    return {
      ok: false,
      message: '❌ Botun bu kanala mesaj göndermek için gerekli izinleri yok.',
    };
  }
  setGuildSetting(guild.id, MOD_LOG_SETTING_KEY, channel.id);
  return { ok: true, message: null };
}

// Mod-log ayarini kaldirir.
function clearModLogChannel(guildId) {
  setGuildSetting(guildId, MOD_LOG_SETTING_KEY, '');
}

// Mod-log durumunu okur: { configuredId, channel, active }
function getModLogStatus(guild) {
  const configuredId = getConfiguredModLogChannelId(guild.id);
  const channel = configuredId
    ? guild.channels.cache.get(configuredId)
    : resolveModLogChannel(guild);

  if (!channel || !channel.isTextBased() || channel.isThread()) {
    return { configuredId: configuredId || null, channel: null, active: false };
  }
  return { configuredId, channel, active: true };
}

module.exports = {
  sendModLog,
  setModLogChannel,
  clearModLogChannel,
  getModLogStatus,
  getConfiguredModLogChannelId,
  canBotLogInChannel,
  MOD_LOG_SETTING_KEY,
  BOT_LOG_SETTING_KEY,
  sendBotLog,
  setBotLogChannel,
  clearBotLogChannel,
  getBotLogStatus,
  getConfiguredBotLogChannelId,
};
