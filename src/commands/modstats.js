const { SlashCommandBuilder } = require('discord.js');
const { getModStats } = require('../utils/modStats');
const { buildModStatsLogEmbed } = require('../utils/modLogEmbeds');

// Bir moderatorun yaptigi islemlerin istatistiklerini gosterir (Owner / Yonetici)
module.exports = {
  data: new SlashCommandBuilder()
    .setName('modstats')
    .setDescription('Bir moderatörün yaptığı işlemlerin istatistiklerini gösterir.')
    .addUserOption((option) =>
      option
        .setName('kullanici')
        .setDescription('İstatistikleri görülecek moderatör (boş = kendiniz)')
        .setRequired(false)
    ),
  moderationAction: 'modstats',

  async execute(interaction) {
    const targetUser = interaction.options.getUser('kullanici') || interaction.user;
    const counts = getModStats(interaction.guild.id, targetUser.id);

    const embed = buildModStatsLogEmbed({
      moderatorTag: targetUser.tag,
      counts,
    });

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
