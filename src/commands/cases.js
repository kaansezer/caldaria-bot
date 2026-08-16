const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getAuditCasesForUser, getRecentAuditCases } = require('../utils/auditLog');
const { formatDate } = require('../utils/format');

// Bir kullanicinin veya sunucunun islem kayitlarini listeler (Owner / Yonetici)
module.exports = {
  data: new SlashCommandBuilder()
    .setName('cases')
    .setDescription('Bir kullanıcının işlem kayıtlarını (case) listeler.')
    .addUserOption((option) =>
      option
        .setName('kullanici')
        .setDescription('Kayıtları görülecek kullanıcı (boş = son işlemler)')
        .setRequired(false)
    ),
  moderationAction: 'modstats',

  async execute(interaction) {
    const targetUser = interaction.options.getUser('kullanici');

    const records = targetUser
      ? getAuditCasesForUser(interaction.guild.id, targetUser.id)
      : getRecentAuditCases(interaction.guild.id);

    if (records.length === 0) {
      await interaction.reply({
        content: targetUser
          ? 'ℹ️ Bu kullanıcıya ait kayıt bulunamadı.'
          : 'ℹ️ Bu sunucuda henüz işlem kaydı bulunmuyor.',
        ephemeral: true,
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(targetUser ? `📁 ${targetUser.tag} - İşlem Kayıtları` : '📁 Son İşlem Kayıtları')
      .setDescription(
        records
          .map(
            (r) =>
              `**#${r.caseNumber}** | ${r.action} | <@${r.targetId || r.moderatorId || '?'}> | ${formatDate(r.createdAt)}`
          )
          .join('\n')
      )
      .setFooter({ text: `Son ${records.length} kayıt` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
