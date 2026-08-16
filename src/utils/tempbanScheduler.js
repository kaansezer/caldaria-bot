const db = require('./database');
const { sendModLog } = require('./modLog');
const { buildTempbanExpiredLogEmbed } = require('./modLogEmbeds');
const logger = require('./logger');

const CHUNK_MS = 20 * 24 * 60 * 60 * 1000; // setTimeout siniri (~24.8 gun) icin parcali bekleme

// Tempban kaydini veritabanina ekler.
function addTempban(guildId, userId, { reason, moderatorId, expiresAt }) {
  db.prepare(
    'INSERT INTO tempbans (guildId, userId, reason, moderatorId, createdAt, expiresAt) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(guildId, userId, reason, moderatorId, Date.now(), expiresAt);
}

// Kullanicinin aktif tempban kaydini dondurur (yoksa null).
function getActiveTempban(guildId, userId) {
  const now = Date.now();
  return (
    db
      .prepare(
        'SELECT * FROM tempbans WHERE guildId = ? AND userId = ? AND expiresAt > ? ORDER BY id DESC LIMIT 1'
      )
      .get(guildId, userId, now) || null
  );
}

// Kullanicinin aktif tempban kaydini siler.
function removeTempban(guildId, userId) {
  db.prepare('DELETE FROM tempbans WHERE guildId = ? AND userId = ?').run(guildId, userId);
}

// Sureci dolan tum tempban kayitlarini dondurur.
function getExpiredTempbans() {
  return db
    .prepare('SELECT * FROM tempbans WHERE expiresAt <= ? ORDER BY expiresAt ASC')
    .all(Date.now());
}

// Bir tempban kaydinin suresi doldu: unban uygula + kaydi sil + mod-log.
async function expireTempban(client, row) {
  const guild = client.guilds.cache.get(row.guildId);
  if (!guild) {
    // Sunucu artik mevcut degil: kaydi sil.
    db.prepare('DELETE FROM tempbans WHERE id = ?').run(row.id);
    return;
  }

  try {
    const bans = await guild.bans.fetch();
    const isBanned = bans.some((ban) => ban.user.id === row.userId);

    if (isBanned) {
      await guild.members.unban(row.userId, 'Tempban süresi doldu - otomatik unban');
      logger.info(
        `[TEMP-BAN] ${row.userId} kullanicisinin tempban suresi doldu; unban uygulandi (${guild.name}).`
      );
    }

    // Mod-log: sure dolan tempban kaydi
    const modLogEmbed = buildTempbanExpiredLogEmbed({
      userId: row.userId,
      reason: row.reason || 'Sebep belirtilmedi',
    });
    await sendModLog(guild, modLogEmbed);
  } catch (error) {
    logger.error(`[TEMP-BAN] Otomatik unban basarisiz (${row.userId}):`, error.message);
  } finally {
    db.prepare('DELETE FROM tempbans WHERE id = ?').run(row.id);
  }
}

// Restart sonrasi sureci dolan tempbanlari temizler.
async function sweepTempbans(client) {
  const expired = getExpiredTempbans();
  for (const row of expired) {
    await expireTempban(client, row);
  }
  if (expired.length > 0) {
    logger.info(`[TEMP-BAN] Restart taramasi: ${expired.length} sureci dolan tempban islendi.`);
  }

  // Henuz sureci dolmayan en yakin tempban icin zamanlayici kur.
  scheduleNextTempban(client);
}

// Suresi dolacak en yakin tempban icin tek seferlik zamanlayici kurar.
function scheduleNextTempban(client) {
  const next = db
    .prepare('SELECT * FROM tempbans WHERE expiresAt > ? ORDER BY expiresAt ASC LIMIT 1')
    .get(Date.now());

  if (!next) return;

  const wait = next.expiresAt - Date.now();
  const timeout = Math.min(wait, CHUNK_MS);

  setTimeout(async () => {
    if (wait > CHUNK_MS) {
      // Sure hala uzak: yeniden zamanlayici kur.
      scheduleNextTempban(client);
      return;
    }
    await expireTempban(client, next);
    scheduleNextTempban(client);
  }, timeout);
}

// Bot baslangicinda cagrilir: once gecmisleri temizle, sonra zamanlayiciyi kur.
function initTempbans(client) {
  sweepTempbans(client).catch((error) => {
    logger.error('[TEMP-BAN] Baslangic taramasi hatasi:', error);
  });
}

module.exports = {
  addTempban,
  getActiveTempban,
  removeTempban,
  getExpiredTempbans,
  expireTempban,
  sweepTempbans,
  initTempbans,
};
