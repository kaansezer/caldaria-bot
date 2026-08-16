const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

// commmands/ klasorunu recursive gezerek alt klasorler dahil tum slash command dosyalarini yukler
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

function loadCommands(client) {
  const commandsPath = path.join(__dirname, '../commands');
  const commandFiles = collectCommandFiles(commandsPath);

  for (const filePath of commandFiles) {
    const command = require(filePath);

    if ('data' in command && 'execute' in command) {
      client.commands.set(command.data.name, command);
      logger.info(`Komut yuklendi: ${command.data.name}`);
    } else {
      logger.warn(`${path.basename(filePath)} gecerli bir komut dosyasi degil (data ve execute gerekli).`);
    }
  }
}

module.exports = { loadCommands };
