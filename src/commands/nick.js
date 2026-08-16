const { SlashCommandBuilder } = require('discord.js');
const { getTargetError } = require('../utils/moderationPermissions');
const { sendModLog } = require('../utils/modLog');
const { buildNickLogEmbed } = require('../utils/modLogEmbeds');
const { logModAction } = require('../utils/modStats');
const { logAudit } = require('../utils/auditLog');
const logger = require('../utils/logger');

const MAX_NICK_LENGTH = 32;

// Kullanicinin nickname'ini degistirir (Owner / Yonetici)
module.exports = {
  data: new SlashCommandBuilder()
    .setName('nick')
    .setDescription('Bir kullanıcının nickname (takma ad) değerini değiştirir.')
    .addUserOption((option) =>
      option.setName('kullanici').setDescription('Nickname değiştirilecek kullanıcı').setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('isim')
        .setDescription('Yeni nickname')
        .setRequired(true)
        .setMaxLength(MAX_NICK_LENGTH)
    ),
  moderationAction: 'nick',

  async execute(interaction) {
    const targetUser = interaction.options.getUser('kullanici');
    const newNick = interaction.options.getString('isim').trim();

    if (newNick.length === 0) {
      await interaction.reply({ content: '❌ Nickname boş olamaz.', ephemeral: true });
      return;
    }
    if (newNick.length > MAX_NICK_LENGTH) {
      await interaction.reply({
        content: `❌ Nickname en fazla ${MAX_NICK_LENGTH} karakter olabilir.`,
        ephemeral: true,
      });
      return;
    }

    const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
    const targetError = getTargetError(interaction, targetMember, 'nick');
    if (targetError) {
      await interaction.reply({ content: targetError, ephemeral: true });
      return;
    }

    const oldNick = targetMember.nickname || targetMember.user.username;

    try {
      await targetMember.setNickname(newNick, `${interaction.user.tag} tarafından değiştirildi`);

      logger.info(
        `[MODERATION] ${interaction.user.tag} nickname degistirdi: ${targetUser.tag} (${oldNick} -> ${newNick})`
      );
      await interaction.reply({ content: '✅ Kullanıcının nickname\'i değiştirildi.', ephemeral: true });

      logModAction(interaction.guild.id, interaction.user.id, 'nick', targetUser.id);
      logAudit({
        guildId: interaction.guild.id,
        action: 'nick',
        moderatorId: interaction.user.id,
        targetId: targetUser.id,
        details: { eski: oldNick, yeni: newNick },
      });

      const modLogEmbed = buildNickLogEmbed({
        user: targetUser,
        oldNick,
        newNick,
        moderatorTag: interaction.user.tag,
      });
      await sendModLog(interaction.guild, modLogEmbed);
    } catch (error) {
      logger.error(`[MODERATION] Nickname degistirilemedi (${targetUser.tag}):`, error);
      await interaction.reply({ content: '❌ Nickname değiştirilemedi.', ephemeral: true });
    }
  },
};
