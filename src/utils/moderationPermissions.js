const { PermissionFlagsBits } = require('discord.js');

// Rol tabanli yetki seviyeleri. Sunucu yapisina gore bu listeleri duzenleyebilirsiniz.
const OWNER_ROLE_NAMES = ['👑 Owner', 'Owner', 'Sahip', '👑 Sahip'];
const ADMIN_ROLE_NAMES = ['👑 Yönetim', 'Yönetici', 'Yönetim', 'Admin', 'Administrator'];

// Her moderasyon aksiyonu icin gereken Discord yetkisi.
const ACTION_PERMISSIONS = {
  ban: PermissionFlagsBits.BanMembers,
  unban: PermissionFlagsBits.BanMembers,
  tempban: PermissionFlagsBits.BanMembers,
  kick: PermissionFlagsBits.KickMembers,
  timeout: PermissionFlagsBits.ModerateMembers,
  warn: PermissionFlagsBits.ManageMessages,
  clear: PermissionFlagsBits.ManageMessages,
  lock: PermissionFlagsBits.ManageChannels,
  unlock: PermissionFlagsBits.ManageChannels,
  slowmode: PermissionFlagsBits.ManageChannels,
  nick: PermissionFlagsBits.ManageNicknames,
  role: PermissionFlagsBits.ManageRoles,
  modstats: null,
  modlog: null,
  sunucukur: PermissionFlagsBits.ManageGuild,
};

// Sadece Owner seviyesinin kullanabildigi aksiyonlar.
const OWNER_ONLY_ACTIONS = new Set(['sunucukur', 'modlog']);

// Uyenin yetki seviyesini dondurur: 'owner' | 'admin' | null
function getRoleTier(member) {
  if (!member) return null;
  if (member.id === member.guild.ownerId) return 'owner';

  const roles = member.roles.cache;
  if (roles.some((role) => OWNER_ROLE_NAMES.includes(role.name))) return 'owner';
  if (roles.some((role) => ADMIN_ROLE_NAMES.includes(role.name))) return 'admin';

  return null;
}

// Rol + Discord yetki kontrolu. Her komut calistirildiginda bot tarafinda tekrar yapilir.
function hasModerationPermission(member, action) {
  const tier = getRoleTier(member);
  if (tier === 'owner') return true;
  if (tier === 'admin') {
    if (OWNER_ONLY_ACTIONS.has(action)) return false;
    const required = ACTION_PERMISSIONS[action];
    if (!required) return true;
    return member.permissions.has(required);
  }
  return false;
}

// Hedef kullanici uzerinde islem yapilabilir mi? Hata varsa hata mesaji dondurur, yoksa null.
function getTargetError(interaction, targetMember, action) {
  const guild = interaction.guild;
  const botMember = guild.members.me;

  if (!botMember) return '❌ Bot bu sunucuda bulunamadı.';

  const required = ACTION_PERMISSIONS[action];
  if (required && !botMember.permissions.has(required)) {
    return '❌ Botun bu işlemi yapabilmek için gerekli yetkisi yok.';
  }

  if (!targetMember) return '❌ Hedef kullanıcı bu sunucuda bulunamadı.';

  if (targetMember.id === guild.ownerId) return '❌ Sunucu sahibine bu işlem uygulanamaz.';
  if (targetMember.id === botMember.id) return '❌ Bota bu işlem uygulanamaz.';
  if (targetMember.id === interaction.user.id) return '❌ Kendine bu işlemi uygulayamazsın.';

  const targetHighest = targetMember.roles.highest.position;
  const actorHighest = interaction.member.roles.highest.position;

  // Sunucu sahibi haricinde: kullanicinin esit/yuksek rol hedeflemesi engellenir.
  if (interaction.user.id !== guild.ownerId && targetHighest >= actorHighest) {
    return '❌ Bu kullanıcıya işlem uygulayamazsın: hedef kullanıcı senden yüksek veya eşit bir role sahip.';
  }

  // Botun rol hiyerarsisi kontrolu.
  if (targetHighest >= botMember.roles.highest.position) {
    return '❌ Bot, kendisinden yüksek veya eşit role sahip bir kullanıcıya bu işlemi uygulayamaz.';
  }

  return null;
}

module.exports = {
  hasModerationPermission,
  getRoleTier,
  getTargetError,
  ACTION_PERMISSIONS,
  OWNER_ROLE_NAMES,
  ADMIN_ROLE_NAMES,
};
