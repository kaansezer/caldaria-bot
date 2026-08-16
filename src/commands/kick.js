const { SlashCommandBuilder } = require('discord.js');
const { getTargetError } = require('../utils/moderationPermissions');
const { sendModLog } = require('../utils/modLog');
const { buildKickLogEmbed } = require('../utils/modLogEmbeds');
const { logModAction } = require('../utils/modStats');
const { logAudit } = require('../utils/auditLog');
const { sendDM } = require('../utils/dmNotifier');
const logger = require('../utils/logger');

// Kullaniciyi sunucudan atar (Owner / Yonetici)
module.exports = {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Bir kullanıcıyı sunucudan atar.')
    .addUserOption((option) =>
      option.setName('kullanici').setDescription('Atılacak kullanıcı').setRequired(true)
    )
    .addStringOption((option) =>
      option.setName('sebep').setDescription('Atılma sebebi').setRequired(false)
    ),
  moderationAction: 'kick',

  async execute(interaction) {
    const targetUser = interaction.options.getUser('kullanici');
    const reason = interaction.options.getString('sebep') || 'Sebep belirtilmedi';

    const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
    const targetError = getTargetError(interaction, targetMember, 'kick');
    if (targetError) {
      await interaction.reply({ content: targetError, ephemeral: true });
      return;
    }

    try {
      await targetMember.kick(reason);
      logger.info(
        `[MODERATION] ${interaction.user.tag} kullaniciyi atdi: ${targetUser.tag} | Sebep: ${reason}`
      );
      await interaction.reply({
        content: `✅ ${targetUser.tag} sunucudan atıldı.`,
        ephemeral: true,
      });

      await sendDM(targetUser, {
        title: '👢 Sunucudan Atıldınız',
        description: `${interaction.guild.name} sunucusundan atıldınız.`,
        color: 0xfaa61a,
        fields: [
          { name: '👮 Yetkili', value: interaction.user.tag, inline: true },
          { name: '📝 Sebep', value: reason, inline: false },
        ],
      });

      logModAction(interaction.guild.id, interaction.user.id, 'kick', targetUser.id);
      logAudit({
        guildId: interaction.guild.id,
        action: 'kick',
        moderatorId: interaction.user.id,
        targetId: targetUser.id,
        reason,
      });

      const modLogEmbed = buildKickLogEmbed({
        user: targetUser,
        moderatorTag: interaction.user.tag,
        reason,
      });
      await sendModLog(interaction.guild, modLogEmbed);
    } catch (error) {
      logger.error(`[MODERATION] Kick islemi basarisiz (${targetUser.tag}):`, error);
      await interaction.reply({ content: '❌ Atma işlemi gerçekleştirilemedi.', ephemeral: true });
    }
  },
};
