const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
} = require('discord.js');
const {
  saveWelcomeSettings,
  DEFAULT_WELCOME_MESSAGE,
} = require('../../events/guildMemberAdd');
const logger = require('../../utils/logger');

// Hos geldin kanali, auto-role ve mesaji yapilandirir (Owner / Yonetici).
module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup-welcome')
    .setDescription('Karşılama kanalı, otomatik rol ve mesajı ayarlar.')
    .addChannelOption((option) =>
      option
        .setName('channel')
        .setDescription('Hoş geldin mesajının gönderileceği kanal')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    )
    .addRoleOption((option) =>
      option
        .setName('role')
        .setDescription('Yeni üyelere otomatik verilecek rol')
        .setRequired(false)
    )
    .addStringOption((option) =>
      option
        .setName('message')
        .setDescription('Hoş geldin mesajı. Değişkenler: {user}, {guild}, {memberCount}')
        .setRequired(false)
        .setMaxLength(1500)
    ),

  async execute(interaction) {
    if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) {
      await interaction.reply({
        content: '❌ Bu komutu kullanmak için **Sunucuyu Yönet** yetkisine sahip olmalısın.',
        ephemeral: true,
      });
      return;
    }

    const channel = interaction.options.getChannel('channel');
    const role = interaction.options.getRole('role');
    const message = interaction.options.getString('message');

    const settings = saveWelcomeSettings({
      guildId: interaction.guild.id,
      welcomeChannelId: channel ? channel.id : null,
      autoroleId: role ? role.id : null,
      welcomeMessage: message,
    });

    logger.info(
      `[WELCOME] ${interaction.guild.name} ayarlari guncellendi (kanal: ${channel?.name || 'yok'}, rol: ${role?.name || 'yok'}).`
    );
    await interaction.reply({
      content:
        `✅ Hoş geldin ayarları güncellendi:\n` +
        `• Kanal: ${channel ? channel.toString() : 'Ayarlanmadı'}\n` +
        `• Auto-role: ${role ? role.toString() : 'Ayarlanmadı'}\n` +
        `• Mesaj: ${(settings.welcome_message || DEFAULT_WELCOME_MESSAGE).slice(0, 200)}\n\n` +
        `Kullanılabilir değişkenler: \`{user}\`, \`{guild}\`, \`{memberCount}\``,
      ephemeral: true,
    });
  },
};