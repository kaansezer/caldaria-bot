// Kufur / uygunsuz kelime filtre yardimcisi.
// Yasakli kelimeleri ve kelime tespit mantigini burada tutar.

// Yaygin leet/sembol kacis karakterleri -> harf eslemeleri.
// Ornek: s4lak, s@lak, s3ks gibi yazimlarin yakalanmasini saglar.
const LEET_MAP = {
  a: ['4', '@'],
  e: ['3'],
  i: ['1', '!'],
  o: ['0'],
  s: ['5', '$'],
  t: ['7'],
  g: ['9'],
  z: ['2'],
};

// Harfler arasina sikistirilabilen ayirici karakterler.
// Ornek: s.a.l.a.k, s-a-l-a-k, s a l a k gibi kacislar yakalanir.
const SEPARATOR_PATTERN = '[\\s._\\-~,;:/\\\\|+*#@!?()\\[\\]{}\"\'=%&]*';

// Yasakli kelime listesi. Duz yazimlari ekleyin (Turkce karakterlerle).
// Kucuk harf kullanin; buyuk/kucuk harf farki otomatik yok sayilir.
// Ileride sonekli halleri de yakalamak isterseniz:
//   { word: 'sik', stem: true }   -> 'sik', 'sikmek', 'sikiyorum' gibi halleri yakalar.
const bannedWords = [
  'amına',
  'amı',
  'amcık',
  'amk',
  'amq',
  'aq',
  'ao',
  'sik',
  'sikik',
  'sikerim',
  'sikeyim',
  'sikiyorum',
  'sikmek',
  'siktir',
  'siktirgit',
  'skm',
  'sks',
  'orospu',
  'orospu çocuğu',
  'oç',
  'oe',
  'pezevenk',
  'puşt',
  'piç',
  'gavat',
  'göt',
  'götveren',
  'ibne',
  'oç',
  'yavşak',
  'kahpe',
  'kaltak',
  'dönek',
  'salak',
  'mal',
  'gerizekalı',
  'embesil',
  'dangalak',
];

function escapeCharClass(char) {
  return char.replace(/[\]\\^\-]/g, '\\$&');
}

// Kelime icin derlenmis regex nesnesi
function buildRegex(word, stem) {
  const lowerWord = word.toLocaleLowerCase('tr-TR');
  const charClasses = [...lowerWord].map((char) => {
    const equivalents = LEET_MAP[char] || [];
    const classBody = [...new Set([char, ...equivalents])].map(escapeCharClass).join('');
    return `[${classBody}]`;
  });

  const body = charClasses.join(SEPARATOR_PATTERN);
  const startBoundary = '(^|[^\\p{L}\\p{N}])';
  const endBoundary = stem ? '' : '($|[^\\p{L}\\p{N}])';

  return new RegExp(`${startBoundary}${body}${endBoundary}`, 'iu');
}

// Kelime listesini uygulanabilir forma donusturur
function compileList() {
  return bannedWords.map((entry) => {
    if (typeof entry === 'string') {
      return { word: entry, regex: buildRegex(entry, false) };
    }
    return { word: entry.word, regex: buildRegex(entry.word, Boolean(entry.stem)) };
  });
}

const compiled = compileList();

// Verilen metin yasakli bir kelime iceriyorsa eslesen kelimeyi,
// icermiyorsa null dondurur.
function containsProfanity(text) {
  const normalized = String(text).toLocaleLowerCase('tr-TR');

  for (const { word, regex } of compiled) {
    if (regex.test(normalized)) {
      return word;
    }
  }

  return null;
}

module.exports = { containsProfanity, bannedWords };
