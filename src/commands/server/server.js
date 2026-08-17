const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} = require('discord.js');
const serverManager = require('../../services/serverManager');
const logger = require('../../utils/logger');

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

function buildErrorEmbed(message) {
  return buildEmbed(EMBED_COLORS.error, '❌ Sunucu işlemi hatası', message);
}

function buildStatusEmbed(running, raw) {
  if (running) {
    return buildEmbed(
      EMBED_COLORS.success,
      '🟢 Bannerlord Coop sunucusu çalışıyor',
      raw || 'Sunucu aktif.'
    );
  }
  return buildEmbed(EMBED_COLORS.error, '🔴 Bannerlord Coop sunucusu kapalı', 'Sunucu şu anda çalışmıyor.');
}

function sendError(replyFn, message) {
  return replyFn({ embeds: [buildErrorEmbed(message)] });
}

// /server slash command grubu.
module.exports = {
  data: new SlashCommandBuilder()
    .setName('server')
    .setDescription('Bannerlord Coop dedicated sunucusunu yönetir.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub.setName('status').setDescription('Sunucunun çalışıp çalışmadığını gösterir.')
    )
    .addSubcommand((sub) => sub.setName('start').setDescription('Sunucuyu başlatır.'))
    .addSubcommand((sub) => sub.setName('stop').setDescription('Sunucuyu kapatır.'))
    .addSubcommand((sub) => sub.setName('restart').setDescription('Sunucuyu yeniden başlatır.'))
    .addSubcommand((sub) =>
      sub
        .setName('console')
        .setDescription('Çalışan sunucunun konsoluna komut gönderir.')
        .addStringOption((option) =>
          option.setName('komut').setDescription('Gönderilecek konsol komutu').setRequired(true)
        )
    ),
  moderationAction: 'server',

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'status') {
      await interaction.deferReply({ ephemeral: true });
      const result = await serverManager.status();
      if (!result.ok) {
        await interaction.editReply({ embeds: [buildErrorEmbed(result.message)] });
        return;
      }
      await interaction.editReply({ embeds: [buildStatusEmbed(result.running, result.raw)] });
      return;
    }

    if (subcommand === 'console') {
      const command = interaction.options.getString('komut');
      await interaction.deferReply({ ephemeral: true });
      const result = await serverManager.consoleCommand(command);
      const embed = result.ok
        ? buildEmbed(EMBED_COLORS.success, '✅ Konsol komutu', result.message)
        : buildErrorEmbed(result.message);
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    // start / stop / restart -> onay butonu ister.
    const labels = {
      start: { emoji: '▶️', text: 'Başlat', actionText: 'başlatılacak' },
      stop: { emoji: '⏹️', text: 'Durdur', actionText: 'durdurulacak' },
      restart: { emoji: '🔄', text: 'Yeniden Başlat', actionText: 'yeniden başlatılacak' },
    };
    const { emoji, text, actionText } = labels[subcommand];

    const confirmRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`server:confirm:${subcommand}:${interaction.user.id}`)
        .setLabel(text)
        .setEmoji(emoji)
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`server:cancel:${interaction.user.id}`)
        .setLabel('İptal')
        .setEmoji('❌')
        .setStyle(ButtonStyle.Danger)
    );

    await interaction.reply({
      embeds: [
        buildEmbed(
          EMBED_COLORS.warning,
          `⚠️ Sunucu Onayı`,
          `Bannerlord Coop sunucusu **${actionText}**.\n\nDevam etmek istiyor musun?`
        ),
      ],
      components: [confirmRow],
      ephemeral: true,
    });
  },

  async handleButton(interaction) {
    const parts = interaction.customId.split(':');
    const action = parts[1]; // 'confirm' | 'cancel'

    if (action === 'cancel') {
      await interaction.update({
        embeds: [buildEmbed(EMBED_COLORS.info, '❌ İptal edildi', 'Sunucu işlemi iptal edildi.')],
        components: [],
      });
      return;
    }

    if (action !== 'confirm') return;

    const [operation, ownerId] = parts.slice(2); // parts: server, confirm, <start|stop|restart>, <ownerId>

    if (interaction.user.id !== ownerId) {
      await interaction.reply({
        embeds: [
          buildErrorEmbed('Bu butonu yalnızca komutu kullanan kişi kullanabilir.'),
        ],
        ephemeral: true,
      });
      return;
    }

    await interaction.update({
      embeds: [buildEmbed(EMBED_COLORS.info, '⏳ İşlem yapılıyor', 'Lütfen bekleyin...')],
      components: [],
    });

    const handlers = {
      start: serverManager.start,
      stop: serverManager.stop,
      restart: serverManager.restart,
    };
    const handler = handlers[operation];

    try {
      const result = await handler();
      const embed = result.ok
        ? buildEmbed(EMBED_COLORS.success, '✅ İşlem tamamlandı', result.message)
        : buildErrorEmbed(result.message);
      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      logger.error(`Sunucu islem hatasi (${operation}):`, error);
      await interaction.editReply({
        embeds: [buildErrorEmbed(error.message || 'Beklenmeyen bir hata oluştu.')],
      });
    }
  },
};