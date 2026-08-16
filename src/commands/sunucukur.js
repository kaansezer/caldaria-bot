const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} = require('discord.js');
const { setupServer } = require('../utils/serverSetup');
const logger = require('../utils/logger');

const EMBED_COLORS = {
  success: 0x57f287,
  error: 0xed4245,
  warning: 0xfaa61a,
  info: 0xfee75c,
};

function buildEmbed(color, title, description) {
  return new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(description)
    .setTimestamp();
}

function buildSuccessEmbed(stats) {
  const totalRoles = stats.rolesCreated + stats.rolesExisting;
  const totalCategories = stats.categoriesCreated + stats.categoriesExisting;
  const totalChannels = stats.channelsCreated + stats.channelsExisting;

  return buildEmbed(
    EMBED_COLORS.success,
    '✅ Sunucu kurulumu tamamlandı!',
    [
      'Caldaria sunucu yapısı başarıyla oluşturuldu.',
      '',
      '**Oluşturulan / Mevcut:**',
      `• Roller: **${stats.rolesCreated}** yeni, **${stats.rolesExisting}** mevcut (toplam ${totalRoles})`,
      `• Kategoriler: **${stats.categoriesCreated}** yeni, **${stats.categoriesExisting}** mevcut (toplam ${totalCategories})`,
      `• Kanallar: **${stats.channelsCreated}** yeni, **${stats.channelsExisting}** mevcut (toplam ${totalChannels})`,
      '',
      'Mevcut kanallar ve roller korundu; yalnızca eksik olanlar eklendi.',
    ].join('\n')
  );
}

function buildErrorEmbed(message, stage) {
  let description = message;
  if (stage) {
    description += `\n\n**Hata aşaması:** ${stage}`;
  }

  return buildEmbed(EMBED_COLORS.error, '❌ Kurulum hatası', description);
}

function checkBotPermissions(guild) {
  const me = guild.members.me;
  if (!me) {
    return 'Bot bu sunucuda bulunamadı.';
  }

  const missing = [];

  if (!me.permissions.has(PermissionFlagsBits.ManageRoles)) {
    missing.push('Rolleri Yönet (Manage Roles)');
  }
  if (!me.permissions.has(PermissionFlagsBits.ManageChannels)) {
    missing.push('Kanalları Yönet (Manage Channels)');
  }

  if (missing.length > 0) {
    return `Botun gerekli yetkileri eksik:\n• ${missing.join('\n• ')}\n\nLütfen bot rolüne bu yetkileri verin ve bot rolünü diğer rollerin üstüne taşıyın.`;
  }

  return null;
}

// /sunucukur slash command
module.exports = {
  data: new SlashCommandBuilder()
    .setName('sunucukur')
    .setDescription('Caldaria sunucusunun temel yapısını otomatik oluşturur.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  moderationAction: 'sunucukur',

  async execute(interaction) {
    if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) {
      await interaction.reply({
        embeds: [
          buildErrorEmbed('Bu komutu kullanmak için **Sunucuyu Yönet** yetkisine sahip olmalısın.'),
        ],
        ephemeral: true,
      });
      return;
    }

    const botPermissionError = checkBotPermissions(interaction.guild);
    if (botPermissionError) {
      await interaction.reply({
        embeds: [buildErrorEmbed(botPermissionError)],
        ephemeral: true,
      });
      return;
    }

    const confirmRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`sunucukur:confirm:${interaction.user.id}`)
        .setLabel('Oluştur')
        .setEmoji('✅')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`sunucukur:cancel:${interaction.user.id}`)
        .setLabel('İptal')
        .setEmoji('❌')
        .setStyle(ButtonStyle.Danger)
    );

    await interaction.reply({
      embeds: [
        buildEmbed(
          EMBED_COLORS.warning,
          '⚠️ Sunucu Kurulum Onayı',
          'Discord sunucusunun temel yapısı oluşturulacak.\n\nDevam etmek istiyor musun?\n\n**Not:** Mevcut kanallar ve roller korunur; yalnızca eksik olanlar eklenir.'
        ),
      ],
      components: [confirmRow],
      ephemeral: true,
    });
  },

  async handleButton(interaction) {
    const [, action, ownerId] = interaction.customId.split(':');

    if (interaction.user.id !== ownerId) {
      await interaction.reply({
        embeds: [buildErrorEmbed('Bu butonu yalnızca komutu kullanan kişi kullanabilir.')],
        ephemeral: true,
      });
      return;
    }

    if (action === 'cancel') {
      await interaction.update({
        embeds: [
          buildEmbed(EMBED_COLORS.info, '❌ İptal edildi', 'Sunucu kurulumu iptal edildi.'),
        ],
        components: [],
      });
      return;
    }

    if (action !== 'confirm') return;

    const botPermissionError = checkBotPermissions(interaction.guild);
    if (botPermissionError) {
      await interaction.update({
        embeds: [buildErrorEmbed(botPermissionError)],
        components: [],
      });
      return;
    }

    await interaction.update({
      embeds: [
        buildEmbed(EMBED_COLORS.info, '⏳ Kurulum başlatılıyor', 'Lütfen bekleyin...'),
      ],
      components: [],
    });

    try {
      const { stats } = await setupServer(interaction.guild, async (message) => {
        await interaction.editReply({
          embeds: [buildEmbed(EMBED_COLORS.info, '⏳ Kurulum devam ediyor', message)],
        });
      });

      await interaction.editReply({
        embeds: [buildSuccessEmbed(stats)],
      });
    } catch (error) {
      logger.error('Sunucu kurulum hatasi:', error);

      await interaction.editReply({
        embeds: [
          buildErrorEmbed(
            error.message || 'Kurulum sırasında beklenmeyen bir hata oluştu.',
            error.setupStage
          ),
        ],
      });
    }
  },
};
