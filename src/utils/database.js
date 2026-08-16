const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const logger = require('./logger');

// Veritabani dosyasi: data/moderation.sqlite
const dataDir = path.join(__dirname, '..', '..', 'data');
fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'moderation.sqlite'));
db.pragma('journal_mode = WAL');

// Warn tablosu. Soft-delete icin deletedAt + deletedBy alanlari kullanilir (audit amaciyla kayit korunur).
db.exec(`
  CREATE TABLE IF NOT EXISTS warnings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guildId TEXT NOT NULL,
    userId TEXT NOT NULL,
    moderatorId TEXT,
    reason TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'manual',
    createdAt INTEGER NOT NULL,
    deletedAt INTEGER,
    deletedBy TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_warnings_guild_user ON warnings (guildId, userId);
  CREATE INDEX IF NOT EXISTS idx_warnings_active ON warnings (guildId, userId, deletedAt);

  CREATE TABLE IF NOT EXISTS guild_settings (
    guildId TEXT NOT NULL,
    key TEXT NOT NULL,
    value TEXT,
    PRIMARY KEY (guildId, key)
  );

  CREATE TABLE IF NOT EXISTS timeout_states (
    guildId TEXT NOT NULL,
    userId TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'warn_system',
    permanent INTEGER NOT NULL DEFAULT 0,
    warnCount INTEGER,
    appliedAt INTEGER,
    expiresAt INTEGER,
    PRIMARY KEY (guildId, userId)
  );

  CREATE TABLE IF NOT EXISTS moderation_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guildId TEXT NOT NULL,
    moderatorId TEXT NOT NULL,
    action TEXT NOT NULL,
    targetId TEXT,
    createdAt INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_modlog_guild_moderator ON moderation_logs (guildId, moderatorId);

  CREATE TABLE IF NOT EXISTS tempbans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guildId TEXT NOT NULL,
    userId TEXT NOT NULL,
    reason TEXT,
    moderatorId TEXT,
    createdAt INTEGER NOT NULL,
    expiresAt INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_tempbans_guild_user ON tempbans (guildId, userId);

  CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    caseNumber INTEGER NOT NULL,
    guildId TEXT NOT NULL,
    action TEXT NOT NULL,
    moderatorId TEXT,
    targetId TEXT,
    reason TEXT,
    details TEXT,
    createdAt INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_audit_guild ON audit_logs (guildId);
  CREATE INDEX IF NOT EXISTS idx_audit_guild_case ON audit_logs (guildId, caseNumber);
  CREATE INDEX IF NOT EXISTS idx_audit_guild_target ON audit_logs (guildId, targetId);

  CREATE TABLE IF NOT EXISTS gemini_settings (
    guild_id TEXT PRIMARY KEY,
    chat_channel_id TEXT,
    system_prompt TEXT,
    is_enabled INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS gemini_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    channel_id TEXT,
    role TEXT NOT NULL,
    parts TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_gemini_history_ctx ON gemini_history (guild_id, channel_id, user_id);

  CREATE TABLE IF NOT EXISTS youtube_channels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    youtube_channel_id TEXT NOT NULL,
    discord_channel_id TEXT NOT NULL,
    ping_role_id TEXT,
    last_video_id TEXT,
    created_at INTEGER NOT NULL,
    UNIQUE (guild_id, youtube_channel_id)
  );

  CREATE TABLE IF NOT EXISTS tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id TEXT NOT NULL,
    guild_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    created_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_tickets_guild ON tickets (guild_id);
  CREATE INDEX IF NOT EXISTS idx_tickets_user ON tickets (user_id, status);

  CREATE TABLE IF NOT EXISTS welcome_settings (
    guild_id TEXT PRIMARY KEY,
    welcome_channel_id TEXT,
    autorole_id TEXT,
    welcome_message TEXT
  );
`);

// Eski veritabaninda deletedBy kolonu yoksa ekle (migration)
const warningColumns = db.prepare('PRAGMA table_info(warnings)').all().map((c) => c.name);
if (!warningColumns.includes('deletedBy')) {
  db.exec('ALTER TABLE warnings ADD COLUMN deletedBy TEXT');
}

logger.info('Veritabani hazir: data/moderation.sqlite');

module.exports = db;
