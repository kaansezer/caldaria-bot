const db = require('./database');

// Mevcut timeout'un bize (warn sistemine) ait oldugunu dogrulamak icin tolerans.
const TIMEOUT_TOLERANCE = 5 * 60 * 1000;

// Kullanicinin timeout durum kaydini dondurur.
function getTimeoutState(guildId, userId) {
  return (
    db.prepare('SELECT * FROM timeout_states WHERE guildId = ? AND userId = ?').get(guildId, userId) ||
    null
  );
}

// Timeout durum kaydini yazar/gunceller.
function setTimeoutState(guildId, userId, fields = {}) {
  const now = Date.now();
  db.prepare(
    `INSERT INTO timeout_states (guildId, userId, source, permanent, warnCount, appliedAt, expiresAt)
     VALUES (@guildId, @userId, @source, @permanent, @warnCount, @appliedAt, @expiresAt)
     ON CONFLICT(guildId, userId) DO UPDATE SET
       source = excluded.source,
       permanent = excluded.permanent,
       warnCount = excluded.warnCount,
       appliedAt = excluded.appliedAt,
       expiresAt = excluded.expiresAt`
  ).run({
    guildId,
    userId,
    source: fields.source || 'warn_system',
    permanent: fields.permanent ? 1 : 0,
    warnCount: fields.warnCount || 0,
    appliedAt: fields.appliedAt || now,
    expiresAt: fields.expiresAt || null,
  });
}

function clearTimeoutState(guildId, userId) {
  db.prepare('DELETE FROM timeout_states WHERE guildId = ? AND userId = ?').run(guildId, userId);
}

// Permanent (5+ warn) durumdaki kullanicilar (restart taramasi icin).
function getPermanentTimeoutUsers() {
  return db
    .prepare("SELECT * FROM timeout_states WHERE source = 'warn_system' AND permanent = 1")
    .all();
}

// Kullanicinin mevcut Discord timeout'u bizim kaydettigimiz zamanla eslesiyor mu?
function isOurTimeout(member, state) {
  if (!member || !state || !state.expiresAt) return false;
  const currentUntil = member.communicationDisabledUntil;
  if (!currentUntil) return false;
  const currentTime = new Date(currentUntil).getTime();
  return Math.abs(currentTime - state.expiresAt) <= TIMEOUT_TOLERANCE;
}

// Sadece warn sistemine ait oldugunu dogrulayarak timeout kaldirir.
async function safeRemoveTimeout(member, state) {
  if (state && state.source === 'warn_system' && isOurTimeout(member, state)) {
    await member.timeout(null, 'Warn sistemi - timeout kaldırıldı');
    return true;
  }
  return false;
}

module.exports = {
  getTimeoutState,
  setTimeoutState,
  clearTimeoutState,
  getPermanentTimeoutUsers,
  isOurTimeout,
  safeRemoveTimeout,
};
