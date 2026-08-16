const moderationConfig = require('../config/moderationConfig');
const { getActiveWarningCount } = require('./warnManager');
const { getTimeoutState, setTimeoutState, clearTimeoutState, safeRemoveTimeout } = require('./timeoutManager');
const logger = require('./logger');

// setTimeout limiti ~24.8 gundur (2^31-1 ms). 28 gun tek setTimeout ile kurulamaz,
// bu yuzden 20 gunluk parcalar halinde programlanir ve her parca sonunda yeniden degerlendirilir.
const CHUNK_MS = 20 * 24 * 60 * 60 * 1000;

const timers = new Map(); // "guildId:userId" -> timeout handle
let client = null;

function key(guildId, userId) {
  return `${guildId}:${userId}`;
}

function init(clientRef) {
  client = clientRef;
}

function cancelPermanentReapply(guildId, userId) {
  const k = key(guildId, userId);
  const handle = timers.get(k);
  if (handle) {
    clearTimeout(handle);
    timers.delete(k);
  }
}

// Expiry bitmeden once yenileme zamanlayicisini kurar (coklu parca destegi).
function schedulePermanentReapply(guildId, userId, expiresAt) {
  cancelPermanentReapply(guildId, userId);

  let remaining = expiresAt - Date.now() - moderationConfig.permanentReapplyMargin;
  if (remaining < 0) remaining = 0;
  const delay = Math.min(remaining, CHUNK_MS);

  const handle = setTimeout(() => {
    timers.delete(key(guildId, userId));
    handleRefresh(guildId, userId).catch((error) => {
      logger.error(`[PERMANENT-TIMEOUT] Yenileme hatasi (${guildId}/${userId}):`, error.message);
    });
  }, delay);

  timers.set(key(guildId, userId), handle);
}

// Kullaniciya 28 gunluk timeout uygular, durumu kaydeder ve yenileme zamanlar.
async function applyPermanentTimeout(member, warnCount) {
  const now = Date.now();
  const expiresAt = now + moderationConfig.permanentTimeoutDuration;

  await member.timeout(
    moderationConfig.permanentTimeoutDuration,
    `Warn sistemi - ${warnCount} aktif warn (Permanent timeout)`
  );

  await setTimeoutState(member.guild.id, member.id, {
    source: 'warn_system',
    permanent: 1,
    warnCount,
    appliedAt: now,
    expiresAt,
  });

  schedulePermanentReapply(member.guild.id, member.id, expiresAt);
  return expiresAt;
}

// Zamanlayici tetiklendiginde: hala permanent ise yenile, degilse temizle.
async function handleRefresh(guildId, userId) {
  if (!client) return;

  const state = getTimeoutState(guildId, userId);
  if (!state || state.permanent !== 1) return;

  const guild = client.guilds.cache.get(guildId);
  if (!guild) return;

  const member = await guild.members.fetch(userId).catch(() => null);
  if (!member) return;

  const count = getActiveWarningCount(guildId, userId);
  if (count < 5) {
    await releasePermanentTimeout(member);
    return;
  }

  await applyPermanentTimeout(member, count);
  logger.info(`[PERMANENT-TIMEOUT] ${member.user.tag} permanent timeout yenilendi (${count} warn).`);
}

// Permanent timeout'u tamamen kaldirir (zamanlayici + durum + discord timeout).
async function releasePermanentTimeout(member) {
  cancelPermanentReapply(member.guild.id, member.id);

  const state = getTimeoutState(member.guild.id, member.id);
  await safeRemoveTimeout(member, state);
  clearTimeoutState(member.guild.id, member.id);
}

// Bot acildiginda 5+ warn kullanicilarini bulup permanent timeout'u yeniden uygular.
async function sweepPermanentTimeouts(clientRef) {
  init(clientRef);

  const rows = require('./timeoutManager').getPermanentTimeoutUsers();
  let restored = 0;

  for (const row of rows) {
    try {
      const guild = client.guilds.cache.get(row.guildId);
      if (!guild) continue;

      const member = await guild.members.fetch(row.userId).catch(() => null);
      if (!member) continue;

      const count = getActiveWarningCount(row.guildId, row.userId);
      if (count >= 5) {
        await applyPermanentTimeout(member, count);
        restored += 1;
      } else {
        await releasePermanentTimeout(member);
      }
    } catch (error) {
      logger.warn(
        `[PERMANENT-TIMEOUT] Restart taramasi sirasinda hata (${row.guildId}/${row.userId}):`,
        error.message
      );
    }
  }

  logger.info(`[PERMANENT-TIMEOUT] Restart taramasi tamamlandi (${restored} kullanici yenilendi).`);
  return restored;
}

module.exports = {
  init,
  applyPermanentTimeout,
  releasePermanentTimeout,
  schedulePermanentReapply,
  cancelPermanentReapply,
  sweepPermanentTimeouts,
};
