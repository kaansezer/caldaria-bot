const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const { getWarningsHistory, getActiveWarningCount } = require('../utils/warnManager');
const { hasModerationPermission } = require('../utils/moderationPermissions');
const { formatDate } = require('../utils/format');
const logger = require('../utils/logger');

const PAGE_SIZE = 10;
const BUTTON_TIMEOUT = 60_000;

function moderatorText(warning) {
  if (warning.moderatorId) return `<@${warning.moderatorId}>`;
  if (warning.source === 'profanity_filter') return 'Küfür Filtresi';
  if (warning.source === 'automatic') return 'Otomatik';
  return 'Bilinmiyor';
}

function removedByText(warning) {
  return warning.deletedBy ? ` (${moderatorText({ moderatorId: warning.deletedBy })})` : '';
}

// Gosterim listesi olusturur: aktif warnlar once, sonra kaldirilmislar.
function buildDisplayItems(history, activeCount) {
  const items = [];
  history.forEach((warning) => {
    if (!warning.deletedAt) {
      items.push({ warning, removed: false });
    }
  });
  history.forEach((warning) => {
    if (warning.deletedAt) {
      items.push({ warning, removed: true });
    }
  });
  return items;
}

function buildWarnsEmbed(targetUser, history, activeCount, items, page, totalPages, filters = null) {
  const filterText = filters && (filters.kaynak || filters.baslangic || filters.bitis)
    ? ` | Filtre: ${filters.kaynak || ''} ${filters.baslangic || ''} ${filters.bitis || ''}`.trim()
    : '';
  const embed = new EmbedBuilder()
    .setColor(0xfee75c)
    .setTitle('⚠️ Warn Geçmişi')
    .setDescription(
      `**👤 ${targetUser.tag}**\n` +
        `⚠️ Aktif Warn: **${activeCount}**\n` +
        `📋 Toplam Warn Geçmişi: **${history.length}**` +
        (filterText ? `\n${filterText}` : '')
    )
    .setFooter({ text: `Sayfa ${page + 1}/${totalPages}` });

  const start = page * PAGE_SIZE;
  const slice = items.slice(start, start + PAGE_SIZE);

  if (slice.length === 0) {
    embed.setDescription('ℹ️ Bu kullanıcının herhangi bir uyarısı bulunmuyor.');
    return embed;
  }

  slice.forEach(({ warning, removed }, index) => {
    const lines = [
      `📝 ${warning.reason}`,
      `👮 ${moderatorText(warning)}`,
      `📅 ${formatDate(warning.createdAt)}`,
    ];
    if (removed) {
      lines.push(`🗑️ Kaldırıldı: ${formatDate(warning.deletedAt)}${removedByText(warning)}`);
    }
    embed.addFields({
      name: `${removed ? '🗑️' : '#'}${start + index + 1}`,
      value: lines.join('\n'),
      inline: false,
    });
  });

  return embed;
}

function buildPaginationRow(ownerId, page, totalPages) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`warns:${ownerId}:prev`)
      .setLabel('◀ Önceki')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page === 0),
    new ButtonBuilder()
      .setCustomId(`warns:${ownerId}:next`)
      .setLabel('Sonraki ▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page === totalPages - 1)
  );
}

// Kullaniciya ait warn gecmisini (aktif + kaldirilmis) sayfalayarak gosterir (Owner / Yonetici)
module.exports = {
  data: new SlashCommandBuilder()
    .setName('warns')
    .setDescription('Bir kullanıcının uyarı geçmişini gösterir.')
    .addUserOption((option) =>
      option.setName('kullanici').setDescription('Geçmişi görülecek kullanıcı').setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('kaynak')
        .setDescription('Filtre: manual / profanity_filter / automatic (boş = tümü)')
        .setRequired(false)
    )
    .addStringOption((option) =>
      option
        .setName('tarih_baslangic')
        .setDescription('Başlangıç tarihi (YYYY-MM-DD), boş = sınırsız')
        .setRequired(false)
    )
    .addStringOption((option) =>
      option
        .setName('tarih_bitis')
        .setDescription('Bitiş tarihi (YYYY-MM-DD), boş = sınırsız')
        .setRequired(false)
    ),
  moderationAction: 'warn',

  async execute(interaction) {
    const targetUser = interaction.options.getUser('kullanici');
    const guildId = interaction.guild.id;
    const userId = targetUser.id;

    const kaynakFilter = interaction.options.getString('kaynak') || null;
    const baslangicStr = interaction.options.getString('tarih_baslangic') || null;
    const bitisStr = interaction.options.getString('tarih_bitis') || null;

    let history = getWarningsHistory(guildId, userId);

    // Kaynak filtresi
    if (kaynakFilter) {
      const validSources = ['manual', 'profanity_filter', 'automatic'];
      if (validSources.includes(kaynakFilter)) {
        history = history.filter((w) => w.source === kaynakFilter);
      }
    }

    // Tarih filtreleri
    if (baslangicStr) {
      const startTs = new Date(baslangicStr).getTime();
      if (!isNaN(startTs)) {
        history = history.filter((w) => w.createdAt >= startTs);
      }
    }
    if (bitisStr) {
      const endTs = new Date(bitisStr).setHours(23, 59, 59, 999);
      if (!isNaN(endTs)) {
        history = history.filter((w) => w.createdAt <= endTs);
      }
    }

    const activeCount = getActiveWarningCount(guildId, userId);
    const items = buildDisplayItems(history, activeCount);

    if (items.length === 0) {
      await interaction.reply({
        content: 'ℹ️ Bu kullanıcının herhangi bir uyarısı bulunmuyor.',
        ephemeral: true,
      });
      return;
    }

    const totalPages = Math.ceil(items.length / PAGE_SIZE);
    let page = 0;

    const filters = { kaynak: kaynakFilter, baslangic: baslangicStr, bitis: bitisStr };
    const embed = buildWarnsEmbed(targetUser, history, activeCount, items, page, totalPages, filters);
    const row = buildPaginationRow(interaction.user.id, page, totalPages);
    const reply = await interaction.reply({
      embeds: [embed],
      components: totalPages > 1 ? [row] : [],
      ephemeral: true,
    });

    if (totalPages <= 1) return;

    const collector = reply.createMessageComponentCollector({
      filter: (i) => i.customId.startsWith('warns:') && i.user.id === interaction.user.id,
      time: BUTTON_TIMEOUT,
    });

    collector.on('collect', async (i) => {
      if (!hasModerationPermission(i.member, 'warn')) {
        await i.reply({ content: '❌ Bu komutu kullanmak için yetkiniz yok.', ephemeral: true });
        return;
      }

      const [, , action] = i.customId.split(':');
      page = action === 'next' ? Math.min(page + 1, totalPages - 1) : Math.max(page - 1, 0);

      const filters = { kaynak: kaynakFilter, baslangic: baslangicStr, bitis: bitisStr };
      const newEmbed = buildWarnsEmbed(targetUser, history, activeCount, items, page, totalPages, filters);
      const newRow = buildPaginationRow(interaction.user.id, page, totalPages);
      await i.update({ embeds: [newEmbed], components: [newRow] });
    });

    collector.on('end', async () => {
      try {
        await reply.edit({ components: [] }).catch(() => {});
      } catch (error) {
        logger.warn('[WARNS] Sayfalama temizlenemedi:', error.message);
      }
    });
  },
};
