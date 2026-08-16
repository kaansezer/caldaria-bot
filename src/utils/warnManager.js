const db = require('./database');

// Warn kaynaklari. Kufur filtresi de otomatik warn verebiliyor.
const SOURCES = {
  manual: 'manual',
  profanityFilter: 'profanity_filter',
  automatic: 'automatic',
};

// Kullaniciya uyari ekler ve olusan warn kaydini dondurur.
function addWarn(guildId, userId, { reason, moderatorId = null, source = SOURCES.manual } = {}) {
  const createdAt = Date.now();
  const info = db
    .prepare(
      `INSERT INTO warnings (guildId, userId, moderatorId, reason, source, createdAt)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(guildId, userId, moderatorId, reason, source, createdAt);

  return db.prepare('SELECT * FROM warnings WHERE id = ?').get(info.lastInsertRowid);
}

// Aktif (silinmemis) warnlari en yeniden en eskiye dondurur.
function getWarnings(guildId, userId) {
  return db
    .prepare(
      `SELECT * FROM warnings
       WHERE guildId = ? AND userId = ? AND deletedAt IS NULL
       ORDER BY createdAt DESC, id DESC`
    )
    .all(guildId, userId);
}

// Tum warnlari (aktif + kaldirilmis) en yeniden en eskiye dondurur.
function getWarningsHistory(guildId, userId) {
  return db
    .prepare(
      `SELECT * FROM warnings
       WHERE guildId = ? AND userId = ?
       ORDER BY createdAt DESC, id DESC`
    )
    .all(guildId, userId);
}

// Aktif warn sayisini dondurur.
function getActiveWarningCount(guildId, userId) {
  return db
    .prepare(
      `SELECT COUNT(*) AS count FROM warnings
       WHERE guildId = ? AND userId = ? AND deletedAt IS NULL`
    )
    .get(guildId, userId).count;
}

function getWarningById(guildId, warnId) {
  return db.prepare('SELECT * FROM warnings WHERE id = ? AND guildId = ?').get(warnId, guildId);
}

// Tek warn'i soft-delete eder (deletedAt + deletedBy doldurulur). Silinen kaydi dondurur, yoksa null.
function removeWarn(guildId, warnId, { deletedBy = null } = {}) {
  const warning = getWarningById(guildId, warnId);
  if (!warning || warning.deletedAt) return null;

  db.prepare('UPDATE warnings SET deletedAt = ?, deletedBy = ? WHERE id = ?').run(
    Date.now(),
    deletedBy,
    warnId
  );
  return { ...warning, deletedAt: Date.now(), deletedBy };
}

// Kullanicinin tum aktif warnlarini soft-delete eder. Silinen warn sayisini dondurur.
function removeAllWarns(guildId, userId, { deletedBy = null } = {}) {
  const info = db
    .prepare(
      `UPDATE warnings SET deletedAt = ?, deletedBy = ?
       WHERE guildId = ? AND userId = ? AND deletedAt IS NULL`
    )
    .run(Date.now(), deletedBy, guildId, userId);
  return info.changes;
}

module.exports = {
  addWarn,
  getWarnings,
  getWarningsHistory,
  getActiveWarningCount,
  getWarningById,
  removeWarn,
  removeAllWarns,
  SOURCES,
};
