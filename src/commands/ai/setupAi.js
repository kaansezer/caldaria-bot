const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
} = require('discord.js');
const {
  saveGuildSettings,
  setEnabled,
  getGuildSettings,
  DEFAULT_SYSTEM_PROMPT,
} = require('../../services/geminiService');
const logger = require('../../utils/logger');

// AI kanalini baglar, sistem promptunu ayarlar veya AI'yi kapatir (Owner / Yonetici).
module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup-ai')
    .setDescription('Yapay zeka sohbet kanalini ve sistem promptunu ayarlar.')
    .addChannelOption((option) =>
      option
        .setName('channel')
        .setDescription('AI sohbetleri icin kullanilacak kanal (bos = bagimsiz /chat)')
        .addChannelTypes(ChannelType.GuildText, ChannelType.PublicThread)
        .setRequired(false)
    )
    .addStringOption((option) =>
      option
        .setName('prompt')
        .setDescription('Sistem promptu (AI karakteri/hayati)')
        .setRequired(false)
        .setMaxLength(2000)
    )
    .addStringOption((option) =>
      option
        .setName('durum')
        .setDescription('AI sistemini ac/kapat')
        .setRequired(false)
        .addChoices(
          { name: 'Ac', value: 'ac' },
          { name: 'Kapat', value: 'kapat' }
        )
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
    const prompt = interaction.options.getString('prompt');
    const durum = interaction.options.getString('durum');

    // Kapatma islemi once ele alinir.
    if (durum === 'kapat') {
      setEnabled(interaction.guild.id, false);
      logger.info(`[AI] ${interaction.guild.name} icin AI sistemi kapatildi (${interaction.user.tag}).`);
      await interaction.reply({ content: '✅ AI sistemi kapatıldı.', ephemeral: true });
      return;
    }
    if (durum === 'ac') {
      setEnabled(interaction.guild.id, true);
      logger.info(`[AI] ${interaction.guild.name} icin AI sistemi acildi (${interaction.user.tag}).`);
      await interaction.reply({ content: '✅ AI sistemi açıldı.', ephemeral: true });
      return;
    }

    // Hiçbir parametre verilmedi -> durum goster.
    if (!channel && !prompt) {
      const settings = getGuildSettings(interaction.guild.id);
      const desc = settings
        ? `**Durum:** ${settings.is_enabled ? '🟢 Açık' : '🔴 Kapalı'}\n` +
          `**Kanal:** ${settings.chat_channel_id ? `<#${settings.chat_channel_id}>` : 'Ayarlanmadı (sadece /chat)'}\n` +
          `**Prompt:** ${(settings.system_prompt || DEFAULT_SYSTEM_PROMPT).slice(0, 200)}`
        : 'AI henüz yapılandırılmamış. `/setup-ai channel:#kanal prompt:...` ile başlayın.';
      await interaction.reply({ content: `🤖 **AI Sohbet Ayarları**\n${desc}`, ephemeral: true });
      return;
    }

    saveGuildSettings(interaction.guild.id, {
      chatChannelId: channel ? channel.id : null,
      systemPrompt: prompt ?? null,
    });

    logger.info(
      `[AI] ${interaction.guild.name} kanal ayarlandi: #${channel?.name || 'yok'} (${interaction.user.tag}).`
    );
    await interaction.reply({
      content:
        `✅ AI kanalı **${channel ? channel.toString() : 'kaldırıldı'}** olarak güncellendi.\n` +
        `Durum: ` +
        (channel
          ? `AI ile sohbet bu kanala yazılacak.`
          : `Yalnızca /chat ile kullanılabilir.`),
      ephemeral: true,
    });
  },
};