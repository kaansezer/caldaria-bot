const { Events } = require('discord.js');
const logger = require('../utils/logger');
const sunucukur = require('../commands/sunucukur');
const serverCommand = require('../commands/server/server');
const { hasModerationPermission } = require('../utils/moderationPermissions');
const { handleInteractionOrButton } = require('../services/ticketManager');

const NO_PERMISSION_MESSAGE = '❌ Bu komutu kullanmak için yetkiniz yok.';

// Slash command ve buton etkilesimlerini yonetir
module.exports = {
  name: Events.InteractionCreate,

  async execute(interaction) {
    if (interaction.isChatInputCommand()) {
      const command = interaction.client.commands.get(interaction.commandName);

      if (!command) {
        logger.warn(`Bilinmeyen komut: ${interaction.commandName}`);
        return;
      }

      // Her komut calistirilirken bot tarafinda tekrar yetki kontrolu yapilir.
      if (command.moderationAction && !hasModerationPermission(interaction.member, command.moderationAction)) {
        await interaction.reply({ content: NO_PERMISSION_MESSAGE, ephemeral: true });
        return;
      }

      try {
        await command.execute(interaction);
      } catch (error) {
        logger.error(`Komut hatasi (${interaction.commandName}):`, error);

        const payload = {
          content: 'Bu komutu calistirirken bir hata olustu.',
          ephemeral: true,
        };

        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(payload);
        } else {
          await interaction.reply(payload);
        }
      }
      return;
    }

    if (interaction.isButton() && interaction.customId.startsWith('ticket:')) {
      try {
        await handleInteractionOrButton(interaction);
      } catch (error) {
        logger.error('Ticket buton hatasi:', error);

        const payload = {
          content: 'Islem sirasinda bir hata olustu.',
          ephemeral: true,
        };

        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(payload);
        } else if (interaction.isRepliable()) {
          await interaction.reply(payload);
        }
      }
      return;
    }

    if (interaction.isButton() && interaction.customId.startsWith('sunucukur:')) {
      try {
        await sunucukur.handleButton(interaction);
      } catch (error) {
        logger.error('Sunucukur buton hatasi:', error);

        const payload = {
          content: 'Islem sirasinda bir hata olustu.',
          ephemeral: true,
        };

        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(payload);
        } else if (interaction.isRepliable()) {
          await interaction.reply(payload);
        }
      }
    }

    if (interaction.isButton() && interaction.customId.startsWith('server:')) {
      try {
        await serverCommand.handleButton(interaction);
      } catch (error) {
        logger.error('Server buton hatasi:', error);

        const payload = {
          content: 'Islem sirasinda bir hata olustu.',
          ephemeral: true,
        };

        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(payload);
        } else if (interaction.isRepliable()) {
          await interaction.reply(payload);
        }
      }
    }
  },
};
