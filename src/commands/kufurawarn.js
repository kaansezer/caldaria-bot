const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const moderationConfig = require('../config/moderationConfig');
const { getGuildSetting, setGuildSetting } = require('../utils/settings');
const logger = require('../utils/logger');

const SETTING_KEY = 'profanityWarnEnabled';

function buildStatusEmbed(enabled) {
  return new EmbedBuilder()
    .setColor(enabled ? 0x57f287 : 0xed4245)
    .setTitle(enabled ? '✅ Otomatik warn açık' : '❌ Otomatik warn kapalı')
    .setDescription(
      enabled
        ? [
            'Küfür filtresi artık küfürlü mesajlar için otomatik warn verecek.',
            '',
            `📝 Sebep: **${moderationConfig.profanityWarnReason}**`,
            'Warn sayısına göre otomatik cezalar (timeout/kick/ban) uygulanmaya devam edecek.',
            'Mod-log kanalına `🟠 UYARI` kaydı gönderilir.',
          ].join('\n')
        : 'Küfür filtresi yalnızca mesajı silecek; otomatik warn vermeyecek.'
    )
    .setTimestamp();
}

// Kufur filtresinin otomatik warn vermesini acar/kapatir veya durumu gosterir (Owner / Yonetici)
module.exports = {
  data: new SlashCommandBuilder()
    .setName('kufurawarn')
    .setDescription('Küfür filtresinin otomatik warn vermesini açar/kapatır.')
    .addBooleanOption((option) =>
      option
        .setName('acik')
        .setDescription('Açık (true) / Kapalı (false). Boş bırakılırsa durum gösterilir.')
        .setRequired(false)
    ),
  moderationAction: 'warn',

  async execute(interaction) {
    const currentEnabled = getGuildSetting(interaction.guild.id, SETTING_KEY, '0') === '1';
    const enabled = interaction.options.getBoolean('acik');

    if (enabled === null) {
      await interaction.reply({ embeds: [buildStatusEmbed(currentEnabled)], ephemeral: true });
      return;
    }

    setGuildSetting(interaction.guild.id, SETTING_KEY, enabled ? '1' : '0');

    logger.info(
      `[MODERATION] ${interaction.user.tag} kufur filtresi otomatik warn ayarini degistirdi: ${enabled}`
    );
    await interaction.reply({ embeds: [buildStatusEmbed(enabled)], ephemeral: true });
  },
};
