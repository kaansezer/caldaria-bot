const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getTargetError } = require('../utils/moderationPermissions');
const { addWarn, getActiveWarningCount, SOURCES } = require('../utils/warnManager');
const { sendModLog } = require('../utils/modLog');
const { buildWarnLogEmbed } = require('../utils/modLogEmbeds');
const { describePenalty, penaltyReasonText, applyWarnPenalty } = require('../utils/warnPenalty');
const { logModAction } = require('../utils/modStats');
const { logAudit } = require('../utils/auditLog');
const { sendDM } = require('../utils/dmNotifier');
const { formatDate } = require('../utils/format');
const logger = require('../utils/logger');

// Kullaniciya uyari verir, veritabanina kaydeder ve warn sayisina gore ceza uygular (Owner / Yonetici)
module.exports = {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Bir kullanıcıyı uyarır ve kaydeder.')
    .addUserOption((option) =>
      option.setName('kullanici').setDescription('Uyarılacak kullanıcı').setRequired(true)
    )
    .addStringOption((option) =>
      option.setName('sebep').setDescription('Uyarı sebebi (zorunlu)').setRequired(true)
    ),
  moderationAction: 'warn',

  async execute(interaction) {
    const targetUser = interaction.options.getUser('kullanici');
    const reason = interaction.options.getString('sebep');

    const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
    const targetError = getTargetError(interaction, targetMember, 'warn');
    if (targetError) {
      await interaction.reply({ content: targetError, ephemeral: true });
      return;
    }

    let warning;
    try {
      warning = addWarn(interaction.guild.id, targetUser.id, {
        reason,
        moderatorId: interaction.user.id,
        source: SOURCES.manual,
      });
    } catch (error) {
      logger.error('[WARN] Uyari veritabanina kaydedilemedi:', error);
      await interaction.reply({
        content: '❌ Uyarı kaydedilemedi (veritabanı hatası).',
        ephemeral: true,
      });
      return;
    }

    const totalWarns = getActiveWarningCount(interaction.guild.id, targetUser.id);

    // Warn sayisina gore cezayi uygula (merkezi fonksiyon)
    const penaltyResult = await applyWarnPenalty(targetMember);

    const penaltyText = penaltyResult.penalty
      ? describePenalty(penaltyResult.penalty)
      : null;
    const note = penaltyResult.reason
      ? `Ceza uygulanamadı: ${penaltyReasonText(penaltyResult.reason)}`
      : null;

    const embed = new EmbedBuilder()
      .setColor(0xfaa61a)
      .setTitle('⚠️ Kullanıcı Uyarıldı')
      .addFields(
        { name: '👤 Kullanıcı', value: `${targetUser.tag} (\`${targetUser.id}\`)`, inline: false },
        { name: '👮 Yetkili', value: interaction.user.tag, inline: true },
        { name: '📝 Sebep', value: reason, inline: false },
        { name: '⚠️ Toplam uyarı', value: String(totalWarns), inline: true }
      );

    if (penaltyText) {
      embed.addFields({ name: '🔇 Ceza', value: penaltyText, inline: true });
    }
    if (note) {
      embed.addFields({ name: '⚠️ Not', value: note, inline: false });
    }
    embed.setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });

    // Mod-log kaydi
    const modLogEmbed = buildWarnLogEmbed({
      user: targetUser,
      moderatorText: interaction.user.tag,
      reason,
      totalWarns,
      penaltyText,
      note,
      source: SOURCES.manual,
    });
    const logResult = await sendModLog(interaction.guild, modLogEmbed);

    if (!logResult.sent && logResult.reason === 'no_channel') {
      await interaction
        .followUp({
          content: '⚠️ Warn verildi ancak mod-log kanalı ayarlanmadığı için log gönderilemedi.',
          ephemeral: true,
        })
        .catch(() => {});
    }

    await sendDM(targetUser, {
      title: '⚠️ Uyarı Aldınız',
      description: `${interaction.guild.name} sunucusunda uyarı aldınız.`,
      color: 0xfaa61a,
      fields: [
        { name: '👮 Yetkili', value: interaction.user.tag, inline: true },
        { name: '📝 Sebep', value: reason, inline: false },
        { name: '⚠️ Toplam Uyarı', value: String(totalWarns), inline: true },
      ],
    });

    logModAction(interaction.guild.id, interaction.user.id, 'warn', targetUser.id);
    logAudit({
      guildId: interaction.guild.id,
      action: 'warn',
      moderatorId: interaction.user.id,
      targetId: targetUser.id,
      reason,
      details: { toplam_warn: totalWarns, ceza: penaltyText },
    });

    logger.info(
      `[MODERATION] ${interaction.user.tag} kullaniciyi uyardi: ${targetUser.tag} | Sebep: ${reason} | Toplam: ${totalWarns} | Tarih: ${formatDate(warning.createdAt)}`
    );
  },
};
