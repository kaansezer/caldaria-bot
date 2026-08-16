const {
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const db = require('../utils/database');
const { getGuildSetting, setGuildSetting } = require('../utils/settings');
const logger = require('../utils/logger');

const TICKET_CATEGORY_SETTING = 'ticket_category_id';
const TICKET_SUPPORT_ROLE_SETTING = 'ticket_support_role_id';

// ---- SQLite erisimleri (tickets) ----

function saveOpenTicket({ ticketChannelId, guildId, userId }) {
  db.prepare(
    `INSERT INTO tickets (ticket_id, guild_id, channel_id, user_id, status, created_at)
     VALUES (?, ?, ?, ?, 'open', ?)`
  ).run(ticketChannelId, guildId, ticketChannelId, userId, Date.now());
}

function markTicketClosed(ticketId) {
  db.prepare(`UPDATE tickets SET status = 'closed' WHERE ticket_id = ?`).run(ticketId);
}

function removeTicket(guildId, channelId) {
  return db
    .prepare('DELETE FROM tickets WHERE guild_id = ? AND channel_id = ?')
    .run(guildId, channelId).changes;
}

function getTicketByChannel(guildId, channelId) {
  return (
    db
      .prepare('SELECT * FROM tickets WHERE guild_id = ? AND channel_id = ?')
      .get(guildId, channelId) || null
  );
}

function getOpenTicketByUser(guildId, userId) {
  return (
    db
      .prepare("SELECT * FROM tickets WHERE guild_id = ? AND user_id = ? AND status = 'open'")
      .get(guildId, userId) || null
  );
}

// ---- Konfigurasyon ----

function getCategoryId(guildId) {
  const raw = getGuildSetting(guildId, TICKET_CATEGORY_SETTING, '');
  return raw && raw.trim() ? raw.trim() : null;
}

function getSupportRoleId(guildId) {
  const raw = getGuildSetting(guildId, TICKET_SUPPORT_ROLE_SETTING, '');
  return raw && raw.trim() ? raw.trim() : null;
}

// Destek rolu ayarlanmamissa sunucudaki ilk Administrator yetkiliyu role fallback yap.
function resolveSupportRole(guild) {
  const configured = getSupportRoleId(guild.id);
  if (configured) {
    const role = guild.roles.cache.get(configured);
    if (role) return role;
  }
  return guild.roles.cache.find((r) => r.permissions.has(PermissionFlagsBits.Administrator)) || null;
}

// ---- Panel (embed + buton) ----

function buildPanelEmbed(title) {
  return new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('🎫 Destek Talebi')
    .setDescription(
      title ||
        'Bir sorun yaşıyorsanız ya da talebiniz varsa aşağıdaki butonu kullanarak destek talebi oluşturabilirsiniz.'
    )
    .setTimestamp();
}

function buildPanelRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('ticket:create')
      .setLabel('Talep Oluştur')
      .setEmoji('🎫')
      .setStyle(ButtonStyle.Primary)
  );
}

function buildTicketActionsRow(ticketId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`ticket:close:${ticketId}`)
      .setLabel('Talebi Kapat')
      .setEmoji('🔒')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`ticket:delete:${ticketId}`)
      .setLabel('Talebi Sil')
      .setEmoji('🗑️')
      .setStyle(ButtonStyle.Danger)
  );
}

// Panel mesajini gonderir; kategori/rol ayarlarini kaydeder.
async function savePanel(guild, { channel, category, title, supportRole }) {
  if (category) {
    setGuildSetting(guild.id, TICKET_CATEGORY_SETTING, category.id);
  }
  if (supportRole) {
    setGuildSetting(guild.id, TICKET_SUPPORT_ROLE_SETTING, supportRole.id);
  }
  await channel.send({ embeds: [buildPanelEmbed(title)], components: [buildPanelRow()] });
}

// ---- Ticket olusturma ----

async function createTicket(interaction) {
  const guild = interaction.guild;
  const member = interaction.member;

  const supportRole = resolveSupportRole(guild);
  const supportRoleId = supportRole ? supportRole.id : null;

  // Ayni kullanicinin actik talebi varsa yeni ticket acmasini engelle.
  const existingTicket = getOpenTicketByUser(guild.id, member.id);
  if (existingTicket) {
    await interaction.reply({
      content: `❌ Zaten açık bir talebiniz var: <#${existingTicket.channel_id}>`,
      ephemeral: true,
    });
    return;
  }

  const categoryId = getCategoryId(guild.id);
  const category = categoryId ? guild.channels.cache.get(categoryId) : null;

  const channel = await guild.channels.create({
    name: `ticket-${member.user.username}`.slice(0, 100),
    parent: category ? category.id : null,
    topic: `Destek talebi | Açan: ${member.user.tag}`,
    permissionOverwrites: [
      { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
      {
        id: member.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.AttachFiles,
          PermissionFlagsBits.EmbedLinks,
        ],
      },
      ...(supportRoleId
        ? [
            {
              id: supportRoleId,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory,
              ],
            },
          ]
        : []),
    ],
  });

  saveOpenTicket({ ticketChannelId: channel.id, guildId: guild.id, userId: member.id });

  await interaction.reply({ content: `✅ Talebiniz oluşturuldu: ${channel}`, ephemeral: true });

  await channel.send({
    content: `${member.toString()} — ekibimiz en kısa sürede ilgilenecek.`,
    embeds: [
      new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle('📬 Yeni Destek Talebi')
        .setDescription('Mesajınızı bu kanala yazabilirsiniz. İşiniz bittiğinde talebi kapatabilirsiniz.')
        .addFields({ name: '👤 Açan', value: member.user.tag, inline: true })
        .setTimestamp(),
    ],
    components: [buildTicketActionsRow(channel.id)],
  });

  logger.info(`[TICKET] ${guild.name}: ${member.user.tag} destek talebi acti (${channel.id}).`);
}

// ---- Kapat / Sil ----

async function closeTicket(interaction, ticketId) {
  const ticket = getTicketByChannel(interaction.guild.id, ticketId);
  if (!ticket || ticket.channel_id !== interaction.channel.id) {
    await interaction.reply({ content: '❌ Bu kanal geçerli bir destek talebi değil.', ephemeral: true });
    return;
  }

  markTicketClosed(ticketId);
  await interaction.update({
    content: '🔒 Talep kapatıldı.',
    embeds: [],
    components: [],
  });
  await interaction.channel.setName(`closed-${interaction.channel.name}`.slice(0, 100)).catch(() => {});
  logger.info(`[TICKET] ${interaction.guild.name}: talep kapatildi (${ticketId}).`);

  // Kapama bilgisini mod-log'a gonder.
  const { sendModLog } = require('../utils/modLog');
  await sendModLog(interaction.guild, buildTranscriptEmbed(interaction.channel.name));
}

async function deleteTicketInteraction(interaction, ticketId) {
  const guild = interaction.guild;
  const channel = interaction.channel;
  const ticket = getTicketByChannel(guild.id, ticketId);
  if (!ticket || ticket.channel_id !== channel.id) {
    await interaction.reply({ content: '❌ Bu kanal geçerli bir ticket değil.', ephemeral: true });
    return;
  }

  await interaction.update({ content: '🗑️ Talep siliniyor...', embeds: [], components: [] });

  // Transcript'i mod-log kanalina gonder, sonra kanali sil.
  try {
    await sendTranscript(guild, ticket, channel);
  } catch (error) {
    logger.error('[TICKET] Transcript gönderilemedi:', error.message);
  }

  removeTicket(guild.id, ticketId);
  await channel.delete('Ticket silindi');
  logger.info(`[TICKET] ${guild.name}: talep silindi (${ticketId}).`);
}

async function sendTranscript(guild, ticket, channel) {
  const messages = await channel.messages.fetch({ limit: 100 }).catch(() => null);
  if (!messages) return;

  const lines = messages
    .sort((a, b) => a.createdTimestamp - b.createdTimestamp)
    .map((m) => `${m.author.tag} [${new Date(m.createdTimestamp).toLocaleString('tr-TR')}]: ${m.content || m.embeds[0]?.description || '(içerik yok)'}`)
    .join('\n');

  const content = [
    `DESTEK TALEBİ KAYDI`,
    `Kanal: #${channel.name}`,
    `Açan: <@${ticket.user_id}> (${ticket.user_id})`,
    `Açılma: ${new Date(ticket.created_at).toLocaleString('tr-TR')}`,
    `Durum: ${ticket.status}`,
    '',
    '--- MESA MESAJLARI ---',
    lines || '(mesaj yok)',
  ].join('\n');

  const transcriptChannel = resolveModLogChannel(guild);
  if (transcriptChannel) {
    await transcriptChannel.send({
      files: [{ attachment: Buffer.from(content, 'utf8'), name: `transcript-${channel.name}.txt` }],
    });
  }
}

function buildTranscriptEmbed(channelName) {
  return new EmbedBuilder()
    .setColor(0x57f287)
    .setTitle('🔒 Talep Kapatıldı')
    .setDescription(`Kanal: #${channelName}`)
    .setTimestamp();
}

function resolveModLogChannel(guild) {
  const configured = getGuildSetting(guild.id, 'mod_log_channel_id', '');
  const channel = guild.channels.cache.get(configured);
  if (channel && channel.isTextBased()) return channel;
  return guild.channels.cache.find((c) => c.name.toLowerCase().includes('mod-log') && c.isTextBased()) || null;
}

// Buton etkilesimlerini yonetir.
async function handleInteractionOrButton(interaction) {
  if (interaction.customId === 'ticket:create') {
    await createTicket(interaction);
    return;
  }
  if (interaction.customId.startsWith('ticket:close:')) {
    await closeTicket(interaction, interaction.customId.split(':')[2]);
    return;
  }
  if (interaction.customId.startsWith('ticket:delete:')) {
    await deleteTicketInteraction(interaction, interaction.customId.split(':')[2]);
  }
}

module.exports = {
  savePanel,
  handleInteractionOrButton,
  getCategoryId,
  getSupportRoleId,
  resolveSupportRole,
  buildPanelEmbed,
  buildPanelRow,
  buildTicketActionsRow,
  TICKET_CATEGORY_SETTING,
  TICKET_SUPPORT_ROLE_SETTING,
  getOpenTicketByUser,
  saveOpenTicket,
  markTicketClosed,
  removeTicket,
  getTicketByChannel,
};