// ╔══════════════════════════════════════════════════════════════╗
// ║   StrangerToStranger — HeyyYuki Powered Server v4.0 FINAL   ║
// ║   All Commands Fixed | All Functions Working | 2026         ║
// ╚══════════════════════════════════════════════════════════════╝

require("dotenv").config();
const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http, { cors: { origin: "*" } });
const path = require("path");
const fs = require("fs");
const mongoose = require("mongoose");

const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActivityType,
  REST,
  Routes,
  SlashCommandBuilder,
} = require("discord.js");

// ══════════════════════════════════════════════════════════════
// 🔑 CONFIGURATION
// ══════════════════════════════════════════════════════════════
const MONGO_URI =
  process.env.MONGO_URI ||
  "mongodb+srv://yashwantsingh2046_db_user:Yashu2046@db.avouoxu.mongodb.net/?appName=db";
const CLIENT_ID   = process.env.CLIENT_ID   || "1478767384398528573";
const DISCORD_TOKEN = process.env.DISCORD_TOKEN || "";

// Admin panel control channel IDs (add more as needed)
const CONTROL_CHANNEL_IDS = ["1506573109728247848"];
const GUILD_ID = "1485522389403173004";

const STATUS_CHANNEL_ID    = process.env.STATUS_CHANNEL_ID    || "";
const CHAT_CHANNEL_ID      = process.env.CHAT_CHANNEL_ID      || "";
const MEDIA_LOG_CHANNEL_ID = process.env.MEDIA_LOG_CHANNEL_ID || "";
const JOIN_LEAVE_CHANNEL_ID= process.env.JOIN_LEAVE_CHANNEL_ID|| "";
const MOD_LOG_CHANNEL_ID   = process.env.MOD_LOG_CHANNEL_ID   || "";
const VIP_LOG_CHANNEL_ID   = process.env.VIP_LOG_CHANNEL_ID   || "";
const REPORT_CHANNEL_ID    = process.env.REPORT_CHANNEL_ID    || "";
const ERROR_CHANNEL_ID     = process.env.ERROR_CHANNEL_ID     || "";

const ADMIN_NAME = process.env.ADMIN_NAME || "Yashwant";
const PORT       = process.env.PORT || 4000;

// ══════════════════════════════════════════════════════════════
// 📦 MONGODB CONNECTION
// ══════════════════════════════════════════════════════════════
mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log("✅ MongoDB Connected");
    logToDiscordError("✅ MongoDB Connected — Server Online", "info");
  })
  .catch((err) => {
    console.error("❌ MongoDB Error:", err.message);
    logToDiscordError("❌ MongoDB FAILED: " + err.message, "error");
  });

// ══════════════════════════════════════════════════════════════
// 📋 MONGODB SCHEMAS
// ══════════════════════════════════════════════════════════════
const MsgSchema = new mongoose.Schema({
  room:        { type: String, default: "global" },
  senderId:    String,
  senderName:  String,
  senderAvatar:String,
  senderColor: String,
  text:        String,
  type:        { type: String, default: "text" },
  mediaUrl:    String,
  isVip:       { type: Boolean, default: false },
  createdAt:   { type: Date, default: Date.now },
});
const Message = mongoose.model("Message", MsgSchema);

const DMSchema = new mongoose.Schema({
  channelId:        { type: String, unique: true },
  participantNames: [String],
  messages: [
    {
      senderName:  String,
      senderAvatar:String,
      senderColor: String,
      text:        String,
      mediaUrl:    String,
      type:        { type: String, default: "text" },
      createdAt:   { type: Date, default: Date.now },
    },
  ],
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
  reportedUser: String,
  reporterUser: String,
  reporterEmail:String,
  category:     String,
  reason:       String,
  device:       String,
  createdAt:    { type: Date, default: Date.now },
});
const Report = mongoose.model("Report", ReportSchema);

const AnnouncementSchema = new mongoose.Schema({
  text:      String,
  expiresAt: Date,
  createdAt: { type: Date, default: Date.now },
});
const Announcement =
  mongoose.models.Announcement ||
  mongoose.model("Announcement", AnnouncementSchema);

const BanSchema = new mongoose.Schema({ username: { type: String, unique: true } });
const VipSchema = new mongoose.Schema({ username: { type: String, unique: true } });
const Banned = mongoose.model("Banned", BanSchema);
const Vip    = mongoose.model("Vip",    VipSchema);

// ══════════════════════════════════════════════════════════════
// 📁 FILE-BASED PERSISTENCE
// ══════════════════════════════════════════════════════════════
const BANNED_FILE = path.join(__dirname, "banned-usernames.json");
const VIPS_FILE   = path.join(__dirname, "vip-users.json");
const ADMINS_FILE = path.join(__dirname, "admin-users.json");

let bannedUsernames = new Set();
let vips            = new Set();
let admins          = new Set();

function loadJSON(file) {
  try { return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : []; }
  catch (e) { return []; }
}

bannedUsernames = new Set(loadJSON(BANNED_FILE));
vips            = new Set(loadJSON(VIPS_FILE));
admins          = new Set(loadJSON(ADMINS_FILE));

function saveBanned() { fs.writeFileSync(BANNED_FILE, JSON.stringify([...bannedUsernames])); }
function saveVips()   { fs.writeFileSync(VIPS_FILE,   JSON.stringify([...vips])); }
function saveAdmins() { fs.writeFileSync(ADMINS_FILE,  JSON.stringify([...admins])); }

// ══════════════════════════════════════════════════════════════
// 🧠 IN-MEMORY STATE
// ══════════════════════════════════════════════════════════════
const activeUsers    = {};   // socketId → user object
const tempBannedIPs  = new Map();
const shadowBanned   = new Set();

// ══════════════════════════════════════════════════════════════
// 🛠️ UTILITY HELPERS
// ══════════════════════════════════════════════════════════════
function genId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

function getIP(socket) {
  const raw =
    socket.handshake.headers["x-forwarded-for"] || socket.handshake.address;
  return (raw || "127.0.0.1").split(",")[0].trim();
}

function getDMChannelId(nameA, nameB) {
  return [nameA.toLowerCase(), nameB.toLowerCase()].sort().join("__dm__");
}

function isUserAdmin(nameLower) {
  return admins.has(nameLower) || nameLower === ADMIN_NAME.toLowerCase();
}

function isUserVip(nameLower) {
  return vips.has(nameLower) || isUserAdmin(nameLower);
}

function buildUserList() {
  return Object.values(activeUsers).map((u) => {
    const nameLower   = u.name.toLowerCase();
    const userIsAdmin = isUserAdmin(nameLower);
    const userIsVip   = isUserVip(nameLower);
    let displayName   = u.name;

    if (userIsAdmin)     displayName = "👑 " + displayName;
    else if (userIsVip)  displayName = displayName + " 💎";

    return {
      socketId: u.socketId,
      name:     displayName,
      rawName:  u.name,
      bio:      u.bio,
      avatar:   u.avatar,
      color:    u.color,
      isVip:    userIsVip,
      isAdmin:  userIsAdmin,
    };
  });
}

// ══════════════════════════════════════════════════════════════
// 🤖 DISCORD BOT — SETUP
// ══════════════════════════════════════════════════════════════
const discordClient = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

let discordReady = false;

// ── Slash Commands Definition ──
const commands = [
  new SlashCommandBuilder()
    .setName("ann")
    .setDescription("Global chat mein system announcement bhejo")
    .addStringOption((o) =>
      o.setName("message").setDescription("Announcement text").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("kick")
    .setDescription("User ko 5 minute ke liye kick karo")
    .addStringOption((o) =>
      o.setName("username").setDescription("Username").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Username permanently ban karo")
    .addStringOption((o) =>
      o.setName("username").setDescription("Username").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("unban")
    .setDescription("Username unban karo")
    .addStringOption((o) =>
      o.setName("username").setDescription("Username").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("addvip")
    .setDescription("User ko VIP do")
    .addStringOption((o) =>
      o.setName("username").setDescription("Username").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("removevip")
    .setDescription("User ka VIP hatao")
    .addStringOption((o) =>
      o.setName("username").setDescription("Username").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("online")
    .setDescription("Sabhi online users ka list dekho"),

  new SlashCommandBuilder()
    .setName("cleargroup")
    .setDescription("Group ke messages clear karo")
    .addStringOption((o) =>
      o.setName("groupname").setDescription("Group name").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("stats")
    .setDescription("Server statistics dekho"),

  new SlashCommandBuilder()
    .setName("assignadmin")
    .setDescription("User ko permanent admin banao")
    .addStringOption((o) =>
      o.setName("username").setDescription("Username").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("removeadmin")
    .setDescription("User ka admin status hatao")
    .addStringOption((o) =>
      o.setName("username").setDescription("Username").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("clearmessages")
    .setDescription("Global chat ke saare messages delete karo"),

  new SlashCommandBuilder()
    .setName("shadowban")
    .setDescription("User ko shadow ban karo (sirf use dikhega)")
    .addStringOption((o) =>
      o.setName("username").setDescription("Username").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("removeshadowban")
    .setDescription("Shadow ban hatao")
    .addStringOption((o) =>
      o.setName("username").setDescription("Username").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("announce")
    .setDescription("Website pe timed announcement set karo")
    .addIntegerOption((o) =>
      o.setName("duration").setDescription("Duration in minutes").setRequired(true)
    )
    .addStringOption((o) =>
      o.setName("message").setDescription("Announcement text").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("active-announcements")
    .setDescription("Active website announcements dekho"),

  new SlashCommandBuilder()
    .setName("remove-currentannouncement")
    .setDescription("Active website announcement hatao"),
].map((c) => c.toJSON());

// ── Register Slash Commands ──
if (DISCORD_TOKEN) {
  const GUILD_ID = "1485522389403173004"; // 👈 apna server ID daalo
  const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);
  (async () => {
    try {
      await rest.put(
        Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
        { body: commands }
      );
      console.log("✅ Slash commands registered (guild only)");
    } catch (e) {
      console.error("❌ Slash command registration error:", e.message);
    }
  })();
}

// ══════════════════════════════════════════════════════════════
// 🤖 DISCORD BOT — EVENTS
// ══════════════════════════════════════════════════════════════
discordClient.once("ready", () => {
  discordReady = true;
  console.log(`🤖 HeyyYuki online as ${discordClient.user.tag}`);
  discordClient.user.setActivity("StrangerToStranger 🌐 | 24/7", {
    type: ActivityType.Watching,
  });
  updateDiscordStatus();
  logToDiscordError(`🤖 HeyyYuki Bot Started as ${discordClient.user.tag}`, "info");
});

// Discord se chat message aaye toh web users ko bhi dikhao
discordClient.on("messageCreate", (msg) => {
  if (msg.author.bot || msg.channel.id !== CHAT_CHANNEL_ID) return;
  if (msg.content.startsWith("/")) return;
  io.to("global").emit("chat message", {
    id:         "discord_" + Date.now(),
    sender:     `[Discord] ${msg.author.username}`,
    message:    msg.content,
    type:       "text",
    isVip:      true,
    senderColor:"#5865f2",
    createdAt:  new Date(),
  });
});

// ══════════════════════════════════════════════════════════════
// 🤖 DISCORD BOT — INTERACTION HANDLER (All Commands Fixed)
// ══════════════════════════════════════════════════════════════
discordClient.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  // Security: sirf allowed channels se commands
  if (!CONTROL_CHANNEL_IDS.includes(interaction.channelId)) {
    return interaction.reply({
      content:
        `❌ **Access Denied!**\n\n` +
        `Ye channel allowed nahi hai.\n` +
        `**Is channel ka ID:** \`${interaction.channelId}\`\n` +
        `Ise copy karke \`CONTROL_CHANNEL_IDS\` array mein add karein.`,
      flags: 64,
    });
  }

  const { commandName, options } = interaction;

  // Crash-proof reply helper
  const safeReply = async (content, ephemeral = true) => {
    try {
      const payload = { content, flags: ephemeral ? 64 : undefined };
      if (!interaction.replied && !interaction.deferred) {
        return await interaction.reply(payload);
      } else {
        return await interaction.editReply(payload);
      }
    } catch (e) {
      console.error("safeReply error:", e.message);
    }
  };

  try {

    // ──────────────────────────────────────────────────────
    // 📢 /ann — Global system announcement
    // ──────────────────────────────────────────────────────
    if (commandName === "ann") {
      const text = options.getString("message");
      io.emit("chat message", {
        id:        "ann_" + Date.now(),
        sender:    "📢 Announcement",
        message:   text,
        type:      "system",
        room:      "global",
        createdAt: new Date(),
      });
      return safeReply(`✅ Announcement sabko bheja gaya:\n> ${text}`);
    }

    // ──────────────────────────────────────────────────────
    // 👢 /kick — 5 minute kick
    // ──────────────────────────────────────────────────────
    else if (commandName === "kick") {
      const target = options.getString("username").trim().toLowerCase();
      const entry  = Object.entries(activeUsers).find(
        ([, u]) => u.name.toLowerCase() === target
      );
      if (!entry) return safeReply(`❌ \`${target}\` abhi online nahi hai.`);

      const [sid, user] = entry;

      // IP ko 5 min ke liye block karo
      tempBannedIPs.set(user.ip, {
        expiry:       Date.now() + 5 * 60 * 1000,
        reservedName: user.name,
      });

      // User ko inform karo phir disconnect karo
      io.to(sid).emit("kicked", {
        message: "👢 Aapko admin ne 5 minute ke liye kick kiya hai. Baad mein aana.",
      });
      setTimeout(() => {
        const sock = io.sockets.sockets.get(sid);
        if (sock) sock.disconnect(true);
      }, 800);

      sendEmbed(MOD_LOG_CHANNEL_ID, {
        color:  0xffd60a,
        title:  "👢 User Kicked",
        fields: [
          { name: "Username", value: `\`${user.name}\``, inline: true },
          { name: "IP",       value: `\`${user.ip}\``,   inline: true },
          { name: "Duration", value: "5 minutes",         inline: true },
        ],
      });
      return safeReply(`✅ **${user.name}** ko 5 minute ke liye kick kiya gaya.`);
    }

    // ──────────────────────────────────────────────────────
    // 🔨 /ban — Permanent username ban
    // ──────────────────────────────────────────────────────
    else if (commandName === "ban") {
      const target = options.getString("username").trim().toLowerCase();

      // Pehle check karo ban pehle se hai ki nahi
      if (bannedUsernames.has(target)) {
        return safeReply(`⚠️ **${target}** pehle se banned hai.`);
      }

      bannedUsernames.add(target);
      saveBanned();
      await Banned.updateOne(
        { username: target },
        { username: target },
        { upsert: true }
      );

      // Agar online ho toh turant disconnect karo
      const entry = Object.entries(activeUsers).find(
        ([, u]) => u.name.toLowerCase() === target
      );
      if (entry) {
        const [sid] = entry;
        io.to(sid).emit("duplicate", "🚫 Aapko permanently ban kar diya gaya hai.");
        setTimeout(() => {
          const sock = io.sockets.sockets.get(sid);
          if (sock) sock.disconnect(true);
        }, 800);
      }

      sendEmbed(MOD_LOG_CHANNEL_ID, {
        color:  0xff3c5f,
        title:  "🔨 User Permanently Banned",
        fields: [
          { name: "Username", value: `\`${target}\``, inline: true },
          { name: "Status",   value: "Online → Kicked", inline: entry ? true : false },
        ],
      });
      return safeReply(`✅ **${target}** permanently ban ho gaya.`);
    }

    // ──────────────────────────────────────────────────────
    // ✅ /unban — Ban hatao
    // ──────────────────────────────────────────────────────
    else if (commandName === "unban") {
      const target = options.getString("username").trim().toLowerCase();
      if (!bannedUsernames.has(target)) {
        return safeReply(`⚠️ \`${target}\` banned list mein nahi hai.`);
      }
      bannedUsernames.delete(target);
      saveBanned();
      await Banned.deleteOne({ username: target });

      sendEmbed(MOD_LOG_CHANNEL_ID, {
        color:  0x00f5a0,
        title:  "✅ User Unbanned",
        fields: [{ name: "Username", value: `\`${target}\``, inline: true }],
      });
      return safeReply(`✅ **${target}** unban ho gaya. Ab join kar sakta hai.`);
    }

    // ──────────────────────────────────────────────────────
    // 💎 /addvip — VIP do
    // ──────────────────────────────────────────────────────
    else if (commandName === "addvip") {
      const target = options.getString("username").trim().toLowerCase();

      if (vips.has(target)) {
        return safeReply(`⚠️ **${target}** pehle se VIP hai.`);
      }

      vips.add(target);
      saveVips();
      await Vip.updateOne(
        { username: target },
        { username: target },
        { upsert: true }
      );

      // Live update agar online ho
      const entry = Object.entries(activeUsers).find(
        ([, u]) => u.name.toLowerCase() === target
      );
      if (entry) {
        const [sid] = entry;
        activeUsers[sid].isVip = true;
        io.to(sid).emit("vip_granted", { message: "💎 Congratulations! Aapko VIP status mila hai!" });
      }
      io.emit("user list", buildUserList());

      sendEmbed(VIP_LOG_CHANNEL_ID, {
        color:  0xffd700,
        title:  "💎 VIP Granted",
        fields: [
          { name: "Username", value: `\`${target}\``, inline: true },
          { name: "Online",   value: entry ? "Yes 🟢" : "No 🔴", inline: true },
        ],
      });
      return safeReply(`✅ **${target}** ko VIP de diya gaya 💎`);
    }

    // ──────────────────────────────────────────────────────
    // ❌ /removevip — VIP hatao
    // ──────────────────────────────────────────────────────
    else if (commandName === "removevip") {
      const target = options.getString("username").trim().toLowerCase();
      if (!vips.has(target)) {
        return safeReply(`⚠️ \`${target}\` VIP list mein nahi hai.`);
      }
      vips.delete(target);
      saveVips();
      await Vip.deleteOne({ username: target });

      const entry = Object.entries(activeUsers).find(
        ([, u]) => u.name.toLowerCase() === target
      );
      if (entry) {
        const [sid] = entry;
        activeUsers[sid].isVip = false;
      }
      io.emit("user list", buildUserList());

      return safeReply(`⚠️ **${target}** ka VIP status hata diya gaya.`);
    }

    // ──────────────────────────────────────────────────────
    // 👥 /online — Sabhi online users
    // ──────────────────────────────────────────────────────
    else if (commandName === "online") {
      const users = Object.values(activeUsers);
      if (users.length === 0) return safeReply("📭 Abhi koi bhi online nahi hai.");

      const list = users.map((u, i) => {
        const badge = isUserAdmin(u.name.toLowerCase())
          ? "👑"
          : isUserVip(u.name.toLowerCase())
          ? "💎"
          : "👤";
        return `${i + 1}. ${badge} \`${u.name}\` — IP: \`${u.ip}\``;
      }).join("\n");

      return safeReply(`**🟢 Online Users (${users.length}):**\n${list}`);
    }

    // ──────────────────────────────────────────────────────
    // 🗑️ /cleargroup — Group messages clear karo
    // ──────────────────────────────────────────────────────
    else if (commandName === "cleargroup") {
      await interaction.deferReply({ flags: 64 });
      const groupName = options.getString("groupname").trim();

      const group = await Group.findOne({
        name: { $regex: new RegExp(`^${groupName}$`, "i") },
      });
      if (!group) {
        return interaction.editReply(`❌ Group \`${groupName}\` nahi mila. Sahi naam likhein.`);
      }

      const room   = "group_" + group._id.toString();
      const result = await Message.deleteMany({ room });

      // Online users ko clear signal bhejo
      io.to(room).emit("messages_cleared", { room });

      sendEmbed(MOD_LOG_CHANNEL_ID, {
        color:  0xff3c5f,
        title:  "🗑️ Group Messages Cleared",
        fields: [
          { name: "Group",   value: group.name,              inline: true },
          { name: "Deleted", value: `${result.deletedCount}`, inline: true },
        ],
      });
      return interaction.editReply(
        `✅ **${group.name}** ke **${result.deletedCount}** messages delete ho gaye.`
      );
    }

    // ──────────────────────────────────────────────────────
    // 📊 /stats — Server statistics
    // ──────────────────────────────────────────────────────
    else if (commandName === "stats") {
      await interaction.deferReply({ flags: 64 });

      const [totalMsg, totalDMs, totalReports, totalGroups, totalBanned, totalVips] =
        await Promise.all([
          Message.countDocuments(),
          DM.countDocuments(),
          Report.countDocuments(),
          Group.countDocuments(),
          Banned.countDocuments(),
          Vip.countDocuments(),
        ]);

      const onlineCount = Object.keys(activeUsers).length;

      return interaction.editReply(
        `📊 **StrangerToStranger Server Stats**\n\n` +
        `🟢 **Online Right Now:** ${onlineCount}\n` +
        `💬 **Total Messages:** ${totalMsg}\n` +
        `📨 **Total DMs:** ${totalDMs}\n` +
        `🚨 **Reports Filed:** ${totalReports}\n` +
        `👥 **Groups:** ${totalGroups}\n` +
        `🔨 **Banned Users:** ${totalBanned}\n` +
        `💎 **VIP Users:** ${totalVips}\n` +
        `👑 **Admins:** ${admins.size}\n` +
        `🌐 **MongoDB:** ${mongoose.connection.readyState === 1 ? "Connected ✅" : "Disconnected ❌"}`
      );
    }

    // ──────────────────────────────────────────────────────
    // 👑 /assignadmin — Admin banao
    // ──────────────────────────────────────────────────────
    else if (commandName === "assignadmin") {
      const target = options.getString("username").trim().toLowerCase();

      if (isUserAdmin(target)) {
        return safeReply(`⚠️ **${target}** pehle se admin hai.`);
      }

      admins.add(target);
      saveAdmins();
      // Admin ko automatically VIP bhi do
      vips.add(target);
      saveVips();
      await Vip.updateOne({ username: target }, { username: target }, { upsert: true });

      const entry = Object.entries(activeUsers).find(
        ([, u]) => u.name.toLowerCase() === target
      );
      if (entry) {
        const [sid] = entry;
        activeUsers[sid].isAdmin = true;
        activeUsers[sid].isVip   = true;
        io.to(sid).emit("admin_granted", {
          message: "👑 Congratulations! Aapko Admin status mila hai!",
        });
      }
      io.emit("user list", buildUserList());

      sendEmbed(MOD_LOG_CHANNEL_ID, {
        color:  0xffd700,
        title:  "👑 Admin Assigned",
        fields: [
          { name: "Username", value: `\`${target}\``, inline: true },
          { name: "Online",   value: entry ? "Yes 🟢" : "No 🔴", inline: true },
        ],
      });
      return safeReply(`✅ **${target}** ab Permanent Admin hai! 👑`);
    }

    // ──────────────────────────────────────────────────────
    // ❌ /removeadmin — Admin status hatao
    // ──────────────────────────────────────────────────────
    else if (commandName === "removeadmin") {
      const target = options.getString("username").trim().toLowerCase();
      if (!admins.has(target)) {
        return safeReply(`⚠️ \`${target}\` admin list mein nahi hai.`);
      }
      admins.delete(target);
      saveAdmins();

      const entry = Object.entries(activeUsers).find(
        ([, u]) => u.name.toLowerCase() === target
      );
      if (entry) {
        const [sid] = entry;
        activeUsers[sid].isAdmin = false;
      }
      io.emit("user list", buildUserList());

      return safeReply(`⚠️ **${target}** ka Admin status hata diya gaya.`);
    }




    

// ──────────────────────────────────────────────────────
    // 🧹 /clearmessages — Poora global chat clear karo
    // ──────────────────────────────────────────────────────
    if (commandName === "clearmessages") {
      try {
        // Database se delete karo
        const result = await Message.deleteMany({ room: "global" });
        
        // Website ko signal bhejo
        io.emit("messages_cleared", { room: "global" });

        // Mod logs
        sendEmbed(MOD_LOG_CHANNEL_ID, {
          color: 0xff3c5f,
          title: "🧹 Global Chat Cleared",
          fields: [
            { name: "Messages Deleted", value: `${result.deletedCount}`, inline: true },
          ],
        });

        // Reply
        return await interaction.reply({ 
          content: `✅ Global chat ke **${result.deletedCount}** messages delete ho gaye aur website ki screen saaf ho gayi!`, 
          flags: 64 
        });

      } catch (err) {
        console.error("❌ COMMAND ERROR [clearmessages]:", err);
        return await interaction.reply({ content: "❌ Error occurred.", flags: 64 });
      }
    }

    // ──────────────────────────────────────────────────────
    // 👻 /shadowban — Ghost ban (sirf user ko dikhega)
    // ──────────────────────────────────────────────────────
    else if (commandName === "shadowban") {
      const target = options.getString("username").trim().toLowerCase();
      shadowBanned.add(target);
      return safeReply(`👻 **${target}** shadow ban ho gaya. Woh message bhejta rahega par kisi ko nahi dikhega.`);
    }

    // ──────────────────────────────────────────────────────
    // ✅ /removeshadowban — Shadow ban hatao
    // ──────────────────────────────────────────────────────
    else if (commandName === "removeshadowban") {
      const target = options.getString("username").trim().toLowerCase();
      if (!shadowBanned.has(target)) {
        return safeReply(`⚠️ \`${target}\` shadow banned nahi hai.`);
      }
      shadowBanned.delete(target);
      return safeReply(`✅ **${target}** ka shadow ban hata diya gaya.`);
    }

    // ──────────────────────────────────────────────────────
    // 📢 /announce — Timed website announcement
    // ──────────────────────────────────────────────────────
    else if (commandName === "announce") {
      await interaction.deferReply({ flags: 64 });
      const duration = options.getInteger("duration");
      const text     = options.getString("message");

      await Announcement.deleteMany({});
      const expiry = new Date(Date.now() + duration * 60 * 1000);
      await new Announcement({ text, expiresAt: expiry }).save();

      return interaction.editReply(
        `✅ Website announcement set!\n` +
        `⏰ **${duration} minutes** tak dikhegi.\n> ${text}`
      );
    }

    // ──────────────────────────────────────────────────────
    // 📋 /active-announcements — Current announcement check
    // ──────────────────────────────────────────────────────
    else if (commandName === "active-announcements") {
      await interaction.deferReply({ flags: 64 });
      const current = await Announcement.findOne({ expiresAt: { $gt: new Date() } });

      if (!current) return interaction.editReply("❌ Koi active announcement nahi hai abhi.");

      const timeLeft = Math.round((current.expiresAt - Date.now()) / 1000 / 60);
      return interaction.editReply(
        `📢 **Active Announcement:**\n> ${current.text}\n\n⏰ **${timeLeft} minute** bacha hai.`
      );
    }

    // ──────────────────────────────────────────────────────
    // 🗑️ /remove-currentannouncement — Announcement hatao
    // ──────────────────────────────────────────────────────
    else if (commandName === "remove-currentannouncement") {
      await interaction.deferReply({ flags: 64 });
      const result = await Announcement.deleteMany({});
      if (result.deletedCount === 0) {
        return interaction.editReply("⚠️ Hatane ke liye koi active announcement nahi thi.");
      }
      return interaction.editReply("✅ Active announcement successfully hata di gayi.");
    }

    // ──────────────────────────────────────────────────────
    // ❓ Unknown command fallback
    // ──────────────────────────────────────────────────────
    else {
      return safeReply(`⚠️ Command \`${commandName}\` handle nahi hua. Developer ko batao.`);
    }

  } catch (err) {
    console.error(`❌ Command Error [${commandName}]:`, err);
    logToDiscordError(`❌ Command Error [${commandName}]:\n${err.message}\n${(err.stack || "").substring(0, 800)}`, "error");
    try {
      await safeReply("❌ Kuch error aaya. Console mein dekho.");
    } catch (e) {}
  }
});

if (DISCORD_TOKEN) {
  discordClient
    .login(DISCORD_TOKEN)
    .catch((err) => console.error("❌ Discord login failed:", err.message));
}

// ══════════════════════════════════════════════════════════════
// 🛠️ DISCORD HELPERS
// ══════════════════════════════════════════════════════════════
async function updateDiscordStatus() {
  if (!discordReady) return;
  try {
    const count = Object.keys(activeUsers).length;
    discordClient.user?.setActivity(`${count} Strangers Online 🌐`, {
      type: ActivityType.Watching,
    });
    const ch = await discordClient.channels.fetch(STATUS_CHANNEL_ID).catch(() => null);
    if (ch) await ch.setName(`🟢-online-${count}`).catch(() => {});
  } catch (e) {}
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
  } catch (e) {}
}

async function logToDiscordError(msg, type = "error") {
  if (!discordReady) return;
  try {
    const ch = discordClient.channels.cache.get(ERROR_CHANNEL_ID);
    if (!ch) return;
    const colors = { error: 0xff3c5f, warn: 0xffd60a, info: 0x00f5a0 };
    const icons  = { error: "❌",    warn: "⚠️",       info: "ℹ️" };
    const embed  = new EmbedBuilder()
      .setColor(colors[type] || 0xff3c5f)
      .setTitle(`${icons[type]} ${type.toUpperCase()}`)
      .setDescription("```" + msg.substring(0, 1900) + "```")
      .setTimestamp()
      .setFooter({ text: "HeyyYuki Error Monitor" });
    ch.send({ embeds: [embed] });
  } catch (e) {}
}

// ══════════════════════════════════════════════════════════════
// 🔌 SOCKET.IO — CONNECTION HANDLER
// ══════════════════════════════════════════════════════════════
io.on("connection", (socket) => {
  const userIP = getIP(socket);
  let currentUser = null;

  // ── JOIN ──
  socket.on("join", async (data) => {
    try {
      const name     = (data.name  || "").trim();
      const bio      = (data.bio   || "No bio").trim();
      const avatar   = data.avatar || "";
      const color    = data.color  || "#00f5a0";
      const nameLower= name.toLowerCase();

      if (!name || name.length < 2) {
        return socket.emit("error_msg", "Username kam se kam 2 characters ka hona chahiye.");
      }

      // IP based kick check
      if (tempBannedIPs.has(userIP)) {
        const ban = tempBannedIPs.get(userIP);
        if (Date.now() < ban.expiry) {
          if (nameLower !== ban.reservedName.toLowerCase()) {
            return socket.emit(
              "duplicate",
              `🚫 Aap kicked hain. Sirf "${ban.reservedName}" allowed hai aapke IP se.`
            );
          }
          return socket.emit("kick_timer", {
            message:       `👢 Aap kicked hain. ${Math.ceil((ban.expiry - Date.now()) / 60000)} minute wait karein.`,
            remainingTime: ban.expiry - Date.now(),
          });
        } else {
          tempBannedIPs.delete(userIP);
        }
      }

      if (bannedUsernames.has(nameLower)) {
        return socket.emit("duplicate", "🚫 Aap permanently banned hain.");
      }

      const duplicate = Object.values(activeUsers).find(
        (u) => u.name.toLowerCase() === nameLower
      );
      if (duplicate) {
        return socket.emit("duplicate", "⚠️ Ye username pehle se liya hua hai. Koi aur naam chunein.");
      }

      const userIsAdmin = isUserAdmin(nameLower);
      const userIsVip   = isUserVip(nameLower);

      currentUser = {
        socketId: socket.id,
        name,
        bio,
        avatar,
        color,
        ip:      userIP,
        isVip:   userIsVip,
        isAdmin: userIsAdmin,
        room:    "global",
      };

      activeUsers[socket.id] = currentUser;
      socket.join("global");

      // Chat history bhejo
      const history = await Message.find({ room: "global" })
        .sort({ createdAt: 1 })
        .limit(100)
        .lean();

      const normalizedHistory = history.map((m) => ({
        id:          m._id.toString(),
        sender:      m.senderName,
        senderAvatar:m.senderAvatar,
        senderColor: m.senderColor,
        message:     m.text,
        type:        m.type || "text",
        mediaUrl:    m.mediaUrl,
        isVip:       m.isVip,
        room:        m.room,
        createdAt:   m.createdAt,
      }));

      socket.emit("history", normalizedHistory);

      // Join announcement
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
        color:  0x00f5a0,
        title:  "📥 User Joined",
        fields: [
          { name: "Username", value: name + (userIsAdmin ? " 👑" : userIsVip ? " 💎" : ""), inline: true },
          { name: "IP",       value: userIP, inline: true },
        ],
      });

      // Groups list bhejo
      const groups = await Group.find({}).sort({ createdAt: -1 }).lean();
      socket.emit(
        "groups_list",
        groups.map((g) => ({ ...g, hasPassword: !!g.password }))
      );
    } catch (err) {
      console.error("join error:", err);
      socket.emit("error_msg", "Join failed. Dobara try karein.");
    }
  });

  // ── CHAT MESSAGE ──
  socket.on("chat message", async (data) => {
    if (!currentUser) return;
    try {
      const room = data.room || "global";
      const payload = {
        id:          data.id || socket.id + "_" + Date.now(),
        sender:      currentUser.name,
        senderAvatar:currentUser.avatar,
        senderColor: currentUser.color,
        isVip:       currentUser.isVip,
        message:     data.message || "",
        type:        data.type || "text",
        mediaUrl:    data.mediaUrl || "",
        replyTo:     data.replyTo  || null,
        room,
        createdAt:   new Date(),
      };

      const msgDoc = new Message({
        room,
        senderId:    socket.id,
        senderName:  currentUser.name,
        senderAvatar:currentUser.avatar,
        senderColor: currentUser.color,
        text:        data.message || "",
        type:        data.type || "text",
        mediaUrl:    data.mediaUrl || "",
        isVip:       currentUser.isVip,
      });
      await msgDoc.save();
      payload._id = msgDoc._id.toString();

      if (!shadowBanned.has(currentUser.name.toLowerCase())) {
        io.to(room).emit("chat message", payload);
        // Discord mein bhi bhejo
        if (payload.type === "text" && discordReady) {
          discordClient.channels.cache
            .get(CHAT_CHANNEL_ID)
            ?.send(`💬 **${currentUser.name}**: ${payload.message}`);
        } else if (payload.type === "image") {
          sendEmbed(MEDIA_LOG_CHANNEL_ID, {
            color: 0x9b59b6,
            title: `🖼️ Image from ${currentUser.name}`,
            image: payload.mediaUrl,
          });
        }
      } else {
        // Shadow ban: sirf us user ko dikhao
        socket.emit("chat message", payload);
      }
    } catch (err) {
      console.error("chat message error:", err);
    }
  });

  // ── DELETE MESSAGE ──
  socket.on("delete message", async (id) => {
    try {
      await Message.findByIdAndDelete(id).catch(() => null);
      // Fallback: senderId se bhi try karo
      await Message.findOneAndDelete({ senderId: socket.id, _id: id }).catch(() => null);
    } catch (e) {}
    // Sabko broadcast karo (success ho ya fail)
    io.emit("delete message", id);
  });

  // ── TYPING ──
  socket.on("typing", (data) => {
    if (!currentUser) return;
    const room = (data && data.room) ? data.room : (currentUser.room || "global");
    socket.to(room).emit("typing", { user: currentUser.name });
  });

  // ── PRIVATE MESSAGE ──
  socket.on("private message", async (data) => {
    if (!currentUser) return;
    try {
      const receiverName = data.receiver;
      const toUser       = Object.values(activeUsers).find(
        (u) => u.name.toLowerCase() === receiverName?.toLowerCase()
      );
      const channelId = getDMChannelId(currentUser.name, receiverName);

      let dmDoc = await DM.findOne({ channelId });
      if (!dmDoc) {
        dmDoc = new DM({
          channelId,
          participantNames: [currentUser.name, receiverName],
          messages: [],
        });
      }
      const msgObj = {
        senderName:  currentUser.name,
        senderAvatar:currentUser.avatar,
        senderColor: currentUser.color,
        text:        data.message,
        type:        data.type || "text",
        mediaUrl:    data.mediaUrl || "",
        createdAt:   new Date(),
      };
      dmDoc.messages.push(msgObj);
      dmDoc.updatedAt = new Date();
      await dmDoc.save();

      const payload = {
        channelId,
        id:          data.id || genId(),
        sender:      currentUser.name,
        senderAvatar:currentUser.avatar,
        senderColor: currentUser.color,
        receiver:    receiverName,
        message:     data.message,
        type:        data.type || "text",
        mediaUrl:    data.mediaUrl || "",
        createdAt:   new Date(),
      };

      socket.emit("private message", payload);
      if (toUser) io.to(toUser.socketId).emit("private message", payload);
    } catch (err) {
      console.error("private message error:", err);
    }
  });

  // ── DM HISTORY ──
  socket.on("dm_history", async ({ withUser }) => {
    if (!currentUser) return;
    try {
      const channelId = getDMChannelId(currentUser.name, withUser);
      const dmDoc     = await DM.findOne({ channelId }).lean();
      const messages  = (dmDoc ? dmDoc.messages : []).map((m) => ({
        sender:      m.senderName,
        senderAvatar:m.senderAvatar,
        senderColor: m.senderColor,
        message:     m.text,
        type:        m.type,
        mediaUrl:    m.mediaUrl,
        createdAt:   m.createdAt,
      }));
      socket.emit("dm_history_data", { channelId, withUser, messages });
    } catch (err) {
      console.error("dm_history error:", err);
    }
  });

  // ── DM TYPING ──
  socket.on("dm_typing", ({ toUser, isTyping }) => {
    if (!currentUser) return;
    const target = Object.values(activeUsers).find(
      (u) => u.name.toLowerCase() === toUser?.toLowerCase()
    );
    if (target) {
      io.to(target.socketId).emit("dm_typing_update", {
        fromUser: currentUser.name,
        isTyping,
      });
    }
  });

  // ── JOIN GROUP ──
  socket.on("join_group", async ({ groupId, password }) => {
    try {
      const group = await Group.findById(groupId);
      if (!group) return socket.emit("group_error", "Group nahi mila.");
      if (group.password && group.password !== password) {
        return socket.emit("group_error", "Wrong password.");
      }

      const room = "group_" + groupId;
      socket.join(room);
      if (currentUser) currentUser.room = room;

      const history = await Message.find({ room })
        .sort({ createdAt: 1 })
        .limit(100)
        .lean();

      const normalizedHistory = history.map((m) => ({
        id:          m._id.toString(),
        sender:      m.senderName,
        senderAvatar:m.senderAvatar,
        senderColor: m.senderColor,
        message:     m.text,
        type:        m.type || "text",
        isVip:       m.isVip,
        room:        m.room,
        createdAt:   m.createdAt,
      }));

      socket.emit("group_joined", { group, history: normalizedHistory });

      if (currentUser) {
        io.to(room).emit("chat message", {
          id:        "sys_" + Date.now(),
          sender:    "System",
          message:   `${currentUser.name} joined ${group.name}`,
          type:      "system",
          room,
          createdAt: new Date(),
        });
      }
    } catch (err) {
      console.error("join_group error:", err);
    }
  });

  // ── CREATE GROUP ──
  socket.on("create_group", async ({ name, description, password, icon }) => {
    if (!currentUser) return;
    try {
      const group = new Group({
        name,
        description: description || "",
        password:    password    || "",
        adminName:   currentUser.name,
        icon:        icon        || "👥",
        members:     [currentUser.name],
      });
      await group.save();
      socket.emit("group_created", group);

      const groups = await Group.find({}).sort({ createdAt: -1 }).lean();
      io.emit(
        "groups_list",
        groups.map((g) => ({ ...g, hasPassword: !!g.password }))
      );
    } catch (err) {
      console.error("create_group error:", err);
    }
  });

  // ── GET GROUPS ──
  socket.on("get_groups", async () => {
    try {
      const groups = await Group.find({}).sort({ createdAt: -1 }).lean();
      socket.emit(
        "groups_list",
        groups.map((g) => ({ ...g, hasPassword: !!g.password }))
      );
    } catch (err) {
      console.error("get_groups error:", err);
    }
  });

  // ── REPORT USER ──
  socket.on("report user", async (data) => {
    try {
      const device = /Mobi|Android/i.test(
        socket.handshake.headers["user-agent"] || ""
      )
        ? "📱 Mobile"
        : "🖥️ Desktop";

      await new Report({
        reportedUser: data.reportedUser,
        reporterUser: data.reportedBy || data.reporterUser || currentUser?.name,
        reporterEmail:data.email,
        category:     data.reason,
        reason:       data.description || data.reason,
        device,
      }).save();

      if (discordReady) {
        const embed = new EmbedBuilder()
          .setColor(0xff3c5f)
          .setTitle("🚨 New User Report")
          .addFields(
            { name: "🎯 Reported",  value: `\`${data.reportedUser}\``,        inline: true },
            { name: "👤 Reporter",  value: `\`${data.reportedBy || "—"}\``,   inline: true },
            { name: "📱 Device",    value: device,                             inline: true },
            { name: "📂 Category",  value: `\`${data.reason || "—"}\``,       inline: false },
            { name: "📝 Details",   value: (data.description || "—").substring(0, 1000), inline: false },
          )
          .setTimestamp()
          .setFooter({ text: "StrangerToStranger 2026" });

        const ch =
          discordClient.channels.cache.get(REPORT_CHANNEL_ID) ||
          discordClient.channels.cache.get(MOD_LOG_CHANNEL_ID);
        if (ch) ch.send({ embeds: [embed] });
      }

      socket.emit("report_success");
    } catch (err) {
      socket.emit("report_error", "Report submit karne mein fail. Dobara try karein.");
    }
  });

  // ── PROFILE UPDATE ──
  const handleProfileUpdate = ({ bio, avatar, color, name }) => {
    if (!currentUser) return;
    if (bio    !== undefined) currentUser.bio    = bio;
    if (avatar !== undefined) currentUser.avatar = avatar;
    if (color  !== undefined) currentUser.color  = color;

    if (name && name !== currentUser.name) {
      const nameLower = name.toLowerCase();
      const dup = Object.values(activeUsers).find(
        (u) => u.name.toLowerCase() === nameLower && u.socketId !== socket.id
      );
      if (!dup) currentUser.name = name;
    }

    activeUsers[socket.id] = currentUser;
    io.emit("user list", buildUserList());
    socket.emit("profile_updated", currentUser);
  };

  socket.on("update_profile", handleProfileUpdate);
  socket.on("update profile", handleProfileUpdate);

  // ── DISCONNECT ──
  socket.on("disconnect", () => {
    if (!currentUser) return;

    io.emit("chat message", {
      id:        "sys_" + Date.now(),
      sender:    "System",
      message:   `${currentUser.name} left the chat`,
      type:      "system",
      room:      currentUser.room || "global",
      createdAt: new Date(),
    });

    sendEmbed(JOIN_LEAVE_CHANNEL_ID, {
      color:  0xff3c5f,
      title:  "📤 User Left",
      fields: [
        { name: "Username", value: currentUser.name, inline: true },
        { name: "IP",       value: currentUser.ip,   inline: true },
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
app.use(
  express.static(path.join(__dirname, "public"), {
    extensions: ["html", "htm"],
  })
);

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});
app.get("/iframe-groupchatroom", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "iframe-groupchatroom.html"));
});
app.get("/S2s", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});
app.get("/General-Chat", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "iframe-groupchatroom.html"));
});

// 📢 Live announcement endpoint
app.get("/api/live-announcement", async (req, res) => {
  try {
    const current = await Announcement.findOne({ expiresAt: { $gt: new Date() } });
    if (!current) {
      return res.json({
        active: false,
        text:   "📢 Share this link with friends to grow our chat room!",
      });
    }
    res.json({ active: true, text: current.text });
  } catch (err) {
    res.json({ active: false, text: "Error loading announcement" });
  }
});

// 🚨 Report via HTTP
app.post("/api/report", async (req, res) => {
  try {
    const device = /Mobi|Android/i.test(req.headers["user-agent"] || "")
      ? "📱 Mobile"
      : "🖥️ Desktop";
    const data = { ...req.body, device };
    await new Report(data).save();

    if (discordReady) {
      const embed = new EmbedBuilder()
        .setColor(0xff3c5f)
        .setTitle("🚨 Report (HTTP API)")
        .addFields(
          { name: "🎯 Reported", value: `\`${data.reportedUser || "—"}\``,    inline: true },
          { name: "👤 Reporter", value: `\`${data.reporterUser || "—"}\``,    inline: true },
          { name: "📱 Device",   value: device,                               inline: true },
          { name: "📧 Email",    value: data.reporterEmail || "Not provided", inline: false },
          { name: "📝 Reason",   value: (data.reason || "—").substring(0, 1000), inline: false },
        )
        .setTimestamp()
        .setFooter({ text: "HeyyYuki Report System" });

      const ch =
        discordClient.channels.cache.get(REPORT_CHANNEL_ID) ||
        discordClient.channels.cache.get(MOD_LOG_CHANNEL_ID);
      if (ch) ch.send({ embeds: [embed] });
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ❤️ Health check
app.get("/health", (req, res) => {
  res.json({
    status:  "ok",
    online:  Object.keys(activeUsers).length,
    discord: discordReady,
    mongo:   mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    uptime:  Math.floor(process.uptime()) + "s",
    banned:  bannedUsernames.size,
    vips:    vips.size,
    admins:  admins.size,
  });
});

app.get("/sw.js", (req, res) =>
  res.sendFile(path.resolve(__dirname, "public/sw.js"))
);
app.get("/manifest.json", (req, res) =>
  res.sendFile(path.resolve(__dirname, "public/manifest.json"))
);
app.use(
  "/.well-known",
  express.static(path.join(__dirname, ".well-known"), { dotfiles: "allow" })
);

// ══════════════════════════════════════════════════════════════
// 🚀 SERVER START
// ══════════════════════════════════════════════════════════════
http.listen(PORT, () => {
  console.log(`🚀 StrangerToStranger running on http://localhost:${PORT}`);
  console.log(`📋 Admin: ${ADMIN_NAME} | Port: ${PORT}`);
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
  logToDiscordError(
    `💥 Uncaught Exception:\n${err.message}\n${(err.stack || "").substring(0, 1000)}`
  );
});
