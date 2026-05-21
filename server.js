// ╔══════════════════════════════════════════════════════════════╗
// ║   StrangerToStranger — HeyyYuki Powered Server v3.1 FIXED   ║
// ╚══════════════════════════════════════════════════════════════╝
require("dotenv").config();
const express  = require("express");
const app      = express();
const http     = require("http").createServer(app);
const io       = require("socket.io")(http, { cors: { origin: "*" } });
const path     = require("path");
const fs       = require("fs");
const mongoose = require("mongoose");

const {
  Client, GatewayIntentBits, EmbedBuilder,
  ActivityType, REST, Routes, SlashCommandBuilder,
} = require("discord.js");

// ══════════════════════════════════════════════════════════════
// 🔑 CONFIGURATION
// ══════════════════════════════════════════════════════════════
const MONGO_URI     = process.env.MONGO_URI     || "mongodb+srv://yashwantsingh2046_db_user:Yashu2046@db.avouoxu.mongodb.net/?appName=db";
const CLIENT_ID     = process.env.CLIENT_ID     || "1478767384398528573";
const DISCORD_TOKEN = process.env.DISCORD_TOKEN || "";

// 🎯 MULTIPLE CHANNELS LIST (Yahan comma lagakar jitni chaho utni admin channel IDs dalo)
const CONTROL_CHANNEL_IDS = ["1485501424891727952", "1506573109728247848"];

const STATUS_CHANNEL_ID     = process.env.STATUS_CHANNEL_ID     || "1503654154457845900";
const CHAT_CHANNEL_ID       = process.env.CHAT_CHANNEL_ID       || "1503653808105062480";
const MEDIA_LOG_CHANNEL_ID  = process.env.MEDIA_LOG_CHANNEL_ID  || "1503653995246518292";
const JOIN_LEAVE_CHANNEL_ID = process.env.JOIN_LEAVE_CHANNEL_ID || "1503653732372447273";
const MOD_LOG_CHANNEL_ID    = process.env.MOD_LOG_CHANNEL_ID    || "1503653357229969540";
const VIP_LOG_CHANNEL_ID    = process.env.VIP_LOG_CHANNEL_ID    || "1505848329790029844";
const REPORT_CHANNEL_ID     = process.env.REPORT_CHANNEL_ID     || "1505888284927197285";
const ERROR_CHANNEL_ID      = process.env.ERROR_CHANNEL_ID      || "1505888155197509902";

const ADMIN_NAME = process.env.ADMIN_NAME || "Yashwant";
const PORT       = process.env.PORT       || 4000;

// ══════════════════════════════════════════════════════════════
// 📦 MONGODB SCHEMAS
// ══════════════════════════════════════════════════════════════
mongoose.connect(MONGO_URI)
  .then(() => {
    console.log("✅ MongoDB Connected");
    logToDiscordError("✅ MongoDB Connected — Server Online", "info");
  })
  .catch(err => {
    console.error("❌ MongoDB Error:", err.message);
    logToDiscordError("❌ MongoDB FAILED: " + err.message, "error");
  });

const MsgSchema = new mongoose.Schema({
  room:         { type: String, default: "global" },
  senderId:     String,
  senderName:   String,
  senderAvatar: String,
  senderColor:  String,
  text:         String,
  type:         { type: String, default: "text" },
  mediaUrl:     String,
  isVip:        { type: Boolean, default: false },
  createdAt:    { type: Date, default: Date.now },
});
const Message = mongoose.model("Message", MsgSchema);

const DMSchema = new mongoose.Schema({
  channelId:        { type: String, unique: true },
  participantNames: [String],
  messages: [{
    senderName:   String,
    senderAvatar: String,
    senderColor:  String,
    text:         String,
    mediaUrl:     String,
    type:         { type: String, default: "text" },
    createdAt:    { type: Date, default: Date.now },
  }],
  updatedAt: { type: Date, default: Date.now },
});
const DM = mongoose.model("DM", DMSchema);

const GroupSchema = new mongoose.Schema({
  name:        String,
  description: String,
  password:    String,
  adminName:   String,
  icon:        { type: String, default: "👥" },
  members:     [String],
  createdAt:   { type: Date, default: Date.now },
});
const Group = mongoose.model("Group", GroupSchema);

const ReportSchema = new mongoose.Schema({
  reportedUser:  String,
  reporterUser:  String,
  reporterEmail: String,
  category:      String,
  reason:        String,
  device:        String,
  createdAt:     { type: Date, default: Date.now },
});
const Report = mongoose.model("Report", ReportSchema);

// 📢 DYNAMIC ANNOUNCEMENT SCHEMA FOR WEB
const announcementSchema = new mongoose.Schema({
  text: String,
  expiresAt: Date,
  createdAt: { type: Date, default: Date.now }
});
const Announcement = mongoose.models.Announcement || mongoose.model('Announcement', announcementSchema);

const BanSchema = new mongoose.Schema({ username: { type: String, unique: true } });
const VipSchema = new mongoose.Schema({ username: { type: String, unique: true } });
const Banned = mongoose.model("Banned", BanSchema);
const Vip    = mongoose.model("Vip",    VipSchema);

// ══════════════════════════════════════════════════════════════
// 📁 FILE-BASED PERSISTENCE
// ══════════════════════════════════════════════════════════════
const BANNED_FILE = path.join(__dirname, "banned-usernames.json");
const VIPS_FILE   = path.join(__dirname, "vip-users.json");

let bannedUsernames = new Set();
let vips            = new Set();

if (fs.existsSync(BANNED_FILE)) {
  try { bannedUsernames = new Set(JSON.parse(fs.readFileSync(BANNED_FILE, "utf8"))); } catch(e) {}
}
if (fs.existsSync(VIPS_FILE)) {
  try { vips = new Set(JSON.parse(fs.readFileSync(VIPS_FILE, "utf8"))); } catch(e) {}
}

function saveBanned() {
  fs.writeFileSync(BANNED_FILE, JSON.stringify([...bannedUsernames]));
  Banned.deleteMany({}).then(() => {
    // ✅ Array.from use karne se square brackets aur '...' ka jhanjhat hi khatam!
    Array.from(bannedUsernames).forEach(u => new Banned({ username: u }).save().catch(() => {}));
  }).catch(() => {});
}

function saveVips() {
  fs.writeFileSync(VIPS_FILE, JSON.stringify([...vips]));
  Vip.deleteMany({}).then(() => {
    // ✅ Yahan bhi ekdum safe aur clean tarika apply kar diya
    Array.from(vips).forEach(u => new Vip({ username: u }).save().catch(() => {}));
  }).catch(() => {});
}

// ══════════════════════════════════════════════════════════════
// 🤖 DISCORD BOT
// ══════════════════════════════════════════════════════════════
const discordClient = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

let discordReady = false;

// ⚡ ANNOUNCEMENT SLASH COMMANDS ARE NOW EMBEDDED IN SYSTEM Array
const commands = [
  new SlashCommandBuilder().setName("ann").setDescription("Send global announcement")
    .addStringOption(o => o.setName("message").setDescription("Announcement text").setRequired(true)),
  new SlashCommandBuilder().setName("kick").setDescription("Kick user for 5 minutes")
    .addStringOption(o => o.setName("username").setDescription("Username").setRequired(true)),
  new SlashCommandBuilder().setName("ban").setDescription("Permanently ban a username")
    .addStringOption(o => o.setName("username").setDescription("Username").setRequired(true)),
  new SlashCommandBuilder().setName("unban").setDescription("Unban a username")
    .addStringOption(o => o.setName("username").setDescription("Username").setRequired(true)),
  new SlashCommandBuilder().setName("addvip").setDescription("Grant VIP to user")
    .addStringOption(o => o.setName("username").setDescription("Username").setRequired(true)),
  new SlashCommandBuilder().setName("removevip").setDescription("Revoke VIP status")
    .addStringOption(o => o.setName("username").setDescription("Username").setRequired(true)),
  new SlashCommandBuilder().setName("online").setDescription("Show all online users"),
  new SlashCommandBuilder().setName("cleargroup").setDescription("Clear group messages")
    .addStringOption(o => o.setName("groupname").setDescription("Group name").setRequired(true)),
  new SlashCommandBuilder().setName("stats").setDescription("Show server statistics"),
  
  // 📢 NEW LIVE WEB ANNOUNCEMENT COMMANDS REGISTERED HERE!
  new SlashCommandBuilder().setName("announce").setDescription("Set website live timed announcement")
    .addIntegerOption(o => o.setName("duration").setDescription("Duration in minutes").setRequired(true))
    .addStringOption(o => o.setName("message").setDescription("Announcement text paragraph").setRequired(true)),
  new SlashCommandBuilder().setName("active-announcements").setDescription("Check active website announcements"),
  new SlashCommandBuilder().setName("remove-currentannouncement").setDescription("Remove running website announcement")
].map(c => c.toJSON());

if (DISCORD_TOKEN) {
  const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);
  (async () => {
    try {
      await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
      console.log("✅ Slash commands registered");
    } catch(e) {
      console.error("❌ Slash command error:", e.message);
    }
  })();
}

discordClient.once("ready", () => {
  discordReady = true;
  console.log(`🤖 HeyyYuki online as ${discordClient.user.tag}`);
  discordClient.user.setActivity("StrangerToStranger 🌐 | 24/7", { type: ActivityType.Watching });
  updateDiscordStatus();
  logToDiscordError(`🤖 HeyyYuki Bot Started as ${discordClient.user.tag}`, "info");
});

discordClient.on("messageCreate", (msg) => {
  if (msg.author.bot || msg.channel.id !== CHAT_CHANNEL_ID) return;
  if (msg.content.startsWith("/")) return;
  io.to("global").emit("chat message", {
    id:          "discord_" + Date.now(),
    sender:      `[Discord] ${msg.author.username}`,
    message:     msg.content,
    type:        "text",
    isVip:       true,
    senderColor: "#5865f2",
    createdAt:   new Date(),
  });
});

discordClient.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  
  // 🔄 MULTIPLE CHANNELS LISTENER SECURITY CHECK
  if (!CONTROL_CHANNEL_IDS.includes(interaction.channelId)) {
    return interaction.reply({ content: `❌ Please use permitted administrator control channels.`, ephemeral: true });
  }

  const { commandName, options } = interaction;

  // 📢 NEW: /announce Command Logic
  if (commandName === "announce") {
    await interaction.deferReply();
    const durationInMinutes = options.getInteger("duration");
    const messageText = options.getString("message");

    await Announcement.deleteMany({});
    const expiryDate = new Date(Date.now() + durationInMinutes * 60 * 1000);

    const newAnnounce = new Announcement({ text: messageText, expiresAt: expiryDate });
    await newAnnounce.save();

    return interaction.editReply(`✅ Website par announcement chalu! Ye **${durationInMinutes} minutes** tak dikhegi.`);
  }

  // 📋 NEW: /active-announcements Command Logic
  if (commandName === "active-announcements") {
    await interaction.deferReply();
    const current = await Announcement.findOne({ expiresAt: { $gt: new Date() } });

    if (!current) {
      return interaction.editReply("❌ No announcements is active now.");
    }

    const timeLeft = Math.round((current.expiresAt - Date.now()) / 1000 / 60);
    return interaction.editReply(`📢 **Active Announcement:**\n"${current.text}"\n\n⏰ Yeh **${timeLeft} minutes** baad automatic hat jayegi.`);
  }

  // 🗑️ NEW: /remove-currentannouncement Command Logic
  if (commandName === "remove-currentannouncement") {
    await interaction.deferReply();
    await Announcement.deleteMany({});
    return interaction.editReply("🗑️ Website se chal rahi announcement ko turant hata diya gaya hai!");
  }

  if (commandName === "ann") {
    const msg = options.getString("message");
    io.emit("announcement", msg);
    return interaction.reply(`📢 Announced: **${msg}**`);
  }

  if (commandName === "kick") {
    const target = options.getString("username").toLowerCase();
    const sid = Object.keys(activeUsers).find(id => activeUsers[id]?.name?.toLowerCase() === target);
    if (sid) {
      const u = activeUsers[sid];
      const expiry = Date.now() + 5 * 60 * 1000;
      tempBannedIPs.set(u.ip, { expiry, reservedName: u.name });
      io.to(sid).emit("kicked_signal", { message: "👢 You have been kicked for 5 minutes.", name: u.name, expiry });
      io.sockets.sockets.get(sid)?.disconnect();
      setTimeout(() => tempBannedIPs.delete(u.ip), 5 * 60 * 1000);
      sendEmbed(MOD_LOG_CHANNEL_ID, { color: 0xe67e22, title: "👢 User Kicked", fields: [{ name: "User", value: u.name, inline: true }, { name: "IP", value: u.ip, inline: true }] });
      return interaction.reply(`✅ **${u.name}** kicked for 5 minutes.`);
    }
    return interaction.reply("❌ User not found online.");
  }

  if (commandName === "ban") {
    const target = options.getString("username").toLowerCase();
    bannedUsernames.add(target);
    saveBanned();
    const sid = Object.keys(activeUsers).find(id => activeUsers[id]?.name?.toLowerCase() === target);
    if (sid) { io.to(sid).emit("duplicate", "🚫 You have been permanently banned."); io.sockets.sockets.get(sid)?.disconnect(); }
    sendEmbed(MOD_LOG_CHANNEL_ID, { color: 0xff4757, title: "🚫 User Banned", description: `**${target}** permanently banned.` });
    return interaction.reply(`🚫 **${target}** banned.`);
  }

  if (commandName === "unban") {
    const target = options.getString("username").toLowerCase();
    if (!bannedUsernames.has(target)) return interaction.reply("❌ Not in ban list.");
    bannedUsernames.delete(target);
    saveBanned();
    sendEmbed(MOD_LOG_CHANNEL_ID, { color: 0x2ed573, title: "🔓 User Unbanned", description: `**${target}** unbanned.` });
    return interaction.reply(`✅ **${target}** unbanned.`);
  }

  if (commandName === "addvip") {
    const target = options.getString("username").toLowerCase();
    vips.add(target);
    saveVips();
    Object.keys(activeUsers).forEach(sid => { if (activeUsers[sid]?.name?.toLowerCase() === target) activeUsers[sid].isVip = true; });
    io.emit("vip_update", { username: target, action: "grant" });
    io.emit("user list", buildUserList());
    sendEmbed(VIP_LOG_CHANNEL_ID, { color: 0x1e90ff, title: "💎 VIP Granted", description: `**${target}** → VIP activated.` });
    return interaction.reply(`💎 VIP granted to **${target}**.`);
  }

  if (commandName === "removevip") {
    const target = options.getString("username").toLowerCase();
    if (!vips.has(target)) return interaction.reply("❌ Not a VIP user.");
    vips.delete(target);
    saveVips();
    Object.keys(activeUsers).forEach(sid => { if (activeUsers[sid]?.name?.toLowerCase() === target) activeUsers[sid].isVip = false; });
    io.emit("vip_update", { username: target, action: "revoke" });
    io.emit("user list", buildUserList());
    sendEmbed(VIP_LOG_CHANNEL_ID, { color: 0xffa500, title: "⚠️ VIP Revoked", description: `**${target}** → VIP removed.` });
    return interaction.reply(`⚠️ VIP revoked from **${target}**.`);
  }

  if (commandName === "online") {
    const list = Object.values(activeUsers).map(u => `• **${u.name}** ${u.isVip ? "🔹" : ""} | IP: \`${u.ip}\``).join("\n") || "No users online.";
    return interaction.reply(`📊 **Active Users (${Object.keys(activeUsers).length}):**\n${list}`);
  }

  if (commandName === "cleargroup") {
    const gname = options.getString("groupname");
    const group = await Group.findOne({ name: new RegExp(`^${gname}$`, "i") });
    if (!group) return interaction.reply("❌ Group not found.");
    await Message.deleteMany({ room: "group_" + group._id });
    io.to("group_" + group._id).emit("group_cleared", { room: "group_" + group._id });
    return interaction.reply(`✅ Messages cleared in **${group.name}**.`);
  }

  if (commandName === "stats") {
    const [msgCount, dmCount, grpCount, repCount] = await Promise.all([
      Message.countDocuments(), DM.countDocuments(), Group.countDocuments(), Report.countDocuments()
    ]);
    return interaction.reply(
      `📈 **StrangerToStranger Stats:**\n` +
      `• Online: \`${Object.keys(activeUsers).length}\`\n` +
      `• Messages: \`${msgCount}\`\n` +
      `• DM Channels: \`${dmCount}\`\n` +
      `• Groups: \`${grpCount}\`\n` +
      `• Reports: \`${repCount}\`\n` +
      `• Banned: \`${bannedUsernames.size}\`\n` +
      `• VIPs: \`${vips.size}\``
    );
  }
});

if (DISCORD_TOKEN) {
  discordClient.login(DISCORD_TOKEN).catch(err => console.error("❌ Discord login failed:", err.message));
}

// ══════════════════════════════════════════════════════════════
// 🛠️ HELPERS
// ══════════════════════════════════════════════════════════════
function getIP(socket) {
  const raw = socket.handshake.headers["x-forwarded-for"] || socket.handshake.address;
  return (raw || "127.0.0.1").split(",")[0].trim();
}

function buildUserList() {
  return Object.values(activeUsers).map(u => ({
    socketId: u.socketId,
    name:     u.name,
    bio:      u.bio,
    avatar:   u.avatar,
    color:    u.color,
    isVip:    u.isVip,
  }));
}

async function updateDiscordStatus() {
  if (!discordReady) return;
  try {
    const count = Object.keys(activeUsers).length;
    discordClient.user?.setActivity(`${count} Strangers Online 🌐`, { type: ActivityType.Watching });
    const ch = await discordClient.channels.fetch(STATUS_CHANNEL_ID).catch(() => null);
    if (ch) await ch.setName(`🟢-online-${count}`).catch(() => {});
  } catch(e) {}
}

async function sendEmbed(channelId, opts) {
  if (!discordReady) return;
  try {
    const ch = discordClient.channels.cache.get(channelId);
    if (!ch) return;
    const embed = new EmbedBuilder()
      .setColor(opts.color || 0x00f5a0)
      .setTitle(opts.title || "")
      .setTimestamp()
      .setFooter({ text: "HeyyYuki • StrangerToStranger 2026" });
    if (opts.description) embed.setDescription(opts.description);
    if (opts.fields)      embed.addFields(opts.fields);
    if (opts.image)       embed.setImage(opts.image);
    ch.send({ embeds: [embed] });
  } catch(e) {}
}

async function logToDiscordError(msg, type = "error") {
  if (!discordReady) return;
  try {
    const ch = discordClient.channels.cache.get(ERROR_CHANNEL_ID);
    if (!ch) return;
    const colors = { error: 0xff3c5f, warn: 0xffd60a, info: 0x00f5a0 };
    const icons  = { error: "❌", warn: "⚠️", info: "ℹ️" };
    const embed  = new EmbedBuilder()
      .setColor(colors[type] || 0xff3c5f)
      .setTitle(`${icons[type]} ${type.toUpperCase()}`)
      .setDescription("```" + msg.substring(0, 1900) + "```")
      .setTimestamp()
      .setFooter({ text: "HeyyYuki Error Monitor" });
    ch.send({ embeds: [embed] });
  } catch(e) {}
}

function getDMChannelId(nameA, nameB) {
  return [nameA.toLowerCase(), nameB.toLowerCase()].sort().join("__dm__");
}

// ══════════════════════════════════════════════════════════════
// 🧠 IN-MEMORY STATE
// ══════════════════════════════════════════════════════════════
const activeUsers   = {};
const tempBannedIPs = new Map();
const shadowBanned  = new Set();
const typingTimers  = new Map();

// ══════════════════════════════════════════════════════════════
// 🔌 SOCKET.IO
// ══════════════════════════════════════════════════════════════
io.on("connection", (socket) => {
  const userIP = getIP(socket);
  let currentUser = null;

  socket.on("join", async (data) => {
    try {
      const name      = (data.name || "").trim();
      const bio       = (data.bio  || "No bio").trim();
      const avatar    = data.avatar || "";
      const color     = data.color  || "#00f5a0";
      const nameLower = name.toLowerCase();

      if (!name || name.length < 2) {
        return socket.emit("error_msg", "Username must be at least 2 characters.");
      }

      if (tempBannedIPs.has(userIP)) {
        const ban = tempBannedIPs.get(userIP);
        if (Date.now() < ban.expiry) {
          if (nameLower !== ban.reservedName.toLowerCase()) {
            return socket.emit("duplicate", `🚫 You are kicked. Only "${ban.reservedName}" allowed from your IP.`);
          }
          return socket.emit("kick_timer", {
            message: `👢 Kicked. Wait ${Math.ceil((ban.expiry - Date.now()) / 60000)} minutes.`,
            remainingTime: ban.expiry - Date.now(),
          });
        } else {
          tempBannedIPs.delete(userIP);
        }
      }

      if (bannedUsernames.has(nameLower)) {
        return socket.emit("duplicate", "🚫 You are permanently banned.");
      }

      const duplicate = Object.values(activeUsers).find(u => u.name.toLowerCase() === nameLower);
      if (duplicate) {
        return socket.emit("duplicate", "⚠️ Username already taken. Choose another.");
      }

      const isVip   = vips.has(nameLower) || name === ADMIN_NAME;
      const isAdmin = name === ADMIN_NAME;

      currentUser = {
        socketId: socket.id,
        name, bio, avatar, color, ip: userIP,
        isVip, isAdmin, room: "global",
      };

      activeUsers[socket.id] = currentUser;
      socket.join("global");

      const history = await Message.find({ room: "global" }).sort({ createdAt: 1 }).limit(100).lean();
      const normalizedHistory = history.map(m => ({
        id:           m._id.toString(),
        sender:       m.senderName,
        senderAvatar: m.senderAvatar,
        senderColor:  m.senderColor,
        message:      m.text,
        type:         m.type || "text",
        mediaUrl:     m.mediaUrl,
        isVip:        m.isVip,
        room:         m.room,
        createdAt:    m.createdAt,
      }));

      socket.emit("history", normalizedHistory);

      io.to("global").emit("chat message", {
        id:        "sys_" + Date.now(),
        sender:    "System",
        message:   `${name} joined the chat`,
        type:      "system",
        room:      "global",
        createdAt: new Date(),
      });

      io.emit("user list", buildUserList());
      socket.emit("joined", currentUser);
      updateDiscordStatus();

      sendEmbed(JOIN_LEAVE_CHANNEL_ID, {
        color: 0x00f5a0, title: "📥 User Joined",
        fields: [
          { name: "Username", value: name + (isVip ? " 🔹" : ""), inline: true },
          { name: "IP",       value: userIP,                       inline: true },
          { name: "Bio",      value: bio || "—",                   inline: false },
        ],
      });

      const groups = await Group.find({}).sort({ createdAt: -1 }).lean();
      socket.emit("groups_list", groups.map(g => ({ ...g, hasPassword: !!g.password })));

    } catch(err) {
      console.error("join error:", err);
      socket.emit("error_msg", "Join failed. Try again.");
    }
  });

  socket.on("chat message", async (data) => {
    if (!currentUser) return;
    try {
      const room = data.room || "global";
      const payload = {
        id:           data.id || (socket.id + "_" + Date.now()),
        sender:       currentUser.name,
        senderAvatar: currentUser.avatar,
        senderColor:  currentUser.color,
        isVip:        currentUser.isVip,
        message:      data.message || "",
        type:         data.type || "text",
        mediaUrl:     data.mediaUrl || "",
        replyTo:      data.replyTo || null,
        room,
        createdAt:    new Date(),
      };

      const msgDoc = new Message({
        room, senderId: socket.id, senderName: currentUser.name,
        senderAvatar: currentUser.avatar, senderColor: currentUser.color,
        text: data.message || "", type: data.type || "text", mediaUrl: data.mediaUrl || "", isVip: currentUser.isVip,
      });
      await msgDoc.save();
      payload._id = msgDoc._id.toString();

      if (!shadowBanned.has(currentUser.name.toLowerCase())) {
        io.to(room).emit("chat message", payload);
        if (payload.type === "text" && discordReady) {
          discordClient.channels.cache.get(CHAT_CHANNEL_ID)?.send(`💬 **${currentUser.name}**: ${payload.message}`);
        } else if (payload.type === "image") {
          sendEmbed(MEDIA_LOG_CHANNEL_ID, { color: 0x9b59b6, title: `🖼️ Image from ${currentUser.name}`, image: payload.mediaUrl });
        }
      } else {
        socket.emit("chat message", payload);
      }
    } catch(err) {}
  });

  socket.on("delete message", async (id) => {
    try { await Message.findByIdAndDelete(id); io.emit("delete message", id); } catch(e) {}
  });

  socket.on("typing", (data) => {
    if (!currentUser) return;
    const room = (data && data.room) ? data.room : (currentUser.room || "global");
    socket.to(room).emit("typing", { user: currentUser.name });
  });

  socket.on("private message", async (data) => {
    if (!currentUser) return;
    try {
      const receiverName = data.receiver;
      const toUser = Object.values(activeUsers).find(u => u.name.toLowerCase() === receiverName?.toLowerCase());
      const channelId = getDMChannelId(currentUser.name, receiverName);

      let dmDoc = await DM.findOne({ channelId });
      if (!dmDoc) { dmDoc = new DM({ channelId, participantNames: [currentUser.name, receiverName], messages: [] }); }
      const msgObj = { senderName: currentUser.name, senderAvatar: currentUser.avatar, senderColor: currentUser.color, text: data.message, type: data.type || "text", mediaUrl: data.mediaUrl || "", createdAt: new Date() };
      dmDoc.messages.push(msgObj);
      dmDoc.updatedAt = new Date();
      await dmDoc.save();

      const payload = { channelId, id: data.id || genId(), sender: currentUser.name, senderAvatar: currentUser.avatar, senderColor: currentUser.color, receiver: receiverName, message: data.message, type: data.type || "text", mediaUrl: data.mediaUrl || "", createdAt: new Date() };
      socket.emit("private message", payload);
      if (toUser) io.to(toUser.socketId).emit("private message", payload);
    } catch(err) {}
  });

  socket.on("dm_history", async ({ withUser }) => {
    if (!currentUser) return;
    try {
      const channelId = getDMChannelId(currentUser.name, withUser);
      const dmDoc = await DM.findOne({ channelId }).lean();
      const messages = (dmDoc ? dmDoc.messages : []).map(m => ({ sender: m.senderName, senderAvatar: m.senderAvatar, senderColor: m.senderColor, message: m.text, type: m.type, mediaUrl: m.mediaUrl, createdAt: m.createdAt }));
      socket.emit("dm_history_data", { channelId, withUser, messages });
    } catch(err) {}
  });

  socket.on("dm_typing", ({ toUser, isTyping }) => {
    if (!currentUser) return;
    const target = Object.values(activeUsers).find(u => u.name.toLowerCase() === toUser?.toLowerCase());
    if (target) io.to(target.socketId).emit("dm_typing_update", { fromUser: currentUser.name, isTyping });
  });

  socket.on("join_group", async ({ groupId, password }) => {
    try {
      const group = await Group.findById(groupId);
      if (!group) return socket.emit("group_error", "Group not found.");
      if (group.password && group.password !== password) return socket.emit("group_error", "Wrong password.");

      const room = "group_" + groupId;
      socket.join(room);
      if (currentUser) currentUser.room = room;

      const history = await Message.find({ room }).sort({ createdAt: 1 }).limit(100).lean();
      const normalizedHistory = history.map(m => ({ id: m._id.toString(), sender: m.senderName, senderAvatar: m.senderAvatar, senderColor: m.senderColor, message: m.text, type: m.type || "text", isVip: m.isVip, room: m.room, createdAt: m.createdAt }));
      socket.emit("group_joined", { group, history: normalizedHistory });
      if (currentUser) {
        io.to(room).emit("chat message", { id: "sys_" + Date.now(), sender: "System", message: `${currentUser.name} joined ${group.name}`, type: "system", room, createdAt: new Date() });
      }
    } catch(err) {}
  });

  socket.on("create_group", async ({ name, description, password, icon }) => {
    if (!currentUser) return;
    try {
      const group = new Group({ name, description: description || "", password: password || "", adminName: currentUser.name, icon: icon || "👥", members: [currentUser.name] });
      await group.save();
      socket.emit("group_created", group);
      const groups = await Group.find({}).sort({ createdAt: -1 }).lean();
      io.emit("groups_list", groups.map(g => ({ ...g, hasPassword: !!g.password })));
    } catch(err) {}
  });

  socket.on("get_groups", async () => {
    try { const groups = await Group.find({}).sort({ createdAt: -1 }).lean(); socket.emit("groups_list", groups.map(g => ({ ...g, hasPassword: !!g.password }))); } catch(err) {}
  });

  socket.on("report user", async (data) => {
    try {
      const device = /Mobi|Android/i.test(socket.handshake.headers["user-agent"] || "") ? "📱 Mobile" : "🖥️ Desktop";
      await new Report({ reportedUser: data.reportedUser, reporterUser: data.reportedBy || data.reporterUser || currentUser?.name, reporterEmail: data.email, category: data.reason, reason: data.description || data.reason, device }).save();

      if (discordReady) {
        const embed = new EmbedBuilder().setColor(0xff3c5f).setTitle("🚨 New User Report")
          .addFields({ name: "🎯 Reported", value: `\`${data.reportedUser}\``, inline: true }, { name: "👤 Reporter", value: `\`${data.reportedBy || "—"}\``, inline: true }, { name: "📱 Device", value: device, inline: true }, { name: "📂 Category", value: `\`${data.reason || "—"}\``, inline: false }, { name: "📝 Details", value: (data.description || "—").substring(0, 1000), inline: false }).setTimestamp().setFooter({ text: "StrangerToStranger 2026" });
        const ch = discordClient.channels.cache.get(REPORT_CHANNEL_ID) || discordClient.channels.cache.get(MOD_LOG_CHANNEL_ID);
        if (ch) ch.send({ embeds: [embed] });
      }
      socket.emit("report_success");
    } catch(err) { socket.emit("report_error", "Failed to submit report."); }
  });

  const handleProfileUpdate = ({ bio, avatar, color, name }) => {
    if (!currentUser) return;
    if (bio    !== undefined) currentUser.bio    = bio;
    if (avatar !== undefined) currentUser.avatar = avatar;
    if (color  !== undefined) currentUser.color  = color;
    if (name && name !== currentUser.name) {
      const nameLower = name.toLowerCase();
      const duplicate = Object.values(activeUsers).find(u => u.name.toLowerCase() === nameLower && u.socketId !== socket.id);
      if (!duplicate) currentUser.name = name;
    }
    activeUsers[socket.id] = currentUser;
    io.emit("user list", buildUserList());
    socket.emit("profile_updated", currentUser);
  };
  socket.on("update_profile", handleProfileUpdate);
  socket.on("update profile",  handleProfileUpdate);

  socket.on("disconnect", () => {
    if (!currentUser) return;
    io.emit("chat message", { id: "sys_" + Date.now(), sender: "System", message: `${currentUser.name} left the chat`, type: "system", room: currentUser.room || "global", createdAt: new Date() });
    sendEmbed(JOIN_LEAVE_CHANNEL_ID, { color: 0xff3c5f, title: "📤 User Left", fields: [{ name: "Username", value: currentUser.name, inline: true }, { name: "IP", value: currentUser.ip, inline: true }] });
    delete activeUsers[socket.id];
    io.emit("user list", buildUserList());
    updateDiscordStatus();
  });
});

function genId() { return Date.now().toString(36) + Math.random().toString(36).substr(2, 5); }

// ══════════════════════════════════════════════════════════════
// 🌐 REST API
// ══════════════════════════════════════════════════════════════
app.use(express.json({ limit: "10mb" }));
app.use(express.static(path.join(__dirname, "public"), { extensions: ["html", "htm"] }));

app.get("/", (req, res) => { res.sendFile(path.join(__dirname, "public", "index.html")); });
app.get("/iframe-groupchatroom", (req, res) => { res.sendFile(path.join(__dirname, "public", "iframe-groupchatroom.html")); });
app.get("/chat", (req, res) => { res.sendFile(path.join(__dirname, "public", "index.html")); });

// 📋 LIVE WEB ANNOUNCEMENT ENDPOINT (Bina client error ke chalu!)
app.get('/api/live-announcement', async (req, res) => {
  try {
    const current = await Announcement.findOne({ expiresAt: { $gt: new Date() } });
    if (!current) {
      return res.json({ active: false, text: "📢 Share this link with friends to grow our chat room!" });
    }
    res.json({ active: true, text: current.text });
  } catch (err) {
    res.json({ active: false, text: "Error loading announcement" });
  }
});

app.post("/api/report", async (req, res) => {
  try {
    const device = /Mobi|Android/i.test(req.headers["user-agent"] || "") ? "📱 Mobile" : "🖥️ Desktop";
    const data = { ...req.body, device };
    await new Report(data).save();
    if (discordReady) {
      const embed = new EmbedBuilder().setColor(0xff3c5f).setTitle("🚨 Report (HTTP)").addFields({ name: "🎯 Reported", value: `\`${data.reportedUser || "—"}\``, inline: true }, { name: "👤 Reporter", value: `\`${data.reporterUser || "—"}\``, inline: true }, { name: "📱 Device", value: device, inline: true }, { name: "📧 Email", value: data.reporterEmail || "Not provided", inline: false }, { name: "📝 Reason", value: (data.reason || "—").substring(0, 1000), inline: false }).setTimestamp().setFooter({ text: "HeyyYuki Report System" });
      const ch = discordClient.channels.cache.get(REPORT_CHANNEL_ID) || discordClient.channels.cache.get(MOD_LOG_CHANNEL_ID);
      if (ch) ch.send({ embeds: [embed] });
    }
    res.json({ ok: true });
  } catch(err) { res.status(500).json({ ok: false }); }
});

app.get("/health", (req, res) => {
  res.json({ status: "ok", online: Object.keys(activeUsers).length, discord: discordReady, mongo: mongoose.connection.readyState === 1 ? "connected" : "disconnected" });
});

app.get("/sw.js",         (req, res) => res.sendFile(path.resolve(__dirname, "public/sw.js")));
app.get("/manifest.json",(req, res) => res.sendFile(path.resolve(__dirname, "public/manifest.json")));
app.use("/.well-known",  express.static(path.join(__dirname, ".well-known"), { dotfiles: "allow" }));

// ══════════════════════════════════════════════════════════════
// 🚀 START
// ══════════════════════════════════════════════════════════════
http.listen(PORT, () => {
  console.log(`🚀 StrangerToStranger running on http://localhost:${PORT}`);
});

// ══════════════════════════════════════════════════════════════
// 🛡️ CRASH PROTECTION
// ══════════════════════════════════════════════════════════════
process.on("unhandledRejection", (err) => {
  console.error("⚠️ Unhandled Rejection:", err);
  logToDiscordError(`💥 Unhandled Rejection:\n${String(err).substring(0, 1500)}`);
});
process.on("uncaughtException", (err) => {
  console.error("⚠️ Uncaught Exception:", err);
  logToDiscordError(`💥 Uncaught Exception:\n${err.message}\n${(err.stack || "").substring(0, 1000)}`);
});
