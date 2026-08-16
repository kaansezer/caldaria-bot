const db = require('./database');

// Her moderasyon islemi icin sunucu bazli artan "case" numarasi olusturup kaydeder.
// Case numarasi sunucu icinde 1, 2, 3... seklinde gider; guildId ile ayirt edilir (coklu sunucu uyumlu).
function logAudit({ guildId, action, moderatorId, targetId = null, reason = null, details = null }) {
  const row = db
    .prepare('SELECT MAX(caseNumber) AS maxCase FROM audit_logs WHERE guildId = ?')
    .get(guildId);
  const caseNumber = (row && row.maxCase ? row.maxCase : 0) + 1;

  const info = db
    .prepare(
      `INSERT INTO audit_logs (caseNumber, guildId, action, moderatorId, targetId, reason, details, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(caseNumber, guildId, action, moderatorId, targetId, reason, details ? JSON.stringify(details) : null, Date.now());

  return { id: info.lastInsertRowid, caseNumber };
}

// Case numarasina gore kaydi dondurur.
function getAuditCase(guildId, caseNumber) {
  const row = db
    .prepare('SELECT * FROM audit_logs WHERE guildId = ? AND caseNumber = ?')
    .get(guildId, caseNumber);
  if (!row) return null;
  return { ...row, details: row.details ? JSON.parse(row.details) : null };
}

// Bir kullanicinin (hedef veya moderator olarak) islem gecmisini dondurur.
function getAuditCasesForUser(guildId, userId, limit = 20) {
  return db
    .prepare(
      `SELECT * FROM audit_logs
       WHERE guildId = ? AND (targetId = ? OR moderatorId = ?)
       ORDER BY id DESC LIMIT ?`
    )
    .all(guildId, userId, userId, limit)
    .map((row) => ({ ...row, details: row.details ? JSON.parse(row.details) : null }));
}

// Sunucudaki son islemleri dondurur.
function getRecentAuditCases(guildId, limit = 20) {
  return db
    .prepare('SELECT * FROM audit_logs WHERE guildId = ? ORDER BY id DESC LIMIT ?')
    .all(guildId, limit)
    .map((row) => ({ ...row, details: row.details ? JSON.parse(row.details) : null }));
}

module.exports = {
  logAudit,
  getAuditCase,
  getAuditCasesForUser,
  getRecentAuditCases,
};
