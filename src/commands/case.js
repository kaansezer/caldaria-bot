const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getAuditCase } = require('../utils/auditLog');
const { formatDate } = require('../utils/format');

// Belirli bir case numarasinin detaylarini gosterir (Owner / Yonetici)
module.exports = {
  data: new SlashCommandBuilder()
    .setName('case')
    .setDescription('Belirtilen case (işlem kaydı) numarasının detaylarını gösterir.')
    .addIntegerOption((option) =>
      option.setName('id').setDescription('Görüntülenecek case numarası').setRequired(true)
    ),
  moderationAction: 'modstats',

  async execute(interaction) {
    const caseNumber = interaction.options.getInteger('id');
    const record = getAuditCase(interaction.guild.id, caseNumber);

    if (!record) {
      await interaction.reply({
        content: `❌ Bu sunucuda \`#${caseNumber}\` numaralı bir kayıt bulunamadı.`,
        ephemeral: true,
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`📁 Case #${record.caseNumber}`)
      .addFields(
        { name: '🎯 İşlem', value: record.action, inline: true },
        { name: '🆔 Hedef', value: record.targetId ? `<@${record.targetId}>` : '—', inline: true },
        { name: '👮 Yetkili', value: record.moderatorId ? `<@${record.moderatorId}>` : 'Otomatik', inline: true },
        { name: '📝 Sebep', value: record.reason || 'Sebep belirtilmedi', inline: false },
        { name: '📅 Tarih', value: formatDate(record.createdAt), inline: true }
      )
      .setTimestamp();

    if (record.details) {
      embed.addFields({
        name: '📋 Detaylar',
        value: Object.entries(record.details)
          .map(([key, val]) => `**${key}:** ${val}`)
          .join('\n') || '—',
        inline: false,
      });
    }

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
