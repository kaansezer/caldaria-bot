const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { sendModLog } = require('../utils/modLog');
const { buildUnlockLogEmbed } = require('../utils/modLogEmbeds');
const { logModAction } = require('../utils/modStats');
const { logAudit } = require('../utils/auditLog');
const logger = require('../utils/logger');

// Kilitli kanalin kilidini acar: @everyone icin SendMessages yasagi kaldirilir (Owner / Yonetici)
module.exports = {
  data: new SlashCommandBuilder()
    .setName('unlock')
    .setDescription('Kilitli kanalın kilidini açar.'),
  moderationAction: 'unlock',

  async execute(interaction) {
    const channel = interaction.channel;

    const botMember = interaction.guild.members.me;
    if (
      !botMember ||
      !botMember.permissionsIn(channel).has(PermissionFlagsBits.ManageChannels)
    ) {
      await interaction.reply({
        content: '❌ Botun bu kanalın kilidini açmak için gerekli yetkisi yok.',
        ephemeral: true,
      });
      return;
    }

    const everyoneRole = interaction.guild.roles.everyone;
    const overwrite = channel.permissionOverwrites.cache.get(everyoneRole.id);

    // Kanal zaten aciksa islem yapma.
    if (!overwrite || !overwrite.deny.has(PermissionFlagsBits.SendMessages)) {
      await interaction.reply({ content: 'ℹ️ Bu kanal zaten açık.', ephemeral: true });
      return;
    }

    try {
      await channel.permissionOverwrites.edit(
        everyoneRole.id,
        { SendMessages: null },
        { reason: `${interaction.user.tag} tarafından kilidi açıldı` }
      );

      logger.info(
        `[MODERATION] ${interaction.user.tag} kanalin kilidini acti: #${channel.name}`
      );
      await interaction.reply({ content: '🔓 Bu kanalın kilidi açıldı.', ephemeral: true });

      logModAction(interaction.guild.id, interaction.user.id, 'unlock', channel.id);
      logAudit({
        guildId: interaction.guild.id,
        action: 'unlock',
        moderatorId: interaction.user.id,
        targetId: channel.id,
        details: { kanal: `#${channel.name}` },
      });

      const modLogEmbed = buildUnlockLogEmbed({
        channelName: `#${channel.name}`,
        moderatorTag: interaction.user.tag,
      });
      await sendModLog(interaction.guild, modLogEmbed);
    } catch (error) {
      logger.error(`[MODERATION] Kanal kilidi acilamadi (#${channel.name}):`, error);
      await interaction.reply({ content: '❌ Kanalın kilidi açılamadı.', ephemeral: true });
    }
  },
};
