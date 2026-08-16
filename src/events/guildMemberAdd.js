const { Events, PermissionFlagsBits } = require('discord.js');
const db = require('../utils/database');
const logger = require('../utils/logger');

const DEFAULT_WELCOME_MESSAGE =
  'Hoş geldin {user}! {guild} sunucusuna katıldığın için mutluyuz. 🎉';

function getWelcomeSettings(guildId) {
  return (
    db
      .prepare('SELECT * FROM welcome_settings WHERE guild_id = ?')
      .get(guildId) || null
  );
}

function saveWelcomeSettings({ guildId, welcomeChannelId, autoroleId, welcomeMessage }) {
  const current = getWelcomeSettings(guildId);
  const nextMessage =
    welcomeMessage !== null && welcomeMessage.trim().length > 0
      ? welcomeMessage.trim()
      : current?.welcome_message || DEFAULT_WELCOME_MESSAGE;

  db.prepare(
    `INSERT INTO welcome_settings (guild_id, welcome_channel_id, autorole_id, welcome_message)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(guild_id) DO UPDATE SET
       welcome_channel_id = excluded.welcome_channel_id,
       autorole_id = excluded.autorole_id,
       welcome_message = excluded.welcome_message`
  ).run(
    guildId,
    welcomeChannelId !== null ? welcomeChannelId : current?.welcome_channel_id || null,
    autoroleId !== null ? autoroleId : current?.autorole_id || null,
    nextMessage
  );
  return getWelcomeSettings(guildId);
}

function renderWelcomeMessage(template, { user, guild }) {
  return template
    .replaceAll('{user}', user.toString())
    .replaceAll('{guild}', guild.name)
    .replaceAll('{memberCount}', String(guild.memberCount));
}

// Yeni uye katildiginda auto-role verir ve ozel hos geldin mesaji gonderir.
module.exports = {
  name: Events.GuildMemberAdd,

  async execute(member) {
    try {
      const guild = member.guild;
      const settings = getWelcomeSettings(guild.id);

      if (!settings) return;

      // Auto-role: rol ver (rol silinmis/bot ustundeyse sessizce gec).
      if (settings.autorole_id) {
        const role = guild.roles.cache.get(settings.autorole_id);
        const botMember = guild.members.me;
        if (
          role &&
          !role.managed &&
          botMember &&
          role.position < botMember.roles.highest.position &&
          botMember.permissions.has(PermissionFlagsBits.ManageRoles)
        ) {
          await member.roles.add(role, 'Auto-role (hoş geldin)').catch((error) => {
            logger.warn(`[WELCOME] ${guild.name}: auto-role atanamadi: ${error.message}`);
          });
        }
      }

      // Hos geldin mesaji.
      if (settings.welcome_channel_id) {
        const channel = guild.channels.cache.get(settings.welcome_channel_id);
        if (channel && channel.isTextBased()) {
          const text = renderWelcomeMessage(settings.welcome_message || DEFAULT_WELCOME_MESSAGE, {
            user: member.user,
            guild,
          });
          await channel.send(text);
        }
      }
    } catch (error) {
      logger.error('[WELCOME] Yeni uye islem hatasi:', error.message);
    }
  },
};

module.exports.getWelcomeSettings = getWelcomeSettings;
module.exports.saveWelcomeSettings = saveWelcomeSettings;
module.exports.renderWelcomeMessage = renderWelcomeMessage;
module.exports.DEFAULT_WELCOME_MESSAGE = DEFAULT_WELCOME_MESSAGE;