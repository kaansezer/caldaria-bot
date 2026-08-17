const { execFile } = require('child_process');

// Bannerlord Coop sunucusunu yonetmek icin blctl script'ini calistirir.
// Bot root olarak calisiyorsa sudo kullanilmaz; baska bir kullaniciyla
// calisiyorsa sudo uzerinden erisir (sudoers: NOPASSWD tek komut).
const CTL_PATH = process.env.SERVER_CTL || '/usr/local/bin/blctl';

const IS_ROOT = typeof process.getuid === 'function' && process.getuid() === 0;

const TIMEOUT_MS = 60000;

function run(args, timeoutMs = TIMEOUT_MS) {
  return new Promise((resolve) => {
    const command = IS_ROOT ? CTL_PATH : 'sudo';
    const commandArgs = IS_ROOT ? args : [CTL_PATH, ...args];

    execFile(command, commandArgs, { timeout: timeoutMs }, (error, stdout, stderr) => {
      const output = String(stdout || '').trim();
      const errorText = String(stderr || '').trim();

      if (error) {
        const message = errorText || output || error.message || 'Bilinmeyen hata';
        resolve({ ok: false, output, message });
        return;
      }

      resolve({ ok: true, output });
    });
  });
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function status() {
  const result = await run(['status'], 15000);
  if (!result.ok) {
    return { ok: false, running: false, message: result.message };
  }
  return { ok: true, running: result.output.includes('RUNNING'), raw: result.output };
}

async function start() {
  const result = await run(['start']);
  if (!result.ok) return { ok: false, message: result.message };

  if (result.output.includes('ALREADY_RUNNING')) {
    return { ok: true, alreadyRunning: true, message: 'Sunucu zaten çalışıyor.' };
  }
  if (result.output.includes('FAILED_TO_START')) {
    return { ok: false, message: 'Sunucu başlatılamadı. Logları kontrol edin.' };
  }
  if (result.output.includes('ERROR_DIR_NOT_FOUND')) {
    return { ok: false, message: 'Sunucu dizini bulunamadı (SERVER_DIR kontrol edin).' };
  }
  return { ok: true, message: 'Sunucu başlatıldı.' };
}

async function stop() {
  const result = await run(['stop']);
  if (!result.ok) return { ok: false, message: result.message };

  if (result.output.includes('NOT_RUNNING')) {
    return { ok: true, alreadyStopped: true, message: 'Sunucu zaten kapalı.' };
  }
  if (result.output.includes('STOPPED_GRACEFUL')) {
    return { ok: true, message: 'Sunucu nazikçe kapatıldı.' };
  }
  return { ok: true, message: 'Sunucu kapatıldı (fallback kill gerekli oldu).' };
}

async function restart() {
  const result = await run(['restart']);
  if (!result.ok) return { ok: false, message: result.message };
  return { ok: true, message: 'Sunucu yeniden başlatıldı.' };
}

async function consoleCommand(command) {
  const clean = String(command || '').replace(/[\n\r]/g, ' ').trim();
  if (!clean) {
    return { ok: false, message: 'Gönderilecek komut boş olamaz.' };
  }

  const result = await run(['console', clean], 15000);
  if (!result.ok) return { ok: false, message: result.message };
  if (result.output.includes('NOT_RUNNING')) {
    return { ok: false, message: 'Sunucu çalışmıyor, komut gönderilemedi.' };
  }
  if (result.output.includes('NO_CONSOLE')) {
    return { ok: false, message: 'Sunucu konsolu erişilebilir değil.' };
  }
  return { ok: true, message: 'Komut gönderildi.' };
}

module.exports = {
  start,
  stop,
  restart,
  status,
  consoleCommand,
  CTL_PATH,
};