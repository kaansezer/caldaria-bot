const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { sendModLog } = require('../utils/modLog');
const { buildLockLogEmbed } = require('../utils/modLogEmbeds');
const { logModAction } = require('../utils/modStats');
const { logAudit } = require('../utils/auditLog');
const logger = require('../utils/logger');

// Komutun kullanildigi kanali kilitler: @everyone icin SendMessages kapatilir (Owner / Yonetici)
module.exports = {
  data: new SlashCommandBuilder()
    .setName('lock')
    .setDescription('Bu kanalı kilitler (normal üyeler mesaj gönderemez).'),
  moderationAction: 'lock',

  async execute(interaction) {
    const channel = interaction.channel;

    const botMember = interaction.guild.members.me;
    if (
      !botMember ||
      !botMember.permissionsIn(channel).has(PermissionFlagsBits.ManageChannels)
    ) {
      await interaction.reply({
        content: '❌ Botun bu kanalı kilitlemek için gerekli yetkisi yok.',
        ephemeral: true,
      });
      return;
    }

    const everyoneRole = interaction.guild.roles.everyone;
    const overwrite = channel.permissionOverwrites.cache.get(everyoneRole.id);

    // Kanal zaten kilitliyse tekrar islem yapma.
    if (overwrite && overwrite.deny.has(PermissionFlagsBits.SendMessages)) {
      await interaction.reply({ content: 'ℹ️ Bu kanal zaten kilitli.', ephemeral: true });
      return;
    }

    try {
      await channel.permissionOverwrites.edit(
        everyoneRole.id,
        { SendMessages: false },
        { reason: `${interaction.user.tag} tarafından kilitlendi` }
      );

      logger.info(
        `[MODERATION] ${interaction.user.tag} kanali kilitledi: #${channel.name}`
      );
      await interaction.reply({ content: '🔒 Bu kanal kilitlendi.', ephemeral: true });

      logModAction(interaction.guild.id, interaction.user.id, 'lock', channel.id);
      logAudit({
        guildId: interaction.guild.id,
        action: 'lock',
        moderatorId: interaction.user.id,
        targetId: channel.id,
        details: { kanal: `#${channel.name}` },
      });

      const modLogEmbed = buildLockLogEmbed({
        channelName: `#${channel.name}`,
        moderatorTag: interaction.user.tag,
      });
      await sendModLog(interaction.guild, modLogEmbed);
    } catch (error) {
      logger.error(`[MODERATION] Kanal kilitlenemedi (#${channel.name}):`, error);
      await interaction.reply({ content: '❌ Kanal kilitlenemedi.', ephemeral: true });
    }
  },
};
