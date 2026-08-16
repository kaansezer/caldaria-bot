// Otomatik ceza (warn -> timeout) sistemi ayarlari.
// Warn sayisina gore uygulanacak cezalar buradan kolayca duzenlenebilir.

module.exports = {
  // Warn sayisina gore timeout cezalari. 'permanent: true' olan esik "warns ve uzeri" icin gecerlidir.
  penalties: [
    { warns: 1, duration: 10 * 60 * 1000, label: '10 dakika Timeout' },
    { warns: 2, duration: 30 * 60 * 1000, label: '30 dakika Timeout' },
    { warns: 3, duration: 2 * 60 * 60 * 1000, label: '2 saat Timeout' },
    { warns: 4, duration: 24 * 60 * 60 * 1000, label: '1 gün Timeout' },
    { warns: 5, permanent: true, label: 'Sürekli (Permanent) Timeout' },
  ],

  // Permanent timeout: Discord max 28 gundur. 5+ warn kullanicisi icin
  // 28 gunluk timeout uygulanir ve bitmeden once otomatik yenilenir.
  permanentTimeoutDuration: 28 * 24 * 60 * 60 * 1000, // 28 gun
  permanentReapplyMargin: 60 * 60 * 1000, // bitmeden 1 saat once yenile

  // Otomatik cezalarda kullanilan sebep (sistem tarafindan olusturulur).
  autoPunishReason: 'Warn limitine ulaşıldı',

  // Kufur filtresinin otomatik warn verirken kullanacagi sebep.
  profanityWarnReason: 'Küfür/uygunsuz ifade kullanımı',

  // Kufur filtresi kaynakli warnlar icin ozel ceza tablosu (normal tablodan bagimsiz).
  // 'null' yapilirsa kufur warnlari da normal penalties tablosunu kullanir.
  profanityPenalty: [
    { warns: 1, duration: 60 * 60 * 1000, label: '1 saat Timeout' },
    { warns: 2, duration: 24 * 60 * 60 * 1000, label: '1 gün Timeout' },
    { warns: 3, permanent: true, label: 'Sürekli (Permanent) Timeout' },
  ],
};
