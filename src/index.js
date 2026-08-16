require('dotenv').config();

const { Client, Collection, GatewayIntentBits } = require('discord.js');
const { loadCommands } = require('./handlers/commandHandler');
const { loadEvents } = require('./handlers/eventHandler');
const logger = require('./utils/logger');

if (!process.env.DISCORD_TOKEN) {
  logger.error('DISCORD_TOKEN bulunamadi (.env dosyasini kontrol edin)');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

client.commands = new Collection();

loadCommands(client);
loadEvents(client);

client.login(process.env.DISCORD_TOKEN).catch((error) => {
  logger.error('Discord\'a baglanirken hata olustu:', error);
  process.exit(1);
});
