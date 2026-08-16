const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
} = require('discord.js');
const {
  addTrackedChannel,
  removeTrackedChannel,
  getTrackedChannels,
} = require('../../services/youtubeNotifier');
const logger = require('../../utils/logger');

const CHANNEL_ID_REGEX = /^UC[\w-]{22}$/;

// YouTube kanal bildirimlerini yonetir (Owner / Yonetici)
module.exports = {
  data: new SlashCommandBuilder()
    .setName('youtube')
    .setDescription('YouTube kanal bildirimlerini yönetir.')
    .addSubcommand((sub) =>
      sub
        .setName('add')
        .setDescription('Bir YouTube kanalını bu sunucuya ekler.')
        .addStringOption((option) =>
          option
            .setName('creators')
            .setDescription('YouTube kanal ID (ör. UCxxxxx...)')
            .setRequired(true)
        )
        .addChannelOption((option) =>
          option
            .setName('discord_channel')
            .setDescription('Yeni videoların duyurulacağı kanal')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
        .addRoleOption((option) =>
          option
            .setName('role')
            .setDescription('Videoda pinglenmesi gereken rol (opsiyonel)')
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('remove')
        .setDescription('Bir YouTube kanalını takipten çıkarır.')
        .addStringOption((option) =>
          option.setName('creators').setDescription('Çıkarılacak YouTube kanal ID').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub.setName('list').setDescription('Bu sunucudaki YouTube takipleri listeler.')
    ),

  async execute(interaction) {
    if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) {
      await interaction.reply({
        content: '❌ Bu komutu kullanmak için **Sunucuyu Yönet** yetkisine sahip olmalısın.',
        ephemeral: true,
      });
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'add') {
      const youtubeChannelId = interaction.options.getString('creators').trim();
      const channel = interaction.options.getChannel('discord_channel');
      const role = interaction.options.getRole('role');

      if (!CHANNEL_ID_REGEX.test(youtubeChannelId)) {
        await interaction.reply({
          content: '❌ Geçerli bir YouTube kanal ID girin (örn. UCxxxxxxxxxxxxxxxxxxxxxxxxxx).',
          ephemeral: true,
        });
        return;
      }

      addTrackedChannel({
        guildId: interaction.guild.id,
        youtubeChannelId,
        discordChannelId: channel.id,
        pingRoleId: role ? role.id : null,
      });

      logger.info(
        `[YOUTUBE] ${interaction.guild.name}: ${youtubeChannelId} takip ediliyor (#${channel.name}).`
      );
      await interaction.reply({
        content:
          `✅ YouTube kanalı eklendi.\n` +
          `• Kanal: \`${youtubeChannelId}\`\n` +
          `• Duyuru: ${channel}\n` +
          (role ? `• Ping: ${role}\n` : '') +
          `Yeni videoları 5 dakikada bir kontrol edilecek.`,
        ephemeral: true,
      });
      return;
    }

    if (subcommand === 'remove') {
      const youtubeChannelId = interaction.options.getString('creators').trim();
      const removed = removeTrackedChannel(interaction.guild.id, youtubeChannelId);

      if (removed === 0) {
        await interaction.reply({
          content: `ℹ️ ${youtubeChannelId} takipte değil.`,
          ephemeral: true,
        });
        return;
      }

      logger.info(`[YOUTUBE] ${interaction.guild.name}: ${youtubeChannelId} takipten cikarildi.`);
      await interaction.reply({
        content: '✅ YouTube kanalı takipten çıkarıldı.',
        ephemeral: true,
      });
      return;
    }

    // list
    const records = getTrackedChannels().filter((r) => r.guild_id === interaction.guild.id);
    if (records.length === 0) {
      await interaction.reply({
        content: 'ℹ️ Bu sunucuda takip edilen YouTube kanalı yok.',
        ephemeral: true,
      });
      return;
    }

    const lines = records.map(
      (r) =>
        `• \`${r.youtube_channel_id}\` → <#${r.discord_channel_id}>` +
        (r.ping_role_id ? ` (ping: <@&${r.ping_role_id}>)` : '')
    );
    await interaction.reply({
      content: `📺 **Takip edilen YouTube kanalları:**\n${lines.join('\n')}`,
      ephemeral: true,
    });
  },
};