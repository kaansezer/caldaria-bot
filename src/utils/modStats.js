const db = require('./database');

// Moderatör istatistiklerinde sayilan aksiyonlar.
const ACTIONS = [
  'ban',
  'unban',
  'kick',
  'timeout',
  'warn',
  'unwarn',
  'clear',
  'lock',
  'unlock',
  'slowmode',
  'nick',
  'role_add',
  'role_remove',
];

// Bir moderasyon aksiyonunu veritabanina kaydeder (modstats icin).
function logModAction(guildId, moderatorId, action, targetId = null) {
  if (!moderatorId) return;
  if (!ACTIONS.includes(action)) return;
  db.prepare(
    'INSERT INTO moderation_logs (guildId, moderatorId, action, targetId, createdAt) VALUES (?, ?, ?, ?, ?)'
  ).run(guildId, moderatorId, action, targetId, Date.now());
}

// Bir moderatorun aksiyon sayilarini dondurur: { ban: n, kick: n, ... }
function getModStats(guildId, moderatorId) {
  const rows = db
    .prepare(
      'SELECT action, COUNT(*) AS count FROM moderation_logs WHERE guildId = ? AND moderatorId = ? GROUP BY action'
    )
    .all(guildId, moderatorId);

  const counts = {};
  for (const action of ACTIONS) counts[action] = 0;
  for (const row of rows) {
    if (Object.prototype.hasOwnProperty.call(counts, row.action)) {
      counts[row.action] = row.count;
    }
  }
  return counts;
}

module.exports = { logModAction, getModStats, ACTIONS };
