const cron = require('node-cron');
const Parser = require('rss-parser');
const { EmbedBuilder } = require('discord.js');
const db = require('../utils/database');
const logger = require('../utils/logger');

const FEED_URL_TEMPLATE = 'https://www.youtube.com/feeds/videos.xml?channel_id={channelId}';
const POLL_INTERVAL = '*/5 * * * *'; // 5 dakikada bir
const parser = new Parser({ timeout: 15000 });

let cronTask = null;

// ---- SQLite erisimleri (youtube_channels) ----

function getTrackedChannels() {
  return db.prepare('SELECT * FROM youtube_channels').all();
}

function getTrackedChannel(guildId, youtubeChannelId) {
  return (
    db
      .prepare('SELECT * FROM youtube_channels WHERE guild_id = ? AND youtube_channel_id = ?')
      .get(guildId, youtubeChannelId) || null
  );
}

function addTrackedChannel({ guildId, youtubeChannelId, discordChannelId, pingRoleId }) {
  db.prepare(
    `INSERT INTO youtube_channels (guild_id, youtube_channel_id, discord_channel_id, ping_role_id, last_video_id, created_at)
     VALUES (?, ?, ?, ?, NULL, ?)
     ON CONFLICT(guild_id, youtube_channel_id) DO UPDATE SET
       discord_channel_id = excluded.discord_channel_id,
       ping_role_id = excluded.ping_role_id`
  ).run(guildId, youtubeChannelId, discordChannelId, pingRoleId || null, Date.now());
}

function removeTrackedChannel(guildId, youtubeChannelId) {
  return db
    .prepare('DELETE FROM youtube_channels WHERE guild_id = ? AND youtube_channel_id = ?')
    .run(guildId, youtubeChannelId).changes;
}

// Yeni video goruldugunde last_video_id'yi hemen gunceller.
function updateLastVideo(guildId, youtubeChannelId, videoId) {
  db.prepare(
    'UPDATE youtube_channels SET last_video_id = ? WHERE guild_id = ? AND youtube_channel_id = ?'
  ).run(videoId, guildId, youtubeChannelId);
}

// Sadece guild + kanal bazli olarak işlemi kilitler (cakisma/duplike onleme).
const processing = new Set();
function isProcessing(record) {
  const key = `${record.guild_id}:${record.youtube_channel_id}`;
  if (processing.has(key)) return true;
  processing.add(key);
  return false;
}
function releaseProcessing(record) {
  processing.delete(`${record.guild_id}:${record.youtube_channel_id}`);
}

// RSS akisini citekler ve yeni video olup olmadigini kontrol eder.
async function checkChannel(client, record) {
  if (isProcessing(record)) return;

  try {
    const feedUrl = FEED_URL_TEMPLATE.replace('{channelId}', record.youtube_channel_id);
    const feed = await parser.parseURL(feedUrl);

    if (!feed.items || feed.items.length === 0) return;

    const first = feed.items[0];
    // video_id hem 'yt:video:ID' hem de 'ID' formunda gelebilir.
    const videoId = first.id ? first.id.replace(/^yt:video:/, '') : null;
    if (!videoId) return;

    if (record.last_video_id === videoId) return;

    updateLastVideo(record.guild_id, record.youtube_channel_id, videoId);

    // Veri kaydetmeden video detaylarini topla. Video yoksa alan listesini atla.
    const video = {
      id: videoId,
      title: first.title || 'Yeni video',
      url: first.link || `https://www.youtube.com/watch?v=${videoId}`,
      publishedAt: first.isoDate,
      thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
    };

    await postVideo(client, record, video);
  } catch (error) {
    if (error.statusCode === 404) {
      logger.warn(`[YOUTUBE] ${record.youtube_channel_id} RSS akisi bulunamadi (kanal yok veya gizli).`);
    } else {
      logger.error(`[YOUTUBE] RSS okuma hatasi (${record.youtube_channel_id}):`, error.message);
    }
  } finally {
    releaseProcessing(record);
  }
}

// Yeni videoyu bagli Discord kanalina zengin embed olarak gonderir.
async function postVideo(client, record, video) {
  const guild = client.guilds.cache.get(record.guild_id);
  if (!guild) return;

  const channel = guild.channels.cache.get(record.discord_channel_id);
  if (!channel || !channel.isTextBased()) {
    logger.warn(`[YOUTUBE] ${guild.name}: hedef kanal bulunamadi (${record.discord_channel_id}).`);
    return;
  }

  const role = record.ping_role_id ? guild.roles.cache.get(record.ping_role_id) : null;
  const content = role ? `${role.toString()} yeni video yayınlandı! 🎉` : null;
  const embed = buildVideoEmbed(video);

  try {
    await channel.send({ content, embeds: [embed] });
    logger.info(`[YOUTUBE] ${guild.name}: yeni video duyuruldu (${video.title})`);
  } catch (error) {
    logger.error(`[YOUTUBE] Video duyurusu gonderilemedi (${guild.name}):`, error.message);
  }
}

function buildVideoEmbed(video) {
  return new EmbedBuilder()
    .setColor(0xff0000)
    .setTitle('🎬 Yeni Video!')
    .setURL(video.url)
    .setDescription(`${video.title}\n\nYouTube kanalından yeni bir video yayınlandı!`)
    .setImage(video.thumbnail || null)
    .setFooter({
      text: 'YouTube',
      iconURL: 'https://www.youtube.com/s/desktop/f1e6ca53/img/favicon_144x144.png',
    })
    .setTimestamp();
}

// 5 dakikada bir tum kayitli kanallari kontrol eder.
function startYoutubeNotifier(client) {
  if (cronTask) return;

  cronTask = cron.schedule(POLL_INTERVAL, async () => {
    const records = getTrackedChannels();
    for (const record of records) {
      // Her kanali paralel degil sirali kontrol et (rate-limit korumasi).
      try {
        await checkChannel(client, record);
      } catch (error) {
        logger.error('[YOUTUBE] Kontrol hatasi:', error.message);
      }
    }
  });

  logger.info(`[YOUTUBE] Bildirim cron'i başlatıldi (${POLL_INTERVAL}).`);

  // Baslangicta mevcut son videoyu tani (restart sonrasi duplike engeli).
  const records = getTrackedChannels();
  for (const record of records) {
    checkChannel(client, record).catch(() => {});
  }
}

function stopYoutubeNotifier() {
  if (cronTask) {
    cronTask.stop();
    cronTask = null;
  }
}

module.exports = {
  getTrackedChannels,
  getTrackedChannel,
  addTrackedChannel,
  removeTrackedChannel,
  updateLastVideo,
  startYoutubeNotifier,
  stopYoutubeNotifier,
  buildVideoEmbed,
};