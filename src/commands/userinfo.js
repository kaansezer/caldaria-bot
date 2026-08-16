const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getWarningsHistory, getActiveWarningCount } = require('../utils/warnManager');
const { formatDate } = require('../utils/format');

const MAX_ROLES_DISPLAYED = 10;
const MAX_ROLE_TEXT_LENGTH = 1000;

function formatRoles(member) {
  if (!member) return 'Sunucuda değil';

  const roles = member.roles.cache
    .filter((role) => role.id !== member.guild.roles.everyone.id)
    .sort((a, b) => b.position - a.position);

  if (roles.size === 0) return 'Rol yok';

  const names = roles.map((role) => role.toString());
  const shown = names.slice(0, MAX_ROLES_DISPLAYED);

  let text = shown.join(' ');
  if (names.length > MAX_ROLES_DISPLAYED) {
    text += `\n… +${names.length - MAX_ROLES_DISPLAYED} rol daha`;
  }
  return text.slice(0, MAX_ROLE_TEXT_LENGTH);
}

// Kullanicinin bilgilerini ve warn durumunu gosterir (herkes kullanabilir)
module.exports = {
  data: new SlashCommandBuilder()
    .setName('userinfo')
    .setDescription('Bir kullanıcının bilgilerini ve warn durumunu gösterir.')
    .addUserOption((option) =>
      option.setName('kullanici').setDescription('Bilgisi görülecek kullanıcı').setRequired(true)
    ),

  async execute(interaction) {
    const targetUser = interaction.options.getUser('kullanici');
    const guild = interaction.guild;

    const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);

    const history = getWarningsHistory(guild.id, targetUser.id);
    const activeWarns = getActiveWarningCount(guild.id, targetUser.id);
    const removedWarns = history.filter((warning) => warning.deletedAt).length;

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('👤 Kullanıcı Bilgileri')
      .setThumbnail(targetUser.displayAvatarURL({ size: 256 }))
      .addFields(
        { name: '👤 Kullanıcı', value: targetUser.tag, inline: false },
        { name: '🆔 Kullanıcı ID', value: targetUser.id, inline: true },
        { name: '🤖 Bot mu?', value: targetUser.bot ? 'Evet' : 'Hayır', inline: true },
        {
          name: '📅 Discord hesabı oluşturulma',
          value: formatDate(targetUser.createdAt.getTime()),
          inline: false,
        },
        {
          name: '📅 Sunucuya katılma',
          value: targetMember ? formatDate(targetMember.joinedAt.getTime()) : 'Sunucuda değil',
          inline: false,
        },
        { name: '🏷️ Roller', value: formatRoles(targetMember), inline: false },
        { name: '⚠️ Aktif Warn', value: String(activeWarns), inline: true },
        { name: '🗑️ Kaldırılmış Warn', value: String(removedWarns), inline: true }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
