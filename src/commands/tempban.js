const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getTargetError } = require('../utils/moderationPermissions');
const { sendModLog } = require('../utils/modLog');
const { buildTempbanLogEmbed } = require('../utils/modLogEmbeds');
const { addTempban, removeTempban } = require('../utils/tempbanScheduler');
const { logModAction } = require('../utils/modStats');
const { logAudit } = require('../utils/auditLog');
const { sendDM } = require('../utils/dmNotifier');
const logger = require('../utils/logger');

const MAX_MINUTES = 40320; // 28 gun

// Kullaniciyi belirli sure sonra otomatik kalkacak sekilde banlar (Owner / Yonetici)
module.exports = {
  data: new SlashCommandBuilder()
    .setName('tempban')
    .setDescription('Belirli süre sonra otomatik kalkacak şekilde kullanıcıyı yasaklar.')
    .addUserOption((option) =>
      option.setName('kullanici').setDescription('Tempbanlanacak kullanıcı').setRequired(true)
    )
    .addIntegerOption((option) =>
      option
        .setName('sure')
        .setDescription('Süre (dakika, en fazla 40320 = 28 gün)')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(MAX_MINUTES)
    )
    .addStringOption((option) =>
      option.setName('sebep').setDescription('Ban sebebi').setRequired(false)
    ),
  moderationAction: 'tempban',

  async execute(interaction) {
    const targetUser = interaction.options.getUser('kullanici');
    const minutes = interaction.options.getInteger('sure');
    const reason = interaction.options.getString('sebep') || 'Sebep belirtilmedi';

    const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
    const targetError = getTargetError(interaction, targetMember, 'tempban');
    if (targetError) {
      await interaction.reply({ content: targetError, ephemeral: true });
      return;
    }

    const botMember = interaction.guild.members.me;
    if (!botMember || !botMember.permissions.has(PermissionFlagsBits.BanMembers)) {
      await interaction.reply({
        content: '❌ Botun ban uygulamak için gerekli yetkisi yok.',
        ephemeral: true,
      });
      return;
    }

    const expiresAt = Date.now() + minutes * 60_000;

    try {
      await targetMember.ban({ reason: `${reason} (tempban: ${minutes} dk)` });
      addTempban(interaction.guild.id, targetUser.id, {
        reason,
        moderatorId: interaction.user.id,
        expiresAt,
      });

      logger.info(
        `[MODERATION] ${interaction.user.tag} tempban uyguladi: ${targetUser.tag} | Sure: ${minutes}dk | Sebep: ${reason}`
      );
      await interaction.reply({
        content: `✅ ${targetUser.tag} kullanıcısı ${minutes} dakikalığına yasaklandı.`,
        ephemeral: true,
      });

      await sendDM(targetUser, {
        title: '🔨 Geçici Yasaklandınız',
        description: `${interaction.guild.name} sunucusundan ${minutes} dakikalığına yasaklandınız.`,
        color: 0xed4245,
        fields: [
          { name: '👮 Yetkili', value: interaction.user.tag, inline: true },
          { name: '📝 Sebep', value: reason, inline: false },
        ],
      });

      logModAction(interaction.guild.id, interaction.user.id, 'ban', targetUser.id);
      logAudit({
        guildId: interaction.guild.id,
        action: 'tempban',
        moderatorId: interaction.user.id,
        targetId: targetUser.id,
        reason,
        details: { sure: `${minutes} dakika` },
      });

      const modLogEmbed = buildTempbanLogEmbed({
        user: targetUser,
        moderatorTag: interaction.user.tag,
        reason,
        duration: `${minutes} dakika`,
      });
      await sendModLog(interaction.guild, modLogEmbed);
    } catch (error) {
      logger.error(`[MODERATION] Tempban islemi basarisiz (${targetUser.tag}):`, error);
      await interaction.reply({ content: '❌ Tempban işlemi gerçekleştirilemedi.', ephemeral: true });
    }
  },
};
