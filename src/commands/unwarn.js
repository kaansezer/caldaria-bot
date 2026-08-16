const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
} = require('discord.js');
const { getWarnings, removeWarn, removeAllWarns } = require('../utils/warnManager');
const { hasModerationPermission } = require('../utils/moderationPermissions');
const { sendModLog } = require('../utils/modLog');
const { buildWarnRemovedLogEmbed, buildAllWarnsRemovedLogEmbed } = require('../utils/modLogEmbeds');
const { describePenalty, penaltyReasonText, applyWarnPenalty } = require('../utils/warnPenalty');
const { logModAction } = require('../utils/modStats');
const { logAudit } = require('../utils/auditLog');
const { sendDM } = require('../utils/dmNotifier');
const { formatDate } = require('../utils/format');
const logger = require('../utils/logger');

const SELECT_LIMIT = 25;
const SELECT_TIMEOUT = 90_000;

// Ayarlara uygun ceza durumunu okur (mod-log icin)
async function getPenaltyInfo(member) {
  if (!member) return { penaltyText: null, note: null };
  const result = await applyWarnPenalty(member);
  return {
    penaltyText: result.penalty ? describePenalty(result.penalty) : null,
    note: result.reason ? `Ceza uygulanamadı: ${penaltyReasonText(result.reason)}` : null,
  };
}

function buildModeMenu(ownerId, guildId, userId) {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`unwarn:mode:${ownerId}:${guildId}:${userId}`)
      .setPlaceholder('İşlem seç')
      .setMaxValues(1)
      .addOptions([
        {
          label: 'Belirli bir warnı seç ve kaldır',
          description: 'Açılan listeden bir warn seçilir',
          value: 'select',
          emoji: '🖊️',
        },
        {
          label: 'Tüm warnları kaldır',
          description: 'Tüm aktif warnlar silinir (onay istenir)',
          value: 'all',
          emoji: '🗑️',
        },
      ])
  );
}

function buildWarnListMenu(ownerId, guildId, userId, warnings) {
  const options = warnings.slice(0, SELECT_LIMIT).map((warning, index) => ({
    label: `#${index + 1} - ${warning.reason.slice(0, 90)}`,
    description: `Tarih: ${formatDate(warning.createdAt)}`,
    value: String(warning.id),
  }));

  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`unwarn:warn:${ownerId}:${guildId}:${userId}`)
      .setPlaceholder('Kaldırılacak uyarıyı seç')
      .setMaxValues(1)
      .addOptions(options)
  );
}

function buildConfirmButtons(ownerId, guildId, userId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`unwarn:confirm:${ownerId}:${guildId}:${userId}`)
      .setLabel('Evet, Tümünü Kaldır')
      .setEmoji('✅')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`unwarn:cancel:${ownerId}:${guildId}:${userId}`)
      .setLabel('İptal')
      .setEmoji('❌')
      .setStyle(ButtonStyle.Secondary)
  );
}

// Kullaniciya ait warnlardan birini veya tumunu kaldirir (Owner / Yonetici)
module.exports = {
  data: new SlashCommandBuilder()
    .setName('unwarn')
    .setDescription('Bir kullanıcının uyarısını veya tüm uyarılarını kaldırır.')
    .addUserOption((option) =>
      option.setName('kullanici').setDescription('Uyarısı kaldırılacak kullanıcı').setRequired(true)
    ),
  moderationAction: 'warn',

  async execute(interaction) {
    const targetUser = interaction.options.getUser('kullanici');
    const guildId = interaction.guild.id;
    const userId = targetUser.id;
    const warnings = getWarnings(guildId, userId);

    if (warnings.length === 0) {
      await interaction.reply({
        content: 'ℹ️ Bu kullanıcının kaldırılacak uyarısı bulunmuyor.',
        ephemeral: true,
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0xfee75c)
      .setTitle('⚠️ Warn Yönetimi')
      .addFields(
        { name: '👤 Kullanıcı', value: `${targetUser.tag} (\`${userId}\`)`, inline: false },
        { name: '⚠️ Aktif Warn', value: String(warnings.length), inline: true }
      )
      .setDescription('Aşağıdan yapmak istediğiniz işlemi seçin.');

    const reply = await interaction.reply({
      embeds: [embed],
      components: [buildModeMenu(interaction.user.id, guildId, userId)],
      ephemeral: true,
    });

    const collector = reply.createMessageComponentCollector({
      filter: (i) => i.customId.startsWith('unwarn:') && i.user.id === interaction.user.id,
      time: SELECT_TIMEOUT,
    });

    collector.on('collect', async (i) => {
      if (!hasModerationPermission(i.member, 'warn')) {
        await i.reply({ content: '❌ Bu komutu kullanmak için yetkiniz yok.', ephemeral: true });
        return;
      }

      const parts = i.customId.split(':');
      const step = parts[1];

      if (step === 'mode') {
        const mode = i.values[0];
        if (mode === 'select') {
          await i.update({
            embeds: [
              new EmbedBuilder()
                .setColor(0xfee75c)
                .setTitle(`🖊️ ${targetUser.tag} - Uyarı Listesi`)
                .setDescription('Kaldırmak istediğiniz uyarıyı seçin.')
                .setFooter({
                  text:
                    warnings.length > SELECT_LIMIT
                      ? `Son ${SELECT_LIMIT} uyarı gösteriliyor (toplam ${warnings.length}).`
                      : `Toplam ${warnings.length} uyarı.`,
                }),
            ],
            components: [buildWarnListMenu(interaction.user.id, guildId, userId, warnings)],
          });
        } else if (mode === 'all') {
          await i.update({
            embeds: [
              new EmbedBuilder()
                .setColor(0xed4245)
                .setTitle('⚠️ Emin misin?')
                .setDescription(
                  `${targetUser.tag} kullanıcısının **TÜM aktif warnları** silinecek (${warnings.length} uyarı).\n\nBu işlem geri alınamaz.`
                ),
            ],
            components: [buildConfirmButtons(interaction.user.id, guildId, userId)],
          });
        }
        return;
      }

      if (step === 'warn') {
        const warnId = Number(i.values[0]);
        const removed = removeWarn(guildId, warnId, { deletedBy: i.user.id });
        if (!removed) {
          await i.update({
            content: '❌ Seçilen uyarı bulunamadı veya zaten kaldırılmış.',
            embeds: [],
            components: [],
          });
          return;
        }

        const member = await i.guild.members.fetch(userId).catch(() => null);
        const penaltyInfo = await getPenaltyInfo(member);

        await i.update({
          content: `✅ ${targetUser.tag} kullanıcısının seçilen uyarısı kaldırıldı.`,
          embeds: [],
          components: [],
        });

        const modLogEmbed = buildWarnRemovedLogEmbed({
          user: targetUser,
          moderatorTag: i.user.tag,
          removedReason: removed.reason,
          remaining: getWarnings(guildId, userId).length,
          penaltyText: penaltyInfo.penaltyText,
          note: penaltyInfo.note,
        });
        await sendModLog(i.guild, modLogEmbed);

        await sendDM(targetUser, {
          title: '✅ Uyarınız Kaldırıldı',
          description: `${i.guild.name} sunucusunda bir uyarınız kaldırıldı.`,
          color: 0x57f287,
          fields: [
            { name: '👮 Yetkili', value: i.user.tag, inline: true },
            { name: '📝 Kaldırılan sebep', value: removed.reason, inline: false },
          ],
        });

        logModAction(guildId, i.user.id, 'unwarn', userId);
        logAudit({
          guildId,
          action: 'unwarn',
          moderatorId: i.user.id,
          targetId: userId,
          reason: removed.reason,
        });

        logger.info(
          `[MODERATION] ${i.user.tag} uyari kaldirdi: ${targetUser.tag} | Kaldirilan sebep: ${removed.reason}`
        );
        collector.stop();
        return;
      }

      if (step === 'confirm') {
        const removedCount = removeAllWarns(guildId, userId, { deletedBy: i.user.id });

        const member = await i.guild.members.fetch(userId).catch(() => null);
        const penaltyInfo = await getPenaltyInfo(member);

        const embedResult = new EmbedBuilder()
          .setColor(0x57f287)
          .setTitle('⚠️ Warnlar Temizlendi')
          .addFields(
            { name: '👤 Kullanıcı', value: `${targetUser.tag} (\`${userId}\`)`, inline: false },
            { name: '🗑️ Kaldırılan warn', value: String(removedCount), inline: true },
            { name: '👮 Yetkili', value: i.user.tag, inline: true },
            { name: '⚠️ Kalan Warn', value: '0', inline: true }
          );
        if (penaltyInfo.penaltyText) {
          embedResult.addFields({ name: '🔊 Timeout', value: penaltyInfo.penaltyText, inline: false });
        }
        if (penaltyInfo.note) {
          embedResult.addFields({ name: '⚠️ Not', value: penaltyInfo.note, inline: false });
        }
        embedResult.setTimestamp();

        await i.update({ embeds: [embedResult], components: [] });

        const modLogEmbed = buildAllWarnsRemovedLogEmbed({
          user: targetUser,
          moderatorTag: i.user.tag,
          removedCount,
          penaltyText: penaltyInfo.penaltyText,
          note: penaltyInfo.note,
        });
        await sendModLog(i.guild, modLogEmbed);

        await sendDM(targetUser, {
          title: '✅ Tüm Uyarılarınız Kaldırıldı',
          description: `${i.guild.name} sunucusunda ${removedCount} uyarınız kaldırıldı.`,
          color: 0x57f287,
          fields: [{ name: '👮 Yetkili', value: i.user.tag, inline: true }],
        });

        logModAction(guildId, i.user.id, 'unwarn', userId);
        logAudit({
          guildId,
          action: 'unwarn_all',
          moderatorId: i.user.id,
          targetId: userId,
          details: { kaldirilan: removedCount },
        });

        logger.info(
          `[MODERATION] ${i.user.tag} tum warnlari kaldirdi: ${targetUser.tag} | Adet: ${removedCount}`
        );
        collector.stop();
        return;
      }

      if (step === 'cancel') {
        await i.update({
          content: '❌ İşlem iptal edildi.',
          embeds: [],
          components: [],
        });
        collector.stop();
      }
    });

    collector.on('end', async () => {
      try {
        await reply.edit({ components: [] }).catch(() => {});
      } catch (error) {
        logger.warn('[UNWARN] Menü temizlenemedi:', error.message);
      }
    });
  },
};
