const { SlashCommandBuilder } = require('discord.js');
const { chat, splitResponse, sendAsMessages, getChannelContextKey } = require('../../services/geminiService');

// Talep uzerine AI'ya soru sorar. Baglam: sunucu + kanal + kullanici bazinda tutulur.
module.exports = {
  data: new SlashCommandBuilder()
    .setName('chat')
    .setDescription('Yapay zekaya bir soru sorar.')
    .addStringOption((option) =>
      option.setName('prompt').setDescription('Sorunuz veya mesajınız').setRequired(true)
    ),

  async execute(interaction) {
    const prompt = interaction.options.getString('prompt');
    const channelId = getChannelContextKey(interaction.channel);

    await interaction.deferReply({ ephemeral: false });

    const result = await chat({
      guildId: interaction.guild.id,
      userId: interaction.user.id,
      channelId,
      prompt,
    });

    if (!result.ok) {
      await interaction.editReply({
        content: `⚠️ Yanıt alınamadı: ${result.errorMessage}`,
      });
      return;
    }

    const parts = splitResponse(result.text);
    await sendAsMessages(interaction, parts);
  },
};