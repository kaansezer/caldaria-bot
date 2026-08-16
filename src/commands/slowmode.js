const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { sendModLog } = require('../utils/modLog');
const { buildSlowmodeLogEmbed } = require('../utils/modLogEmbeds');
const { logModAction } = require('../utils/modStats');
const { logAudit } = require('../utils/auditLog');
const logger = require('../utils/logger');

const MAX_SLOWMODE_SECONDS = 21600; // Discord azami 6 saat

// Kanalin slowmode suresini ayarlar (0 = kapali) (Owner / Yonetici)
module.exports = {
  data: new SlashCommandBuilder()
    .setName('slowmode')
    .setDescription('Bu kanalın yavaş mod süresini ayarlar (0 = kapatır).')
    .addIntegerOption((option) =>
      option
        .setName('sure')
        .setDescription('Süre (saniye, 0 = kapalı)')
        .setRequired(true)
        .setMinValue(0)
        .setMaxValue(MAX_SLOWMODE_SECONDS)
    ),
  moderationAction: 'slowmode',

  async execute(interaction) {
    const seconds = interaction.options.getInteger('sure');
    const channel = interaction.channel;

    const botMember = interaction.guild.members.me;
    if (
      !botMember ||
      !botMember.permissionsIn(channel).has(PermissionFlagsBits.ManageChannels)
    ) {
      await interaction.reply({
        content: '❌ Botun slowmode ayarlamak için gerekli yetkisi yok.',
        ephemeral: true,
      });
      return;
    }

    try {
      await channel.setRateLimitPerUser(seconds, `${interaction.user.tag} tarafından ayarlandı`);

      const message =
        seconds === 0
          ? '🐢 Slowmode kapatıldı.'
          : `🐢 Slowmode ${seconds} saniye olarak ayarlandı.`;

      logger.info(
        `[MODERATION] ${interaction.user.tag} slowmode ayarladi: #${channel.name} (${seconds}s)`
      );
      await interaction.reply({ content: message, ephemeral: true });

      logModAction(interaction.guild.id, interaction.user.id, 'slowmode', channel.id);
      logAudit({
        guildId: interaction.guild.id,
        action: 'slowmode',
        moderatorId: interaction.user.id,
        targetId: channel.id,
        details: { sure: `${seconds} saniye`, kanal: `#${channel.name}` },
      });

      const modLogEmbed = buildSlowmodeLogEmbed({
        channelName: `#${channel.name}`,
        seconds,
        moderatorTag: interaction.user.tag,
      });
      await sendModLog(interaction.guild, modLogEmbed);
    } catch (error) {
      logger.error(`[MODERATION] Slowmode ayarlanamadi (#${channel.name}):`, error);
      await interaction.reply({ content: '❌ Slowmode ayarlanamadı.', ephemeral: true });
    }
  },
};
