require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { REST, Routes } = require('discord.js');
const logger = require('../src/utils/logger');

// Kullanim:
//   node scripts/deploy.js global            -> tum sunuculara global olarak kaydeder
//   node scripts/deploy.js guild <guildId>   -> sadece belirtilen sunucuya kaydeder
//   node scripts/deploy.js clear             -> global komutlari temizler
//   node scripts/deploy.js clear <guildId>   -> sunucudaki tüm komutlari temizler

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;

// src/commands klasorunu recursive gezerek .js sonlu komut dosyalarini toplar.
function collectCommandFiles(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectCommandFiles(fullPath));
    } else if (entry.name.endsWith('.js')) {
      results.push(fullPath);
    }
  }
  return results;
}

// Tum komutlarin JSON temsillerini yukler; hatali dosyada sureci durdurur (syntax hatasi yakalama).
function loadCommandData() {
  const commandsPath = path.join(__dirname, '..', 'src', 'commands');
  const files = collectCommandFiles(commandsPath);

  const commands = [];
  for (const file of files) {
    const command = require(file);
    if ('data' in command && 'execute' in command) {
      commands.push(command.data.toJSON());
    } else {
      logger.warn(`Atlandi: ${path.basename(file)} (data/execute yok)`);
    }
  }
  return commands;
}

// API hata mesajlarini okunabilir hale getirir, rate-limit bilgisini gosterir.
function formatError(error) {
  if (error.status === 429) {
    const retry = error.retryAfter || 'bilinmiyor';
    return `Rate limit (429): ${retry} saniye sonra tekrar deneyin.`;
  }
  if (error.status === 401) return '401 Yetkisiz: DISCORD_TOKEN gecersiz.';
  if (error.status === 403) return '403: Bot komut kaydetme yetkisine sahip degil.';
  if (error.status === 404) return '404: CLIENT_ID veya guildId gecersiz.';
  return `${error.status || '?'}: ${error.message}`;
}

async function main() {
  const [scope, guildId] = process.argv.slice(2);

  if (!TOKEN) {
    logger.error('DISCORD_TOKEN .env dosyasinda tanimli degil.');
    process.exit(1);
  }
  if (!CLIENT_ID) {
    logger.error('DISCORD_CLIENT_ID .env dosyasinda tanimli degil.');
    process.exit(1);
  }

  const rest = new REST({ version: '10' }).setToken(TOKEN);
  const commands = loadCommandData();
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  try {
    if (scope === 'global') {
      logger.info(`Globale ${commands.length} komut kaydediliyor...`);
      const data = await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
      logger.info(`✅ ${data.length} global komut kaydedildi.`);
    } else if (scope === 'guild' && guildId) {
      logger.info(`${guildId} sunucusuna ${commands.length} komut kaydediliyor...`);
      await rest.put(Routes.applicationGuildCommands(CLIENT_ID, guildId), { body: commands });
      logger.info(`✅ ${guildId} sunucusuna ${commands.length} komut kaydedildi.`);
      logger.info('Guncellemelerin gorunmesi birkaç dakika surebilir.');
    } else if (scope === 'clear') {
      const target = guildId
        ? Routes.applicationGuildCommands(CLIENT_ID, guildId)
        : Routes.applicationCommands(CLIENT_ID);
      await rest.put(target, { body: [] });
      logger.info(`✅ Komutlar temizlendi${guildId ? ` (guild: ${guildId})` : ' (global)'}.`);
    } else {
      logger.info('Kullanim: node scripts/deploy.js <global|guild <guildId>|clear [guildId]>');
      process.exit(1);
    }
  } catch (error) {
    logger.error(`Komut kaydi basarisiz: ${formatError(error)}`);
    process.exit(1);
  }

  // Rate-limit sonrasinda temiz kapatabilmek icin REST'in bekleyen islemlerini bekle.
  await sleep(500);
}

main();