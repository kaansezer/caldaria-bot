const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
} = require('discord.js');
const { savePanel, resolveSupportRole } = require('../../services/ticketManager');
const logger = require('../../utils/logger');

// Destek paneli mesajini ayarlanan kanala gonderir (Owner / Yonetici).
module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket-setup')
    .setDescription('Destek talebi (ticket) panelini ayarlar.')
    .addChannelOption((option) =>
      option
        .setName('channel')
        .setDescription('Panelin gönderileceği kanal')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    )
    .addChannelOption((option) =>
      option
        .setName('category')
        .setDescription('Ticket kanallarının açılacağı kategori (opsiyonel)')
        .addChannelTypes(ChannelType.GuildCategory)
        .setRequired(false)
    )
    .addRoleOption((option) =>
      option
        .setName('role')
        .setDescription('Ticketları görebilecek destek rolü (opsiyonel)')
        .setRequired(false)
    )
    .addStringOption((option) =>
      option
        .setName('title')
        .setDescription('Panel embed açıklaması (opsiyonel)')
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
    const category = interaction.options.getChannel('category') || null;
    const role = interaction.options.getRole('role') || null;
    const title = interaction.options.getString('title') || null;

    const botMember = interaction.guild.members.me;
    if (
      !botMember ||
      !botMember.permissionsIn(channel).has(
        [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks],
        true
      )
    ) {
      await interaction.reply({
        content: '❌ Botun belirtilen kanala mesaj gönderebilmek için gerekli izinleri yok.',
        ephemeral: true,
      });
      return;
    }

    try {
      await savePanel(interaction.guild, { channel, category, title, supportRole: role });

      logger.info(
        `[TICKET] ${interaction.guild.name}: panel ayarlandi (kanal: #${channel.name}, rolu: ${role?.name || 'yok'}).`
      );
      await interaction.reply({
        content: `✅ Destek paneli ${channel} kanalına gönderildi.`,
        ephemeral: true,
      });
    } catch (error) {
      logger.error('[TICKET] Panel gönderilemedi:', error);
      await interaction.reply({
        content: '❌ Panel gönderilemedi. Lütfen botun kanala erişimini kontrol edin.',
        ephemeral: true,
      });
    }
  },
};