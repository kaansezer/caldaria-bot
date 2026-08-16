const db = require('./database');

// Sunucu bazli kalici ayar okur (guild_settings tablosu).
function getGuildSetting(guildId, key, defaultValue = null) {
  const row = db
    .prepare('SELECT value FROM guild_settings WHERE guildId = ? AND key = ?')
    .get(guildId, key);
  return row ? row.value : defaultValue;
}

// Sunucu bazli kalici ayar yazar.
function setGuildSetting(guildId, key, value) {
  db.prepare(
    `INSERT INTO guild_settings (guildId, key, value) VALUES (?, ?, ?)
     ON CONFLICT(guildId, key) DO UPDATE SET value = excluded.value`
  ).run(guildId, key, String(value));
  return value;
}

module.exports = { getGuildSetting, setGuildSetting };
