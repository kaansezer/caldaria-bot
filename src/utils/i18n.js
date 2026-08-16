const fs = require('fs');
const path = require('path');
const { getGuildSetting } = require('./settings');

const DEFAULT_LOCALE = 'tr';
const LOCALE_SETTING_KEY = 'locale';

const translations = {};
const i18nDir = path.join(__dirname, '..', 'i18n');
for (const file of fs.readdirSync(i18nDir).filter((f) => f.endsWith('.json'))) {
  const lang = path.basename(file, '.json');
  translations[lang] = require(path.join(i18nDir, file));
}

// Bir dilin anahtar karsiligini dondurur. Yoksa anahtar adini dondurur (eksik ceviri uyarisi).
function t(locale, key, vars = {}) {
  const table = translations[locale] || translations[DEFAULT_LOCALE] || {};
  let text = table[key];
  if (text === undefined) {
    text = key; // eksik ceviri fallback
  }
  for (const [k, v] of Object.entries(vars)) {
    text = text.replaceAll(`{${k}}`, String(v));
  }
  return text;
}

// Sunucunun dilini dondurur (ayarlanmamissa TR).
function getGuildLocale(guildId) {
  const locale = getGuildSetting(guildId, LOCALE_SETTING_KEY, DEFAULT_LOCALE);
  return translations[locale] ? locale : DEFAULT_LOCALE;
}

function setGuildLocale(guildId, locale) {
  const valid = translations[locale] ? locale : DEFAULT_LOCALE;
  const { setGuildSetting } = require('./settings');
  setGuildSetting(guildId, LOCALE_SETTING_KEY, valid);
  return valid;
}

module.exports = { t, getGuildLocale, setGuildLocale, DEFAULT_LOCALE, LOCALE_SETTING_KEY, translations };
