const { EmbedBuilder } = require('discord.js');

// Manual warn / otomatik warn (kufur filtresi) mod-log embed'i
function buildWarnLogEmbed({ user, moderatorText, reason, totalWarns, penaltyText, note, source }) {
  const isProfanity = source === 'profanity_filter';
  const embed = new EmbedBuilder()
    .setColor(isProfanity ? 0xed4245 : 0xfaa61a)
    .setTitle(isProfanity ? '🔴 OTOMATİK WARN' : '🟠 WARN')
    .addFields(
      { name: '👤 Kullanıcı', value: `${user.tag} (\`${user.id}\`)`, inline: false },
      { name: '👮 Yetkili', value: moderatorText, inline: true },
      { name: '📝 Sebep', value: reason, inline: false },
      { name: '⚠️ Aktif Warn', value: String(totalWarns), inline: true }
    );

  if (penaltyText) {
    embed.addFields({ name: '🔇 Ceza', value: penaltyText, inline: true });
  }
  if (isProfanity) {
    embed.addFields({ name: '⚙️ Kaynak', value: 'Küfür Filtresi', inline: false });
  }
  if (note) {
    embed.addFields({ name: '⚠️ Not', value: note, inline: false });
  }

  return embed.setTimestamp();
}

// Tek warn kaldirma mod-log embed'i
function buildWarnRemovedLogEmbed({ user, moderatorTag, removedReason, remaining, penaltyText, note }) {
  const embed = new EmbedBuilder()
    .setColor(0x57f287)
    .setTitle('🟢 WARN KALDIRILDI')
    .addFields(
      { name: '👤 Kullanıcı', value: `${user.tag} (\`${user.id}\`)`, inline: false },
      { name: '👮 Yetkili', value: moderatorTag, inline: true },
      { name: '📝 Kaldırılan sebep', value: removedReason, inline: false },
      { name: '⚠️ Kalan Warn', value: String(remaining), inline: true }
    );

  if (penaltyText) {
    embed.addFields({ name: '🔇 Yeni Ceza', value: penaltyText, inline: true });
  }
  if (note) {
    embed.addFields({ name: '⚠️ Not', value: note, inline: false });
  }

  return embed.setTimestamp();
}

// Tum warnlari kaldirma mod-log embed'i
function buildAllWarnsRemovedLogEmbed({ user, moderatorTag, removedCount, penaltyText, note }) {
  const embed = new EmbedBuilder()
    .setColor(0x57f287)
    .setTitle('🟢 TÜM WARNLAR KALDIRILDI')
    .addFields(
      { name: '👤 Kullanıcı', value: `${user.tag} (\`${user.id}\`)`, inline: false },
      { name: '👮 Yetkili', value: moderatorTag, inline: true },
      { name: '🗑️ Kaldırılan Warn', value: String(removedCount), inline: true },
      { name: '⚠️ Kalan Warn', value: '0', inline: true }
    );

  if (penaltyText) {
    embed.addFields({ name: '🔊 Timeout', value: penaltyText, inline: false });
  }
  if (note) {
    embed.addFields({ name: '⚠️ Not', value: note, inline: false });
  }

  return embed.setTimestamp();
}

// Ban mod-log embed'i
function buildBanLogEmbed({ user, moderatorTag, reason }) {
  return new EmbedBuilder()
    .setColor(0xed4245)
    .setTitle('🔴 BAN')
    .addFields(
      { name: '👤 Kullanıcı', value: `${user.tag}`, inline: false },
      { name: '🆔 ID', value: user.id, inline: true },
      { name: '👮 Yetkili', value: moderatorTag, inline: true },
      { name: '📝 Sebep', value: reason || 'Sebep belirtilmedi', inline: false }
    )
    .setTimestamp();
}

// Unban mod-log embed'i
function buildUnbanLogEmbed({ user, moderatorTag }) {
  return new EmbedBuilder()
    .setColor(0x57f287)
    .setTitle('🟢 BAN KALDIRILDI')
    .addFields(
      { name: '👤 Kullanıcı', value: user.tag, inline: false },
      { name: '🆔 ID', value: user.id, inline: true },
      { name: '👮 Yetkili', value: moderatorTag, inline: true }
    )
    .setTimestamp();
}

// Kick mod-log embed'i
function buildKickLogEmbed({ user, moderatorTag, reason }) {
  return new EmbedBuilder()
    .setColor(0xfaa61a)
    .setTitle('👢 KICK')
    .addFields(
      { name: '👤 Kullanıcı', value: user.tag, inline: false },
      { name: '🆔 ID', value: user.id, inline: true },
      { name: '👮 Yetkili', value: moderatorTag, inline: true },
      { name: '📝 Sebep', value: reason || 'Sebep belirtilmedi', inline: false }
    )
    .setTimestamp();
}

// Timeout mod-log embed'i
function buildTimeoutLogEmbed({ user, moderatorTag, duration, reason }) {
  return new EmbedBuilder()
    .setColor(0xfaa61a)
    .setTitle('🔇 TIMEOUT')
    .addFields(
      { name: '👤 Kullanıcı', value: user.tag, inline: false },
      { name: '🆔 ID', value: user.id, inline: true },
      { name: '👮 Yetkili', value: moderatorTag, inline: true },
      { name: '⏱️ Süre', value: duration, inline: true },
      { name: '📝 Sebep', value: reason || 'Sebep belirtilmedi', inline: false }
    )
    .setTimestamp();
}

// Mesaj temizleme mod-log embed'i
function buildClearLogEmbed({ moderatorTag, channelName, count }) {
  return new EmbedBuilder()
    .setColor(0x57f287)
    .setTitle('🧹 MESAJ TEMİZLENDİ')
    .addFields(
      { name: '📍 Kanal', value: channelName, inline: false },
      { name: '🧹 Silinen mesaj', value: String(count), inline: true },
      { name: '👮 Yetkili', value: moderatorTag, inline: true }
    )
    .setTimestamp();
}

// Kanal kilitleme mod-log embed'i
function buildLockLogEmbed({ channelName, moderatorTag }) {
  return new EmbedBuilder()
    .setColor(0xfee75c)
    .setTitle('🔒 KANAL KİLİTLENDİ')
    .addFields(
      { name: '📍 Kanal', value: channelName, inline: false },
      { name: '👮 Yetkili', value: moderatorTag, inline: true }
    )
    .setTimestamp();
}

// Kanal kilidi acma mod-log embed'i
function buildUnlockLogEmbed({ channelName, moderatorTag }) {
  return new EmbedBuilder()
    .setColor(0x57f287)
    .setTitle('🔓 KANAL KİLİDİ AÇILDI')
    .addFields(
      { name: '📍 Kanal', value: channelName, inline: false },
      { name: '👮 Yetkili', value: moderatorTag, inline: true }
    )
    .setTimestamp();
}

// Slowmode mod-log embed'i
function buildSlowmodeLogEmbed({ channelName, seconds, moderatorTag }) {
  const durationText =
    seconds === 0 ? 'Kapalı (0 saniye)' : seconds === 1 ? '1 saniye' : `${seconds} saniye`;
  return new EmbedBuilder()
    .setColor(0x57f287)
    .setTitle('🐢 SLOWMODE')
    .addFields(
      { name: '📍 Kanal', value: channelName, inline: false },
      { name: '⏱️ Süre', value: durationText, inline: true },
      { name: '👮 Yetkili', value: moderatorTag, inline: true }
    )
    .setTimestamp();
}

// Nickname degisikligi mod-log embed'i
function buildNickLogEmbed({ user, oldNick, newNick, moderatorTag }) {
  return new EmbedBuilder()
    .setColor(0x57f287)
    .setTitle('✏️ NICKNAME DEĞİŞTİRİLDİ')
    .addFields(
      { name: '👤 Kullanıcı', value: user.tag, inline: false },
      { name: '📝 Eski', value: oldNick || 'Yok', inline: true },
      { name: '📝 Yeni', value: newNick || 'Yok', inline: true },
      { name: '👮 Yetkili', value: moderatorTag, inline: true }
    )
    .setTimestamp();
}

// Rol ekleme/kaldirma mod-log embed'i
function buildRoleLogEmbed({ user, role, action, moderatorTag }) {
  const isAdd = action === 'add';
  return new EmbedBuilder()
    .setColor(isAdd ? 0x57f287 : 0xed4245)
    .setTitle(isAdd ? '🎭 ROL VERİLDİ' : '🎭 ROL KALDIRILDI')
    .addFields(
      { name: '👤 Kullanıcı', value: user.tag, inline: false },
      { name: '🎭 Rol', value: `${role.name} (\`${role.id}\`)`, inline: true },
      { name: '👮 Yetkili', value: moderatorTag, inline: true }
    )
    .setTimestamp();
}

// Moderatör istatistikleri embed'i
function buildModStatsLogEmbed({ moderatorTag, counts }) {  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('🛡️ MODERATÖR İSTATİSTİKLERİ')
    .setDescription(`👮 Moderatör: **${moderatorTag}**`)
    .addFields(
      { name: '🔨 Ban', value: String(counts.ban), inline: true },
      { name: '🟢 Unban', value: String(counts.unban), inline: true },
      { name: '👢 Kick', value: String(counts.kick), inline: true },
      { name: '🔇 Timeout', value: String(counts.timeout), inline: true },
      { name: '⚠️ Warn', value: String(counts.warn), inline: true },
      { name: '🗑️ Warn kaldırma', value: String(counts.unwarn), inline: true },
      { name: '🧹 Clear', value: String(counts.clear), inline: true },
      { name: '🔒 Lock', value: String(counts.lock), inline: true },
      { name: '🔓 Unlock', value: String(counts.unlock), inline: true },
      { name: '🐢 Slowmode', value: String(counts.slowmode), inline: true },
      { name: '✏️ Nick', value: String(counts.nick), inline: true },
      { name: '🎭 Rol', value: String(counts.role_add + counts.role_remove), inline: true }
    )
    .setTimestamp();
  return embed;
}

// Tempban mod-log embed'i
function buildTempbanLogEmbed({ user, moderatorTag, reason, duration }) {
  return new EmbedBuilder()
    .setColor(0xed4245)
    .setTitle('🔨 TEMP BAN')
    .addFields(
      { name: '👤 Kullanıcı', value: user.tag, inline: false },
      { name: '🆔 ID', value: user.id, inline: true },
      { name: '👮 Yetkili', value: moderatorTag, inline: true },
      { name: '⏱️ Süre', value: duration, inline: true },
      { name: '📝 Sebep', value: reason || 'Sebep belirtilmedi', inline: false }
    )
    .setTimestamp();
}

// Tempban suresi dolan kullanici icin mod-log embed'i (bilgi amaçlı, user objesi olmayabilir)
function buildTempbanExpiredLogEmbed({ userId, reason }) {
  return new EmbedBuilder()
    .setColor(0x57f287)
    .setTitle('🟢 TEMP BAN SÜRESİ DOLDU')
    .addFields(
      { name: '🆔 Kullanıcı ID', value: userId, inline: true },
      { name: '📝 Sebep', value: reason, inline: false },
      { name: '🤖 Kaynak', value: 'Otomatik unban', inline: true }
    )
    .setTimestamp();
}

module.exports = {
  buildWarnLogEmbed,
  buildWarnRemovedLogEmbed,
  buildAllWarnsRemovedLogEmbed,
  buildBanLogEmbed,
  buildUnbanLogEmbed,
  buildKickLogEmbed,
  buildTimeoutLogEmbed,
  buildClearLogEmbed,
  buildLockLogEmbed,
  buildUnlockLogEmbed,
  buildSlowmodeLogEmbed,
  buildNickLogEmbed,
  buildRoleLogEmbed,
  buildModStatsLogEmbed,
  buildTempbanLogEmbed,
  buildTempbanExpiredLogEmbed,
};
