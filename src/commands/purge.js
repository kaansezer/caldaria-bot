const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { sendModLog } = require('../utils/modLog');
const { buildClearLogEmbed } = require('../utils/modLogEmbeds');
const { logModAction } = require('../utils/modStats');
const { logAudit } = require('../utils/auditLog');
const logger = require('../utils/logger');

const MAX_PURGE_AMOUNT = 100; // Discord bulkDelete max
const MAX_DAYS_OLD = 14;

// Belirli bir kullanicinin kanaldaki mesajlarini siler (Owner / Yonetici)
module.exports = {
  data: new SlashCommandBuilder()
    .setName('purge')
    .setDescription('Belirtilen kullanıcının bu kanaldaki mesajlarını temizler (son 14 gün).')
    .addUserOption((option) =>
      option.setName('kullanici').setDescription('Mesajları silinecek kullanıcı').setRequired(true)
    ),
  moderationAction: 'clear',

  async execute(interaction) {
    const targetUser = interaction.options.getUser('kullanici');
    const channel = interaction.channel;

    const botMember = interaction.guild.members.me;
    if (!botMember || !botMember.permissionsIn(channel).has(PermissionFlagsBits.ManageMessages)) {
      await interaction.reply({
        content: '❌ Botun bu kanalda mesaj silmek için gerekli yetkisi yok.',
        ephemeral: true,
      });
      return;
    }

    try {
      const messages = await channel.messages.fetch({ limit: 100 });
      const userMessages = messages.filter(
        (m) => m.author.id === targetUser.id && (Date.now() - m.createdTimestamp) < MAX_DAYS_OLD * 24 * 60 * 60 * 1000
      );

      if (userMessages.size === 0) {
        await interaction.reply({
          content: 'ℹ️ Belirtilen kullanıcının son 14 gün içinde bu kanalda silinebilecek mesajı bulunamadı.',
          ephemeral: true,
        });
        return;
      }

      const deleted = await channel.bulkDelete(userMessages, true);
      const deletedCount = deleted.size || userMessages.size;

      logger.info(
        `[MODERATION] ${interaction.user.tag} kullanicinin (${targetUser.tag}) mesajlarini sildi: #${channel.name} (${deletedCount})`
      );
      await interaction.reply({
        content: `✅ ${targetUser.tag} kullanıcısına ait ${deletedCount} mesaj silindi.`,
        ephemeral: true,
      });

      logModAction(interaction.guild.id, interaction.user.id, 'clear', targetUser.id);
      logAudit({
        guildId: interaction.guild.id,
        action: 'purge',
        moderatorId: interaction.user.id,
        targetId: targetUser.id,
        details: { adet: deletedCount, kanal: `#${channel.name}` },
      });

      const modLogEmbed = buildClearLogEmbed({
        moderatorTag: interaction.user.tag,
        channelName: `#${channel.name}`,
        count: deletedCount,
      });
      await sendModLog(interaction.guild, modLogEmbed);
    } catch (error) {
      logger.error(`[MODERATION] Purge islemi basarisiz (${targetUser.tag}):`, error);
      await interaction.reply({ content: '❌ Mesajlar silinemedi.', ephemeral: true });
    }
  },
};
