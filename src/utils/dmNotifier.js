const { EmbedBuilder } = require('discord.js');
const logger = require('./logger');

// Hedef kullaniciya DM ile bilgilendirme gonderir. Hata olursa sessizce gecer (DM kapali olabilir).
async function sendDM(user, { title, description, color = 0xfaa61a, fields = [] }) {
  if (!user) return false;
  try {
    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle(title)
      .setDescription(description)
      .setTimestamp();
    if (fields.length > 0) {
      embed.addFields(fields);
    }
    await user.send({ embeds: [embed] });
    return true;
  } catch (error) {
    // DM kapali, bot engellenmis veya kullanici baska sunucuda olmayabilir
    logger.info(`[DM] ${user.tag} kullaniciya DM gonderilemedi: ${error.message}`);
    return false;
  }
}

module.exports = { sendDM };
