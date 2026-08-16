const { SlashCommandBuilder } = require('discord.js');
const { getTargetError } = require('../utils/moderationPermissions');
const { sendModLog } = require('../utils/modLog');
const { buildRoleLogEmbed } = require('../utils/modLogEmbeds');
const { logModAction } = require('../utils/modStats');
const { logAudit } = require('../utils/auditLog');
const logger = require('../utils/logger');

// Kullaniciya rol ekler veya varsa cikarir (toggle) (Owner / Yonetici)
module.exports = {
  data: new SlashCommandBuilder()
    .setName('role')
    .setDescription('Kullanıcıya rol verir veya varsa rolü kaldırır.')
    .addUserOption((option) =>
      option.setName('kullanici').setDescription('Rolü değişecek kullanıcı').setRequired(true)
    )
    .addRoleOption((option) =>
      option.setName('rol').setDescription('Verilecek / kaldırılacak rol').setRequired(true)
    ),
  moderationAction: 'role',

  async execute(interaction) {
    const targetUser = interaction.options.getUser('kullanici');
    const role = interaction.options.getRole('rol');
    const guild = interaction.guild;
    const botMember = guild.members.me;

    // Rol guvenlik kontrolleri
    if (role.id === guild.roles.everyone.id) {
      await interaction.reply({ content: '❌ @everyone rolü yönetilemez.', ephemeral: true });
      return;
    }
    if (role.managed) {
      await interaction.reply({
        content: '❌ Bu rol (entegrasyon/bot rolü) yönetilemez.',
        ephemeral: true,
      });
      return;
    }
    if (!botMember) {
      await interaction.reply({ content: '❌ Bot bu sunucuda bulunamadı.', ephemeral: true });
      return;
    }
    if (role.position >= botMember.roles.highest.position) {
      await interaction.reply({
        content: '❌ Bu rol, botun rolünün üstünde veya eşit seviyede; yönetilemez.',
        ephemeral: true,
      });
      return;
    }

    // Hedef uye kontrolleri (sahip/bot/kendi/hiyerarsi) - merkezi fonksiyon
    const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);
    const targetError = getTargetError(interaction, targetMember, 'role');
    if (targetError) {
      await interaction.reply({ content: targetError, ephemeral: true });
      return;
    }

    // Komutu kullananin kendi hiyerarsisinin altindaki rolleri yonettigi kontrolu
    const actor = interaction.member;
    if (actor.id !== guild.ownerId && role.position >= actor.roles.highest.position) {
      await interaction.reply({
        content: '❌ Bu rolü yönetmek için senden yüksek veya eşit bir role sahip.',
        ephemeral: true,
      });
      return;
    }

    const hasRole = targetMember.roles.cache.has(role.id);

    try {
      if (hasRole) {
        await targetMember.roles.remove(role, `${interaction.user.tag} tarafından kaldırıldı`);
      } else {
        await targetMember.roles.add(role, `${interaction.user.tag} tarafından verildi`);
      }

      const action = hasRole ? 'remove' : 'add';
      const message = hasRole
        ? `✅ ${role.toString()} rolü ${targetUser.toString()} kullanıcısından kaldırıldı.`
        : `✅ ${role.toString()} rolü ${targetUser.toString()} kullanıcısına verildi.`;

      logger.info(
        `[MODERATION] ${interaction.user.tag} rol degistirdi: ${targetUser.tag} (${role.name}: ${action})`
      );
      await interaction.reply({ content: message, ephemeral: true });

      logModAction(guild.id, interaction.user.id, hasRole ? 'role_remove' : 'role_add', targetUser.id);
      logAudit({
        guildId: guild.id,
        action: hasRole ? 'role_remove' : 'role_add',
        moderatorId: interaction.user.id,
        targetId: targetUser.id,
        details: { rol: role.name, rol_id: role.id },
      });

      const modLogEmbed = buildRoleLogEmbed({
        user: targetUser,
        role,
        action: hasRole ? 'remove' : 'add',
        moderatorTag: interaction.user.tag,
      });
      await sendModLog(guild, modLogEmbed);
    } catch (error) {
      logger.error(`[MODERATION] Rol islemi basarisiz (${targetUser.tag}):`, error);
      await interaction.reply({
        content: '❌ Rol işlemi gerçekleştirilemedi.',
        ephemeral: true,
      });
    }
  },
};
