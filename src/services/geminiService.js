const { GoogleGenAI } = require('@google/genai');
const db = require('../utils/database');
const logger = require('../utils/logger');

const MODEL = 'gemini-2.5-flash';
const MAX_CONTEXT_MESSAGES = 10; // Son X mesaj baglam olarak saklanir
const MAX_RESPONSE_LENGTH = 2000; // Discord mesaj limiti
const MAX_PARTS_LENGTH = 2000;

const DEFAULT_SYSTEM_PROMPT =
  'Sen Caldenia sunucusunun yardimci yapay zeka asistanisin. Türkçe ve Ingilizce sorulari anlayip kisa, net ve kibar yanitlar ver.';

// GoogleGenAI istemcisi tek seferde olusturulur (API key env'den okunur).
let aiClient = null;
function getAiClient() {
  if (!process.env.GEMINI_API_KEY) {
    logger.warn('[GEMINI] GEMINI_API_KEY .env dosyasinda tanimli degil.');
    return null;
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return aiClient;
}

// ---- SQLite erisimleri (gemini_settings) ----

function getGuildSettings(guildId) {
  return (
    db
      .prepare(
        'SELECT guild_id, chat_channel_id, system_prompt, is_enabled FROM gemini_settings WHERE guild_id = ?'
      )
      .get(guildId) || null
  );
}

// Sunucu ayarini upsert eder. Donen deger: { ok, message }
function saveGuildSettings(guildId, { chatChannelId = null, systemPrompt = null }) {
  const existing = getGuildSettings(guildId);
  const nextChannelId = chatChannelId !== null ? chatChannelId : existing?.chat_channel_id || null;
  const nextPrompt =
    systemPrompt !== null && systemPrompt.trim().length > 0
      ? systemPrompt.trim()
      : existing?.system_prompt || DEFAULT_SYSTEM_PROMPT;

  db.prepare(
    `INSERT INTO gemini_settings (guild_id, chat_channel_id, system_prompt, is_enabled)
     VALUES (?, ?, ?, 1)
     ON CONFLICT(guild_id) DO UPDATE SET
       chat_channel_id = excluded.chat_channel_id,
       system_prompt = excluded.system_prompt`
  ).run(guildId, nextChannelId, nextPrompt);

  return { ok: true, chatChannelId: nextChannelId, systemPrompt: nextPrompt };
}

function setEnabled(guildId, enabled) {
  db.prepare(
    `INSERT INTO gemini_settings (guild_id, chat_channel_id, system_prompt, is_enabled)
     VALUES (?, NULL, ?, ?)
     ON CONFLICT(guild_id) DO UPDATE SET is_enabled = excluded.is_enabled`
  ).run(guildId, DEFAULT_SYSTEM_PROMPT, enabled ? 1 : 0);
}

// ---- Konusma gecmisi (gemini_history) ----

function addHistory({ guildId, userId, channelId, role, text }) {
  db.prepare(
    `INSERT INTO gemini_history (guild_id, user_id, channel_id, role, parts, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(guildId, userId, channelId, role, String(text).slice(0, MAX_PARTS_LENGTH), Date.now());
}

function trimHistory(guildId, channelId, userId) {
  // Son X mesaj disindakileri siler (context limiti korumak icin).
  const rows = db
    .prepare(
      `SELECT id FROM gemini_history
       WHERE guild_id = ? AND channel_id = ? AND user_id = ?
       ORDER BY id DESC LIMIT ?`
    )
    .all(guildId, channelId, userId, MAX_CONTEXT_MESSAGES);
  const keepIds = rows.map((r) => r.id);
  if (keepIds.length === 0) return;

  const placeholders = keepIds.map(() => '?').join(',');
  db.prepare(
    `DELETE FROM gemini_history WHERE guild_id = ? AND channel_id = ? AND user_id = ? AND id NOT IN (${placeholders})`
  ).run(guildId, channelId, userId, ...keepIds);
}

function getHistory(guildId, channelId, userId) {
  trimHistory(guildId, channelId, userId);
  return db
    .prepare(
      `SELECT role, parts FROM gemini_history
       WHERE guild_id = ? AND channel_id = ? AND user_id = ?
       ORDER BY id ASC`
    )
    .all(guildId, channelId, userId);
}

function clearHistory(guildId, channelId, userId) {
  db.prepare(
    'DELETE FROM gemini_history WHERE guild_id = ? AND channel_id = ? AND user_id = ?'
  ).run(guildId, channelId, userId);
}

// ---- Gemini API cagrisi ----

// Baglam dizisini Gemini formatina cevirir.
function buildContents(history, userText) {
  const contents = history.map((row) => ({
    role: row.role === 'model' ? 'model' : 'user',
    parts: [{ text: row.parts }],
  }));
  contents.push({ role: 'user', parts: [{ text: userText }] });
  return contents;
}

// Gemini'den yanit ister. Donen deger: { ok, text, errorMessage }
async function chat({ guildId, userId, channelId, prompt }) {
  const client = getAiClient();
  if (!client) {
    return { ok: false, text: null, errorMessage: 'GEMINI_API_KEY ayarlanmamis.' };
  }

  const settings = getGuildSettings(guildId);
  const systemPrompt = settings?.system_prompt || DEFAULT_SYSTEM_PROMPT;

  try {
    const history = getHistory(guildId, channelId, userId);
    const contents = buildContents(history, prompt);

    const response = await client.models.generateContent({
      model: MODEL,
      contents,
      config: { systemInstruction: systemPrompt },
    });

    const text = response.text;
    if (!text) {
      return { ok: false, text: null, errorMessage: 'Gemini bos yanit dondu.' };
    }

    // Gecmise kaydet (trim sonrasi)
    addHistory({ guildId, userId, channelId, role: 'user', text: prompt });
    addHistory({ guildId, userId, channelId, role: 'model', text });
    trimHistory(guildId, channelId, userId);

    return { ok: true, text, errorMessage: null };
  } catch (error) {
    logger.error('[GEMINI] Yanit hatasi:', error.message);
    const msg = error.message || 'Bilinmeyen hata';
    if (msg.includes('429') || msg.includes('quota')) {
      return { ok: false, text: null, errorMessage: 'API limiti asildi, kisa sure sonra tekrar deneyin.' };
    }
    return { ok: false, text: null, errorMessage: 'Gemini API hata: ' + msg.slice(0, 300) };
  }
}

// Uzun metinlari Discord mesaj limitine gore parcaya boler.
function splitResponse(text) {
  const parts = [];
  let remaining = text;
  while (remaining.length > MAX_RESPONSE_LENGTH) {
    let cut = remaining.lastIndexOf('\n', MAX_RESPONSE_LENGTH);
    if (cut <= 0) cut = MAX_RESPONSE_LENGTH;
    parts.push(remaining.slice(0, cut).trim());
    remaining = remaining.slice(cut).trim();
  }
  if (remaining.length > 0) parts.push(remaining);
  return parts;
}

async function sendAsMessages(target, parts) {
  // target: channel veya interaction (slash command). Uzun yaniti birden fazla mesaja böler.
  const isInteraction = target && typeof target.reply === 'function' && !target.isThread;
  let firstSent = false;

  for (const part of parts) {
    if (!firstSent) {
      if (isInteraction) {
        // Komut: defer sonrasi editReply ilk parca, geri kalani followUp.
        if (target.deferred || target.replied) {
          await target.editReply({ content: part });
        } else {
          await target.reply({ content: part });
        }
      } else {
        await target.send(part);
      }
      firstSent = true;
      continue;
    }

    // Ilk parca sonrasi kalanlar.
    if (isInteraction) {
      await target.followUp({ content: part });
    } else if (target.channel) {
      await target.channel.send(part);
    } else {
      await target.reply(part);
    }
  }
}

function getChannelContextKey(channel) {
  // Thread icindeki sohbetleri ayri tutmak icin thread id'si kullanilir.
  if (!channel) return null;
  if (channel.isThread && channel.isThread()) return channel.id;
  return channel.id;
}

module.exports = {
  MODEL,
  DEFAULT_SYSTEM_PROMPT,
  MAX_CONTEXT_MESSAGES,
  getGuildSettings,
  saveGuildSettings,
  setEnabled,
  addHistory,
  getHistory,
  clearHistory,
  chat,
  splitResponse,
  sendAsMessages,
  getChannelContextKey,
};