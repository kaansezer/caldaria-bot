# Caldaria Bot

Caldaria Discord sunucusu icin moduler Discord botu.

## Gereksinimler

- [Node.js](https://nodejs.org/) v18 veya uzeri
- Discord Developer Portal'da olusturulmus bir bot uygulamasi

## Kurulum

### 1. Bagimliliklari yukle

```bash
npm install
```

### 2. .env dosyasini ayarla

```env
DISCORD_TOKEN=your_bot_token_here
```

### 3. Discord Developer Portal'da intentleri ac

1. [Discord Developer Portal](https://discord.com/developers/applications)'dan botuna gir
2. Sol menuden **Bot** secenegine tikla
3. **Privileged Gateway Intents** altindan **Message Content Intent** secenegini ac
4. Botu **Reset Token** ile yeniden baslatmadan degisiklik gecerli olmaz (token degisirse `.env` dosyasini guncelle)

Bu intent kapaliysa bot sunucudaki mesajlarin icerigini goremez ve kufur filtresi calismaz.

### 4. Botu baslat

```bash
npm start
```

Gelistirme modu:

```bash
npm run dev
```

## Slash Commandlar

Bot basladiginda slash komutlari otomatik olarak bulundugu tum sunuculara kaydedilir. `CLIENT_ID` veya `GUILD_ID` gerekmez.

Komutlarin Discord'da gorunmesi icin:

1. Botu sunucuya davet ederken `applications.commands` scope'unu sec
2. Botu baslat (`npm start`)
3. Discord'da `/` yazarak komutlari kontrol et

### Mevcut komutlar

| Komut | Aciklama |
|-------|----------|
| `/sunucukur` | Sunucunun temel rol, kategori ve kanal yapisini olusturur (**Owner** rolune ozel) |
| `/ban` | Bir kullaniciyi sunucudan yasaklar |
| `/unban` | Banli bir kullaniciyi ID ile unbanlar |
| `/kick` | Bir kullaniciyi sunucudan atar |
| `/timeout` | Bir kullaniciya gecici konusma kisitlamasi uygular (`sure:0` ile kaldirir) |
| `/warn` | Kullaniciyi uyarir, veritabanina kaydeder (sebep zorunlu); warn sayisina gore otomatik ceza uygular |
| `/warns` | Kullanicinin uyari gecmisini gosterir (aktif + kaldirilmis) |
| `/unwarn` | Kullanicinin secilen uyarisini veya **tum uyarilarini** kaldirir |
| `/kufurawarn` | Kufur filtresinin otomatik warn vermesini acar/kapatir |
| `/clear` | Kanaldan belirli sayida mesaj siler |
| `/lock` | Kullanicinin yasadigi kanali kilitler (@everyone mesaj atamaz) |
| `/unlock` | Kilitli kanalin kilidini acar |
| `/slowmode` | Kanalin yavas mod suresini ayarlar (0 = kapatir, en fazla 21600 sn) |
| `/nick` | Bir kullanicinin nickname'ini degistirir |
| `/role` | Kullaniciya rol verir veya varsa rolü kaldirir (toggle) |
| `/modstats` | Bir moderatorun islem istatistiklerini gosterir |
| `/userinfo` | Kullanicinin bilgilerini ve warn durumunu gosterir (herkes) |
| `/serverinfo` | Sunucu bilgilerini gosterir (herkes) |
| `/modlog` | Mod-log kanalini ayarlar, durumunu gosterir veya kapatir (**sadece Owner**) |

## Warn sistemi

Warnlar RAM'de tutulmaz; **SQLite** veritabaninda saklanir (`data/moderation.sqlite`). Bot yeniden baslatilsa bile warnlar korunur.

- `/warn kullanici:@kullanici sebep:"sebep"` — `sebep` **zorunludur** ve her zaman yetkili tarafindan yazilir
- `/warns kullanici:@kullanici` — uyari gecmisini embed olarak gosterir; ustte **Aktif Warn** ve **Toplam Warn Gecmisi** sayaclari, kaldirilan warnlar `🗑️` ile isaretlenir, 10'arli sayfalanir
- `/unwarn kullanici:@kullanici` — acilan secim menusunden **tek bir uyari** veya **tum uyarilar** kaldirilabilir; "Tumunu kaldir" icin onay butonu istenir. Silinen uyarilar `deletedAt` alani ile **soft-delete** edilir (audit icin kayit korunur, kimin kaldirdigi `deletedBy` ile tutulur)

Warn tablosu alanlari: `id`, `guildId`, `userId`, `moderatorId`, `reason`, `source`, `createdAt`, `deletedAt`, `deletedBy`. `source` alani `manual` | `profanity_filter` | `automatic` degerlerini alabilir (kufur filtresi entegrasyonu icin hazirdir).

### Otomatik ceza (warn -> timeout)

Warn sayisi esigine ulastiginda otomatik timeout uygulanir. Ayarlar `src/config/moderationConfig.js` dosyasindan kolayca degistirilir:

| Warn | Ceza |
|------|------|
| 1 | 10 dakika timeout |
| 2 | 30 dakika timeout |
| 3 | 2 saat timeout |
| 4 | 1 gun timeout |
| 5+ | **28 gun** (kalici) timeout |

Detaylar:

- Her warn eklendiginde **veya kaldirildiginda** ceza yeniden hesaplanir; warn sayisi duserse timeout otomatik olarak geri cekilir (orn. 5 -> 4 warn: 28 gunluk timeout kaldirilir, 1 gunluk timeout uygulanir)
- **Kalici (permanent) timeout** 28 gun surer ve suresi dolmadan **1 saat once otomatik olarak yeniden uygulanir** (Discord'un 28 gunluk azami timeout suresi nedeniyle)
- Bot yeniden baslatilirsa `timeout_states` tablosundan geri yuklenir ve kalan sureye gore yeniden uygulanir
- Ceza ayarlari `penalties` tablosundan, permanent sure `permanentTimeoutDuration` sabitinden degistirilir; `profanityWarnReason` kufur filtresi sebebini belirler
- **Manuel timeout korunur:** `/timeout` ile uygulanan cezalara warn sistemi dokunmaz (kaynak `manual`); yalnizca kalici warn cezasi kaldiysa yonetici `/timeout sure:0` ile kaldirabilir

### Kufur filtresi ile otomatik warn

`/kufurawarn acik:true` komutu ile kufur filtresi, tespit ettigi kufurler icin otomatik warn vermeye baslar (ayar `data/moderation.sqlite` icinde kalici saklanir):

- Warn `source` alani `profanity_filter` olarak kaydedilir, yetkili `Otomatik (Küfür filtresi)` olarak gorunur
- Sebep sistem tarafindan olusturulur (`moderationConfig.js` -> `profanityWarnReason`)
- Warn sayisi otomatik ceza esigine ulasirsa **warn->timeout** cezasi uygulanir
- Mod-log kanalina `🟠 UYARI` kaydi gonderilir
- `/kufurawarn` (optionsuz) ile mevcut durum gosterilir

### Mod-log

Tum moderasyon islemleri `📋・mod-log` kanalina embed olarak gonderilir: `🟠 WARN`, `🟢 WARN KALDIRILDI`, `🟢 TÜM WARNLAR KALDIRILDI`, `🔴 BAN`, `🟢 BAN KALDIRILDI`, `👢 KICK`, `🔇 TIMEOUT`, `🧹 MESAJ TEMİZLENDİ`, `🔒 KANAL KİLİTLENDİ`, `🔓 KANAL KİLİDİ AÇILDI`, `🐢 SLOWMODE`, `✏️ NICKNAME DEĞİŞTİRİLDİ`, `🎭 ROL VERİLDİ`, `🎭 ROL KALDIRILDI`.

Mod-log kanalı `/modlog` komutu ile ayarlanır ve `guild_settings` tablosunda **kalici** saklanir (her sunucu kendi kanalini kullanir, bot restart edilse bile korunur):

- `/modlog kanal:#kanal` — mod-log kanalini ayarlar (**sadece Owner**). Botun o kanalda `ViewChannel`, `SendMessages`, `EmbedLinks` izinleri yoksa ayar kaydedilmez.
- `/modlog` — mevcut durumu gosterir (`🟢 Aktif` / `🔴 Pasif`)
- `/modlog kanal:yok` — mod-log'u kapatir (moderasyon islemleri calismaya devam eder)

Mod-log kanali ayarlanmamis veya silinmisse bot moderasyon islemlerini **ENGELLEMEZ**; islem normal calisir, yalnizca log atlanir ve konsola bilgi yazilir. Ayarlanan kanal silinirse DB'deki gecersiz ayar otomatik temizlenir.

## Moderator istatistikleri (`/modstats`)

Moderatorlerin yaptigi islemler `moderation_logs` tablosunda tutulur. `/modstats [kullanici]` ile gosterilir (Owner / Yonetici). Sayilan islemler: ban, unban, kick, timeout, warn, unwarn, clear, lock, unlock, slowmode, nick, rol ekleme/kaldirma.

## Yetki sistemi

Moderasyon komutlari sadece **Owner** veya **Yonetici** rolune sahip kullanicilar tarafindan kullanilabilir.

| Yetki | Komutlar |
|-------|----------|
| **Owner** | Tum moderasyon komutlari + `/sunucukur` + `/modlog` |
| **Yonetici** | `/ban`, `/unban`, `/kick`, `/timeout`, `/warn`, `/warns`, `/unwarn`, `/clear`, `/lock`, `/unlock`, `/slowmode`, `/nick`, `/role`, `/modstats` |
| **Normal uye** | `/userinfo`, `/serverinfo` (herkes kullanabilir) |

Detaylar:

- Rol tanimlari `src/utils/moderationPermissions.js` icindeki `OWNER_ROLE_NAMES` ve `ADMIN_ROLE_NAMES` listelerinden ayarlanir
- Yetki kontrolu komutun Discord'da gorunurlugune bagli degildir; her komut calistirildiginda **bot tarafinda tekrar** kontrol edilir (`hasModerationPermission`)
- Yetkisi olmayan kullaniciya ephemeral hata mesaji gonderilir: `❌ Bu komutu kullanmak için yetkiniz yok.` ve hicbir islem uygulanmaz
- Ayrica Discord'un kendi yetki sistemi de kontrol edilir (`/ban` icin Ban Members, `/kick` icin Kick Members, `/timeout` icin Moderate Members, `/warn` ve `/clear` icin Manage Messages)
- Botun kendisinden yuksek/esit roldeki kullanicilara islem uygulanmasi engellenir
- Kullanicinin kendisinden yuksek/esit roldeki kullaniciyi hedeflemesi engellenir
- Sunucu sahibine, bota ve kendine islem uygulanamaz

## Bot yetkileri

Moderasyon komutlari icin bot rolune su yetkiler verilmeli:

- Rolleri Yonet
- Kanallari Yonet
- Mesajlari Yonet (Manage Messages) — `/clear` ve kufur filtresi icin
- Uyeleri At (Kick Members) — `/kick` icin
- Uyeleri Yasakla (Ban Members) — `/ban` icin
- Uyeleri Kisitla (Moderate Members) — `/timeout` icin
- Bot rolü, olusturulacak rollerin **ustunde** olmali

## Kufur filtresi

Bot, sunucudaki mesajlari otomatik olarak kontrol eder ve yasakli kelime tespit ettiginde:

1. Mesaji otomatik olarak siler
2. Kullaniciya gecici bir uyari mesaji gonderir (or. `⚠️ Lütfen küfür veya uygunsuz ifadeler kullanma.`)
3. Uyari mesajini yaklasik **5 saniye** sonra otomatik olarak siler

Detaylar:

- Yasakli kelime listesi `src/utils/profanityFilter.js` icindeki `bannedWords` dizisindedir, kolayca duzenlenebilir
- Buyuk/kucuk harf farki yok sayilir (`SALAK`, `Salak`, `sAlAk` ayni kabul edilir)
- `s.a.l.a.k`, `s-a-l-a-k`, `s a l a k` gibi basit kacis yazimlari yakalanir
- `s4lak`, `s@lak` gibi leet yazimlar yakalanir
- Yanlis pozitifleri onlemek icin tam kelime eslesmesi yapilir (yasakli kelime `abc` ise `abcdef` gibi farkli kelimeler yakalanmaz)
- Bot mesajlari, DM mesajlari ve bos mesajlar filtrelenmez
- Mesaj silinebilmesi icin botun ilgili kanalda **Mesajlari Yonet (Manage Messages)** yetkisi olmalidir; yetki yoksa bot sessizce atlar ve `[MODERATION]` uyarisi loglar
- Silinen her mesaj icin konsola `[MODERATION] Kullanıcı: ... | Sebep: Yasaklı kelime (...) | Mesaj silindi` seklinde log yazilir; mesaj icerigi loglanmaz

## Proje yapisi

```
src/
├── index.js
├── config/
│   └── moderationConfig.js
├── commands/
│   ├── sunucukur.js
│   ├── ban.js
│   ├── unban.js
│   ├── kick.js
│   ├── timeout.js
│   ├── warn.js
│   ├── warns.js
│   ├── unwarn.js
│   ├── kufurawarn.js
│   ├── clear.js
│   ├── lock.js
│   ├── unlock.js
│   ├── slowmode.js
│   ├── nick.js
│   ├── role.js
│   ├── modstats.js
│   ├── modlog.js
│   ├── userinfo.js
│   └── serverinfo.js
├── events/
│   ├── ready.js
│   ├── interactionCreate.js
│   └── messageCreate.js
├── handlers/
│   ├── commandHandler.js
│   └── eventHandler.js
└── utils/
    ├── logger.js
    ├── serverSetup.js
    ├── profanityFilter.js
    ├── moderationPermissions.js
    ├── warnManager.js
    ├── database.js
    ├── settings.js
    ├── modLog.js
    ├── modLogEmbeds.js
    ├── modStats.js
    ├── warnPenalty.js
    ├── timeoutManager.js
    ├── permanentTimeout.js
    └── format.js
```

## Yeni komut ekleme

1. `src/commands/` klasorune yeni bir `.js` dosyasi ekle
2. `data` ve `execute` alanlarini tanimla
3. Botu yeniden baslat — komut otomatik yuklenir ve kaydedilir

## Lisans

ISC
