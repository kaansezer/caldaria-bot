const { SlashCommandBuilder } = require('discord.js');
const { getTargetError } = require('../utils/moderationPermissions');
const { sendModLog } = require('../utils/modLog');
const { buildBanLogEmbed } = require('../utils/modLogEmbeds');
const { logModAction } = require('../utils/modStats');
const { logAudit } = require('../utils/auditLog');
const { sendDM } = require('../utils/dmNotifier');
const logger = require('../utils/logger');

// Kullaniciyi sunucudan kalici olarak yasaklar (Owner / Yonetici)
module.exports = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Bir kullanıcıyı sunucudan yasaklar.')
    .addUserOption((option) =>
      option.setName('kullanici').setDescription('Banlanacak kullanıcı').setRequired(true)
    )
    .addStringOption((option) =>
      option.setName('sebep').setDescription('Ban sebebi').setRequired(false)
    ),
  moderationAction: 'ban',

  async execute(interaction) {
    const targetUser = interaction.options.getUser('kullanici');
    const reason = interaction.options.getString('sebep') || 'Sebep belirtilmedi';

    const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
    const targetError = getTargetError(interaction, targetMember, 'ban');
    if (targetError) {
      await interaction.reply({ content: targetError, ephemeral: true });
      return;
    }

    try {
      await targetMember.ban({ reason });
      logger.info(
        `[MODERATION] ${interaction.user.tag} kullaniciyi banladi: ${targetUser.tag} | Sebep: ${reason}`
      );
      await interaction.reply({
        content: `✅ ${targetUser.tag} sunucudan yasaklandı.`,
        ephemeral: true,
      });

      await sendDM(targetUser, {
        title: '🔨 Sunucudan Yasaklandınız',
        description: `${interaction.guild.name} sunucusundan yasaklandınız.`,
        color: 0xed4245,
        fields: [
          { name: '👮 Yetkili', value: interaction.user.tag, inline: true },
          { name: '📝 Sebep', value: reason, inline: false },
        ],
      });

      logModAction(interaction.guild.id, interaction.user.id, 'ban', targetUser.id);
      logAudit({
        guildId: interaction.guild.id,
        action: 'ban',
        moderatorId: interaction.user.id,
        targetId: targetUser.id,
        reason,
      });

      const modLogEmbed = buildBanLogEmbed({
        user: targetUser,
        moderatorTag: interaction.user.tag,
        reason,
      });
      await sendModLog(interaction.guild, modLogEmbed);
    } catch (error) {
      logger.error(`[MODERATION] Ban islemi basarisiz (${targetUser.tag}):`, error);
      await interaction.reply({ content: '❌ Ban işlemi gerçekleştirilemedi.', ephemeral: true });
    }
  },
};
