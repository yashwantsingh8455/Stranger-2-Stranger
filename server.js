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
  console.log(`🤖 HeyyYuki online!`);
  
  // Dashboard Auto-Updater (24/7 Loop)
  setInterval(async () => {
    await refreshDiscordDashboard();
  }, 60000); // Har 60 seconds mein update
  
  // Pehli baar turant run karo
  refreshDiscordDashboard();
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


// 1. 📡 REAL-TIME DATA API (Background data provider)
app.get('/api/admin-data', async (req, res) => {
  try {
    const db = mongoose.connection.db;
    
    // Database ke saare collections ke naam nikalna
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);

    let allUsers = [];
    
    // Auto-Detect: Jo bhi common naam mile wahan se data uthao
    const possibleNames = ['users', 'Users', 'user', 'accounts', 'members'];
    for (let name of possibleNames) {
      if (collectionNames.includes(name)) {
        allUsers = await db.collection(name).find({}).toArray();
        break; // Sahi naam milte hi loop rok do
      }
    }

    const banned = await db.collection('banned').find({}).toArray().catch(() => []);
    const reports = await db.collection('reports').find({}).toArray().catch(() => []);
    
    res.json({
      success: true,
      users: allUsers,
      bannedCount: banned.length,
      reportsCount: reports.length,
      activeCount: Object.keys(activeUsers || {}).length,
      // Saare collections ke naam frontend par bhej rahe hain error dikhane ke liye
      allCollections: collectionNames 
    });
  } catch (error) {
    console.error("API Error:", error);
    res.json({ success: false, error: error.message });
  }
});
// 2. 🌐 SYSTEM ADMIN DASHBOARD (WEB PANEL UI)
// 🌐 SYSTEM ADMIN DASHBOARD (WEB PANEL UI)
// POST requests handle karne ke liye (Agar file ke upar pehle se nahi hai toh ise rehne dena)
app.use(express.json());

// 🔴 API: BAN A USER
// 🔴 API: BAN A USER (UPDATED WITH IP TRACKING & LIVE KICK)
// 🔴 API: BAN A USER & AUTO-LOGOUT
// 🔴 API: BAN A USER & AUTO-LOGOUT (100% WORKING)
app.use(express.json());

// 🔴 THE ULTIMATE IP BAN & LIVE KICK API
app.post('/api/action-ban', async (req, res) => {
  try {
    const { username } = req.body;
    if (!username) return res.json({ success: false, message: "Username zaroori hai!" });

    const db = mongoose.connection.db;
    
    // 1. Pata karo is user ka IP address kya hai
    let targetIp = null;

    // Pehle activeUsers memory object mein dhoondho
    if (typeof activeUsers !== 'undefined') {
      for (let socketId in activeUsers) {
        if (activeUsers[socketId] && activeUsers[socketId].username === username) {
          targetIp = activeUsers[socketId].ip || activeUsers[socketId].ipAddress;
          break;
        }
      }
    }

    // Agar live memory mein nahi mila, toh pichle messages se uthao
    if (!targetIp) {
      const lastMsg = await db.collection('messages').findOne({ username: username });
      if (lastMsg) targetIp = lastMsg.ip || lastMsg.ipAddress;
    }

    // Agar ab bhi IP nahi mila, toh username ko temporary identifier banakar ban list mein dalo
    const secureIp = targetIp || "IP_NOT_FOUND_YET";

    // 2. Database mein IP aur Username dono ko permanently lock karo
    const existing = await db.collection('banneds').findOne({ username: username });
    if (!existing) {
      await db.collection('banneds').insertOne({
        username: username,
        ip: secureIp,
        reason: "Banned via Moderator Dashboard Control",
        createdAt: new Date(),
        systemRole: "Banned",
        dbStatus: "Banned"
      });
    } else if (secureIp !== "IP_NOT_FOUND_YET") {
      // Agar entry pehle se thi par IP ab mila, toh update kar do
      await db.collection('banneds').updateOne({ username: username }, { $set: { ip: secureIp } });
    }

    // 3. 💣 REALTIME SOCKET NUKE: Connection dhoondh kar block karna
    if (typeof io !== 'undefined') {
      const allSockets = await io.fetchSockets();
      
      for (const socket of allSockets) {
        const socketUser = (activeUsers && activeUsers[socket.id] && activeUsers[socket.id].username) || socket.username;
        const socketIp = socket.handshake.address || (activeUsers && activeUsers[socket.id] && activeUsers[socket.id].ip);

        // Agar USERNAME match ho ya IP ADDRESS match ho, toh direct target karo
        if (socketUser === username || (secureIp !== "IP_NOT_FOUND_YET" && socketIp === secureIp)) {
          
          // CRITICAL SIGNAL: Frontend ko bolenge ki window tab hi block kar de
          socket.emit('PERMANENT_FIREWALL_KICK', { 
            message: "Aapka account aur IP Address permanently block kar diya gaya hai." 
          });

          // Sockets ko disconnect karna
          socket.disconnect(true);
          
          if (typeof activeUsers !== 'undefined' && activeUsers[socket.id]) {
            delete activeUsers[socket.id];
          }
        }
      }
    }

    res.json({ success: true, message: `✅ ${username} (IP: ${secureIp}) successfully ban aur logout ho chuka hai.` });
  } catch (error) {
    res.json({ success: false, message: "Error: " + error.message });
  }
});

// 🟢 API: UNBAN A USER
app.post('/api/action-unban', async (req, res) => {
  try {
    const { username } = req.body;
    if (!username) return res.json({ success: false, message: "Username dalna zaroori hai!" });

    const db = mongoose.connection.db;
    const result = await db.collection('banneds').deleteOne({ username: username });

    if (result.deletedCount === 0) {
      return res.json({ success: false, message: `⚠️ ${username} ban list mein nahi mila.` });
    }

    res.json({ success: true, message: `✅ ${username} ko successfully UNBAN kar diya gaya hai.` });
  } catch (error) {
    res.json({ success: false, message: "System Error: " + error.message });
  }
});

// 🌐 SYSTEM ADMIN DASHBOARD (WEB PANEL UI)
app.get('/admin-panel', async (req, res) => {
  try {
    const db = mongoose.connection.db;

    // Aapke asli folders se data nikalna
    const vips = await db.collection('vips').find({}).toArray().catch(() => []);
    const banneds = await db.collection('banneds').find({}).toArray().catch(() => []);
    const reports = await db.collection('reports').find({}).toArray().catch(() => []);
    const activeCount = Object.keys(activeUsers || {}).length;

    // VIPs aur Banneds ko mila kar ek main list banana
    let allUsers = [];
    
    vips.forEach(v => allUsers.push({ ...v, systemRole: 'VIP', dbStatus: 'Active' }));
    banneds.forEach(b => allUsers.push({ ...b, systemRole: 'Banned', dbStatus: 'Banned' }));

    // Date ke hisaab se sort karna (Naye wale upar)
    allUsers.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    // Table HTML Generate Karna
    let tableHTML = '';
    if (allUsers.length === 0) {
      tableHTML = `<tr><td colspan="5" class="p-8 text-center text-gray-500">Abhi tak koi VIP ya Banned user nahi hai.</td></tr>`;
    } else {
      allUsers.forEach((u, i) => {
        const username = u.username || u.name || 'Unknown User';
        // IP Address display setup
        const ip = u.ip || u.ipAddress || 'No IP Logged'; 
        const roleColor = u.systemRole === 'VIP' ? 'text-yellow-400' : 'text-red-400';
        const icon = u.systemRole === 'VIP' ? 'fa-star' : 'fa-ban';
        const joinDate = u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'N/A';
        const userDataString = JSON.stringify(u).replace(/'/g, "&apos;").replace(/"/g, "&quot;");

        tableHTML += `
          <tr class="border-b border-gray-700/50 hover:bg-gray-700/30 transition group user-row">
            <td class="p-4 font-bold text-gray-200 search-name">
              <i class="fas ${icon} ${roleColor} mr-2"></i>${username}
            </td>
            <td class="p-4 font-mono text-blue-400 font-semibold text-sm">${ip}</td>
            <td class="p-4 font-semibold ${roleColor}">${u.systemRole}</td>
            <td class="p-4 text-gray-400">${joinDate}</td>
            <td class="p-4 text-right">
              <button onclick='openModal(${userDataString})' class="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded text-sm font-semibold transition shadow-lg">
                <i class="fas fa-folder-open"></i> Show Data
              </button>
            </td>
          </tr>
        `;
      });
    }

    // HTML Structure
    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Stranger OS | Moderator Dashboard</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
      </head>
      <body class="bg-gray-900 text-gray-100 font-sans antialiased relative">
        
        <nav class="bg-gray-800 border-b border-gray-700 p-4 shadow-lg sticky top-0 z-10">
          <div class="container mx-auto flex justify-between items-center">
            <h1 class="text-2xl font-bold tracking-wider text-white">
              <span class="text-indigo-500">STRANGER</span> OS <span class="text-sm font-normal text-gray-400">| MODERATOR PANEL</span>
            </h1>
            <div class="flex items-center gap-4">
              <span class="text-xs text-gray-400"><i class="fas fa-check-circle text-green-400"></i> Synced with VIPs & Banneds</span>
              <span class="bg-blue-500/20 text-blue-400 px-3 py-1 rounded-full text-sm font-semibold border border-blue-500/30">Moderator Access</span>
            </div>
          </div>
        </nav>

        <div class="container mx-auto p-6 mt-4">
          
          <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div class="bg-gray-800 p-6 rounded-xl shadow-md border border-gray-700 border-l-4 border-l-yellow-500">
              <h3 class="text-gray-400 text-sm uppercase tracking-wider mb-1">Total VIPs</h3>
              <p class="text-4xl font-bold text-white">${vips.length}</p>
            </div>
            <div class="bg-gray-800 p-6 rounded-xl shadow-md border border-gray-700 border-l-4 border-l-red-500">
              <h3 class="text-gray-400 text-sm uppercase tracking-wider mb-1">Banned Users</h3>
              <p class="text-4xl font-bold text-white">${banneds.length}</p>
            </div>
            <div class="bg-gray-800 p-6 rounded-xl shadow-md border border-gray-700 border-l-4 border-l-orange-500">
              <h3 class="text-gray-400 text-sm uppercase tracking-wider mb-1">Total Reports</h3>
              <p class="text-4xl font-bold text-white">${reports.length}</p>
            </div>
            <div class="bg-gray-800 p-6 rounded-xl shadow-md border border-gray-700 border-l-4 border-l-green-500">
              <h3 class="text-gray-400 text-sm uppercase tracking-wider mb-1">Live Active Now</h3>
              <p class="text-4xl font-bold text-white">${activeCount}</p>
            </div>
          </div>

          <div class="bg-gray-800 rounded-xl shadow-md border border-gray-700 p-5 mb-8 flex flex-col md:flex-row items-center justify-between">
            <div class="mb-4 md:mb-0">
              <h2 class="text-lg font-bold text-white"><i class="fas fa-bolt text-yellow-400 mr-2"></i> Quick Moderation</h2>
              <p class="text-sm text-gray-400">Instantly Ban or Unban any user using their exact username</p>
            </div>
            <div class="flex items-center gap-3">
              <input type="text" id="actionUsername" placeholder="Target Username..." class="bg-gray-900 border border-gray-600 text-white text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block w-48 md:w-64 p-2.5 outline-none">
              <button onclick="executeAction('ban')" class="bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 rounded-lg text-sm font-bold transition shadow-lg flex items-center">
                <i class="fas fa-gavel mr-2"></i> BAN
              </button>
              <button onclick="executeAction('unban')" class="bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-lg text-sm font-bold transition shadow-lg flex items-center">
                <i class="fas fa-unlock mr-2"></i> UNBAN
              </button>
            </div>
          </div>

          <div class="bg-gray-800 rounded-xl shadow-md border border-gray-700 overflow-hidden mb-10">
            <div class="p-5 border-b border-gray-700 bg-gray-800/50 flex justify-between items-center">
              <h2 class="text-lg font-bold">Registered Records (VIPs & Bans)</h2>
              <input type="text" id="searchInput" placeholder="Search records..." class="bg-gray-900 border border-gray-700 text-white text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block w-64 p-2.5">
            </div>
            <div class="overflow-x-auto h-[500px] overflow-y-auto">
              <table class="w-full text-left border-collapse relative">
                <thead class="bg-gray-700/80 text-gray-300 text-sm uppercase tracking-wider sticky top-0 backdrop-blur-md">
                  <tr>
                    <th class="p-4 font-semibold">Username</th>
                    <th class="p-4 font-semibold">IP Address</th>
                    <th class="p-4 font-semibold">System Role</th>
                    <th class="p-4 font-semibold">Date Recorded</th>
                    <th class="p-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody id="user-table-body" class="text-sm divide-y divide-gray-700">
                  ${tableHTML}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div id="userModal" class="fixed inset-0 bg-black/80 backdrop-blur-sm hidden z-50 flex justify-center items-center opacity-0 transition-opacity duration-300">
          <div class="bg-gray-800 rounded-2xl border border-gray-600 shadow-2xl w-full max-w-2xl transform scale-95 transition-transform duration-300" id="modalContent">
            <div class="p-6 border-b border-gray-700 flex justify-between items-center bg-gray-800/50 rounded-t-2xl">
              <h3 class="text-xl font-bold text-white flex items-center gap-2"><i class="fas fa-id-card text-indigo-400"></i> Record Intel View</h3>
              <button onclick="closeModal()" class="text-gray-400 hover:text-white transition"><i class="fas fa-times text-xl"></i></button>
            </div>
            <div class="p-6 space-y-6" id="modalBody"></div>
            <div class="p-4 border-t border-gray-700 bg-gray-900/50 rounded-b-2xl flex justify-end gap-3">
              <button onclick="closeModal()" class="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg transition text-sm font-semibold">Close Panel</button>
            </div>
          </div>
        </div>

        <script>
          // Ban and Unban Execution
          async function executeAction(actionType) {
            const usernameInput = document.getElementById('actionUsername');
            const username = usernameInput.value.trim();
            
            if (!username) {
              alert("⚠️ Please enter a target username first!");
              return;
            }

            const confirmMsg = actionType === 'ban' 
              ? \`Are you sure you want to BAN '\${username}'?\` 
              : \`Are you sure you want to UNBAN '\${username}'?\`;

            if (!confirm(confirmMsg)) return;

            const endpoint = actionType === 'ban' ? '/api/action-ban' : '/api/action-unban';
            
            try {
              const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: username })
              });
              
              const data = await response.json();
              
              if (data.success) {
                alert(data.message);
                usernameInput.value = ''; 
                window.location.reload(); // Table update karne ke liye refresh
              } else {
                alert(data.message);
              }
            } catch (err) {
              alert("Network or Server Error occurred!");
            }
          }

          document.getElementById('searchInput').addEventListener('input', function(e) {
            const term = e.target.value.toLowerCase();
            const rows = document.querySelectorAll('.user-row');
            rows.forEach(row => {
              const name = row.querySelector('.search-name').textContent.toLowerCase();
              row.style.display = name.includes(term) ? '' : 'none';
            });
          });

          function openModal(user) {
            const joinDate = user.createdAt ? new Date(user.createdAt).toLocaleString() : 'Not Recorded';
            const statusColor = user.dbStatus === 'Banned' ? 'text-red-400' : 'text-green-400';
            const ip = user.ip || user.ipAddress || 'No IP Logged';
            
            document.getElementById('modalBody').innerHTML = \`
              <div class="grid grid-cols-2 gap-4">
                <div class="bg-gray-900 p-4 rounded-lg border border-gray-700">
                  <p class="text-xs text-gray-500 uppercase tracking-wider mb-1">Username/ID</p>
                  <p class="text-lg font-bold text-white">\${user.username || user.name || 'Unknown'}</p>
                </div>
                <div class="bg-gray-900 p-4 rounded-lg border border-gray-700">
                  <p class="text-xs text-gray-500 uppercase tracking-wider mb-1">Database Role</p>
                  <p class="text-sm font-bold \${user.systemRole === 'VIP' ? 'text-yellow-400' : 'text-red-400'}">\${user.systemRole}</p>
                </div>
                <div class="bg-gray-900 p-4 rounded-lg border border-gray-700">
                  <p class="text-xs text-gray-500 uppercase tracking-wider mb-1">Network Intel</p>
                  <p class="text-sm font-mono text-blue-400 font-bold">\${ip} <br> <span class="text-xs text-gray-500 font-sans">\${user.device || 'Unknown Device'}</span></p>
                </div>
                <div class="bg-gray-900 p-4 rounded-lg border border-gray-700">
                  <p class="text-xs text-gray-500 uppercase tracking-wider mb-1">Location / Reason</p>
                  <p class="text-sm text-gray-300">\${user.reason || user.country || 'Not provided'}</p>
                </div>
              </div>

              <div class="bg-gray-900 p-4 rounded-lg border border-gray-700 mt-2">
                <h4 class="text-sm font-bold text-gray-300 mb-3 border-b border-gray-800 pb-2"><i class="fas fa-clock text-gray-500 mr-2"></i> Timeline</h4>
                <ul class="space-y-3">
                  <li class="flex items-center justify-between bg-gray-800/50 p-2 rounded border border-gray-700/50">
                    <span class="text-sm text-gray-300">Record Created</span>
                    <span class="text-xs text-gray-500 font-mono">\${joinDate}</span>
                  </li>
                  <li class="flex items-center justify-between bg-gray-800/50 p-2 rounded border border-gray-700/50">
                    <span class="text-sm text-gray-300">Status</span>
                    <span class="text-xs font-bold \${statusColor}">\${user.dbStatus}</span>
                  </li>
                </ul>
              </div>
            \`;

            const modal = document.getElementById('userModal');
            const content = document.getElementById('modalContent');
            modal.classList.remove('hidden');
            setTimeout(() => {
              modal.classList.remove('opacity-0');
              content.classList.remove('scale-95');
            }, 10);
          }

          function closeModal() {
            const modal = document.getElementById('userModal');
            const content = document.getElementById('modalContent');
            modal.classList.add('opacity-0');
            content.classList.add('scale-95');
            setTimeout(() => {
              modal.classList.add('hidden');
            }, 300);
          }
        </script>
      </body>
      </html>
    `;

    res.send(html);
  } catch (error) {
    res.status(500).send("<h1 style='color:red;'>Error Loading Dashboard: " + error.message + "</h1>");
  }
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



// 🛡️ BANNED IP FIREWALL (Middleware)
// 🛡️ GLOBAL IP GATEKEEPER
app.use(async (req, res, next) => {
  // Admin panel aur assets ko block mat karna
  if (req.path.startsWith('/admin') || req.path.startsWith('/api')) return next();

  // Client ka exact real IP nikalein
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

  try {
    const db = mongoose.connection.db;
    
    // Check karein kya ye IP banned list mein saved hai
    const ipCheck = await db.collection('banneds').findOne({ ip: clientIp });
    
    if (ipCheck && ipCheck.ip !== 'IP_NOT_FOUND_YET' && ipCheck.ip !== 'No IP Logged') {
      return res.status(403).send(`
        <body style="background:#0f172a; color:#f87171; font-family:sans-serif; display:flex; justify-content:center; align-items:center; height:100vh; flex-direction:column;">
          <h1 style="font-size:4rem; margin-bottom:0;">🚫 403 BAN</h1>
          <p style="color:#94a3b8; font-size:1.2rem;">Your device IP [${clientIp}] has been permanently blacklisted from StrangerOS.</p>
        </body>
      `);
    }
  } catch (e) {
    console.error("Firewall Error:", e);
  }
  next();
});

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











const cron = require('node-cron');
const XLSX = require('xlsx');

// 📊 1. LIVE DASHBOARD (Har 5 second mein update)
async function refreshDiscordDashboard() {
  const channel = discordClient.channels.cache.get("1507732492562727042");
  if (!channel) return;

  try {
    const active = Object.keys(activeUsers || {}).length;
    const banned = await Banned.countDocuments();
    const reports = await Report.countDocuments();
    const vips = await Vip.countDocuments();
    const adminsCount = admins ? admins.size : 0;
    const dbStatus = mongoose.connection.readyState === 1 ? "ONLINE" : "OFFLINE";

    // Table view
    const tableDisplay = `\`\`\`text
╔════════════╦═══════════════╗
║ CATEGORY   ║ VALUE         ║
╠════════════╬═══════════════╣
║ ACTIVE     ║ ${active.toString().padEnd(13)} ║
║ BANNED     ║ ${banned.toString().padEnd(13)} ║
║ REPORTS    ║ ${reports.toString().padEnd(13)} ║
║ VIPs       ║ ${vips.toString().padEnd(13)} ║
║ ADMINS     ║ ${adminsCount.toString().padEnd(13)} ║
║ DB_STATUS  ║ ${dbStatus.padEnd(13)} ║
╚════════════╩═══════════════╝
\`\`\``;

    const embed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle("📊 SYSTEM_DATA_GRID")
      .setDescription(tableDisplay)
      .setFooter({ text: "HeyyYuki // Real-time Synchronization" })
      .setTimestamp();

    const messages = await channel.messages.fetch({ limit: 1 });
    const lastMsg = messages.first();
    if (lastMsg && lastMsg.author.id === discordClient.user.id) {
      await lastMsg.edit({ embeds: [embed] });
    } else {
      await channel.send({ embeds: [embed] });
    }
  } catch (err) { console.error("❌ Dashboard Update Failed:", err); }
}

// 📅 2. WEEKLY SUNDAY 8 AM EXCEL REPORT
cron.schedule('0 8 * * 0', async () => {
  try {
    const channel = discordClient.channels.cache.get("1507732492562727042");
    
    // Data compile karo
    const data = [
      { Category: "Active Users", Value: Object.keys(activeUsers || {}).length },
      { Category: "Total Banned", Value: await Banned.countDocuments() },
      { Category: "Total Reports", Value: await Report.countDocuments() },
      { Category: "Total VIPs", Value: await Vip.countDocuments() }
    ];

    // Excel file banao
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Weekly_Report");
    XLSX.writeFile(wb, "Weekly_Report.xlsx");

    // Discord par send karo
    await channel.send({
      content: "📅 **Weekly Server Report** (Sunday 8:00 AM)",
      files: ["./Weekly_Report.xlsx"]
    });

    // File delete karo taaki space na bhare
    fs.unlinkSync("./Weekly_Report.xlsx");
  } catch (err) { console.error("❌ Weekly Report Failed:", err); }
});

// Bot ready pe shuru karo
discordClient.once("ready", () => {
  setInterval(refreshDiscordDashboard, 5000); // 5 seconds interval (Safe for server)
});





discordClient.on('messageCreate', async (message) => {
  if (message.content.toLowerCase() === '!getreport') {
    if (!message.member.permissions.has('ADMINISTRATOR')) return;

    try {
      message.reply("⏳ Database se detailed report generate ho rahi hai...");

      // 1. Direct MongoDB Access (Bina Models ke)
      const db = mongoose.connection.db;
      const users = await db.collection('users').find({}).toArray();
      const reports = await db.collection('reports').find({}).toArray();
      const banned = await db.collection('banned').find({}).toArray();

      const fileName = `./Management_Report_${Date.now()}.xlsx`;

      // 2. Excel Management UI Structure
      const wsData = [
        ["SERVER MANAGEMENT DASHBOARD"],
        [`Report Date Range: Last 30 Days (Comprehensive Data)`],
        [], 
        ["S.No", "Username", "IP Address", "Country", "State", "Device", "Status", "Joined/Reported Date"]
      ];

      // 3. User Data Filling
      users.forEach((user, index) => {
        wsData.push([
          index + 1,
          user.username || "N/A",
          user.ip || "N/A",
          user.country || "N/A",
          user.state || "N/A",
          user.device || "N/A",
          user.status || "Active",
          user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "N/A"
        ]);
      });

      // 4. Summary Section (Properly Managed UI)
      wsData.push([], [], ["SYSTEM SUMMARY"], ["Metric", "Value"],
        ["Total Users", users.length],
        ["Total Banned Users", banned.length],
        ["Total Reported Users", reports.length],
        ["Database Status", "Operational"]
      );

      // 5. Excel UI Formatting
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      
      // Professional Widths
      ws['!cols'] = [{ wch: 8 }, { wch: 20 }, { wch: 18 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 20 }];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Management_Report");
      XLSX.writeFile(wb, fileName);

      await message.channel.send({
        content: "✅ **Management Report generated successfully!**",
        files: [fileName]
      });

      fs.unlinkSync(fileName);
    } catch (err) {
      console.error(err);
      message.reply("❌ Error: Report generation failed (Check if DB collections exist).");
    }
  }
});








// BAN / UNBAN EXECUTION FUNCTION
          async function executeAction(actionType) {
            const usernameInput = document.getElementById('actionUsername');
            const username = usernameInput.value.trim();
            
            if (!username) {
              alert("⚠️ Please enter a valid username first!");
              return;
            }

            const confirmMsg = actionType === 'ban' 
              ? `Are you sure you want to BAN '${username}'?` 
              : `Are you sure you want to UNBAN '${username}'?`;

            if (!confirm(confirmMsg)) return;

            // API Call
            const endpoint = actionType === 'ban' ? '/api/action-ban' : '/api/action-unban';
            
            try {
              const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: username })
              });
              
              const data = await response.json();
              
              if (data.success) {
                alert(data.message);
                usernameInput.value = ''; // Input clear karna
                window.location.reload(); // Page refresh karke naya data show karna
              } else {
                alert(data.message);
              }
            } catch (err) {
              alert("Network or Server Error occurred!");
            }
          }
