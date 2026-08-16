const { SlashCommandBuilder, EmbedBuilder, ChannelType } = require('discord.js');
const { formatDate } = require('../utils/format');

// Sunucu hakkinda genel bilgileri gosterir (herkes kullanabilir)
module.exports = {
  data: new SlashCommandBuilder()
    .setName('serverinfo')
    .setDescription('Sunucu hakkında genel bilgileri gösterir.'),

  async execute(interaction) {
    const guild = interaction.guild;

    const textChannels = guild.channels.cache.filter(
      (channel) => channel.type === ChannelType.GuildText && !channel.isThread()
    ).size;
    const voiceChannels = guild.channels.cache.filter(
      (channel) => channel.type === ChannelType.GuildVoice
    ).size;
    const categories = guild.channels.cache.filter(
      (channel) => channel.type === ChannelType.GuildCategory
    ).size;
    const roles = guild.roles.cache.size - 1; // @everyone haric

    const members = guild.members.cache;
    const totalMembers = members.size;
    const botCount = members.filter((member) => member.user.bot).size;

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('🏰 CALDARIA SUNUCU BİLGİLERİ')
      .setThumbnail(guild.iconURL({ size: 256 }))
      .addFields(
        { name: '📛 Sunucu', value: guild.name, inline: false },
        { name: '🆔 Sunucu ID', value: guild.id, inline: true },
        { name: '👑 Owner', value: `<@${guild.ownerId}>`, inline: true },
        { name: '👥 Üyeler', value: String(totalMembers), inline: true },
        { name: '🤖 Botlar', value: String(botCount), inline: true },
        { name: '💬 Metin kanalları', value: String(textChannels), inline: true },
        { name: '🔊 Ses kanalları', value: String(voiceChannels), inline: true },
        { name: '📁 Kategoriler', value: String(categories), inline: true },
        { name: '🎭 Roller', value: String(roles), inline: true },
        { name: '🚀 Boost seviyesi', value: String(guild.premiumTier), inline: true },
        { name: '💎 Boost sayısı', value: String(guild.premiumSubscriptionCount || 0), inline: true },
        { name: '📅 Oluşturulma', value: formatDate(guild.createdAt.getTime()), inline: false }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
