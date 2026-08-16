const { Events } = require('discord.js');
const logger = require('../utils/logger');
const { sweepPermanentTimeouts } = require('../utils/permanentTimeout');
const { initTempbans } = require('../utils/tempbanScheduler');
const { startYoutubeNotifier } = require('../services/youtubeNotifier');

// Bot hazir oldugunda slash commandlari sunuculara kaydeder
module.exports = {
  name: Events.ClientReady,
  once: true,

  async execute(client) {
    logger.info(`${client.user.tag} aktif!`);

    const slashCommands = [...client.commands.values()].map((command) => command.data.toJSON());

    for (const guild of client.guilds.cache.values()) {
      try {
        await guild.commands.set(slashCommands);
        logger.info(`Slash komutlari kaydedildi: ${guild.name}`);
      } catch (error) {
        logger.error(`${guild.name} sunucusunda komut kaydi basarisiz:`, error);
      }
    }

    // 5+ warn kullanicilarinin permanent timeout'larini restart sonrasinda yeniden uygula.
    sweepPermanentTimeouts(client).catch((error) => {
      logger.error('[PERMANENT-TIMEOUT] Restart taramasi hatasi:', error);
    });

    // Sureci dolan tempbanlari temizle ve zamanlayiciyi kur.
    initTempbans(client);

    // YouTube kanal bildirimlerini baslat (5 dakikada bir kontrol).
    startYoutubeNotifier(client);
  },
};
