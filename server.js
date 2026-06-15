// ╔══════════════════════════════════════════════════════════════════╗
// ║   StrangerToStranger — HeyyYuki Powered Server v6.1             ║
// ║   Firebase Auth + /panel + VPN Detection + Full User Intel      ║
// ║   Profanity | Warnings | DM Persistence | Group Chatroom | 2026 ║
// ╚══════════════════════════════════════════════════════════════════╝

const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

require("dotenv").config();
const express = require("express");
const app     = express();
const http    = require("http").createServer(app);
const io      = require("socket.io")(http, { cors: { origin: "*" } });
const path    = require("path");
const fs      = require("fs");
const mongoose = require("mongoose");
const admin   = require("firebase-admin");

const {
  Client, GatewayIntentBits, EmbedBuilder, ActivityType,
  REST, Routes, SlashCommandBuilder,
} = require("discord.js");

// ══════════════════════════════════════════════════════════════════
// 🔑 CONFIGURATION
// ══════════════════════════════════════════════════════════════════
const MONGO_URI     = process.env.MONGO_URI     || "mongodb+srv://yashwant2046:yashwant2046@cluster0.ork78ul.mongodb.net/?appName=Cluster0";
const CLIENT_ID     = process.env.CLIENT_ID     || "1478767384398528573";
const DISCORD_TOKEN = process.env.DISCORD_TOKEN || "";

const CONTROL_CHANNEL_IDS   = ["1506573109728247848"];
const GUILD_ID               = "1485522389403173004";
const STATUS_CHANNEL_ID      = process.env.STATUS_CHANNEL_ID      || "1506573109728247848";
const CHAT_CHANNEL_ID        = process.env.CHAT_CHANNEL_ID        || "1506240430260621312";
const MEDIA_LOG_CHANNEL_ID   = process.env.MEDIA_LOG_CHANNEL_ID   || "1506573109728247848";
const JOIN_LEAVE_CHANNEL_ID  = process.env.JOIN_LEAVE_CHANNEL_ID  || "1506240499361775707";
const MOD_LOG_CHANNEL_ID     = process.env.MOD_LOG_CHANNEL_ID     || "1506573109728247848";
const VIP_LOG_CHANNEL_ID     = process.env.VIP_LOG_CHANNEL_ID     || "1506573109728247848";
const REPORT_CHANNEL_ID      = process.env.REPORT_CHANNEL_ID      || "1506573109728247848";
const ERROR_CHANNEL_ID       = process.env.ERROR_CHANNEL_ID       || "1506240662381658162";
const PROFANITY_CHANNEL_ID   = process.env.PROFANITY_CHANNEL_ID   || REPORT_CHANNEL_ID;
const BANNED_LOG_CHANNEL_ID  = process.env.BANNED_LOG_CHANNEL_ID  || "1512753547765223632";

const ADMIN_NAME     = process.env.ADMIN_NAME     || "Yashwant";
const PORT           = process.env.PORT           || 4000;
const PANEL_PASSWORD = process.env.PANEL_PASSWORD || "heyuki2026";

// ══════════════════════════════════════════════════════════════════
// 🔥 FIREBASE ADMIN SDK INIT
// ══════════════════════════════════════════════════════════════════
let firebaseAdminReady = false;
try {
  let serviceAccount;
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  } else if (fs.existsSync(path.join(__dirname, "firebase-service-account.json"))) {
    serviceAccount = require("./firebase-service-account.json");
  }
  if (serviceAccount) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    firebaseAdminReady = true;
    console.log("✅ Firebase Admin SDK initialized");
  } else {
    console.warn("⚠️  Firebase service account not found — token verification disabled");
  }
} catch (err) {
  console.error("❌ Firebase Admin init error:", err.message);
}

async function verifyFirebaseToken(idToken) {
  if (!firebaseAdminReady || !idToken) return null;
  try { return await admin.auth().verifyIdToken(idToken); }
  catch (err) { return null; }
}

// ══════════════════════════════════════════════════════════════════
// 🧠 PROFANITY DETECTION
// ══════════════════════════════════════════════════════════════════
const PROFANITY_WORDS = new Set([
  "gandu","gaandu","madarchod","behenchod","bhaanchod","lavda","lund",
  "chutiya","chutia","chutiye","bhag","sala","salle","saala","mc","bc",
  "randi","kutti","kutty","kutiya","kuthi","kamina","kamine","nalayak",
  "besharam","aayashi","gaali","gaaliyan","saand","bewakoof","bakwas",
  "jhooth","jhuthe","naakaara","napunsak",
  "fuck","shit","ass","bitch","bastard","damn","crap","whore","asshole",
  "dickhead","motherfucker","arsehole","dumbass","prick","bloody","cunt",
  "twat","wanker","bollocks","bugger","arse","cock","dick","pussy","slut",
  "screw","wtf","stfu","ffs","gtfo",
]);

function containsProfanity(text) {
  const words = text.toLowerCase().split(/\s+/);
  return words.some(word => PROFANITY_WORDS.has(word.replace(/[.,!?;:'"()-]/g, "")));
}

// ══════════════════════════════════════════════════════════════════
// 📦 MONGODB CONNECTION — FIXED
// ══════════════════════════════════════════════════════════════════
let mongoConnected = false;

// FIX 1: Proper connection options — timeout aur retry settings
const MONGOOSE_OPTS = {
  serverSelectionTimeoutMS: 10000,  // 10 sec mein select karo
  socketTimeoutMS:          45000,  // 45 sec socket timeout
  connectTimeoutMS:         10000,  // 10 sec connect timeout
  maxPoolSize:              10,
  retryWrites:              true,
  retryReads:               true,
  family:                   4,      // IPv4 force — DNS issue fix
};

async function connectMongoDB() {
  const maxRetries = 5;
  let attempt = 0;

  while (attempt < maxRetries) {
    attempt++;
    try {
      console.log(`🔄 MongoDB connect attempt ${attempt}/${maxRetries}...`);
      await mongoose.connect(MONGO_URI, MONGOOSE_OPTS);
      mongoConnected = true;
      console.log("✅ MongoDB Connected");
      logToDiscordErrorSafe("✅ MongoDB Connected — Server Online", "info");
      return;
    } catch (err) {
      console.error(`❌ MongoDB Error (attempt ${attempt}): ${err.message}`);
      if (attempt < maxRetries) {
        const delay = attempt * 3000; // 3s, 6s, 9s, 12s
        console.log(`⏳ Retry in ${delay/1000}s...`);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }

  console.error("❌ MongoDB: All connection attempts failed. Server running without DB.");
  console.error("   FIX: MongoDB Atlas → Resume cluster at https://cloud.mongodb.com");
}

// Mongoose connection events
mongoose.connection.on("connected", () => { mongoConnected = true; console.log("✅ Mongoose: connected"); });
mongoose.connection.on("disconnected", () => { mongoConnected = false; console.log("⚠️  Mongoose: disconnected — auto-reconnect hoga..."); });
mongoose.connection.on("error", (err) => { console.error("❌ Mongoose error:", err.message); });

// Safe DB operation wrapper — MongoDB down hone par crash nahi hoga
async function safeDB(fn, fallback = null) {
  if (!mongoConnected) return fallback;
  try { return await fn(); }
  catch (err) {
    console.error("DB op failed:", err.message);
    return fallback;
  }
}

// ══════════════════════════════════════════════════════════════════
// 📋 MONGODB SCHEMAS
// ══════════════════════════════════════════════════════════════════
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
    caption:      String,
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

const WarningSchema = new mongoose.Schema({
  username:      { type: String, index: true },
  count:         { type: Number, default: 1 },
  lastWarningAt: { type: Date, default: Date.now },
  reason:        String,
  messages:      [{ text: String, date: Date }],
  createdAt:     { type: Date, default: Date.now },
  updatedAt:     { type: Date, default: Date.now },
});
const Warning = mongoose.model("Warning", WarningSchema);

const AnnouncementSchema = new mongoose.Schema({
  text:      String,
  expiresAt: Date,
  createdAt: { type: Date, default: Date.now },
});
const Announcement = mongoose.models.Announcement || mongoose.model("Announcement", AnnouncementSchema);

const BanSchema = new mongoose.Schema({
  username:    { type: String, unique: true },
  firebaseUid: { type: String, index: true },
  ip:          String,
  forwardedIp: String,
  reason:      { type: String, default: "Profanity/Abuse" },
  country:     { type: String, default: "Unknown" },
  banCount:    { type: Number, default: 1 },
  unbanCount:  { type: Number, default: 0 },
  banHistory:  [{
    action: { type: String, enum: ["ban", "unban"] },
    reason: String,
    by:     String,
    at:     { type: Date, default: Date.now },
  }],
});
const Banned = mongoose.model("Banned", BanSchema);

const SessionSchema = new mongoose.Schema({
  username:      { type: String, index: true },
  firebaseUid:   { type: String, index: true },
  firebaseEmail: String,
  ip:            String,
  forwardedFor:  String,
  userAgent:     String,
  browser:       String,
  os:            String,
  isMobile:      Boolean,
  incognitoHint: { type: Boolean, default: false },
  vpnDetected:   { type: Boolean, default: false },
  connectedAt:   { type: Date, default: Date.now },
  lastSeen:      { type: Date, default: Date.now },
  sessionCount:  { type: Number, default: 1 },
});
const UserSession = mongoose.model("UserSession", SessionSchema);

const VipSchema = new mongoose.Schema({ username: { type: String, unique: true } });
const Vip = mongoose.model("Vip", VipSchema);

// ══════════════════════════════════════════════════════════════════
// 📁 FILE-BASED PERSISTENCE
// ══════════════════════════════════════════════════════════════════
const BANNED_FILE     = path.join(__dirname, "banned-usernames.json");
const VIPS_FILE       = path.join(__dirname, "vip-users.json");
const ADMINS_FILE     = path.join(__dirname, "admin-users.json");
const BANNED_UIDS_FILE= path.join(__dirname, "banned-uids.json");

let bannedUsernames = new Set();
let bannedUids      = new Set();
let vips            = new Set();
let admins          = new Set();

function loadJSON(file) {
  try { return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : []; }
  catch (e) { return []; }
}

bannedUsernames = new Set(loadJSON(BANNED_FILE));
bannedUids      = new Set(loadJSON(BANNED_UIDS_FILE));
vips            = new Set(loadJSON(VIPS_FILE));
admins          = new Set(loadJSON(ADMINS_FILE));

function saveBanned()     { fs.writeFileSync(BANNED_FILE,       JSON.stringify([...bannedUsernames])); }
function saveBannedUids() { fs.writeFileSync(BANNED_UIDS_FILE,  JSON.stringify([...bannedUids])); }
function saveVips()       { fs.writeFileSync(VIPS_FILE,         JSON.stringify([...vips])); }
function saveAdmins()     { fs.writeFileSync(ADMINS_FILE,       JSON.stringify([...admins])); }

// ══════════════════════════════════════════════════════════════════
// 🧠 IN-MEMORY STATE
// ══════════════════════════════════════════════════════════════════
const activeUsers   = {};   // Global chatroom users
const activeGroups  = {};   // Group room users { groupId: { socketId: userObj } }
const tempBannedIPs = new Map();
const shadowBanned  = new Set();

// ══════════════════════════════════════════════════════════════════
// 🛠️ UTILITY HELPERS
// ══════════════════════════════════════════════════════════════════
function genId() { return Date.now().toString(36) + Math.random().toString(36).substr(2, 5); }

function getAllIPs(socket) {
  const forwarded     = socket.handshake.headers["x-forwarded-for"] || "";
  const real          = socket.handshake.headers["x-real-ip"] || "";
  const direct        = socket.handshake.address || "127.0.0.1";
  const forwardedList = forwarded.split(",").map(ip => ip.trim()).filter(Boolean);
  const primaryIP     = forwardedList[0] || real || direct;
  const vpnHint       = forwardedList.length > 1;
  return { primary: primaryIP, allForwarded: forwardedList, realHeader: real, directSocket: direct, vpnHint };
}

function parseUserAgent(ua = "") {
  let browser = "Unknown", os = "Unknown", isMobile = false;
  if (/Edg\//i.test(ua))             browser = "Microsoft Edge";
  else if (/OPR\//i.test(ua))        browser = "Opera";
  else if (/Brave/i.test(ua))        browser = "Brave";
  else if (/Chrome/i.test(ua))       browser = "Chrome";
  else if (/Firefox/i.test(ua))      browser = "Firefox";
  else if (/Safari/i.test(ua))       browser = "Safari";
  else if (/MSIE|Trident/i.test(ua)) browser = "Internet Explorer";
  if (/Windows/i.test(ua))           os = "Windows";
  else if (/Android/i.test(ua))      os = "Android";
  else if (/iPhone|iPad/i.test(ua))  os = "iOS";
  else if (/Macintosh/i.test(ua))    os = "macOS";
  else if (/Linux/i.test(ua))        os = "Linux";
  if (/Mobi|Android|iPhone|iPad/i.test(ua)) isMobile = true;
  return { browser, os, isMobile };
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
  return Object.values(activeUsers).map(u => {
    const nl    = u.name.toLowerCase();
    const isAdm = isUserAdmin(nl);
    const isVip = isUserVip(nl);
    return {
      socketId: u.socketId,
      name:     isAdm ? "👑 " + u.name : u.name,
      rawName:  u.name,
      bio:      u.bio,
      avatar:   u.avatar,
      color:    u.color,
      isVip:    isVip,
      isAdmin:  isAdm,
    };
  });
}

function buildGroupUserList(groupId) {
  const room = activeGroups[groupId] || {};
  return Object.values(room).map(u => ({ name: u.name, bio: u.bio, isVip: isUserVip(u.name.toLowerCase()), isAdmin: isUserAdmin(u.name.toLowerCase()) }));
}

function logToDiscordErrorSafe(msg, type = "error") {
  if (typeof logToDiscordError === "function" && discordReady) logToDiscordError(msg, type);
}

// ══════════════════════════════════════════════════════════════════
// 🤖 DISCORD BOT SETUP
// ══════════════════════════════════════════════════════════════════
const discordClient = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});
let discordReady = false;

// ══════════════════════════════════════════════════════════════════
// 📜 SLASH COMMANDS
// ══════════════════════════════════════════════════════════════════
const commands = [
  new SlashCommandBuilder()
    .setName("panel")
    .setDescription("🎛️ Master Admin Panel")
    .addSubcommand(s => s.setName("user").setDescription("👤 User details").addStringOption(o => o.setName("username").setDescription("Username").setRequired(true)))
    .addSubcommand(s => s.setName("ban").setDescription("🔨 Ban user").addStringOption(o => o.setName("username").setDescription("Username").setRequired(true)).addStringOption(o => o.setName("reason").setDescription("Reason")))
    .addSubcommand(s => s.setName("unban").setDescription("✅ Unban user").addStringOption(o => o.setName("username").setDescription("Username").setRequired(true)))
    .addSubcommand(s => s.setName("kick").setDescription("👢 Kick user").addStringOption(o => o.setName("username").setDescription("Username").setRequired(true)).addStringOption(o => o.setName("reason").setDescription("Reason")))
    .addSubcommand(s => s.setName("warn").setDescription("⚠️ Warn user").addStringOption(o => o.setName("username").setDescription("Username").setRequired(true)).addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(true)))
    .addSubcommand(s => s.setName("clearwarn").setDescription("🧹 Clear warnings").addStringOption(o => o.setName("username").setDescription("Username").setRequired(true)))
    .addSubcommand(s => s.setName("list").setDescription("📋 Banned list").addStringOption(o => o.setName("filter").setDescription("Filter")))
    .addSubcommand(s => s.setName("online").setDescription("🌐 Online users"))
    .addSubcommand(s => s.setName("stats").setDescription("📊 Server stats"))
    .addSubcommand(s => s.setName("ann").setDescription("📢 Announcement").addStringOption(o => o.setName("message").setDescription("Message").setRequired(true)))
    .addSubcommand(s => s.setName("vip").setDescription("💎 VIP manage").addStringOption(o => o.setName("username").setDescription("Username").setRequired(true)).addStringOption(o => o.setName("action").setDescription("add/remove").setRequired(true).addChoices({ name: "Add VIP", value: "add" }, { name: "Remove VIP", value: "remove" })))
    .addSubcommand(s => s.setName("shadow").setDescription("👻 Shadow ban toggle").addStringOption(o => o.setName("username").setDescription("Username").setRequired(true)))
    .addSubcommand(s => s.setName("banuid").setDescription("🔥 Ban by Firebase UID").addStringOption(o => o.setName("uid").setDescription("Firebase UID").setRequired(true)).addStringOption(o => o.setName("reason").setDescription("Reason")))
].map(c => c.toJSON());

if (DISCORD_TOKEN) {
  const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);
  (async () => {
    try {
      await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
      console.log("✅ /panel slash commands registered");
    } catch (e) { console.error("❌ Slash command register error:", e.message); }
  })();
}

// ══════════════════════════════════════════════════════════════════
// 🤖 DISCORD BOT EVENTS
// ══════════════════════════════════════════════════════════════════
discordClient.once("ready", () => {
  discordReady = true;
  console.log(`🤖 HeyyYuki online as ${discordClient.user.tag}`);
  discordClient.user.setActivity("StrangerToStranger 🌐 | 24/7", { type: ActivityType.Watching });
  updateDiscordStatus();
  logToDiscordError("🤖 HeyyYuki Bot v6.1 Started", "info");
});

discordClient.on("messageCreate", msg => {
  if (msg.author.bot || msg.channel.id !== CHAT_CHANNEL_ID) return;
  if (msg.content.startsWith("/")) return;
  io.to("global").emit("chat message", {
    id: "discord_" + Date.now(), sender: `[Discord] ${msg.author.username}`,
    message: msg.content, type: "text", isVip: true, senderColor: "#5865f2", createdAt: new Date(),
  });
});

// ══════════════════════════════════════════════════════════════════
// 🎛️ /panel INTERACTION HANDLER
// ══════════════════════════════════════════════════════════════════
discordClient.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;
  if (!CONTROL_CHANNEL_IDS.includes(interaction.channelId)) return;
  if (interaction.commandName !== "panel") return;

  const { options } = interaction;

  const safeReply = async content => {
    try {
      if (interaction.replied || interaction.deferred) await interaction.editReply({ content: content.substring(0, 2000) });
      else await interaction.reply({ content: content.substring(0, 2000), flags: 64 });
    } catch (e) {}
  };

  const safeEmbedReply = async embed => {
    try {
      if (interaction.replied || interaction.deferred) await interaction.editReply({ embeds: [embed] });
      else await interaction.reply({ embeds: [embed], flags: 64 });
    } catch (e) {}
  };

  try {
    const sub      = options.getSubcommand();
    const username = options.getString("username")?.trim().toLowerCase();

    // ── /panel user ──────────────────────────────────────────────
    if (sub === "user") {
      await interaction.deferReply({ flags: 64 });
      const [session, banRecord, warnRecord] = await Promise.all([
        safeDB(() => UserSession.findOne({ username: { $regex: new RegExp("^" + username + "$", "i") } }).sort({ lastSeen: -1 }).lean()),
        safeDB(() => Banned.findOne({ username: { $regex: new RegExp("^" + username + "$", "i") } }).lean()),
        safeDB(() => Warning.findOne({ username: { $regex: new RegExp("^" + username + "$", "i") } }).lean()),
      ]);
      const onlineUser = Object.values(activeUsers).find(u => u.name.toLowerCase() === username);
      const isBanned = bannedUsernames.has(username) || !!banRecord;

      let vpnStatus = "❓ No data", realIP = "N/A", browserInfo = "N/A", osInfo = "N/A";
      let mobileInfo = "N/A", incognito = "N/A", firebaseEmail = "N/A", firebaseUid = "N/A";

      if (session) {
        realIP      = session.ip || "Unknown";
        vpnStatus   = session.vpnDetected ? "🔴 VPN DETECTED" : "🟢 No VPN";
        browserInfo = session.browser || "Unknown";
        osInfo      = session.os || "Unknown";
        mobileInfo  = session.isMobile ? "📱 Mobile" : "🖥️ Desktop";
        incognito   = session.incognitoHint ? "🕵️ Incognito" : "🌐 Normal";
        firebaseEmail = session.firebaseEmail || "N/A";
        firebaseUid   = session.firebaseUid   || "N/A";
      } else if (onlineUser) {
        realIP        = onlineUser.ip            || "Unknown";
        firebaseUid   = onlineUser.firebaseUid   || "N/A";
        firebaseEmail = onlineUser.firebaseEmail  || "N/A";
        vpnStatus = "⚠️ Session DB mein nahi";
      }

      let banHistoryText = "Kabhi ban nahi hua";
      if (banRecord?.banHistory?.length) {
        banHistoryText = banRecord.banHistory.slice(-5)
          .map((h, i) => `${i+1}. ${h.action==="ban"?"🔨":"✅"} ${new Date(h.at).toLocaleString("en-IN",{timeZone:"Asia/Kolkata"})}${h.reason?` (${h.reason})`:""}`)
          .join("\n");
      }

      let warnText = "Koi warning nahi";
      if (warnRecord?.messages?.length) {
        warnText = warnRecord.messages.slice(-3)
          .map((m, i) => `${i+1}. "${m.text}"`)
          .join("\n");
      }

      const embed = new EmbedBuilder()
        .setColor(isBanned ? 0xff3c5f : onlineUser ? 0x00f5a0 : 0x7289da)
        .setTitle(`🔍 User: ${username}`)
        .setDescription(`**Status:** ${onlineUser?"🟢 Online":isBanned?"🔴 Banned":"⚫ Offline"}`)
        .addFields(
          { name: "📧 Email",        value: firebaseEmail,                inline: true },
          { name: "🔑 Firebase UID", value: `\`${firebaseUid}\``,         inline: true },
          { name: "🚫 UID Banned",   value: bannedUids.has(firebaseUid)?"🔴 YES":"🟢 No", inline: true },
          { name: "📍 IP",           value: `\`${realIP}\``,              inline: true },
          { name: "🛡️ VPN",         value: vpnStatus,                    inline: true },
          { name: "🌏 Browser",      value: browserInfo,                  inline: true },
          { name: "💾 OS",           value: osInfo,                       inline: true },
          { name: "📱 Device",       value: mobileInfo,                   inline: true },
          { name: "🕵️ Mode",        value: incognito,                    inline: true },
          { name: "⚠️ Warnings",     value: warnRecord ? `${warnRecord.count}/3` : "0/3", inline: true },
          { name: "📜 Warn History", value: warnText.substring(0, 500),   inline: false },
          { name: "📊 Ban Count",    value: banRecord ? `🔨 ${banRecord.banCount||1}x` : "Never", inline: true },
          { name: "📜 Ban History",  value: banHistoryText.substring(0, 800), inline: false },
          { name: "🕒 Last Seen",    value: session ? new Date(session.lastSeen).toLocaleString("en-IN",{timeZone:"Asia/Kolkata"}) : onlineUser?"🟢 Now":"—", inline: true },
        )
        .setFooter({ text: "HeyyYuki Panel v6.1" }).setTimestamp();

      return safeEmbedReply(embed);
    }

    // ── /panel ban ───────────────────────────────────────────────
    else if (sub === "ban") {
      const reason     = options.getString("reason") || "Admin ban";
      bannedUsernames.add(username); saveBanned();

      const onlineUser = Object.values(activeUsers).find(u => u.name.toLowerCase() === username);
      const session    = await safeDB(() => UserSession.findOne({ username: { $regex: new RegExp("^" + username + "$", "i") } }).sort({ lastSeen: -1 }).lean());
      const fbUid      = onlineUser?.firebaseUid || session?.firebaseUid;

      if (fbUid) { bannedUids.add(fbUid); saveBannedUids(); }

      // FIX 2: returnDocument: 'after' instead of new: true
      await safeDB(() => Banned.findOneAndUpdate(
        { username },
        { $set: { username, firebaseUid: fbUid||null, ip: onlineUser?.ip||session?.ip||"Unknown", reason }, $inc: { banCount: 1 }, $push: { banHistory: { action: "ban", reason, by: "Discord Admin", at: new Date() } } },
        { upsert: true, returnDocument: "after" }
      ));

      if (onlineUser) {
        io.to(onlineUser.socketId).emit("force_logout", `🚫 Ban: ${reason}`);
        setTimeout(() => { const s = io.sockets.sockets.get(onlineUser.socketId); if (s) s.disconnect(true); }, 500);
        if (onlineUser.ip) tempBannedIPs.set(onlineUser.ip, { expiry: Date.now() + 999*365*24*60*60*1000, reservedName: username });
      }

      sendEmbed(BANNED_LOG_CHANNEL_ID, {
        color: 0xff3c5f, title: "🔨 User Banned",
        fields: [
          { name: "👤 Username", value: `\`${username}\``,          inline: true },
          { name: "📝 Reason",   value: `\`${reason}\``,            inline: true },
          { name: "🔥 UID",      value: `\`${fbUid||"N/A"}\``,     inline: true },
        ],
      });
      return safeReply(`✅ **${username}** banned!\n📝 ${reason}\n🔥 UID banned: ${fbUid ? "Yes" : "No"}`);
    }

    // ── /panel unban ─────────────────────────────────────────────
    else if (sub === "unban") {
      bannedUsernames.delete(username); saveBanned();
      const banDoc = await safeDB(() => Banned.findOne({ username }));
      if (banDoc) {
        if (banDoc.firebaseUid) { bannedUids.delete(banDoc.firebaseUid); saveBannedUids(); }
        banDoc.unbanCount = (banDoc.unbanCount||0) + 1;
        banDoc.banHistory = banDoc.banHistory || [];
        banDoc.banHistory.push({ action: "unban", reason: "Admin unban", by: "Discord Admin", at: new Date() });
        await safeDB(() => banDoc.save());
        if (banDoc.ip) tempBannedIPs.delete(banDoc.ip);
      }
      return safeReply(`✅ **${username}** unbanned!`);
    }

    // ── /panel kick ──────────────────────────────────────────────
    else if (sub === "kick") {
      const reason     = options.getString("reason") || "Admin kick";
      const onlineUser = Object.values(activeUsers).find(u => u.name.toLowerCase() === username);
      if (!onlineUser) return safeReply(`❌ **${username}** online nahi hai.`);
      io.to(onlineUser.socketId).emit("force_logout", `👢 Kick: ${reason}`);
      setTimeout(() => { const s = io.sockets.sockets.get(onlineUser.socketId); if (s) s.disconnect(true); }, 500);
      return safeReply(`👢 **${username}** kicked!\n📝 ${reason}`);
    }

    // ── /panel warn ──────────────────────────────────────────────
    else if (sub === "warn") {
      const reason  = options.getString("reason") || "Admin warning";
      let warning   = await safeDB(() => Warning.findOne({ username }));
      if (!warning) {
        warning = new Warning({ username, count: 1, reason, messages: [{ text: `[Admin] ${reason}`, date: new Date() }] });
      } else {
        warning.count += 1;
        warning.messages.push({ text: `[Admin] ${reason}`, date: new Date() });
        warning.lastWarningAt = new Date();
      }
      await safeDB(() => warning.save());

      const onlineUser = Object.values(activeUsers).find(u => u.name.toLowerCase() === username);
      if (onlineUser) io.to(onlineUser.socketId).emit("profanity_warning", { count: warning.count, message: `⚠️ Warning ${warning.count}/3: ${reason}` });

      if (warning.count >= 3) {
        bannedUsernames.add(username); saveBanned();
        const fbUid = onlineUser?.firebaseUid;
        if (fbUid) { bannedUids.add(fbUid); saveBannedUids(); }
        await safeDB(() => Banned.findOneAndUpdate(
          { username },
          { $set: { username, reason: "3 warnings", firebaseUid: fbUid||null }, $inc: { banCount: 1 }, $push: { banHistory: { action: "ban", reason: "3 warnings", by: "System", at: new Date() } } },
          { upsert: true, returnDocument: "after" }
        ));
        if (onlineUser) {
          io.to(onlineUser.socketId).emit("force_logout", "🚫 3 warnings — auto-ban!");
          setTimeout(() => { const s = io.sockets.sockets.get(onlineUser.socketId); if (s) s.disconnect(true); }, 500);
        }
        return safeReply(`🚫 **${username}** 3rd warning → AUTO-BAN!`);
      }
      return safeReply(`⚠️ **${username}** warning #${warning.count}/3\n📝 ${reason}`);
    }

    // ── /panel clearwarn ────────────────────────────────────────
    else if (sub === "clearwarn") {
      await safeDB(() => Warning.deleteOne({ username: { $regex: new RegExp("^" + username + "$", "i") } }));
      const onlineUser = Object.values(activeUsers).find(u => u.name.toLowerCase() === username);
      if (onlineUser) io.to(onlineUser.socketId).emit("profanity_warning", { count: 0, message: "✅ Warnings clear ho gayi." });
      return safeReply(`✅ **${username}** ki warnings clear!`);
    }

    // ── /panel list ─────────────────────────────────────────────
    else if (sub === "list") {
      await interaction.deferReply({ flags: 64 });
      const filter = options.getString("filter") || "";
      const query  = filter ? { $or: [{ username: { $regex: filter, $options: "i" } }, { ip: filter }] } : {};
      const users  = await safeDB(() => Banned.find(query).lean(), []);

      if (!users.length) return interaction.editReply("📭 Banned list khali.");

      const list = users.slice(0, 25).map((u, i) =>
        `**${i+1}.** \`${u.username}\` | 🌐 \`${u.ip||"N/A"}\` | 🔨 ${u.banCount||1}x`
      ).join("\n");

      const embed = new EmbedBuilder().setColor(0xff3c5f).setTitle(`🔨 Banned (${users.length})`).setDescription(list).setTimestamp();
      return interaction.editReply({ embeds: [embed] });
    }

    // ── /panel online ────────────────────────────────────────────
    else if (sub === "online") {
      const users = Object.values(activeUsers);
      if (!users.length) return safeReply("📭 Koi online nahi.");
      const list = users.map((u, i) => `**${i+1}.** ${u.name} | 🌐 \`${u.ip||"N/A"}\``).join("\n");
      const embed = new EmbedBuilder().setColor(0x00f5a0).setTitle(`🌐 Online (${users.length})`).setDescription(list.substring(0,2000)).setTimestamp();
      return safeEmbedReply(embed);
    }

    // ── /panel stats ─────────────────────────────────────────────
    else if (sub === "stats") {
      await interaction.deferReply({ flags: 64 });
      const [msgC, banC, warnC, repC, dmC, grpC] = await Promise.all([
        safeDB(() => Message.countDocuments(), 0),
        safeDB(() => Banned.countDocuments(), 0),
        safeDB(() => Warning.countDocuments(), 0),
        safeDB(() => Report.countDocuments(), 0),
        safeDB(() => DM.countDocuments(), 0),
        safeDB(() => Group.countDocuments(), 0),
      ]);
      const embed = new EmbedBuilder().setColor(0x5865f2).setTitle("📊 Server Stats")
        .addFields(
          { name: "🟢 Online",  value: String(Object.keys(activeUsers).length), inline: true },
          { name: "💬 Messages", value: String(msgC),  inline: true },
          { name: "🔨 Banned",   value: String(banC),  inline: true },
          { name: "⚠️ Warned",   value: String(warnC), inline: true },
          { name: "🚨 Reports",  value: String(repC),  inline: true },
          { name: "💌 DMs",      value: String(dmC),   inline: true },
          { name: "👥 Groups",   value: String(grpC),  inline: true },
          { name: "🗄️ MongoDB", value: mongoConnected ? "✅ Connected" : "❌ Down", inline: true },
          { name: "🔥 Firebase", value: firebaseAdminReady ? "✅ Active" : "❌ Off", inline: true },
        ).setTimestamp();
      return interaction.editReply({ embeds: [embed] });
    }

    // ── /panel ann ───────────────────────────────────────────────
    else if (sub === "ann") {
      const message = options.getString("message");
      await safeDB(() => new Announcement({ text: message, expiresAt: new Date(Date.now() + 24*60*60*1000) }).save());
      io.emit("announcement", { text: message, from: "Admin", createdAt: new Date() });
      sendEmbed(STATUS_CHANNEL_ID, { color: 0x00f5a0, title: "📢 Announcement", description: message });
      return safeReply(`📢 Sent: ${message}`);
    }

    // ── /panel vip ───────────────────────────────────────────────
    else if (sub === "vip") {
      const action = options.getString("action");
      if (action === "add") {
        vips.add(username); saveVips();
        await safeDB(() => Vip.updateOne({ username }, { username }, { upsert: true }));
        const u = Object.values(activeUsers).find(u => u.name.toLowerCase() === username);
        if (u) { u.isVip = true; io.emit("user list", buildUserList()); }
        return safeReply(`💎 **${username}** is now VIP!`);
      } else {
        vips.delete(username); saveVips();
        await safeDB(() => Vip.deleteOne({ username }));
        const u = Object.values(activeUsers).find(u => u.name.toLowerCase() === username);
        if (u) { u.isVip = false; io.emit("user list", buildUserList()); }
        return safeReply(`❌ VIP removed from **${username}**`);
      }
    }

    // ── /panel shadow ────────────────────────────────────────────
    else if (sub === "shadow") {
      if (shadowBanned.has(username)) { shadowBanned.delete(username); return safeReply(`👻 Shadow ban removed: **${username}**`); }
      else { shadowBanned.add(username); return safeReply(`👻 Shadow banned: **${username}**`); }
    }

    // ── /panel banuid ────────────────────────────────────────────
    else if (sub === "banuid") {
      const uid    = options.getString("uid")?.trim();
      const reason = options.getString("reason") || "Admin UID ban";
      if (!uid) return safeReply("❌ UID required hai.");
      bannedUids.add(uid); saveBannedUids();
      const onlineUser = Object.values(activeUsers).find(u => u.firebaseUid === uid);
      if (onlineUser) {
        bannedUsernames.add(onlineUser.name.toLowerCase()); saveBanned();
        io.to(onlineUser.socketId).emit("force_logout", `🚫 Firebase UID ban: ${reason}`);
        setTimeout(() => { const s = io.sockets.sockets.get(onlineUser.socketId); if (s) s.disconnect(true); }, 500);
      }
      await safeDB(() => Banned.findOneAndUpdate(
        { firebaseUid: uid },
        { $set: { firebaseUid: uid, username: onlineUser?.name?.toLowerCase() || "uid_" + uid.substring(0,8), reason }, $inc: { banCount: 1 }, $push: { banHistory: { action: "ban", reason, by: "Discord Admin (UID)", at: new Date() } } },
        { upsert: true, returnDocument: "after" }
      ));
      return safeReply(`🔥 UID \`${uid}\` banned!\n👤 User: ${onlineUser ? onlineUser.name : "Was offline"}`);
    }

  } catch (err) {
    console.error("❌ /panel error:", err);
    try {
      if (interaction.replied || interaction.deferred) await interaction.editReply("❌ Error: " + err.message.substring(0, 200));
      else await interaction.reply({ content: "❌ Error: " + err.message.substring(0, 200), flags: 64 });
    } catch (e) {}
  }
});

if (DISCORD_TOKEN) {
  discordClient.login(DISCORD_TOKEN).catch(err => console.error("❌ Discord login:", err.message));
}

// ══════════════════════════════════════════════════════════════════
// 🛠️ DISCORD HELPER FUNCTIONS
// ══════════════════════════════════════════════════════════════════
async function updateDiscordStatus() {
  if (!discordReady) return;
  try { discordClient.user?.setActivity(`${Object.keys(activeUsers).length} Online 🌐`, { type: ActivityType.Watching }); }
  catch (e) {}
}

async function sendEmbed(channelId, opts) {
  if (!discordReady || !channelId) return;
  try {
    const ch = discordClient.channels.cache.get(channelId);
    if (!ch) return;
    const embed = new EmbedBuilder().setColor(opts.color||0x00f5a0).setTitle(opts.title||"").setTimestamp().setFooter({ text: "HeyyYuki 2026" });
    if (opts.description) embed.setDescription(opts.description);
    if (opts.fields)      embed.addFields(opts.fields);
    ch.send({ embeds: [embed] });
  } catch (e) {}
}

async function logToDiscordError(msg, type = "error") {
  if (!discordReady || !ERROR_CHANNEL_ID) return;
  try {
    const ch = discordClient.channels.cache.get(ERROR_CHANNEL_ID);
    if (!ch) return;
    const colors = { error: 0xff3c5f, warn: 0xffd60a, info: 0x00f5a0 };
    const icons  = { error: "❌", warn: "⚠️", info: "ℹ️" };
    const embed  = new EmbedBuilder()
      .setColor(colors[type]||0xff3c5f).setTitle(`${icons[type]} ${type.toUpperCase()}`)
      .setDescription("```" + String(msg).substring(0,1900) + "```").setTimestamp()
      .setFooter({ text: "HeyyYuki Monitor" });
    ch.send({ embeds: [embed] });
  } catch (e) {}
}

// ══════════════════════════════════════════════════════════════════
// 🔌 SOCKET.IO
// ══════════════════════════════════════════════════════════════════
io.on("connection", socket => {
  const ipData    = getAllIPs(socket);
  const userIP    = ipData.primary;
  const userAgent = socket.handshake.headers["user-agent"] || "";
  const { browser, os, isMobile } = parseUserAgent(userAgent);
  let currentUser = null;

  // ── JOIN (Global Room) ───────────────────────────────────────────
  socket.on("join", async data => {
    try {
      const name          = (data.name   || "").trim();
      const bio           = (data.bio    || "No bio").trim();
      const avatar        = data.avatar  || "";
      const color         = data.color   || "#00f5a0";
      const firebaseToken = data.firebaseToken || null;
      const incognitoHint = data.incognitoHint || false;
      const nameLower     = name.toLowerCase();

      if (!name || name.length < 2) return socket.emit("error_msg", "Username kam se kam 2 characters ka ho");

      // Firebase token verify
      let firebaseUid = null, firebaseEmail = null;
      if (firebaseAdminReady && firebaseToken) {
        const decoded = await verifyFirebaseToken(firebaseToken);
        if (!decoded) return socket.emit("auth_error", "❌ Invalid session. Please login again.");
        firebaseUid   = decoded.uid;
        firebaseEmail = decoded.email || null;
        if (bannedUids.has(firebaseUid)) return socket.emit("duplicate", "🚫 Aapka account permanently ban ho chuka hai.");
      }

      // IP ban check
      if (tempBannedIPs.has(userIP)) {
        const ban = tempBannedIPs.get(userIP);
        if (Date.now() < ban.expiry) return socket.emit("duplicate", "🚫 Aap banned hain.");
        tempBannedIPs.delete(userIP);
      }

      // Username ban check
      if (bannedUsernames.has(nameLower)) return socket.emit("duplicate", "🚫 Aap permanently banned hain.");

      // Duplicate username check
      if (Object.values(activeUsers).find(u => u.name.toLowerCase() === nameLower)) {
        return socket.emit("duplicate", "⚠️ Ye username already liya hua hai.");
      }

      currentUser = {
        socketId: socket.id, name, bio, avatar, color, ip: userIP,
        firebaseUid, firebaseEmail,
        isVip:    isUserVip(nameLower),
        isAdmin:  isUserAdmin(nameLower),
        room:     "global",
      };
      activeUsers[socket.id] = currentUser;
      socket.join("global");

      // FIX 3: Session save sirf MongoDB connected hone par — buffering timeout fix
      if (mongoConnected) {
        try {
          await UserSession.findOneAndUpdate(
            { username: nameLower },
            {
              $set: { username: nameLower, firebaseUid, firebaseEmail, ip: userIP, forwardedFor: ipData.allForwarded.join(", ")||userIP, userAgent, browser, os, isMobile, incognitoHint, vpnDetected: ipData.vpnHint, lastSeen: new Date() },
              $setOnInsert: { connectedAt: new Date(), sessionCount: 0 },
            },
            { upsert: true, returnDocument: "after" }   // FIX 2: deprecated warning fix
          );
          await UserSession.updateOne({ username: nameLower }, { $inc: { sessionCount: 1 } });
        } catch (sessionErr) {
          console.error("Session save error:", sessionErr.message);
        }
      }

      // Message history
      const history = await safeDB(() => Message.find({ room: "global" }).sort({ createdAt: 1 }).limit(100).lean(), []);
      socket.emit("history", history.map(m => ({
        id: m._id.toString(), sender: m.senderName, message: m.text,
        type: m.type||"text", mediaUrl: m.mediaUrl, isVip: m.isVip, createdAt: m.createdAt,
      })));

      // Joined events
      io.to("global").emit("chat message", {
        id: "sys_" + Date.now(), sender: "System",
        message: `${name} joined`, type: "system", room: "global", createdAt: new Date(),
      });
      io.emit("user list", buildUserList());
      socket.emit("joined", currentUser);
      updateDiscordStatus();

      // Groups list
      const groups = await safeDB(() => Group.find({}).sort({ createdAt: -1 }).lean(), []);
      socket.emit("groups_list", groups.map(g => ({ ...g, hasPassword: !!g.password })));

      // Discord join log
      sendEmbed(JOIN_LEAVE_CHANNEL_ID, {
        color: 0x00f5a0, title: "🟢 User Joined",
        fields: [
          { name: "👤 Name",   value: `\`${name}\``,     inline: true },
          { name: "🌐 IP",     value: `\`${userIP}\``,   inline: true },
          { name: "🌏 Browser",value: browser,            inline: true },
          { name: "💾 OS",     value: os,                 inline: true },
          { name: "📱 Device", value: isMobile?"Mobile":"Desktop", inline: true },
        ],
      });

    } catch (err) {
      console.error("join error:", err);
      socket.emit("error_msg", "Join failed. Please try again.");
    }
  });

  // ── CHAT MESSAGE (Global) ────────────────────────────────────────
  socket.on("chat message", async data => {
    if (!currentUser) return;
    try {
      const room    = data.room    || "global";
      const message = data.message || "";

      // Profanity check
      if (data.type === "text" && containsProfanity(message)) {
        const nl = currentUser.name.toLowerCase();
        let warning = await safeDB(() => Warning.findOne({ username: nl }));
        if (!warning) {
          warning = new Warning({ username: nl, count: 1, reason: "Profanity", messages: [{ text: message, date: new Date() }] });
        } else {
          warning.count += 1;
          warning.messages.push({ text: message, date: new Date() });
          warning.lastWarningAt = new Date();
        }
        await safeDB(() => warning.save());

        if (warning.count >= 3) {
          bannedUsernames.add(nl); saveBanned();
          if (currentUser.firebaseUid) { bannedUids.add(currentUser.firebaseUid); saveBannedUids(); }
          await safeDB(() => Banned.findOneAndUpdate(
            { username: nl },
            { $set: { username: nl, firebaseUid: currentUser.firebaseUid||null, ip: currentUser.ip, reason: "3x Profanity" }, $inc: { banCount: 1 }, $push: { banHistory: { action: "ban", reason: "3 profanity warnings", by: "System", at: new Date() } } },
            { upsert: true, returnDocument: "after" }
          ));
          tempBannedIPs.set(currentUser.ip, { expiry: Date.now() + 999*365*24*60*60*1000, reservedName: currentUser.name });
          io.to(socket.id).emit("force_logout", "🚫 3 baar profanity — PERMANENT BAN!");
          setTimeout(() => { const s = io.sockets.sockets.get(socket.id); if (s) s.disconnect(true); }, 500);
          return;
        } else {
          io.to(socket.id).emit("profanity_warning", { count: warning.count, message: `⚠️ WARNING ${warning.count}/3: Galiyan mat use karo!` });
          return;
        }
      }

      const payload = {
        id:          data.id || genId(),
        sender:      currentUser.name,
        senderColor: currentUser.color,
        isVip:       currentUser.isVip,
        message, type: data.type||"text", caption: data.caption||"",
        mediaUrl:    data.mediaUrl||"",
        replyTo:     data.replyTo||null,
        room, createdAt: new Date(),
      };

      // Save to DB
      await safeDB(() => new Message({
        room, senderId: socket.id, senderName: currentUser.name,
        senderColor: currentUser.color, text: message,
        type: data.type||"text", mediaUrl: data.mediaUrl||"",
        isVip: currentUser.isVip,
      }).save());

      if (!shadowBanned.has(currentUser.name.toLowerCase())) io.to(room).emit("chat message", payload);
      else socket.emit("chat message", payload);

      // Discord mirror (global only)
      if (room === "global" && data.type === "text") {
        try {
          const ch = discordClient.channels.cache.get(CHAT_CHANNEL_ID);
          if (ch && discordReady) ch.send(`**${currentUser.name}:** ${message.substring(0, 1900)}`);
        } catch (e) {}
      }
    } catch (err) { console.error("chat message error:", err); }
  });

  // ── DELETE MESSAGE ───────────────────────────────────────────────
  socket.on("delete message", async id => {
    await safeDB(() => Message.findByIdAndDelete(id).catch(() => null));
    io.emit("delete message", id);
  });

  // ── CLEAR ALL (Admin) ────────────────────────────────────────────
  socket.on("manual_clear_all", async () => {
    if (!currentUser || !isUserAdmin(currentUser.name.toLowerCase())) {
      return socket.emit("error_msg", "Only admin can clear messages.");
    }
    await safeDB(() => Message.deleteMany({ room: "global" }));
    io.emit("messages_cleared", { room: "global" });
  });

  // ── TYPING ───────────────────────────────────────────────────────
  socket.on("typing", data => {
    if (!currentUser) return;
    socket.to(data?.room || "global").emit("typing", { user: currentUser.name });
  });

  // ── PRIVATE MESSAGE ──────────────────────────────────────────────
  socket.on("private message", async data => {
    if (!currentUser) return;
    try {
      const receiverName = data.receiver;
      const toUser       = Object.values(activeUsers).find(u => u.name.toLowerCase() === receiverName?.toLowerCase());
      const channelId    = getDMChannelId(currentUser.name, receiverName);

      let dmDoc = await safeDB(() => DM.findOne({ channelId }));
      if (!dmDoc) dmDoc = new DM({ channelId, participantNames: [currentUser.name, receiverName], messages: [] });

      dmDoc.messages.push({
        senderName: currentUser.name, senderColor: currentUser.color,
        text: data.message, type: data.type||"text", mediaUrl: data.mediaUrl||"", caption: data.caption||"", createdAt: new Date(),
      });
      dmDoc.updatedAt = new Date();
      await safeDB(() => dmDoc.save());

      const payload = {
        channelId, id: data.id || genId(), sender: currentUser.name,
        senderColor: currentUser.color, receiver: receiverName,
        message: data.message, type: data.type||"text",
        mediaUrl: data.mediaUrl||"", caption: data.caption||"", createdAt: new Date(),
      };

      socket.emit("private message", payload);
      if (toUser) io.to(toUser.socketId).emit("private message", payload);
    } catch (err) { console.error("private message error:", err); }
  });

  // ── DM HISTORY ───────────────────────────────────────────────────
  socket.on("dm_history", async ({ withUser }) => {
    if (!currentUser) return;
    const channelId = getDMChannelId(currentUser.name, withUser);
    const dmDoc     = await safeDB(() => DM.findOne({ channelId }).lean());
    const messages  = (dmDoc?.messages || []).map(m => ({
      sender: m.senderName, senderColor: m.senderColor, message: m.text,
      type: m.type, mediaUrl: m.mediaUrl, caption: m.caption||"", createdAt: m.createdAt,
    }));
    socket.emit("dm_history_data", { channelId, withUser, messages });
  });

  // ── DM TYPING ────────────────────────────────────────────────────
  socket.on("dm_typing", ({ toUser, isTyping }) => {
    if (!currentUser) return;
    const target = Object.values(activeUsers).find(u => u.name.toLowerCase() === toUser?.toLowerCase());
    if (target) io.to(target.socketId).emit("dm_typing_update", { fromUser: currentUser.name, isTyping });
  });

  // ══════════════════════════════════════════════════════════════════
  // 👥 GROUP CHATROOM — FIXED & COMPLETE
  // ══════════════════════════════════════════════════════════════════

  // ── CREATE GROUP ─────────────────────────────────────────────────
  socket.on("create_group", async ({ name, description, password, icon }) => {
    if (!currentUser) return;
    try {
      if (!name || name.trim().length < 2) return socket.emit("group_error", "Group name kam se kam 2 characters ka ho.");

      const group = new Group({
        name:        name.trim(),
        description: description || "",
        password:    password    || "",
        adminName:   currentUser.name,
        icon:        icon        || "👥",
        members:     [currentUser.name],
      });
      await safeDB(() => group.save());
      socket.emit("group_created", group);

      const groups = await safeDB(() => Group.find({}).sort({ createdAt: -1 }).lean(), []);
      io.emit("groups_list", groups.map(g => ({ ...g, hasPassword: !!g.password })));
    } catch (err) { console.error("create_group error:", err); socket.emit("group_error", "Group create nahi ho saki."); }
  });

  // ── GET GROUPS ───────────────────────────────────────────────────
  socket.on("get_groups", async () => {
    const groups = await safeDB(() => Group.find({}).sort({ createdAt: -1 }).lean(), []);
    socket.emit("groups_list", groups.map(g => ({ ...g, hasPassword: !!g.password })));
  });

  // ── JOIN GROUP ───────────────────────────────────────────────────
  socket.on("join_group", async ({ groupId, password }) => {
    if (!currentUser) return;
    try {
      const group = await safeDB(() => Group.findById(groupId));
      if (!group) return socket.emit("group_error", "Group nahi mili.");
      if (group.password && group.password !== password) return socket.emit("group_error", "❌ Wrong password.");

      const roomName = "group_" + groupId;

      // Previous group room se nikalo
      if (currentUser.room && currentUser.room !== "global") {
        const prevGroupId = currentUser.room.replace("group_", "");
        socket.leave(currentUser.room);
        if (activeGroups[prevGroupId]) {
          delete activeGroups[prevGroupId][socket.id];
          io.to(currentUser.room).emit("group_user_list", buildGroupUserList(prevGroupId));
          io.to(currentUser.room).emit("group_system_msg", { message: `${currentUser.name} left.`, groupId: prevGroupId });
        }
      }

      socket.join(roomName);
      currentUser.room = roomName;
      activeUsers[socket.id] = currentUser;

      // activeGroups mein add karo
      if (!activeGroups[groupId]) activeGroups[groupId] = {};
      activeGroups[groupId][socket.id] = currentUser;

      // Group members update
      if (!group.members.includes(currentUser.name)) {
        group.members.push(currentUser.name);
        await safeDB(() => group.save());
      }

      // History load
      const history = await safeDB(() => Message.find({ room: roomName }).sort({ createdAt: 1 }).limit(100).lean(), []);
      const normalizedHistory = history.map(m => ({
        id: m._id.toString(), sender: m.senderName, message: m.text,
        type: m.type||"text", mediaUrl: m.mediaUrl, isVip: m.isVip, createdAt: m.createdAt,
      }));

      socket.emit("group_joined", { group, history: normalizedHistory });

      // Group mein join announcement
      io.to(roomName).emit("group_system_msg", { message: `${currentUser.name} joined the group.`, groupId });

      // User list update
      io.to(roomName).emit("group_user_list", buildGroupUserList(groupId));

    } catch (err) { console.error("join_group error:", err); socket.emit("group_error", "Group join nahi ho saka."); }
  });

  // ── LEAVE GROUP ──────────────────────────────────────────────────
  socket.on("leave_group", async ({ groupId }) => {
    if (!currentUser) return;
    const roomName = "group_" + groupId;
    socket.leave(roomName);
    currentUser.room = "global";
    activeUsers[socket.id] = currentUser;
    if (activeGroups[groupId]) delete activeGroups[groupId][socket.id];
    io.to(roomName).emit("group_system_msg", { message: `${currentUser.name} left the group.`, groupId });
    io.to(roomName).emit("group_user_list", buildGroupUserList(groupId));
    socket.emit("group_left", { groupId });
  });

  // ── GROUP MESSAGE ────────────────────────────────────────────────
  socket.on("group_message", async data => {
    if (!currentUser) return;
    try {
      const { groupId, message, type = "text", mediaUrl = "", caption = "" } = data;
      const roomName = "group_" + groupId;

      if (!groupId || !message) return;

      // Profanity check for group too
      if (type === "text" && containsProfanity(message)) {
        socket.emit("profanity_warning", { count: 1, message: "⚠️ Galiyan mat use karo group mein!" });
        return;
      }

      const payload = {
        id:          genId(),
        groupId,
        sender:      currentUser.name,
        senderColor: currentUser.color,
        isVip:       currentUser.isVip,
        message, type, mediaUrl, caption,
        createdAt:   new Date(),
      };

      // DB mein save
      await safeDB(() => new Message({
        room: roomName, senderId: socket.id, senderName: currentUser.name,
        senderColor: currentUser.color, text: message, type, mediaUrl, isVip: currentUser.isVip,
      }).save());

      io.to(roomName).emit("group_message", payload);

    } catch (err) { console.error("group_message error:", err); }
  });

  // ── GROUP TYPING ─────────────────────────────────────────────────
  socket.on("group_typing", ({ groupId }) => {
    if (!currentUser || !groupId) return;
    socket.to("group_" + groupId).emit("group_typing_update", { user: currentUser.name, groupId });
  });

  // ── DELETE GROUP ─────────────────────────────────────────────────
  socket.on("delete_group", async ({ groupId }) => {
    if (!currentUser) return;
    try {
      const group = await safeDB(() => Group.findById(groupId));
      if (!group) return socket.emit("group_error", "Group nahi mili.");
      if (group.adminName.toLowerCase() !== currentUser.name.toLowerCase() && !isUserAdmin(currentUser.name.toLowerCase())) {
        return socket.emit("group_error", "Sirf group admin delete kar sakta hai.");
      }
      await safeDB(() => Group.findByIdAndDelete(groupId));
      await safeDB(() => Message.deleteMany({ room: "group_" + groupId }));

      io.to("group_" + groupId).emit("group_deleted", { groupId });

      const groups = await safeDB(() => Group.find({}).sort({ createdAt: -1 }).lean(), []);
      io.emit("groups_list", groups.map(g => ({ ...g, hasPassword: !!g.password })));
    } catch (err) { console.error("delete_group error:", err); }
  });

  // ── REPORT USER ──────────────────────────────────────────────────
  socket.on("report user", async data => {
    try {
      await safeDB(() => new Report({
        reportedUser:  data.reportedUser,
        reporterUser:  data.reportedBy || currentUser?.name,
        reporterEmail: data.email,
        category:      data.reason,
        reason:        data.description || data.reason,
        device:        isMobile ? "📱 Mobile" : "🖥️ Desktop",
      }).save());

      sendEmbed(REPORT_CHANNEL_ID, {
        color: 0xff3c5f, title: "🚨 New Report",
        fields: [
          { name: "Reported", value: `\`${data.reportedUser}\``,    inline: true },
          { name: "Reporter", value: `\`${data.reportedBy||"—"}\``, inline: true },
          { name: "Category", value: `\`${data.reason||"—"}\``,     inline: false },
          { name: "Details",  value: (data.description||"—").substring(0,1000), inline: false },
        ],
      });
      socket.emit("report_success");
    } catch (err) { socket.emit("report_error", "Report failed."); }
  });

  // ── PROFILE UPDATE ───────────────────────────────────────────────
  socket.on("update profile", ({ bio, avatar, color, name }) => {
    if (!currentUser) return;
    if (bio    !== undefined) currentUser.bio    = bio;
    if (avatar !== undefined) currentUser.avatar = avatar;
    if (color  !== undefined) currentUser.color  = color;
    if (name && name !== currentUser.name) {
      const nl  = name.toLowerCase();
      const dup = Object.values(activeUsers).find(u => u.name.toLowerCase() === nl && u.socketId !== socket.id);
      if (!dup) currentUser.name = name;
    }
    activeUsers[socket.id] = currentUser;
    io.emit("user list", buildUserList());
    socket.emit("profile_updated", currentUser);
  });

  // ── DISCONNECT ───────────────────────────────────────────────────
  socket.on("disconnect", () => {
    if (!currentUser) return;

    // Group cleanup
    if (currentUser.room && currentUser.room.startsWith("group_")) {
      const groupId = currentUser.room.replace("group_", "");
      if (activeGroups[groupId]) {
        delete activeGroups[groupId][socket.id];
        io.to(currentUser.room).emit("group_system_msg", { message: `${currentUser.name} left.`, groupId });
        io.to(currentUser.room).emit("group_user_list", buildGroupUserList(groupId));
      }
    }

    io.to("global").emit("chat message", {
      id: "sys_" + Date.now(), sender: "System",
      message: `${currentUser.name} left`, type: "system",
      room: "global", createdAt: new Date(),
    });

    safeDB(() => UserSession.updateOne({ username: currentUser.name.toLowerCase() }, { $set: { lastSeen: new Date() } }));

    delete activeUsers[socket.id];
    io.emit("user list", buildUserList());
    updateDiscordStatus();
  });
});

// ══════════════════════════════════════════════════════════════════
// 🌐 REST API
// ══════════════════════════════════════════════════════════════════
app.use(express.json({ limit: "10mb" }));
app.use(express.static(path.join(__dirname, "public"), { extensions: ["html", "htm"] }));

app.get("/",                    (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
app.get("/iframe-groupchatroom",(req, res) => res.sendFile(path.join(__dirname, "public", "groupchatroom.html")));
app.get("/admin",               (req, res) => res.sendFile(path.join(__dirname, "public", "admin.html")));

app.get("/health", (req, res) => res.json({
  status: "ok",
  online: Object.keys(activeUsers).length,
  discord: discordReady, mongo: mongoConnected ? "connected" : "disconnected",
  firebaseAdmin: firebaseAdminReady,
}));

app.post("/api/report", async (req, res) => {
  try {
    const device = /Mobi|Android/i.test(req.headers["user-agent"]||"") ? "📱 Mobile" : "🖥️ Desktop";
    await safeDB(() => new Report({ ...req.body, device }).save());
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ ok: false }); }
});

app.get("/api/session/:username", async (req, res) => {
  const session = await safeDB(() => UserSession.findOne({ username: { $regex: new RegExp("^" + req.params.username + "$", "i") } }).lean());
  if (!session) return res.status(404).json({ error: "Not found" });
  res.json(session);
});

// ── Admin REST API ────────────────────────────────────────────────
function requireAdmin(req, res, next) {
  const token = req.headers["x-admin-token"] || req.query.token;
  if (token !== PANEL_PASSWORD) return res.status(401).json({ error: "Unauthorized" });
  next();
}

app.get("/api/admin/stats", requireAdmin, async (req, res) => {
  const [msgC, banC, warnC, repC, dmC, grpC] = await Promise.all([
    safeDB(() => Message.countDocuments(), 0),
    safeDB(() => Banned.countDocuments(), 0),
    safeDB(() => Warning.countDocuments(), 0),
    safeDB(() => Report.countDocuments(), 0),
    safeDB(() => DM.countDocuments(), 0),
    safeDB(() => Group.countDocuments(), 0),
  ]);
  res.json({ online: Object.keys(activeUsers).length, messages: msgC, banned: banC, warned: warnC, reports: repC, dms: dmC, groups: grpC, discord: discordReady, firebaseAdmin: firebaseAdminReady, mongo: mongoConnected ? "connected" : "disconnected" });
});

app.get("/api/admin/online",  requireAdmin, (req, res) => res.json(Object.values(activeUsers).map(u => ({ name: u.name, ip: u.ip, firebaseUid: u.firebaseUid, isVip: u.isVip, isAdmin: u.isAdmin, room: u.room }))));

app.get("/api/admin/banned",  requireAdmin, async (req, res) => {
  const filter = req.query.filter || "";
  const query  = filter ? { $or: [{ username: { $regex: filter, $options: "i" } }, { ip: filter }] } : {};
  res.json(await safeDB(() => Banned.find(query).sort({ _id: -1 }).limit(100).lean(), []));
});

app.get("/api/admin/warnings", requireAdmin, async (req, res) => res.json(await safeDB(() => Warning.find({}).sort({ count: -1 }).limit(50).lean(), [])));
app.get("/api/admin/reports",  requireAdmin, async (req, res) => res.json(await safeDB(() => Report.find({}).sort({ createdAt: -1 }).limit(50).lean(), [])));
app.get("/api/admin/messages", requireAdmin, async (req, res) => res.json((await safeDB(() => Message.find({ room: "global" }).sort({ createdAt: -1 }).limit(50).lean(), [])).reverse()));

app.get("/api/admin/user/:username", requireAdmin, async (req, res) => {
  const uname   = req.params.username.toLowerCase();
  const regex   = new RegExp("^" + uname + "$", "i");
  const [session, banRecord, warnRecord] = await Promise.all([
    safeDB(() => UserSession.findOne({ username: regex }).sort({ lastSeen: -1 }).lean()),
    safeDB(() => Banned.findOne({ username: regex }).lean()),
    safeDB(() => Warning.findOne({ username: regex }).lean()),
  ]);
  const onlineUser = Object.values(activeUsers).find(u => u.name.toLowerCase() === uname);
  res.json({ username: uname, online: !!onlineUser, isVip: isUserVip(uname), isAdmin: isUserAdmin(uname), isBanned: bannedUsernames.has(uname)||!!banRecord, session, ban: banRecord, warning: warnRecord, liveData: onlineUser ? { ip: onlineUser.ip, room: onlineUser.room } : null });
});

app.post("/api/admin/ban", requireAdmin, async (req, res) => {
  try {
    const { username, reason = "Admin ban" } = req.body;
    if (!username) return res.status(400).json({ error: "Username required" });
    const uname      = username.toLowerCase();
    bannedUsernames.add(uname); saveBanned();
    const onlineUser = Object.values(activeUsers).find(u => u.name.toLowerCase() === uname);
    const session    = await safeDB(() => UserSession.findOne({ username: { $regex: new RegExp("^" + uname + "$", "i") } }).lean());
    const fbUid      = onlineUser?.firebaseUid || session?.firebaseUid;
    if (fbUid) { bannedUids.add(fbUid); saveBannedUids(); }
    await safeDB(() => Banned.findOneAndUpdate(
      { username: uname },
      { $set: { username: uname, ip: onlineUser?.ip||session?.ip||"Unknown", reason, firebaseUid: fbUid||null }, $inc: { banCount: 1 }, $push: { banHistory: { action: "ban", reason, by: "Web Panel", at: new Date() } } },
      { upsert: true, returnDocument: "after" }
    ));
    if (onlineUser) {
      io.to(onlineUser.socketId).emit("force_logout", `🚫 Ban: ${reason}`);
      setTimeout(() => { const s = io.sockets.sockets.get(onlineUser.socketId); if (s) s.disconnect(true); }, 500);
      if (onlineUser.ip) tempBannedIPs.set(onlineUser.ip, { expiry: Date.now() + 999*365*24*60*60*1000, reservedName: uname });
    }
    res.json({ ok: true, uidAlsoBanned: !!fbUid });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/admin/unban", requireAdmin, async (req, res) => {
  try {
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: "Username required" });
    const uname  = username.toLowerCase();
    bannedUsernames.delete(uname); saveBanned();
    const banDoc = await safeDB(() => Banned.findOne({ username: uname }));
    if (banDoc) {
      if (banDoc.firebaseUid) { bannedUids.delete(banDoc.firebaseUid); saveBannedUids(); }
      banDoc.unbanCount = (banDoc.unbanCount||0) + 1;
      banDoc.banHistory.push({ action: "unban", reason: "Web Panel", by: "Web Admin Panel", at: new Date() });
      await safeDB(() => banDoc.save());
      if (banDoc.ip) tempBannedIPs.delete(banDoc.ip);
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/admin/kick", requireAdmin, (req, res) => {
  const { username, reason = "Admin kick" } = req.body;
  if (!username) return res.status(400).json({ error: "Username required" });
  const onlineUser = Object.values(activeUsers).find(u => u.name.toLowerCase() === username.toLowerCase());
  if (!onlineUser) return res.status(404).json({ error: "Not online" });
  io.to(onlineUser.socketId).emit("force_logout", `👢 Kick: ${reason}`);
  setTimeout(() => { const s = io.sockets.sockets.get(onlineUser.socketId); if (s) s.disconnect(true); }, 500);
  res.json({ ok: true });
});

app.post("/api/admin/warn", requireAdmin, async (req, res) => {
  try {
    const { username, reason = "Admin warning" } = req.body;
    if (!username) return res.status(400).json({ error: "Username required" });
    const uname   = username.toLowerCase();
    let warning   = await safeDB(() => Warning.findOne({ username: uname }));
    if (!warning) warning = new Warning({ username: uname, count: 1, reason, messages: [{ text: `[Admin] ${reason}`, date: new Date() }] });
    else { warning.count += 1; warning.messages.push({ text: `[Admin] ${reason}`, date: new Date() }); warning.lastWarningAt = new Date(); }
    await safeDB(() => warning.save());
    const onlineUser = Object.values(activeUsers).find(u => u.name.toLowerCase() === uname);
    if (onlineUser) io.to(onlineUser.socketId).emit("profanity_warning", { count: warning.count, message: `⚠️ Warning ${warning.count}/3: ${reason}` });
    if (warning.count >= 3) {
      bannedUsernames.add(uname); saveBanned();
      const fbUid = onlineUser?.firebaseUid;
      if (fbUid) { bannedUids.add(fbUid); saveBannedUids(); }
      await safeDB(() => Banned.findOneAndUpdate({ username: uname }, { $set: { username: uname, reason: "3 warnings", firebaseUid: fbUid||null }, $inc: { banCount: 1 }, $push: { banHistory: { action: "ban", reason: "3 warnings auto", by: "System", at: new Date() } } }, { upsert: true, returnDocument: "after" }));
      if (onlineUser) {
        io.to(onlineUser.socketId).emit("force_logout", "🚫 3 warnings — auto-ban!");
        setTimeout(() => { const s = io.sockets.sockets.get(onlineUser.socketId); if (s) s.disconnect(true); }, 500);
      }
      return res.json({ ok: true, autoBanned: true });
    }
    res.json({ ok: true, autoBanned: false, count: warning.count });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/admin/clearwarn", requireAdmin, async (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: "Username required" });
  await safeDB(() => Warning.deleteOne({ username: username.toLowerCase() }));
  const onlineUser = Object.values(activeUsers).find(u => u.name.toLowerCase() === username.toLowerCase());
  if (onlineUser) io.to(onlineUser.socketId).emit("profanity_warning", { count: 0, message: "✅ Warnings clear." });
  res.json({ ok: true });
});

app.post("/api/admin/announce", requireAdmin, async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: "Message required" });
  await safeDB(() => new Announcement({ text: message, expiresAt: new Date(Date.now() + 24*60*60*1000) }).save());
  io.emit("announcement", { text: message, from: "Admin", createdAt: new Date() });
  sendEmbed(STATUS_CHANNEL_ID, { color: 0x00f5a0, title: "📢 Announcement", description: message });
  res.json({ ok: true });
});

app.post("/api/admin/vip", requireAdmin, async (req, res) => {
  const { username, action } = req.body;
  if (!username || !action) return res.status(400).json({ error: "username & action required" });
  const uname = username.toLowerCase();
  if (action === "add") {
    vips.add(uname); saveVips();
    await safeDB(() => Vip.updateOne({ username: uname }, { username: uname }, { upsert: true }));
  } else {
    vips.delete(uname); saveVips();
    await safeDB(() => Vip.deleteOne({ username: uname }));
  }
  const u = Object.values(activeUsers).find(u => u.name.toLowerCase() === uname);
  if (u) { u.isVip = action === "add"; io.emit("user list", buildUserList()); }
  res.json({ ok: true });
});

app.post("/api/admin/shadow", requireAdmin, (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: "Username required" });
  const uname = username.toLowerCase();
  if (shadowBanned.has(uname)) { shadowBanned.delete(uname); res.json({ ok: true, shadow: false }); }
  else { shadowBanned.add(uname); res.json({ ok: true, shadow: true }); }
});

app.post("/api/admin/deletemsgs", requireAdmin, async (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: "Username required" });
  const result = await safeDB(() => Message.deleteMany({ senderName: { $regex: new RegExp("^" + username + "$", "i") } }), { deletedCount: 0 });
  io.emit("reload_messages");
  res.json({ ok: true, deleted: result?.deletedCount || 0 });
});

app.post("/api/admin/banuid", requireAdmin, async (req, res) => {
  const { uid, reason = "Admin UID ban" } = req.body;
  if (!uid) return res.status(400).json({ error: "UID required" });
  bannedUids.add(uid); saveBannedUids();
  const onlineUser = Object.values(activeUsers).find(u => u.firebaseUid === uid);
  if (onlineUser) {
    bannedUsernames.add(onlineUser.name.toLowerCase()); saveBanned();
    io.to(onlineUser.socketId).emit("force_logout", `🚫 UID Ban: ${reason}`);
    setTimeout(() => { const s = io.sockets.sockets.get(onlineUser.socketId); if (s) s.disconnect(true); }, 500);
  }
  await safeDB(() => Banned.findOneAndUpdate(
    { firebaseUid: uid },
    { $set: { firebaseUid: uid, username: onlineUser?.name?.toLowerCase() || "uid_" + uid.substring(0,8), reason }, $inc: { banCount: 1 }, $push: { banHistory: { action: "ban", reason, by: "Web Panel (UID)", at: new Date() } } },
    { upsert: true, returnDocument: "after" }
  ));
  res.json({ ok: true, userWasOnline: !!onlineUser });
});

// ══════════════════════════════════════════════════════════════════
// 🚀 START SERVER
// ══════════════════════════════════════════════════════════════════
async function startServer() {
  // FIX: MongoDB connect karo PEHLE, phir server start karo
  await connectMongoDB();

  http.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📋 Admin: ${ADMIN_NAME}`);
    console.log(`🔥 Firebase Admin: ${firebaseAdminReady ? "ACTIVE" : "DISABLED"}`);
    console.log(`🚨 Profanity detection: ACTIVE`);
    console.log(`🎛️  /panel command: ACTIVE`);
    console.log(`🗄️  MongoDB: ${mongoConnected ? "✅ Connected" : "❌ Disconnected (server still works)"}`);
  });
}

startServer();

// ══════════════════════════════════════════════════════════════════
// 🛡️ CRASH PROTECTION
// ══════════════════════════════════════════════════════════════════
process.on("unhandledRejection", err => {
  console.error("⚠️ Unhandled Rejection:", err?.message || err);
  logToDiscordErrorSafe(`💥 Unhandled Rejection:\n${String(err).substring(0, 1500)}`);
});

process.on("uncaughtException", err => {
  console.error("⚠️ Uncaught Exception:", err.message);
  logToDiscordErrorSafe(`💥 Uncaught Exception:\n${err.message}`);
});
