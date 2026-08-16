const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { t, getGuildLocale, setGuildLocale, translations } = require('../utils/i18n');

// Sunucu dilini ayarlar (Owner)
module.exports = {
  data: new SlashCommandBuilder()
    .setName('locale')
    .setDescription('Sunucu dilini ayarlar (TR/EN).')
    .addStringOption((option) =>
      option
        .setName('dil')
        .setDescription('tr veya en')
        .setRequired(false)
    ),
  moderationAction: 'modlog',

  async execute(interaction) {
    const guildId = interaction.guild.id;
    const locale = getGuildLocale(guildId);
    const dil = interaction.options.getString('dil');

    if (dil) {
      const normalized = dil.trim().toLowerCase();
      if (!translations[normalized]) {
        await interaction.reply({
          content: '❌ Geçersiz dil. Kullanılabilir: tr, en',
          ephemeral: true,
        });
        return;
      }
      setGuildLocale(guildId, normalized);
      await interaction.reply({
        content: `✅ Sunucu dili **${normalized}** olarak ayarlandı.`,
        ephemeral: true,
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('🌐 Sunucu Dili')
      .setDescription(`Mevcut dil: **${locale}**`)
      .setTimestamp();
    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
