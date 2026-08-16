const { PermissionFlagsBits } = require('discord.js');
const moderationConfig = require('../config/moderationConfig');
const { getActiveWarningCount } = require('./warnManager');
const {
  getTimeoutState,
  setTimeoutState,
  clearTimeoutState,
  safeRemoveTimeout,
} = require('./timeoutManager');
const {
  applyPermanentTimeout,
  releasePermanentTimeout,
  cancelPermanentReapply,
} = require('./permanentTimeout');
const logger = require('./logger');

// Ceza uygulanamama sebeplerinin okunabilir karsiliklar.
const REASON_TEXT = {
  bot_uyesi_yok: 'Bot üyeliği bulunamadı.',
  bot_yetkisi_yok: 'Botun Moderate Members yetkisi yok.',
  hedef_owner: 'Hedef sunucu sahibi.',
  hiyerarsi: 'Hedef kullanıcı botun rolünün üstünde.',
  hedef_yok: 'Hedef kullanıcı sunucuda değil.',
  manuel_korundu: 'Aktif manuel timeout korundu.',
};

// Warn sayisina karsilik gelen ceza tanimini dondurur (5 ve uzeri permanent).
function getPenaltyForCount(count, table = null) {
  if (!count || count <= 0) return null;

  const penalties = table || moderationConfig.penalties;
  const permanent = penalties.find((p) => p.permanent);
  if (permanent && count >= permanent.warns) return permanent;

  return penalties.find((p) => p.warns === count) || null;
}

function describePenalty(penalty) {
  return penalty ? penalty.label : null;
}

function penaltyReasonText(reason) {
  return REASON_TEXT[reason] || 'Bilinmeyen sebep.';
}

// Merkezi ceza fonksiyonu. Her warn degisikliginden sonra cagrilir:
// - warn sayisi arttiysa cezayi uygular/gunceller
// - warn sayisi azaldiysa cezayi geri ceker/gunceller
// - 5+ warn ise permanent timeout yonetir (28 gunluk donen timeout)
// Yalnizca warn sistemine ait timeout'lari yonetir; manuel timeout'a dokunmaz.
async function applyWarnPenalty(member, options = {}) {
  const { source } = options;
  const guild = member.guild;
  const count = getActiveWarningCount(guild.id, member.id);

  const penaltiesTable = (source === 'profanity_filter' && moderationConfig.profanityPenalty)
    ? moderationConfig.profanityPenalty
    : null;
  const penalty = getPenaltyForCount(count, penaltiesTable);
  const state = getTimeoutState(guild.id, member.id);

  const result = { count, penalty, applied: false, action: null, reason: null };

  const botMember = guild.members.me;
  if (!botMember) {
    result.reason = 'bot_uyesi_yok';
    return result;
  }
  if (!botMember.permissions.has(PermissionFlagsBits.ModerateMembers)) {
    result.reason = 'bot_yetkisi_yok';
    return result;
  }
  if (member.id === guild.ownerId) {
    result.reason = 'hedef_owner';
    return result;
  }
  if (member.roles.highest.position >= botMember.roles.highest.position) {
    result.reason = 'hiyerarsi';
    return result;
  }

  // Manuel timeout aktifken warn sisteminin timeout'una dokunma (permanent haric).
  // Yoneticinin /timeout ile verdigi manuel timeout korunur.
  if (state && state.source === 'manual' && !(penalty && penalty.permanent)) {
    if (state.permanent === 1) {
      cancelPermanentReapply(guild.id, member.id);
      clearTimeoutState(guild.id, member.id);
    }
    result.action = 'manual_korundu';
    result.reason = 'manuel_korundu';
    return result;
  }

  if (penalty && penalty.permanent) {
    // 5+ warn -> permanent timeout
    if (!(state && state.permanent === 1)) {
      await applyPermanentTimeout(member, count);
      result.applied = true;
      result.action = 'permanent';
    } else {
      // Zaten permanent; zamanlayici aktif. Sadece sayiyi guncelle.
      await setTimeoutState(guild.id, member.id, {
        source: 'warn_system',
        permanent: 1,
        warnCount: count,
        appliedAt: Date.now(),
        expiresAt: state.expiresAt,
      });
      result.applied = true;
      result.action = 'permanent_devam';
    }
    return result;
  }

  // Permanent flag'i kaldir (count < 5'e dustu)
  if (state && state.permanent === 1) {
    if (state.source === 'warn_system') {
      await releasePermanentTimeout(member);
    } else {
      cancelPermanentReapply(guild.id, member.id);
      clearTimeoutState(guild.id, member.id);
    }
  }

  if (!penalty) {
    // Ceza yok -> warn sisteminin timeout'unu kaldir (manuel ise dokunma).
    if (state && state.source === 'warn_system') {
      await safeRemoveTimeout(member, state);
      clearTimeoutState(guild.id, member.id);
      result.action = 'removed';
    }
    return result;
  }

  // Kademeli timeout uygula (1-4 warn)
  const expiresAt = Date.now() + penalty.duration;
  await member.timeout(penalty.duration, `Warn sistemi - ${count} aktif warn`);

  await setTimeoutState(guild.id, member.id, {
    source: 'warn_system',
    permanent: 0,
    warnCount: count,
    appliedAt: Date.now(),
    expiresAt,
  });

  result.applied = true;
  result.action = 'timeout';
  logger.info(
    `[WARN-PENALTY] ${member.user.tag} icin ceza uygulandi: ${penalty.label} (${count} warn).`
  );
  return result;
}

module.exports = { getPenaltyForCount, describePenalty, penaltyReasonText, applyWarnPenalty };
