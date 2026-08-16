const { Events, PermissionFlagsBits } = require('discord.js');
const { containsProfanity } = require('../utils/profanityFilter');
const { addWarn, getActiveWarningCount, SOURCES } = require('../utils/warnManager');
const { getGuildSetting } = require('../utils/settings');
const moderationConfig = require('../config/moderationConfig');
const { describePenalty, penaltyReasonText, applyWarnPenalty } = require('../utils/warnPenalty');
const { sendModLog } = require('../utils/modLog');
const { buildWarnLogEmbed } = require('../utils/modLogEmbeds');
const {
  getGuildSettings,
  getChannelContextKey,
  chat,
  splitResponse,
} = require('../services/geminiService');
const logger = require('../utils/logger');

const WARNING_MESSAGE = '⚠️ Lütfen küfür veya uygunsuz ifadeler kullanma.';
const WARNING_DELETE_DELAY = 5000;
const PROFANITY_WARN_SETTING = 'profanityWarnEnabled';

// Mesaj, AI kanalinda gonderilmisse veya bot mention edildiyse Gemini'ye iletir.
// Baglam: sunucu + thread/kanal + kullanici bazinda saklanir.
async function maybeHandleAI(message) {
  try {
    const settings = getGuildSettings(message.guild.id);
    if (!settings || settings.is_enabled !== 1) return;

    const mentionsBot = message.mentions?.has(message.client.user);
    const isBoundChannel =
      settings.chat_channel_id && message.channel.id === settings.chat_channel_id;

    if (!mentionsBot && !isBoundChannel) return;

    const channelId = getChannelContextKey(message.channel);
    const prompt = message.content.replace(/<@!?\d+>/g, '').trim();

    if (message.channel.typing) {
      message.channel.typing.start();
    }

    logger.info(`[AI] ${message.author.tag} AI'ya sordu: ${prompt.slice(0, 80)}`);

    const result = await chat({
      guildId: message.guild.id,
      userId: message.author.id,
      channelId,
      prompt,
    });

    if (message.channel.typing) {
      message.channel.typing.stop();
    }

    if (!result.ok) {
      await message.reply(`⚠️ Yanıt alınamadı: ${result.errorMessage}`);
      return;
    }

    const parts = splitResponse(result.text);
    for (const part of parts) {
      await message.channel.send(part);
    }
  } catch (error) {
    logger.error('[AI] Otomatik yanit hatasi:', error.message);
  }
}

// Ayari aciksa kufur filtresi otomatik warn verir ve warn sayisina gore ceza uygular.
async function maybeAutoWarn(message) {
  if (getGuildSetting(message.guild.id, PROFANITY_WARN_SETTING, '0') !== '1') return;

  const warning = addWarn(message.guild.id, message.author.id, {
    reason: moderationConfig.profanityWarnReason,
    moderatorId: null,
    source: SOURCES.profanityFilter,
  });

  const totalWarns = getActiveWarningCount(message.guild.id, message.author.id);

  // Warn sayisina gore cezayi uygula (merkezi fonksiyon, manuel /warn ile ayni mantik)
  let penaltyText = null;
  let note = null;
  if (message.member) {
    const penaltyResult = await applyWarnPenalty(message.member, { source: SOURCES.profanityFilter });
    penaltyText = penaltyResult.penalty ? describePenalty(penaltyResult.penalty) : null;
    note = penaltyResult.reason
      ? `Ceza uygulanamadı: ${penaltyReasonText(penaltyResult.reason)}`
      : null;
  }

  // Mod-log: otomatik warn kaydi
  const modLogEmbed = buildWarnLogEmbed({
    user: message.author,
    moderatorText: 'Otomatik (Küfür filtresi)',
    reason: moderationConfig.profanityWarnReason,
    totalWarns,
    penaltyText,
    note,
    source: SOURCES.profanityFilter,
  });
  await sendModLog(message.guild, modLogEmbed);

  logger.info(
    `[MODERATION] Kufur filtresi otomatik warn verdi: ${message.author.tag} | Toplam: ${totalWarns} | Ceza: ${penaltyText || 'yok'}`
  );
}

// Mesaj olustugunda kufur filtresini calistirir.
module.exports = {
  name: Events.MessageCreate,

  async execute(message) {
    try {
      if (message.author.bot) return;
      if (message.system) return;
      if (!message.inGuild()) return;
      if (!message.content) return;

      // AI kanali / mention kontrolu (kufur filtresinden once, cunku AI her mesaji isler).
      await maybeHandleAI(message);

      const matchedWord = containsProfanity(message.content);
      if (!matchedWord) return;

      let me = message.guild.members.me;
      if (!me) {
        try {
          me = await message.guild.members.fetch(message.client.user.id);
        } catch (error) {
          logger.warn('[MODERATION] Bot uyesi alinamadi:', error.message);
          return;
        }
      }

      if (!me.permissionsIn(message.channel).has(PermissionFlagsBits.ManageMessages)) {
        logger.warn(
          `[MODERATION] ${message.channel.name} kanalinda ManageMessages yetkisi yok; mesaj silinmedi (${message.author.tag})`
        );
        return;
      }

      try {
        await message.delete();
      } catch (error) {
        logger.error('[MODERATION] Mesaj silinemedi:', error.message);
        return;
      }

      logger.info(
        `[MODERATION] Kullanıcı: ${message.author.tag} | Sebep: Yasaklı kelime (${matchedWord}) | Mesaj silindi`
      );

      try {
        const warning = await message.channel.send({
          content: `${message.author}, ${WARNING_MESSAGE}`,
        });

        setTimeout(() => {
          warning.delete().catch(() => {});
        }, WARNING_DELETE_DELAY);
      } catch (error) {
        logger.error('[MODERATION] Uyarı mesajı gönderilemedi:', error.message);
      }

      // Otomatik warn ayari aciksa warn ver (hata olsa bile bot kapanmaz)
      try {
        await maybeAutoWarn(message);
      } catch (error) {
        logger.error('[MODERATION] Otomatik warn hatasi:', error);
      }
    } catch (error) {
      logger.error('[MODERATION] Küfür filtresi hatası:', error);
    }
  },
};
