const {
  ChannelType,
  PermissionFlagsBits,
} = require('discord.js');
const logger = require('./logger');

// Sunucu basina olusturulan yapiyi bellekte tutar
const setupCache = new Map();

// Rol tanimlari (dusukten yuksege sira - pozisyon ayarlanirken kullanilir)
const ROLE_DEFINITIONS = [
  {
    name: '🤖 Bot',
    color: 0x5865f2,
    permissions: [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.EmbedLinks,
      PermissionFlagsBits.AttachFiles,
      PermissionFlagsBits.ReadMessageHistory,
      PermissionFlagsBits.Connect,
      PermissionFlagsBits.Speak,
      PermissionFlagsBits.UseApplicationCommands,
    ],
  },
  {
    name: '🤝 Yeni Oyuncu',
    color: 0x99aab5,
    permissions: [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.ReadMessageHistory,
      PermissionFlagsBits.Connect,
      PermissionFlagsBits.Speak,
    ],
  },
  {
    name: '⚔️ Oyuncu',
    color: 0x57f287,
    permissions: [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.ReadMessageHistory,
      PermissionFlagsBits.AddReactions,
      PermissionFlagsBits.AttachFiles,
      PermissionFlagsBits.Connect,
      PermissionFlagsBits.Speak,
    ],
  },
  {
    name: '🏰 Klan Üyesi',
    color: 0x3498db,
    permissions: [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.ReadMessageHistory,
      PermissionFlagsBits.AddReactions,
      PermissionFlagsBits.AttachFiles,
      PermissionFlagsBits.Connect,
      PermissionFlagsBits.Speak,
    ],
  },
  {
    name: '⚔️ Klan Lideri',
    color: 0xe67e22,
    permissions: [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.ReadMessageHistory,
      PermissionFlagsBits.AddReactions,
      PermissionFlagsBits.AttachFiles,
      PermissionFlagsBits.EmbedLinks,
      PermissionFlagsBits.CreatePublicThreads,
      PermissionFlagsBits.Connect,
      PermissionFlagsBits.Speak,
      PermissionFlagsBits.Stream,
    ],
  },
  {
    name: '🛡️ Moderatör',
    color: 0xf1c40f,
    permissions: [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.ReadMessageHistory,
      PermissionFlagsBits.ManageMessages,
      PermissionFlagsBits.KickMembers,
      PermissionFlagsBits.BanMembers,
      PermissionFlagsBits.ModerateMembers,
      PermissionFlagsBits.ManageNicknames,
    ],
  },
  {
    name: '👑 Yönetim',
    color: 0xe74c3c,
    permissions: [PermissionFlagsBits.Administrator],
  },
];

// Kategori ve kanal tanimlari
const SERVER_STRUCTURE = [
  {
    name: '📌 BİLGİ',
    type: 'info',
    channels: [
      { name: '📢・duyurular', type: ChannelType.GuildText },
      { name: '📜・kurallar', type: ChannelType.GuildText },
      { name: '📖・sunucu-bilgileri', type: ChannelType.GuildText },
      { name: '🗺️・caldaria-hakkinda', type: ChannelType.GuildText },
    ],
  },
  {
    name: '💬 TOPLULUK',
    type: 'community',
    channels: [
      { name: '💬・sohbet', type: ChannelType.GuildText },
      { name: '😂・mizah', type: ChannelType.GuildText },
      { name: '📸・medya', type: ChannelType.GuildText },
      { name: '🎮・oyun', type: ChannelType.GuildText },
    ],
  },
  {
    name: '⚔️ BANNERLORD',
    type: 'default',
    channels: [
      { name: '🏰・bannerlord', type: ChannelType.GuildText },
      { name: '⚔️・klanlar', type: ChannelType.GuildText },
      { name: '🛡️・savaslar', type: ChannelType.GuildText },
      { name: '📊・istatistikler', type: ChannelType.GuildText },
      { name: '📰・bannerlord-duyurular', type: ChannelType.GuildText },
    ],
  },
  {
    name: '🎫 DESTEK',
    type: 'default',
    channels: [
      { name: '🎫・destek', type: ChannelType.GuildText },
      { name: '❓・yardim', type: ChannelType.GuildText },
      { name: '💡・öneriler', type: ChannelType.GuildText },
    ],
  },
  {
    name: '🔒 YÖNETİM',
    type: 'staff',
    channels: [
      { name: '📋・yonetim', type: ChannelType.GuildText },
      { name: '📜・mod-log', type: ChannelType.GuildText },
      { name: '🚨・ceza-log', type: ChannelType.GuildText },
      { name: '🤖・bot-log', type: ChannelType.GuildText },
    ],
  },
  {
    name: '🔊 SES',
    type: 'voice',
    channels: [
      { name: '🔊 Genel', type: ChannelType.GuildVoice },
      { name: '⚔️ Bannerlord', type: ChannelType.GuildVoice },
      { name: '🎮 Oyun Odası', type: ChannelType.GuildVoice },
      { name: '🎵 Müzik', type: ChannelType.GuildVoice },
    ],
  },
  {
    name: 'AFK',
    type: 'afk',
    channels: [{ name: '💤 AFK', type: ChannelType.GuildVoice }],
  },
];

function getSetupCache(guildId) {
  return setupCache.get(guildId) || null;
}

function findRoleByName(guild, name) {
  return guild.roles.cache.find((role) => role.name === name) || null;
}

function findCategoryByName(guild, name) {
  return guild.channels.cache.find(
    (channel) => channel.type === ChannelType.GuildCategory && channel.name === name
  ) || null;
}

function findChannelInCategory(guild, name, parentId) {
  return guild.channels.cache.find(
    (channel) => channel.name === name && channel.parentId === parentId
  ) || null;
}

async function getOrCreateRole(guild, definition, stats) {
  const existing = findRoleByName(guild, definition.name);

  if (existing) {
    stats.rolesExisting += 1;
    return existing;
  }

  const role = await guild.roles.create({
    name: definition.name,
    color: definition.color,
    permissions: definition.permissions,
    reason: 'Caldaria sunucu kurulumu',
  });

  stats.rolesCreated += 1;
  return role;
}

async function setRoleHierarchy(guild, roles) {
  const botMember = guild.members.me;
  if (!botMember) return;

  const botHighestPosition = botMember.roles.highest.position;
  let position = Math.min(botHighestPosition - 1, guild.roles.cache.size - 2);

  for (let i = ROLE_DEFINITIONS.length - 1; i >= 0; i -= 1) {
    const role = roles[ROLE_DEFINITIONS[i].name];
    if (!role || !role.editable) continue;

    try {
      await role.setPosition(position, { reason: 'Caldaria rol hiyerarsisi' });
      position -= 1;
    } catch (error) {
      logger.warn(`Rol pozisyonu ayarlanamadi (${role.name}):`, error.message);
    }
  }
}

function buildChannelPermissions(categoryType, roles, everyoneRole) {
  const yonetim = roles['👑 Yönetim'];
  const moderator = roles['🛡️ Moderatör'];

  const staffAllow = [
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.SendMessages,
    PermissionFlagsBits.ReadMessageHistory,
    PermissionFlagsBits.ManageMessages,
  ];

  if (categoryType === 'info') {
    const overwrites = [
      {
        id: everyoneRole.id,
        deny: [PermissionFlagsBits.SendMessages],
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory],
      },
    ];

    if (yonetim) overwrites.push({ id: yonetim.id, allow: staffAllow });
    if (moderator) overwrites.push({ id: moderator.id, allow: staffAllow });

    return overwrites;
  }

  if (categoryType === 'staff') {
    const overwrites = [
      {
        id: everyoneRole.id,
        deny: [PermissionFlagsBits.ViewChannel],
      },
    ];

    if (yonetim) overwrites.push({ id: yonetim.id, allow: staffAllow });
    if (moderator) overwrites.push({ id: moderator.id, allow: staffAllow });

    return overwrites;
  }

  return [];
}

async function getOrCreateCategory(guild, definition, roles, stats) {
  const existing = findCategoryByName(guild, definition.name);

  if (existing) {
    stats.categoriesExisting += 1;
    return existing;
  }

  const permissionOverwrites = buildChannelPermissions(definition.type, roles, guild.roles.everyone);

  const category = await guild.channels.create({
    name: definition.name,
    type: ChannelType.GuildCategory,
    permissionOverwrites,
    reason: 'Caldaria sunucu kurulumu',
  });

  stats.categoriesCreated += 1;
  return category;
}

async function getOrCreateChannel(guild, channelDef, category, categoryType, roles, stats) {
  const existing = findChannelInCategory(guild, channelDef.name, category.id);

  if (existing) {
    stats.channelsExisting += 1;
    return existing;
  }

  const permissionOverwrites = buildChannelPermissions(categoryType, roles, guild.roles.everyone);

  const channel = await guild.channels.create({
    name: channelDef.name,
    type: channelDef.type,
    parent: category.id,
    permissionOverwrites,
    reason: 'Caldaria sunucu kurulumu',
  });

  stats.channelsCreated += 1;
  return channel;
}

async function assignBotRole(guild, botRole) {
  const botMember = guild.members.me;
  if (!botMember || !botRole || botMember.roles.cache.has(botRole.id)) return;

  try {
    await botMember.roles.add(botRole, 'Caldaria sunucu kurulumu');
  } catch (error) {
    logger.warn('Bot rolü atanamadi:', error.message);
  }
}

// Sunucu kurulumunun ana fonksiyonu
async function setupServer(guild, onProgress = async () => {}) {
  const stats = {
    rolesCreated: 0,
    rolesExisting: 0,
    categoriesCreated: 0,
    categoriesExisting: 0,
    channelsCreated: 0,
    channelsExisting: 0,
  };

  const roles = {};
  const categories = {};
  const channels = {};

  const runStage = async (stageName, progressMessage, fn) => {
    try {
      await onProgress(progressMessage);
      return await fn();
    } catch (error) {
      error.setupStage = stageName;
      throw error;
    }
  };

  await runStage('Roller', '⏳ Roller oluşturuluyor...', async () => {
    for (const definition of ROLE_DEFINITIONS) {
      roles[definition.name] = await getOrCreateRole(guild, definition, stats);
    }

    await setRoleHierarchy(guild, roles);
    await assignBotRole(guild, roles['🤖 Bot']);
  });

  await runStage('Kategoriler', '⏳ Kategoriler oluşturuluyor...', async () => {
    for (const categoryDef of SERVER_STRUCTURE) {
      categories[categoryDef.name] = await getOrCreateCategory(guild, categoryDef, roles, stats);
    }
  });

  await runStage('Kanallar', '⏳ Kanallar oluşturuluyor...', async () => {
    for (const categoryDef of SERVER_STRUCTURE) {
      const category = categories[categoryDef.name];

      for (const channelDef of categoryDef.channels) {
        const channel = await getOrCreateChannel(
          guild,
          channelDef,
          category,
          categoryDef.type,
          roles,
          stats
        );

        channels[channelDef.name] = channel;
      }
    }
  });

  await runStage('İzinler', '⏳ İzinler ayarlanıyor...', async () => {
    const afkChannel = channels['💤 AFK'];
    if (afkChannel && guild.afkChannelId !== afkChannel.id) {
      try {
        await guild.setAFKChannel(afkChannel, 'Caldaria sunucu kurulumu');
      } catch (error) {
        logger.warn('AFK kanali ayarlanamadi:', error.message);
      }
    }
  });

  const cacheData = {
    roles: Object.fromEntries(Object.entries(roles).map(([name, role]) => [name, role.id])),
    categories: Object.fromEntries(
      Object.entries(categories).map(([name, category]) => [name, category.id])
    ),
    channels: Object.fromEntries(
      Object.entries(channels).map(([name, channel]) => [name, channel.id])
    ),
    setupAt: new Date().toISOString(),
  };

  setupCache.set(guild.id, cacheData);

  return { stats, cache: cacheData };
}

module.exports = {
  setupServer,
  getSetupCache,
  ROLE_DEFINITIONS,
  SERVER_STRUCTURE,
};
