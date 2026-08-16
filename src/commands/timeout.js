const { SlashCommandBuilder } = require('discord.js');
const { getTargetError } = require('../utils/moderationPermissions');
const { setTimeoutState, clearTimeoutState } = require('../utils/timeoutManager');
const { cancelPermanentReapply } = require('../utils/permanentTimeout');
const { sendModLog } = require('../utils/modLog');
const { buildTimeoutLogEmbed } = require('../utils/modLogEmbeds');
const { logModAction } = require('../utils/modStats');
const { logAudit } = require('../utils/auditLog');
const { sendDM } = require('../utils/dmNotifier');
const logger = require('../utils/logger');

const MAX_TIMEOUT_MINUTES = 40320; // 28 gun

// Kullaniciya manuel timeout uygular veya kaldirir (Owner / Yonetici).
// Kaynak 'manual' olarak isaretlenir; warn sistemi bu timeout'a dokunmaz.
module.exports = {
  data: new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('Bir kullanıcıya geçici konuşma kısıtlaması uygular (0 = kaldır).')
    .addUserOption((option) =>
      option.setName('kullanici').setDescription('Kısıtlanacak kullanıcı').setRequired(true)
    )
    .addIntegerOption((option) =>
      option
        .setName('sure')
        .setDescription('Süre (dakika, 0 = timeout kaldır, en fazla 40320)')
        .setRequired(true)
        .setMinValue(0)
        .setMaxValue(MAX_TIMEOUT_MINUTES)
    )
    .addStringOption((option) =>
      option.setName('sebep').setDescription('Sebep').setRequired(false)
    ),
  moderationAction: 'timeout',

  async execute(interaction) {
    const targetUser = interaction.options.getUser('kullanici');
    const minutes = interaction.options.getInteger('sure');
    const reason = interaction.options.getString('sebep') || 'Sebep belirtilmedi';

    const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
    const targetError = getTargetError(interaction, targetMember, 'timeout');
    if (targetError) {
      await interaction.reply({ content: targetError, ephemeral: true });
      return;
    }

    // Manuel timeout, warn sisteminin permanent zamanlayicisini devre disi birakir.
    cancelPermanentReapply(interaction.guild.id, targetUser.id);

    try {
      if (minutes === 0) {
        await targetMember.timeout(null, `Timeout kaldırıldı - ${reason}`);
        clearTimeoutState(interaction.guild.id, targetUser.id);
        logger.info(
          `[MODERATION] ${interaction.user.tag} timeout kaldirdi: ${targetUser.tag}`
        );
        await interaction.reply({
          content: `✅ ${targetUser.tag} kullanıcısının timeoutu kaldırıldı.`,
          ephemeral: true,
        });
        return;
      }

      const now = Date.now();
      const duration = minutes * 60_000;
      await targetMember.timeout(duration, reason);
      await setTimeoutState(interaction.guild.id, targetUser.id, {
        source: 'manual',
        permanent: 0,
        warnCount: 0,
        appliedAt: now,
        expiresAt: now + duration,
      });

      logger.info(
        `[MODERATION] ${interaction.user.tag} timeout uyguladi: ${targetUser.tag} | Sure: ${minutes}dk | Sebep: ${reason}`
      );
      await interaction.reply({
        content: `✅ ${targetUser.tag} kullanıcısına ${minutes} dakika timeout uygulandı.`,
        ephemeral: true,
      });

      await sendDM(targetUser, {
        title: '🔇 Timeout Aldınız',
        description: `${interaction.guild.name} sunucusunda ${minutes} dakika susturuldunuz.`,
        color: 0xfaa61a,
        fields: [
          { name: '👮 Yetkili', value: interaction.user.tag, inline: true },
          { name: '📝 Sebep', value: reason, inline: false },
        ],
      });

      logModAction(interaction.guild.id, interaction.user.id, 'timeout', targetUser.id);
      logAudit({
        guildId: interaction.guild.id,
        action: 'timeout',
        moderatorId: interaction.user.id,
        targetId: targetUser.id,
        reason,
        details: { sure: `${minutes} dakika` },
      });

      const modLogEmbed = buildTimeoutLogEmbed({
        user: targetUser,
        moderatorTag: interaction.user.tag,
        duration: `${minutes} dakika`,
        reason,
      });
      await sendModLog(interaction.guild, modLogEmbed);
    } catch (error) {
      logger.error(`[MODERATION] Timeout islemi basarisiz (${targetUser.tag}):`, error);
      await interaction.reply({ content: '❌ Timeout uygulanamadı.', ephemeral: true });
    }
  },
};
