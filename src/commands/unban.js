const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { sendModLog } = require('../utils/modLog');
const { buildUnbanLogEmbed } = require('../utils/modLogEmbeds');
const { logModAction } = require('../utils/modStats');
const { logAudit } = require('../utils/auditLog');
const { sendDM } = require('../utils/dmNotifier');
const logger = require('../utils/logger');

// Banli bir kullaniciyi sunucudan unbanlar (Owner / Yonetici)
module.exports = {
  data: new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Banlı bir kullanıcının banını kaldırır.')
    .addStringOption((option) =>
      option
        .setName('kullanici_id')
        .setDescription('Banı kaldırılacak kullanıcının ID numarası')
        .setRequired(true)
    ),
  moderationAction: 'unban',

  async execute(interaction) {
    const userId = interaction.options.getString('kullanici_id').trim();

    // Gecersiz ID kontrolu (Discord snowflake: 17-20 hane)
    if (!/^\d{17,20}$/.test(userId)) {
      await interaction.reply({ content: '❌ Geçersiz kullanıcı ID numarası.', ephemeral: true });
      return;
    }

    const botMember = interaction.guild.members.me;
    if (!botMember || !botMember.permissions.has(PermissionFlagsBits.BanMembers)) {
      await interaction.reply({
        content: '❌ Botun ban kaldırma yetkisi yok.',
        ephemeral: true,
      });
      return;
    }

    let ban;
    try {
      ban = await interaction.guild.bans.fetch(userId);
    } catch (error) {
      if (error.code === 10026 || error.code === 10025) {
        await interaction.reply({ content: 'ℹ️ Bu kullanıcı banlı değil.', ephemeral: true });
        return;
      }
      logger.error(`[MODERATION] Ban sorgusu basarisiz (${userId}):`, error);
      await interaction.reply({
        content: '❌ Ban bilgisi alınamadı. Lütfen tekrar deneyin.',
        ephemeral: true,
      });
      return;
    }

    try {
      await interaction.guild.members.unban(ban.user.id, `${interaction.user.tag} tarafından unbanlandı`);
      logger.info(
        `[MODERATION] ${interaction.user.tag} unban uyguladi: ${ban.user.tag} (${ban.user.id})`
      );
      await interaction.reply({ content: '✅ Kullanıcının banı kaldırıldı.', ephemeral: true });

      await sendDM(ban.user, {
        title: '🟢 Banınız Kaldırıldı',
        description: `${interaction.guild.name} sunucusunda banınız kaldırıldı.`,
        color: 0x57f287,
        fields: [{ name: '👮 Yetkili', value: interaction.user.tag, inline: true }],
      });

      logModAction(interaction.guild.id, interaction.user.id, 'unban', ban.user.id);
      logAudit({
        guildId: interaction.guild.id,
        action: 'unban',
        moderatorId: interaction.user.id,
        targetId: ban.user.id,
      });

      const modLogEmbed = buildUnbanLogEmbed({
        user: ban.user,
        moderatorTag: interaction.user.tag,
      });
      await sendModLog(interaction.guild, modLogEmbed);
    } catch (error) {
      logger.error(`[MODERATION] Unban islemi basarisiz (${userId}):`, error);
      await interaction.reply({ content: '❌ Ban kaldırılamadı.', ephemeral: true });
    }
  },
};
