// ╔══════════════════════════════════════════════════════════════╗
// ║   StrangerToStranger — HeyyYuki Powered Server v3.0         ║
// ║   MongoDB + Discord.js + Socket.IO + Full Feature Set       ║
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
// 🔑 CONFIGURATION — Replace these values / use .env file
// ══════════════════════════════════════════════════════════════
const MONGO_URI    = process.env.MONGO_URI    || "mongodb+srv://yashwantsingh2046_db_user:Yashu2046@db.avouoxu.mongodb.net/?appName=db";
const CLIENT_ID    = process.env.CLIENT_ID    || "1478767384398528573";

// Discord Channel IDs (same as your original setup)
const CONTROL_CHANNEL_ID   = process.env.CONTROL_CHANNEL_ID   || "1485501424891727952";
const STATUS_CHANNEL_ID    = process.env.STATUS_CHANNEL_ID    || "1503654154457845900";
const CHAT_CHANNEL_ID      = process.env.CHAT_CHANNEL_ID      || "1503653808105062480";
const MEDIA_LOG_CHANNEL_ID = process.env.MEDIA_LOG_CHANNEL_ID || "1503653995246518292";
const JOIN_LEAVE_CHANNEL_ID= process.env.JOIN_LEAVE_CHANNEL_ID|| "1503653732372447273";
const MOD_LOG_CHANNEL_ID   = process.env.MOD_LOG_CHANNEL_ID   || "1503653357229969540";
const VIP_LOG_CHANNEL_ID   = process.env.VIP_LOG_CHANNEL_ID   || "1505848329790029844";
const REPORT_CHANNEL_ID    = process.env.REPORT_CHANNEL_ID    || "1505888284927197285";
const ERROR_CHANNEL_ID     = process.env.ERROR_CHANNEL_ID     || "1505888155197509902";

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

// Message Schema (Global + Group — persistent)
const MsgSchema = new mongoose.Schema({
  room:       { type: String, default: "global" },
  senderId:   String,
  senderName: String,
  senderAvatar: String,
  senderColor:  String,
  text:       String,
  type:       { type: String, default: "text" }, // text | system | image | video | audio
  mediaUrl:   String,
  isVip:      { type: Boolean, default: false },
  createdAt:  { type: Date, default: Date.now },
});
const Message = mongoose.model("Message", MsgSchema);

// DM Schema — persistent, never auto-deleted
const DMSchema = new mongoose.Schema({
  channelId:    { type: String, unique: true },
  participants: [String], // socket IDs are temporary; we store names
  participantNames: [String],
  messages: [{
    senderName: String,
    senderAvatar: String,
    senderColor:  String,
    text: String,
    mediaUrl: String,
    type: { type: String, default: "text" },
    createdAt: { type: Date, default: Date.now },
  }],
  updatedAt: { type: Date, default: Date.now },
});
const DM = mongoose.model("DM", DMSchema);

// Group Schema
const GroupSchema = new mongoose.Schema({
  name:        String,
  description: String,
  password:    String,
  adminName:   String,
  icon:        { type: String, default: "👥" },
  members:     [String], // names
  createdAt:   { type: Date, default: Date.now },
});
const Group = mongoose.model("Group", GroupSchema);

// Report Schema
const ReportSchema = new mongoose.Schema({
  reportedUser: String,
  reporterUser: String,
  reporterEmail:String,
  category:     String,
  reason:       String,
  device:       String,
  createdAt:    { type: Date, default: Date.now },
});
const Report = mongoose.model("Report", ReportSchema);

// Banned / VIP stored in MongoDB too (backup of files)
const BanSchema = new mongoose.Schema({ username: { type: String, unique: true } });
const VipSchema = new mongoose.Schema({ username: { type: String, unique: true } });
const Banned = mongoose.model("Banned", BanSchema);
const Vip    = mongoose.model("Vip",    VipSchema);

// ══════════════════════════════════════════════════════════════
// 📁 FILE-BASED PERSISTENCE (same as your original — dual backup)
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
    [...bannedUsernames].forEach(u => new Banned({ username: u }).save().catch(()=>{}));
  }).catch(()=>{});
}
function saveVips() {
  fs.writeFileSync(VIPS_FILE, JSON.stringify([...vips]));
  Vip.deleteMany({}).then(() => {
    [...vips].forEach(u => new Vip({ username: u }).save().catch(()=>{}));
  }).catch(()=>{});
}

// ══════════════════════════════════════════════════════════════
// 🤖 DISCORD BOT — HeyyYuki
// ══════════════════════════════════════════════════════════════
const discordClient = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

let discordReady = false;

// Slash Commands Registration
const commands = [
  new SlashCommandBuilder().setName("ann").setDescription("Send global announcement to website")
    .addStringOption(o => o.setName("message").setDescription("Announcement text").setRequired(true)),
  new SlashCommandBuilder().setName("kick").setDescription("Kick user for 5 minutes")
    .addStringOption(o => o.setName("username").setDescription("Username to kick").setRequired(true)),
  new SlashCommandBuilder().setName("ban").setDescription("Permanently ban a username")
    .addStringOption(o => o.setName("username").setDescription("Username to ban").setRequired(true)),
  new SlashCommandBuilder().setName("unban").setDescription("Unban a username")
    .addStringOption(o => o.setName("username").setDescription("Username to unban").setRequired(true)),
  new SlashCommandBuilder().setName("addvip").setDescription("Grant VIP blue tick to user")
    .addStringOption(o => o.setName("username").setDescription("Username").setRequired(true)),
  new SlashCommandBuilder().setName("removevip").setDescription("Revoke VIP status")
    .addStringOption(o => o.setName("username").setDescription("Username").setRequired(true)),
  new SlashCommandBuilder().setName("online").setDescription("Show all online users"),
  new SlashCommandBuilder().setName("cleargroup").setDescription("Clear all messages in a group")
    .addStringOption(o => o.setName("groupname").setDescription("Group name").setRequired(true)),
  new SlashCommandBuilder().setName("stats").setDescription("Show server statistics"),
].map(c => c.toJSON());

const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);
(async () => {
  try {
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log("✅ Slash commands registered");
  } catch(e) {
    console.error("❌ Slash command error:", e.message);
  }
})();

discordClient.once("ready", () => {
  discordReady = true;
  console.log(`🤖 HeyyYuki online as ${discordClient.user.tag}`);
  discordClient.user.setActivity("StrangerToStranger 🌐 | 24/7", { type: ActivityType.Watching });
  updateDiscordStatus();
  logToDiscordError(`🤖 HeyyYuki Bot Started Successfully as ${discordClient.user.tag}`, "info");
});

// Mirror Discord → Website global chat
discordClient.on("messageCreate", (msg) => {
  if (msg.author.bot || msg.channel.id !== CHAT_CHANNEL_ID) return;
  if (msg.content.startsWith("/")) return;
  io.to("global").emit("chat message", {
    id: "discord_" + Date.now(),
    sender: `[Discord] ${msg.author.username}`,
    message: msg.content,
    type: "text",
    isVip: true,
    senderColor: "#5865f2",
    createdAt: new Date(),
  });
});

// Slash Command Handler
discordClient.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  // Security: only run in control channel
  if (interaction.channelId !== CONTROL_CHANNEL_ID) {
    return interaction.reply({
      content: `❌ Run commands only in <#${CONTROL_CHANNEL_ID}>`,
      ephemeral: true,
    });
  }

  const { commandName, options } = interaction;

  // /ann — Global Announcement
  if (commandName === "ann") {
    const msg = options.getString("message");
    io.emit("announcement", msg);
    return interaction.reply(`📢 Announced: **${msg}**`);
  }

  // /kick
  if (commandName === "kick") {
    const target = options.getString("username").toLowerCase();
    const sid = Object.keys(activeUsers).find(id => activeUsers[id]?.name?.toLowerCase() === target);
    if (sid) {
      const u = activeUsers[sid];
      const expiry = Date.now() + 5 * 60 * 1000;
      tempBannedIPs.set(u.ip, { expiry, reservedName: u.name });
      io.to(sid).emit("kicked_signal", {
        message: "👢 You have been kicked for 5 minutes. Auto-reconnect will happen!",
        name: u.name, bio: u.bio, expiry,
      });
      discordClient.sockets?.get(sid)?.disconnect();
      io.sockets.sockets.get(sid)?.disconnect();
      setTimeout(() => tempBannedIPs.delete(u.ip), 5 * 60 * 1000);

      sendEmbed(MOD_LOG_CHANNEL_ID, {
        color: 0xe67e22, title: "👢 User Kicked",
        fields: [
          { name: "User", value: u.name, inline: true },
          { name: "IP", value: u.ip, inline: true },
          { name: "Duration", value: "5 Minutes", inline: true },
        ],
      });
      return interaction.reply(`✅ **${u.name}** kicked for 5 minutes.`);
    }
    return interaction.reply("❌ User not found online.");
  }

  // /ban
  if (commandName === "ban") {
    const target = options.getString("username").toLowerCase();
    bannedUsernames.add(target);
    saveBanned();
    const sid = Object.keys(activeUsers).find(id => activeUsers[id]?.name?.toLowerCase() === target);
    if (sid) {
      io.to(sid).emit("duplicate", "🚫 You have been permanently banned.");
      io.sockets.sockets.get(sid)?.disconnect();
    }
    sendEmbed(MOD_LOG_CHANNEL_ID, { color: 0xff4757, title: "🚫 User Banned", description: `**${target}** permanently banned.` });
    return interaction.reply(`🚫 **${target}** banned permanently.`);
  }

  // /unban
  if (commandName === "unban") {
    const target = options.getString("username").toLowerCase();
    if (!bannedUsernames.has(target)) return interaction.reply("❌ User not in ban list.");
    bannedUsernames.delete(target);
    saveBanned();
    sendEmbed(MOD_LOG_CHANNEL_ID, { color: 0x2ed573, title: "🔓 User Unbanned", description: `**${target}** unbanned.` });
    return interaction.reply(`✅ **${target}** unbanned.`);
  }

  // /addvip
  if (commandName === "addvip") {
    const target = options.getString("username").toLowerCase();
    vips.add(target);
    saveVips();
    Object.keys(activeUsers).forEach(sid => {
      if (activeUsers[sid]?.name?.toLowerCase() === target) activeUsers[sid].isVip = true;
    });
    io.emit("vip_update", { username: target, action: "grant" });
    io.emit("user list", buildUserList());
    sendEmbed(VIP_LOG_CHANNEL_ID, { color: 0x1e90ff, title: "💎 VIP Granted", description: `**${target}** → Blue tick activated.` });
    return interaction.reply(`💎 VIP granted to **${target}**.`);
  }

  // /removevip
  if (commandName === "removevip") {
    const target = options.getString("username").toLowerCase();
    if (!vips.has(target)) return interaction.reply("❌ Not a VIP user.");
    vips.delete(target);
    saveVips();
    Object.keys(activeUsers).forEach(sid => {
      if (activeUsers[sid]?.name?.toLowerCase() === target) activeUsers[sid].isVip = false;
    });
    io.emit("vip_update", { username: target, action: "revoke" });
    io.emit("user list", buildUserList());
    sendEmbed(VIP_LOG_CHANNEL_ID, { color: 0xffa500, title: "⚠️ VIP Revoked", description: `**${target}** → Blue tick removed.` });
    return interaction.reply(`⚠️ VIP revoked from **${target}**.`);
  }

  // /online
  if (commandName === "online") {
    const list = Object.values(activeUsers)
      .map(u => `• **${u.name}** ${u.isVip ? "🔹" : ""} | IP: \`${u.ip}\` | Bio: *${u.bio}*`)
      .join("\n") || "No users online.";
    const count = Object.keys(activeUsers).length;
    return interaction.reply(`📊 **Active Users (${count}):**\n${list}`);
  }

  // /cleargroup
  if (commandName === "cleargroup") {
    const gname = options.getString("groupname");
    const group = await Group.findOne({ name: new RegExp(`^${gname}$`, "i") });
    if (!group) return interaction.reply("❌ Group not found.");
    await Message.deleteMany({ room: "group_" + group._id });
    io.to("group_" + group._id).emit("group_cleared", { room: "group_" + group._id });
    return interaction.reply(`✅ Messages cleared in group **${group.name}**.`);
  }

  // /stats
  if (commandName === "stats") {
    const msgCount  = await Message.countDocuments();
    const dmCount   = await DM.countDocuments();
    const grpCount  = await Group.countDocuments();
    const repCount  = await Report.countDocuments();
    return interaction.reply(
      `📈 **StrangerToStranger Stats:**\n` +
      `• Online Now: \`${Object.keys(activeUsers).length}\`\n` +
      `• Total Messages: \`${msgCount}\`\n` +
      `• DM Channels: \`${dmCount}\`\n` +
      `• Groups: \`${grpCount}\`\n` +
      `• Reports: \`${repCount}\`\n` +
      `• Banned: \`${bannedUsernames.size}\`\n` +
      `• VIPs: \`${vips.size}\``
    );
  }
});

discordClient.login(DISCORD_TOKEN).catch(err => {
  console.error("❌ Discord login failed:", err.message);
});

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
    badge:    u.badge,
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
    if (opts.fields) embed.addFields(opts.fields);
    if (opts.image) embed.setImage(opts.image);
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
const activeUsers   = {};  // socketId -> user object
const tempBannedIPs = new Map(); // ip -> { expiry, reservedName }
const shadowBanned  = new Set();
const typingRooms   = new Map(); // room -> Set of names

// ══════════════════════════════════════════════════════════════
// 🔌 SOCKET.IO
// ══════════════════════════════════════════════════════════════
io.on("connection", (socket) => {
  const userIP = getIP(socket);
  let currentUser = null;

  // ── JOIN ──────────────────────────────────────────────────
  socket.on("join", async (data) => {
    try {
      const name   = (data.name || "").trim();
      const bio    = (data.bio  || "").trim();
      const avatar = data.avatar || "";
      const color  = data.color  || "#00f5a0";
      const nameLower = name.toLowerCase();

      if (!name || name.length < 2) return socket.emit("error_msg", "Username must be at least 2 characters.");

      // IP kick check
      if (tempBannedIPs.has(userIP)) {
        const ban = tempBannedIPs.get(userIP);
        if (Date.now() < ban.expiry) {
          if (nameLower !== ban.reservedName.toLowerCase()) {
            return socket.emit("duplicate", `🚫 You are kicked. Only username "${ban.reservedName}" allowed from your network.`);
          }
          return socket.emit("kick_timer", {
            message: `👢 Kicked. Wait ${Math.ceil((ban.expiry - Date.now()) / 60000)} minutes.`,
            remainingTime: ban.expiry - Date.now(),
          });
        } else {
          tempBannedIPs.delete(userIP);
        }
      }

      // Permanent ban check
      if (bannedUsernames.has(nameLower))
        return socket.emit("duplicate", "🚫 You are permanently banned.");

      // Duplicate username check
      if (Object.values(activeUsers).some(u => u.name.toLowerCase() === nameLower))
        return socket.emit("duplicate", "⚠️ Username already taken. Choose another.");

      const isVip   = vips.has(nameLower) || name === ADMIN_NAME;
      const isAdmin = name === ADMIN_NAME;

      currentUser = {
        socketId: socket.id,
        name, bio, avatar, color, ip: userIP,
        isVip, isAdmin, room: "global",
      };

      activeUsers[socket.id] = currentUser;
      socket.join("global");
      socket.userObj = currentUser;

      // Send last 100 global messages from MongoDB
      const history = await Message.find({ room: "global" })
        .sort({ createdAt: 1 }).limit(100).lean();
      socket.emit("history", history);

      // Notify room
      const sysMsg = {
        id: Date.now(), sender: "System", message: `${name} joined the chat`,
        type: "system", room: "global", createdAt: new Date(),
      };
      io.to("global").emit("chat message", sysMsg);
      io.emit("user list", buildUserList());
      socket.emit("joined", currentUser);
      updateDiscordStatus();

      // Discord join log
      sendEmbed(JOIN_LEAVE_CHANNEL_ID, {
        color: 0x00f5a0, title: "📥 User Joined",
        fields: [
          { name: "Username", value: name + (isVip ? " 🔹" : ""), inline: true },
          { name: "IP", value: userIP, inline: true },
          { name: "Bio", value: bio || "—", inline: false },
        ],
      });

      // Load groups list
      const groups = await Group.find({}).sort({ createdAt: -1 }).lean();
      socket.emit("groups_list", groups.map(g => ({ ...g, hasPassword: !!g.password })));

    } catch(err) {
      logToDiscordError("join error: " + err.message);
      socket.emit("error_msg", "Join failed. Try again.");
    }
  });

  // ── CHAT MESSAGE ──────────────────────────────────────────
  socket.on("chat message", async (data) => {
    if (!currentUser) return;
    try {
      const room = data.room || "global";
      const payload = {
        id:           socket.id + "_" + Date.now(),
        sender:       currentUser.name,
        senderAvatar: currentUser.avatar,
        senderColor:  currentUser.color,
        isVip:        currentUser.isVip,
        message:      data.message || "",
        type:         data.type || "text",
        mediaUrl:     data.mediaUrl || "",
        room,
        createdAt:    new Date(),
      };

      // Save to MongoDB
      const msgDoc = new Message({
        room,
        senderId:     socket.id,
        senderName:   currentUser.name,
        senderAvatar: currentUser.avatar,
        senderColor:  currentUser.color,
        text:         data.message || "",
        type:         data.type || "text",
        mediaUrl:     data.mediaUrl || "",
        isVip:        currentUser.isVip,
      });
      await msgDoc.save();
      payload._id = msgDoc._id;

      if (!shadowBanned.has(currentUser.name.toLowerCase())) {
        io.to(room).emit("chat message", payload);
        // Mirror text to Discord
        if (payload.type === "text") {
          discordClient.channels.cache.get(CHAT_CHANNEL_ID)
            ?.send(`💬 **${currentUser.name}**${currentUser.isVip ? " 🔹" : ""} [${room}]: ${payload.message}`);
        } else if (payload.type === "image") {
          sendEmbed(MEDIA_LOG_CHANNEL_ID, {
            color: 0x9b59b6, title: `🖼️ Image from ${currentUser.name}`,
            image: payload.mediaUrl,
          });
        }
      } else {
        socket.emit("chat message", payload); // Shadow: only sender sees it
      }
    } catch(err) {
      logToDiscordError("chat message error: " + err.message);
    }
  });

  // ── DELETE MESSAGE ────────────────────────────────────────
  socket.on("delete message", async (id) => {
    try {
      await Message.findByIdAndDelete(id);
      io.emit("delete message", id);
    } catch(e) {}
  });

  // ── TYPING ────────────────────────────────────────────────
  socket.on("typing", ({ room, isTyping }) => {
    if (!currentUser) return;
    const r = room || "global";
    if (!typingRooms.has(r)) typingRooms.set(r, new Set());
    const set = typingRooms.get(r);
    if (isTyping) set.add(currentUser.name);
    else set.delete(currentUser.name);
    socket.to(r).emit("typing_update", { room: r, users: Array.from(set) });
  });

  // ── PRIVATE / DM MESSAGE ──────────────────────────────────
  socket.on("private message", async (data) => {
    if (!currentUser) return;
    try {
      const toUser = Object.values(activeUsers).find(u => u.name.toLowerCase() === data.receiver?.toLowerCase());
      const toSid  = toUser?.socketId;
      const channelId = getDMChannelId(currentUser.name, data.receiver);

      // Save to MongoDB
      let dmDoc = await DM.findOne({ channelId });
      if (!dmDoc) {
        dmDoc = new DM({
          channelId,
          participants:     [socket.id, toSid || "offline"],
          participantNames: [currentUser.name, data.receiver],
          messages: [],
        });
      }
      const msgObj = {
        senderName:   currentUser.name,
        senderAvatar: currentUser.avatar,
        senderColor:  currentUser.color,
        text:         data.message,
        type:         data.type || "text",
        mediaUrl:     data.mediaUrl || "",
        createdAt:    new Date(),
      };
      dmDoc.messages.push(msgObj);
      dmDoc.updatedAt = new Date();
      await dmDoc.save();

      const payload = {
        channelId,
        sender:       currentUser.name,
        senderAvatar: currentUser.avatar,
        senderColor:  currentUser.color,
        receiver:     data.receiver,
        message:      data.message,
        type:         data.type || "text",
        mediaUrl:     data.mediaUrl || "",
        createdAt:    new Date(),
      };

      socket.emit("private message", payload);
      if (toSid) io.to(toSid).emit("private message", payload);

    } catch(err) {
      logToDiscordError("DM error: " + err.message);
    }
  });

  // ── DM HISTORY (load old messages) ───────────────────────
  socket.on("dm_history", async ({ withUser }) => {
    if (!currentUser) return;
    try {
      const channelId = getDMChannelId(currentUser.name, withUser);
      const dmDoc = await DM.findOne({ channelId }).lean();
      socket.emit("dm_history_data", {
        channelId,
        withUser,
        messages: dmDoc ? dmDoc.messages : [],
      });
    } catch(err) {
      logToDiscordError("DM history error: " + err.message);
    }
  });

  // ── DM TYPING ─────────────────────────────────────────────
  socket.on("dm_typing", ({ toUser, isTyping }) => {
    if (!currentUser) return;
    const target = Object.values(activeUsers).find(u => u.name.toLowerCase() === toUser?.toLowerCase());
    if (target) {
      io.to(target.socketId).emit("dm_typing_update", {
        fromUser: currentUser.name,
        isTyping,
      });
    }
  });

  // ── JOIN GROUP ────────────────────────────────────────────
  socket.on("join_group", async ({ groupId, password }) => {
    try {
      const group = await Group.findById(groupId);
      if (!group) return socket.emit("group_error", "Group not found.");
      if (group.password && group.password !== password)
        return socket.emit("group_error", "Wrong password.");

      const room = "group_" + groupId;
      socket.join(room);

      const history = await Message.find({ room })
        .sort({ createdAt: 1 }).limit(100).lean();

      socket.emit("group_joined", { group, history });
      const u = currentUser;
      if (u) {
        io.to(room).emit("chat message", {
          id: Date.now(), sender: "System",
          message: `${u.name} joined ${group.name}`,
          type: "system", room, createdAt: new Date(),
        });
      }
    } catch(err) {
      logToDiscordError("join_group error: " + err.message);
      socket.emit("group_error", "Failed to join group.");
    }
  });

  // ── CREATE GROUP ──────────────────────────────────────────
  socket.on("create_group", async ({ name, description, password, icon }) => {
    if (!currentUser) return;
    try {
      const group = new Group({
        name, description: description || "",
        password: password || "",
        adminName: currentUser.name,
        icon: icon || "👥",
        members: [currentUser.name],
      });
      await group.save();
      socket.emit("group_created", group);

      // Broadcast updated list to all
      const groups = await Group.find({}).sort({ createdAt: -1 }).lean();
      io.emit("groups_list", groups.map(g => ({ ...g, hasPassword: !!g.password })));
    } catch(err) {
      logToDiscordError("create_group error: " + err.message);
      socket.emit("group_error", "Failed to create group.");
    }
  });

  // ── GET GROUPS ────────────────────────────────────────────
  socket.on("get_groups", async () => {
    try {
      const groups = await Group.find({}).sort({ createdAt: -1 }).lean();
      socket.emit("groups_list", groups.map(g => ({ ...g, hasPassword: !!g.password })));
    } catch(err) {
      logToDiscordError("get_groups error: " + err.message);
    }
  });

  // ── REPORT USER ───────────────────────────────────────────
  socket.on("report user", async (data) => {
    try {
      const device = /Mobi|Android/i.test(socket.handshake.headers["user-agent"] || "")
        ? "📱 Android/Mobile" : "🖥️ Desktop/Web";
      const reportData = { ...data, device, reporterUser: data.reportedBy || data.reporterUser };

      // Save to MongoDB
      await new Report(reportData).save();

      // Send rich embed to Discord report channel
      const embed = new EmbedBuilder()
        .setColor(0xff3c5f)
        .setTitle("🚨 New User Report")
        .addFields(
          { name: "🎯 Reported User", value: `\`${data.reportedUser}\``,       inline: true },
          { name: "👤 Reporter",      value: `\`${data.reportedBy || "—"}\``,  inline: true },
          { name: "📱 Device",        value: device,                            inline: true },
          { name: "📧 Email",         value: data.email || "Not provided",      inline: false },
          { name: "📂 Category",      value: `\`${data.category || "General"}\``, inline: false },
          { name: "📝 Reason",        value: (data.description || data.reason || "—").substring(0, 1000), inline: false },
        )
        .setTimestamp()
        .setFooter({ text: "StrangerToStranger Report System • HeyyYuki 2026" });

      const repCh = discordClient.channels.cache.get(REPORT_CHANNEL_ID) ||
                    discordClient.channels.cache.get(MOD_LOG_CHANNEL_ID);
      if (repCh) repCh.send({ embeds: [embed] });

      socket.emit("report_success");
    } catch(err) {
      logToDiscordError("report error: " + err.message);
      socket.emit("report_error", "Failed to submit report.");
    }
  });

  // ── UPDATE PROFILE ────────────────────────────────────────
  socket.on("update_profile", ({ bio, avatar, color }) => {
    if (!currentUser) return;
    if (bio    !== undefined) currentUser.bio    = bio;
    if (avatar !== undefined) currentUser.avatar = avatar;
    if (color  !== undefined) currentUser.color  = color;
    activeUsers[socket.id] = currentUser;
    io.emit("user list", buildUserList());
    socket.emit("profile_updated", currentUser);
  });

  // ── DISCONNECT ────────────────────────────────────────────
  socket.on("disconnect", () => {
    if (!currentUser) return;
    io.emit("chat message", {
      id: Date.now(), sender: "System",
      message: `${currentUser.name} left the chat`,
      type: "system", room: currentUser.room, createdAt: new Date(),
    });
    sendEmbed(JOIN_LEAVE_CHANNEL_ID, {
      color: 0xff3c5f, title: "📤 User Left",
      fields: [
        { name: "Username", value: currentUser.name, inline: true },
        { name: "IP", value: currentUser.ip, inline: true },
      ],
    });
    delete activeUsers[socket.id];
    io.emit("user list", buildUserList());
    updateDiscordStatus();
  });
});

// ══════════════════════════════════════════════════════════════
// 🌐 REST API
// ══════════════════════════════════════════════════════════════
app.use(express.json({ limit: "10mb" }));
app.use(express.static(path.join(__dirname, "public")));

// Report via HTTP (fallback when socket not connected)
app.post("/api/report", async (req, res) => {
  try {
    const device = /Mobi|Android/i.test(req.headers["user-agent"] || "")
      ? "📱 Android/Mobile" : "🖥️ Desktop/Web";
    const data = { ...req.body, device };
    await new Report(data).save();
    // send to Discord
    const embed = new EmbedBuilder()
      .setColor(0xff3c5f).setTitle("🚨 Report (HTTP Form)")
      .addFields(
        { name: "🎯 Reported", value: `\`${data.reportedUser || "—"}\``, inline: true },
        { name: "👤 Reporter", value: `\`${data.reporterUser || "—"}\``, inline: true },
        { name: "📱 Device",   value: device,                            inline: true },
        { name: "📧 Email",    value: data.reporterEmail || "Not provided", inline: false },
        { name: "📂 Category", value: `\`${data.category || "—"}\``,    inline: false },
        { name: "📝 Reason",   value: (data.reason || "—").substring(0, 1000), inline: false },
      ).setTimestamp().setFooter({ text: "HeyyYuki Report System" });

    const ch = discordClient.channels.cache.get(REPORT_CHANNEL_ID) ||
               discordClient.channels.cache.get(MOD_LOG_CHANNEL_ID);
    if (ch) ch.send({ embeds: [embed] });
    res.json({ ok: true });
  } catch(err) {
    logToDiscordError("API Report error: " + err.message);
    res.status(500).json({ ok: false });
  }
});

// PWA support
app.get("/sw.js",       (req, res) => res.sendFile(path.resolve(__dirname, "public/sw.js")));
app.get("/manifest.json",(req, res) => res.sendFile(path.resolve(__dirname, "public/manifest.json")));
app.use("/.well-known", express.static(path.join(__dirname, ".well-known"), { dotfiles: "allow" }));

// ══════════════════════════════════════════════════════════════
// 🚀 START
// ══════════════════════════════════════════════════════════════
http.listen(PORT, () => {
  console.log(`🚀 StrangerToStranger running on http://localhost:${PORT}`);
});

// ══════════════════════════════════════════════════════════════
// 🛡️ CRASH PROTECTION — Errors go to Discord
// ══════════════════════════════════════════════════════════════
process.on("unhandledRejection", (err) => {
  console.error("⚠️ Unhandled Rejection:", err);
  logToDiscordError(`💥 Unhandled Rejection:\n${String(err).substring(0, 1500)}`);
});
process.on("uncaughtException", (err) => {
  console.error("⚠️ Uncaught Exception:", err);
  logToDiscordError(`💥 Uncaught Exception:\n${err.message}\n${(err.stack||"").substring(0, 1000)}`);
});
