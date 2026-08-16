const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const {
  setModLogChannel,
  clearModLogChannel,
  getModLogStatus,
  setBotLogChannel,
  clearBotLogChannel,
  getBotLogStatus,
} = require('../utils/modLog');
const logger = require('../utils/logger');

function parseChannelInput(interaction, raw) {
  const input = raw.trim();
  if (/^\d{17,20}$/.test(input)) {
    return interaction.guild.channels.cache.get(input) || null;
  }
  const match = input.match(/^<#(\d{17,20})>$/);
  if (match) {
    return interaction.guild.channels.cache.get(match[1]) || null;
  }
  return null;
}

function buildStatusEmbed(guild, status, botStatus) {
  return new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('📋 MOD-LOG AYARLARI')
    .addFields(
      {
        name: '📋 Mod-log kanalı',
        value: status.channel ? `${status.channel.toString()}` : 'Ayarlanmadı',
        inline: false,
      },
      {
        name: '📋 Durum',
        value: status.active ? '🟢 Aktif' : '🔴 Pasif',
        inline: false,
      },
      {
        name: '🤖 Bot-log (fallback) kanalı',
        value: botStatus.channel ? `${botStatus.channel.toString()}` : 'Ayarlanmadı',
        inline: false,
      },
      {
        name: '🤖 Bot-log durumu',
        value: botStatus.active ? '🟢 Aktif' : '🔴 Pasif',
        inline: false,
      }
    )
    .setTimestamp();
}

// Mod-log kanalini ayarlar, durumunu gosterir veya kapatir (Sadece Owner).
// botlog parametresi ile mod-log gonderilemediginde yedek olarak kullanilacak kanal ayarlanir.
module.exports = {
  data: new SlashCommandBuilder()
    .setName('modlog')
    .setDescription('Moderasyon log kanalını ayarlar veya durumunu gösterir (Owner).')
    .addStringOption((option) =>
      option
        .setName('kanal')
        .setDescription('Mod-log kanalı (#kanal veya ID). "yok" = kapat, boş = durum göster')
        .setRequired(false)
    )
    .addStringOption((option) =>
      option
        .setName('botlog')
        .setDescription('Bot-log (fallback) kanalı (#kanal veya ID). "yok" = kapat')
        .setRequired(false)
    ),
  moderationAction: 'modlog',

  async execute(interaction) {
    const rawKanal = interaction.options.getString('kanal');
    const rawBotLog = interaction.options.getString('botlog');
    const guild = interaction.guild;

    // botlog parametresi verildi -> bot-log ayarini yonet
    if (rawBotLog !== null) {
      const normalized = rawBotLog.trim().toLowerCase();

      if (['yok', 'kapat', 'kapalı'].includes(normalized)) {
        clearBotLogChannel(guild.id);
        logger.info(`[MOD-LOG] ${guild.name} icin bot-log ayari kapatildi (${interaction.user.tag}).`);
        await interaction.reply({
          content: '✅ Bot-log (fallback) kapatıldı.',
          ephemeral: true,
        });
        return;
      }

      const channel = parseChannelInput(interaction, rawBotLog);
      if (!channel || !channel.isTextBased() || channel.isThread()) {
        await interaction.reply({
          content: '❌ Geçerli bir metin kanalı belirtilmedi.',
          ephemeral: true,
        });
        return;
      }

      const result = setBotLogChannel(guild, channel);
      if (!result.ok) {
        await interaction.reply({ content: result.message, ephemeral: true });
        return;
      }

      logger.info(
        `[MOD-LOG] ${guild.name} icin bot-log kanali ayarlandi: #${channel.name} (${channel.id})`
      );
      const embed = new EmbedBuilder()
        .setColor(0x57f287)
        .setTitle('✅ Bot-log (fallback) kanalı ayarlandı.')
        .setDescription(`🤖 Kanal: ${channel.toString()}`)
        .setTimestamp();
      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    // kanal parametresi verilmedi -> durumu goster
    if (rawKanal === null) {
      const status = getModLogStatus(guild);
      const botStatus = getBotLogStatus(guild);
      await interaction.reply({
        embeds: [buildStatusEmbed(guild, status, botStatus)],
        ephemeral: true,
      });
      return;
    }

    const normalized = rawKanal.trim().toLowerCase();

    // Mod-log'u kapat
    if (['yok', 'kapat', 'kapalı'].includes(normalized)) {
      clearModLogChannel(guild.id);
      logger.info(`[MOD-LOG] ${guild.name} icin mod-log ayari kapatildi (${interaction.user.tag}).`);
      await interaction.reply({
        content: '✅ Moderasyon logları kapatıldı.',
        ephemeral: true,
      });
      return;
    }

    // Kanal secildi -> ayarla
    const channel = parseChannelInput(interaction, rawKanal);
    if (!channel || !channel.isTextBased() || channel.isThread()) {
      await interaction.reply({
        content: '❌ Geçerli bir metin kanalı belirtilmedi.',
        ephemeral: true,
      });
      return;
    }

    const result = setModLogChannel(guild, channel);
    if (!result.ok) {
      await interaction.reply({ content: result.message, ephemeral: true });
      return;
    }

    logger.info(
      `[MOD-LOG] ${guild.name} icin mod-log kanali ayarlandi: #${channel.name} (${channel.id})`
    );

    const embed = new EmbedBuilder()
      .setColor(0x57f287)
      .setTitle('✅ Moderasyon log kanalı ayarlandı.')
      .setDescription(`📋 Kanal: ${channel.toString()}`)
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
