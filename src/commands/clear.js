const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { sendModLog } = require('../utils/modLog');
const { buildClearLogEmbed } = require('../utils/modLogEmbeds');
const { logModAction } = require('../utils/modStats');
const { logAudit } = require('../utils/auditLog');
const logger = require('../utils/logger');

// Kanaldan belirli sayida mesaj siler (Owner / Yonetici)
module.exports = {
  data: new SlashCommandBuilder()
    .setName('clear')
    .setDescription('Kanaldan belirli sayıda mesajı siler.')
    .addIntegerOption((option) =>
      option
        .setName('miktar')
        .setDescription('Silinecek mesaj sayısı (1-100)')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(100)
    ),
  moderationAction: 'clear',

  async execute(interaction) {
    const amount = interaction.options.getInteger('miktar');

    const botMember = interaction.guild.members.me;
    if (!botMember || !botMember.permissions.has(PermissionFlagsBits.ManageMessages)) {
      await interaction.reply({
        content: '❌ Botun mesajları silmek için gerekli yetkisi yok.',
        ephemeral: true,
      });
      return;
    }

    try {
      const deleted = await interaction.channel.bulkDelete(Math.min(amount, 100), true);
      logger.info(
        `[MODERATION] ${interaction.user.tag} ${interaction.channel.name} kanalinda ${deleted.size} mesaj sildi.`
      );
      await interaction.reply({ content: `✅ ${deleted.size} mesaj silindi.`, ephemeral: true });

      logModAction(interaction.guild.id, interaction.user.id, 'clear', interaction.channel.id);
      logAudit({
        guildId: interaction.guild.id,
        action: 'clear',
        moderatorId: interaction.user.id,
        targetId: interaction.channel.id,
        details: { adet: deleted.size, kanal: `#${interaction.channel.name}` },
      });

      const modLogEmbed = buildClearLogEmbed({
        moderatorTag: interaction.user.tag,
        channelName: `#${interaction.channel.name}`,
        count: deleted.size,
      });
      await sendModLog(interaction.guild, modLogEmbed);
    } catch (error) {
      logger.error('[MODERATION] Mesajlar silinemedi:', error);
      await interaction.reply({ content: '❌ Mesajlar silinemedi.', ephemeral: true });
    }
  },
};
