// ╔══════════════════════════════════════════════════════════════════╗
// ║   StrangerToStranger — HeyyYuki Powered Server v6.0             ║
// ║   Firebase Auth + /panel + VPN Detection + Full User Intel      ║
// ║   Profanity | Warnings | DM Persistence | 2026                  ║
// ╚══════════════════════════════════════════════════════════════════╝

require("dotenv").config();
const express    = require("express");
const app        = express();
const http       = require("http").createServer(app);
const io         = require("socket.io")(http, { cors: { origin: "*" } });
const path       = require("path");
const fs         = require("fs");
const mongoose   = require("mongoose");
const admin      = require("firebase-admin"); // 🆕 Firebase Admin SDK

const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActivityType,
  REST,
  Routes,
  SlashCommandBuilder,
} = require("discord.js");

// ══════════════════════════════════════════════════════════════════
// 🔑 CONFIGURATION
// ══════════════════════════════════════════════════════════════════
const MONGO_URI =
  process.env.MONGO_URI ||
  "mongodb+srv://yashwantsingh2046_db_user:Yashu2046@db.avouoxu.mongodb.net/?appName=db";
const CLIENT_ID    = process.env.CLIENT_ID    || "1478767384398528573";
const DISCORD_TOKEN= process.env.DISCORD_TOKEN|| "";

const CONTROL_CHANNEL_IDS  = ["1506573109728247848"];
const GUILD_ID             = "1485522389403173004";

const STATUS_CHANNEL_ID    = process.env.STATUS_CHANNEL_ID    || "1506573109728247848";
const CHAT_CHANNEL_ID      = process.env.CHAT_CHANNEL_ID      || "1506240430260621312";
const MEDIA_LOG_CHANNEL_ID = process.env.MEDIA_LOG_CHANNEL_ID || "1506573109728247848";
const JOIN_LEAVE_CHANNEL_ID= process.env.JOIN_LEAVE_CHANNEL_ID|| "1506240499361775707";
const MOD_LOG_CHANNEL_ID   = process.env.MOD_LOG_CHANNEL_ID   || "1506573109728247848";
const VIP_LOG_CHANNEL_ID   = process.env.VIP_LOG_CHANNEL_ID   || "1506573109728247848";
const REPORT_CHANNEL_ID    = process.env.REPORT_CHANNEL_ID    || "1506573109728247848";
const ERROR_CHANNEL_ID     = process.env.ERROR_CHANNEL_ID     || "1506240662381658162";
const PROFANITY_CHANNEL_ID = process.env.PROFANITY_CHANNEL_ID || REPORT_CHANNEL_ID;
const BANNED_LOG_CHANNEL_ID= process.env.BANNED_LOG_CHANNEL_ID|| "1512753547765223632";

const ADMIN_NAME    = process.env.ADMIN_NAME    || "Yashwant";
const PORT          = process.env.PORT          || 4000;
const PANEL_PASSWORD= process.env.PANEL_PASSWORD|| "heyuki2026";

// ══════════════════════════════════════════════════════════════════
// 🔥 FIREBASE ADMIN SDK INIT
// ══════════════════════════════════════════════════════════════════
// 
// SETUP INSTRUCTIONS:
// 1. Firebase Console → Project Settings → Service Accounts
// 2. "Generate New Private Key" → JSON file download karo
// 3. Us file ko "firebase-service-account.json" naam do
//    aur is server.js ke saath same folder mein rakho
// 4. YA phir .env mein FIREBASE_SERVICE_ACCOUNT_JSON set karo
//    (JSON content ko single line string mein convert karke)
//
let firebaseAdminReady = false;
try {
  let serviceAccount;

  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    // ENV variable se (production/Glitch ke liye recommended)
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  } else if (fs.existsSync(path.join(__dirname, "firebase-service-account.json"))) {
    // Local file se
    serviceAccount = require("./firebase-service-account.json");
  }

  if (serviceAccount) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    firebaseAdminReady = true;
    console.log("✅ Firebase Admin SDK initialized");
  } else {
    console.warn("⚠️  Firebase service account not found — token verification disabled");
    console.warn("    Place firebase-service-account.json in project root, or set FIREBASE_SERVICE_ACCOUNT_JSON env var");
  }
} catch (err) {
  console.error("❌ Firebase Admin init error:", err.message);
}

// ── Firebase Token Verify Helper ─────────────────────────────────
// Returns decoded token { uid, email, name, ... } or null
async function verifyFirebaseToken(idToken) {
  if (!firebaseAdminReady || !idToken) return null;
  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    return decoded;
  } catch (err) {
    return null;
  }
}

// ══════════════════════════════════════════════════════════════════
// 🧠 PROFANITY DETECTION
// ══════════════════════════════════════════════════════════════════
const PROFANITY_WORDS = new Set([
  // Hindi/Hinglish
  "gandu","gaandu","madarchod","behenchod","bhaanchod","lavda","lund",
  "chutiya","chutia","chutiye","bhag","sala","salle","saala","mc","bc",
  "randi","kutti","kutty","kutiya","kuthi","kamina","kamine","nalayak",
  "besharam","aayashi","gaali","gaaliyan","saand","bewakoof","bakwas",
  "jhooth","jhuthe","naakaara","napunsak",
  // English
  "fuck","shit","ass","bitch","bastard","damn","crap","whore","asshole",
  "dickhead","motherfucker","arsehole","dumbass","prick","bloody","cunt",
  "twat","wanker","bollocks","bugger","arse","cock","dick","pussy","slut",
  "screw",
  // Abbreviations
  "wtf","stfu","ffs","gtfo",
]);

function containsProfanity(text) {
  const words = text.toLowerCase().split(/\s+/);
  return words.some((word) => {
    const cleanWord = word.replace(/[.,!?;:'"()-]/g, "");
    return PROFANITY_WORDS.has(cleanWord);
  });
}

// ══════════════════════════════════════════════════════════════════
// 📦 MONGODB CONNECTION
// ══════════════════════════════════════════════════════════════════
mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log("✅ MongoDB Connected");
    logToDiscordErrorSafe("✅ MongoDB Connected — Server Online", "info");
  })
  .catch((err) => {
    console.error("❌ MongoDB Error:", err.message);
  });

// ══════════════════════════════════════════════════════════════════
// 📋 MONGODB SCHEMAS
// ══════════════════════════════════════════════════════════════════
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
  messages: [{
    senderName:  String,
    senderAvatar:String,
    senderColor: String,
    text:        String,
    mediaUrl:    String,
    type:        { type: String, default: "text" },
    caption:     String,
    createdAt:   { type: Date, default: Date.now },
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
const Announcement =
  mongoose.models.Announcement || mongoose.model("Announcement", AnnouncementSchema);

const BanSchema = new mongoose.Schema({
  username:    { type: String, unique: true },
  firebaseUid: { type: String, index: true }, // 🆕 Firebase UID se ban track
  ip:          { type: String },
  forwardedIp: { type: String },
  reason:      { type: String, default: "Profanity/Abuse" },
  country:     { type: String, default: "Unknown" },
  banCount:    { type: Number, default: 1 },
  unbanCount:  { type: Number, default: 0 },
  banHistory:  [{
    action: { type: String, enum: ["ban","unban"] },
    reason: String,
    by:     String,
    at:     { type: Date, default: Date.now },
  }],
});
const Banned = mongoose.model("Banned", BanSchema);

const SessionSchema = new mongoose.Schema({
  username:      { type: String, index: true },
  firebaseUid:   { type: String, index: true },  // 🆕 Firebase UID
  firebaseEmail: { type: String },               // 🆕 Firebase email
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
const BANNED_FILE = path.join(__dirname, "banned-usernames.json");
const VIPS_FILE   = path.join(__dirname, "vip-users.json");
const ADMINS_FILE = path.join(__dirname, "admin-users.json");

// 🆕 Firebase UID ban list (IP ban ki tarah, UID se bhi ban)
const BANNED_UIDS_FILE = path.join(__dirname, "banned-uids.json");

let bannedUsernames = new Set();
let bannedUids      = new Set(); // 🆕
let vips            = new Set();
let admins          = new Set();

function loadJSON(file) {
  try { return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : []; }
  catch (e) { return []; }
}

bannedUsernames = new Set(loadJSON(BANNED_FILE));
bannedUids      = new Set(loadJSON(BANNED_UIDS_FILE)); // 🆕
vips            = new Set(loadJSON(VIPS_FILE));
admins          = new Set(loadJSON(ADMINS_FILE));

function saveBanned()     { fs.writeFileSync(BANNED_FILE,      JSON.stringify([...bannedUsernames])); }
function saveBannedUids() { fs.writeFileSync(BANNED_UIDS_FILE, JSON.stringify([...bannedUids])); } // 🆕
function saveVips()       { fs.writeFileSync(VIPS_FILE,        JSON.stringify([...vips])); }
function saveAdmins()     { fs.writeFileSync(ADMINS_FILE,      JSON.stringify([...admins])); }

// ══════════════════════════════════════════════════════════════════
// 🧠 IN-MEMORY STATE
// ══════════════════════════════════════════════════════════════════
const activeUsers   = {};
const tempBannedIPs = new Map();
const shadowBanned  = new Set();

// ══════════════════════════════════════════════════════════════════
// 🛠️ UTILITY HELPERS
// ══════════════════════════════════════════════════════════════════
function genId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

function getAllIPs(socket) {
  const forwarded = socket.handshake.headers["x-forwarded-for"] || "";
  const real      = socket.handshake.headers["x-real-ip"] || "";
  const direct    = socket.handshake.address || "127.0.0.1";

  const forwardedList = forwarded.split(",").map(ip => ip.trim()).filter(Boolean);
  const primaryIP     = forwardedList[0] || real || direct;
  const lastHopIP     = forwardedList[forwardedList.length - 1] || direct;
  const vpnHint       = forwardedList.length > 1;

  return { primary: primaryIP, lastHop: lastHopIP, allForwarded: forwardedList, realHeader: real, directSocket: direct, vpnHint };
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
  else if (/Macintosh/i.test(ua) && !/iPhone/i.test(ua)) os = "macOS";
  else if (/Linux/i.test(ua))        os = "Linux";
  else if (/CrOS/i.test(ua))         os = "Chrome OS";

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
  return Object.values(activeUsers).map((u) => {
    const nameLower   = u.name.toLowerCase();
    const userIsAdmin = isUserAdmin(nameLower);
    const userIsVip   = isUserVip(nameLower);
    let displayName   = u.name;

    if (userIsAdmin)    displayName = "👑 " + displayName;
    else if (userIsVip) displayName = displayName + " 💎";

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

function logToDiscordErrorSafe(msg, type = "error") {
  if (typeof logToDiscordError === "function" && discordReady) {
    logToDiscordError(msg, type);
  }
}

// ══════════════════════════════════════════════════════════════════
// 🤖 DISCORD BOT SETUP
// ══════════════════════════════════════════════════════════════════
const discordClient = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

let discordReady = false;

// ══════════════════════════════════════════════════════════════════
// 📜 SLASH COMMANDS DEFINITION
// ══════════════════════════════════════════════════════════════════
const commands = [
  new SlashCommandBuilder()
    .setName("panel")
    .setDescription("🎛️ Master Admin Panel")
    .addSubcommand(sub =>
      sub.setName("user")
         .setDescription("👤 User ki poori details")
         .addStringOption(o => o.setName("username").setDescription("Username").setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName("ban")
         .setDescription("🔨 User ko permanently ban karo")
         .addStringOption(o => o.setName("username").setDescription("Username").setRequired(true))
         .addStringOption(o => o.setName("reason").setDescription("Reason"))
    )
    .addSubcommand(sub =>
      sub.setName("unban")
         .setDescription("✅ User ko unban karo")
         .addStringOption(o => o.setName("username").setDescription("Username").setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName("kick")
         .setDescription("👢 Online user ko kick karo")
         .addStringOption(o => o.setName("username").setDescription("Username").setRequired(true))
         .addStringOption(o => o.setName("reason").setDescription("Reason"))
    )
    .addSubcommand(sub =>
      sub.setName("warn")
         .setDescription("⚠️ User ko warning do")
         .addStringOption(o => o.setName("username").setDescription("Username").setRequired(true))
         .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName("clearwarn")
         .setDescription("🧹 User ki warnings clear karo")
         .addStringOption(o => o.setName("username").setDescription("Username").setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName("list")
         .setDescription("📋 Banned users ki list")
         .addStringOption(o => o.setName("filter").setDescription("Filter (optional)"))
    )
    .addSubcommand(sub => sub.setName("online").setDescription("🌐 Online users"))
    .addSubcommand(sub => sub.setName("stats").setDescription("📊 Server stats"))
    .addSubcommand(sub =>
      sub.setName("ann")
         .setDescription("📢 Announcement bhejo")
         .addStringOption(o => o.setName("message").setDescription("Message").setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName("vip")
         .setDescription("💎 VIP manage karo")
         .addStringOption(o => o.setName("username").setDescription("Username").setRequired(true))
         .addStringOption(o =>
           o.setName("action").setDescription("add/remove").setRequired(true)
            .addChoices({ name: "Add VIP", value: "add" }, { name: "Remove VIP", value: "remove" })
         )
    )
    .addSubcommand(sub =>
      sub.setName("shadow")
         .setDescription("👻 Shadow ban toggle")
         .addStringOption(o => o.setName("username").setDescription("Username").setRequired(true))
    )
    // 🆕 Firebase UID se ban
    .addSubcommand(sub =>
      sub.setName("banuid")
         .setDescription("🔥 Firebase UID se ban karo (bypasses username change)")
         .addStringOption(o => o.setName("uid").setDescription("Firebase UID").setRequired(true))
         .addStringOption(o => o.setName("reason").setDescription("Reason"))
    )
].map(c => c.toJSON());

if (DISCORD_TOKEN) {
  const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);
  (async () => {
    try {
      await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
      console.log("✅ /panel slash commands registered");
    } catch (e) {
      console.error("❌ Slash command register error:", e.message);
    }
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
  logToDiscordError("🤖 HeyyYuki Bot v6.0 Started — Firebase Auth + /panel active", "info");
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

// ══════════════════════════════════════════════════════════════════
// 🎛️ /panel INTERACTION HANDLER
// ══════════════════════════════════════════════════════════════════
discordClient.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (!CONTROL_CHANNEL_IDS.includes(interaction.channelId)) return;
  if (interaction.commandName !== "panel") return;

  const { options } = interaction;

  const safeReply = async (content) => {
    try {
      if (interaction.replied || interaction.deferred) {
        await interaction.editReply({ content: content.substring(0, 2000) });
      } else {
        await interaction.reply({ content: content.substring(0, 2000), flags: 64 });
      }
    } catch (e) {}
  };

  const safeEmbedReply = async (embed) => {
    try {
      if (interaction.replied || interaction.deferred) {
        await interaction.editReply({ embeds: [embed] });
      } else {
        await interaction.reply({ embeds: [embed], flags: 64 });
      }
    } catch (e) {}
  };

  try {
    const sub      = options.getSubcommand();
    const username = options.getString("username")?.trim().toLowerCase();

    // ─── /panel user ─────────────────────────────────────────────
    if (sub === "user") {
      await interaction.deferReply({ flags: 64 });

      const session    = await UserSession.findOne({ username: { $regex: new RegExp("^" + username + "$", "i") } }).sort({ lastSeen: -1 }).lean();
      const banRecord  = await Banned.findOne({ username: { $regex: new RegExp("^" + username + "$", "i") } }).lean();
      const warnRecord = await Warning.findOne({ username: { $regex: new RegExp("^" + username + "$", "i") } }).lean();
      const onlineUser = Object.values(activeUsers).find(u => u.name.toLowerCase() === username);

      const isBanned = bannedUsernames.has(username) || !!banRecord;
      const isOnline = !!onlineUser;
      const isVip    = isUserVip(username);
      const isAdmin  = isUserAdmin(username);

      let vpnStatus = "❓ Data nahi", realIP = "N/A", proxyIP = "N/A";
      let browserInfo = "N/A", osInfo = "N/A", mobileInfo = "N/A", incognito = "N/A";
      let firebaseEmail = "N/A", firebaseUid = "N/A";

      if (session) {
        realIP      = session.ip          || "Unknown";
        proxyIP     = (session.forwardedFor && session.forwardedFor !== session.ip) ? session.forwardedFor : "—";
        vpnStatus   = session.vpnDetected ? "🔴 VPN/Proxy DETECTED" : session.forwardedFor && session.forwardedFor !== session.ip ? "🟡 Possible Proxy" : "🟢 No VPN";
        browserInfo = session.browser     || "Unknown";
        osInfo      = session.os          || "Unknown";
        mobileInfo  = session.isMobile    ? "📱 Mobile" : "🖥️ Desktop";
        incognito   = session.incognitoHint ? "🕵️ Incognito Detected" : "🌐 Normal Mode";
        // 🆕 Firebase data
        firebaseEmail = session.firebaseEmail || "N/A";
        firebaseUid   = session.firebaseUid   || "N/A";
      } else if (onlineUser) {
        realIP          = onlineUser.ip           || "Unknown";
        firebaseUid     = onlineUser.firebaseUid  || "N/A";
        firebaseEmail   = onlineUser.firebaseEmail|| "N/A";
        vpnStatus       = "⚠️ Session DB mein nahi";
      }

      let banHistoryText = "Kabhi ban nahi hua";
      if (banRecord?.banHistory?.length) {
        banHistoryText = banRecord.banHistory.slice(-5)
          .map((h, i) => `${i+1}. ${h.action==="ban"?"🔨 Ban":"✅ Unban"} — ${new Date(h.at).toLocaleString("en-IN",{timeZone:"Asia/Kolkata"})}${h.reason?` (${h.reason})`:""}${h.by?` by ${h.by}`:""}`)
          .join("\n");
      }

      let warnMsgText = "Koi warning nahi";
      if (warnRecord?.messages?.length) {
        warnMsgText = warnRecord.messages.slice(-3)
          .map((m, i) => `${i+1}. "${m.text}" — ${new Date(m.date).toLocaleString("en-IN",{timeZone:"Asia/Kolkata"})}`)
          .join("\n");
      }

      const embed = new EmbedBuilder()
        .setColor(isBanned ? 0xff3c5f : isOnline ? 0x00f5a0 : 0x7289da)
        .setTitle(`🔍 User Intelligence: ${username}`)
        .setDescription(`**Status:** ${isOnline?"🟢 Online":isBanned?"🔴 Banned":"⚫ Offline"} ${isAdmin?"| 👑 Admin":""} ${isVip?"| 💎 VIP":""}`)
        .addFields(
          { name: "═══ 🔥 FIREBASE ACCOUNT ═══",  value: "\u200b", inline: false },
          { name: "📧 Email",        value: firebaseEmail,  inline: true },
          { name: "🔑 Firebase UID", value: `\`${firebaseUid}\``, inline: true },
          { name: "🚫 UID Banned",   value: bannedUids.has(firebaseUid) ? "🔴 YES" : "🟢 No", inline: true },

          { name: "═══ 🌐 IP INTELLIGENCE ═══",   value: "\u200b", inline: false },
          { name: "📍 Primary IP",   value: `\`${realIP}\``,  inline: true },
          { name: "🔀 Proxy IP",     value: `\`${proxyIP}\``, inline: true },
          { name: "🛡️ VPN Status",  value: vpnStatus,         inline: false },

          { name: "═══ 💻 DEVICE & BROWSER ═══",  value: "\u200b", inline: false },
          { name: "🌏 Browser",  value: browserInfo, inline: true },
          { name: "💾 OS",       value: osInfo,      inline: true },
          { name: "📱 Device",   value: mobileInfo,  inline: true },
          { name: "🕵️ Incognito",value: incognito,   inline: false },

          { name: "═══ 🔨 BAN HISTORY ═══",        value: "\u200b", inline: false },
          { name: "📊 Ban Count", value: banRecord ? `🔨 ${banRecord.banCount||1} baar | ✅ ${banRecord.unbanCount||0} unban` : "Kabhi ban nahi hua", inline: false },
          { name: "📜 History",   value: banHistoryText.substring(0, 1000), inline: false },

          { name: "═══ ⚠️ WARNINGS ═══",           value: "\u200b", inline: false },
          { name: "🔢 Warnings",  value: warnRecord ? `${warnRecord.count}/3` : "0/3", inline: true },
          { name: "📅 Last Warn", value: warnRecord ? new Date(warnRecord.lastWarningAt).toLocaleString("en-IN",{timeZone:"Asia/Kolkata"}) : "—", inline: true },
          { name: "💬 Messages",  value: warnMsgText.substring(0, 800), inline: false },

          { name: "═══ 🕒 SESSION ═══",             value: "\u200b", inline: false },
          { name: "🔢 Sessions",  value: session ? String(session.sessionCount||1) : "—", inline: true },
          { name: "🕒 Last Seen", value: session ? new Date(session.lastSeen).toLocaleString("en-IN",{timeZone:"Asia/Kolkata"}) : isOnline?"🟢 Right Now":"—", inline: true },
          { name: "📅 First Seen",value: session ? new Date(session.connectedAt).toLocaleString("en-IN",{timeZone:"Asia/Kolkata"}) : "—", inline: true },
        )
        .setFooter({ text: "HeyyYuki Panel v6.0 — Firebase Auth Integrated" })
        .setTimestamp();

      return safeEmbedReply(embed);
    }

    // ─── /panel ban ──────────────────────────────────────────────
    else if (sub === "ban") {
      const reason = options.getString("reason") || "Admin ban";
      bannedUsernames.add(username);
      saveBanned();

      const onlineUser = Object.values(activeUsers).find(u => u.name.toLowerCase() === username);
      const session    = await UserSession.findOne({ username: { $regex: new RegExp("^" + username + "$", "i") } }).sort({ lastSeen: -1 }).lean();

      // 🆕 Firebase UID bhi ban karo agar available ho
      const fbUid = onlineUser?.firebaseUid || session?.firebaseUid;
      if (fbUid) {
        bannedUids.add(fbUid);
        saveBannedUids();
      }

      let banDoc = await Banned.findOne({ username });
      if (!banDoc) {
        banDoc = new Banned({
          username,
          firebaseUid: fbUid || null,
          ip:          onlineUser?.ip || session?.ip || "Unknown",
          forwardedIp: session?.forwardedFor || "Unknown",
          reason,
          banCount:    1,
          unbanCount:  0,
          banHistory:  [{ action: "ban", reason, by: "Discord Admin", at: new Date() }],
        });
      } else {
        banDoc.banCount = (banDoc.banCount || 0) + 1;
        banDoc.reason   = reason;
        if (fbUid) banDoc.firebaseUid = fbUid;
        banDoc.banHistory = banDoc.banHistory || [];
        banDoc.banHistory.push({ action: "ban", reason, by: "Discord Admin", at: new Date() });
      }
      await banDoc.save();

      if (onlineUser) {
        io.to(onlineUser.socketId).emit("force_logout", `🚫 Aap admin dwara ban ho gaye. Reason: ${reason}`);
        setTimeout(() => { const s = io.sockets.sockets.get(onlineUser.socketId); if (s) s.disconnect(true); }, 500);
        if (onlineUser.ip) tempBannedIPs.set(onlineUser.ip, { expiry: Date.now() + 999*365*24*60*60*1000, reservedName: username });
      }

      sendEmbed(BANNED_LOG_CHANNEL_ID, {
        color: 0xff3c5f,
        title: "🔨 User Banned via /panel",
        fields: [
          { name: "👤 Username",     value: `\`${username}\``,          inline: true },
          { name: "📝 Reason",       value: `\`${reason}\``,             inline: true },
          { name: "🌐 IP",           value: `\`${banDoc.ip}\``,          inline: true },
          { name: "🔥 Firebase UID", value: `\`${fbUid || "N/A"}\``,    inline: true },
          { name: "🔢 Ban #",        value: `${banDoc.banCount} baar`,   inline: true },
        ],
      });

      return safeReply(`✅ **${username}** ban ho gaya!\n📝 ${reason}\n🔥 UID also banned: ${fbUid ? "Yes" : "No (UID not found)"}\n🔢 Ban #${banDoc.banCount}`);
    }

    // ─── /panel unban ────────────────────────────────────────────
    else if (sub === "unban") {
      bannedUsernames.delete(username);
      saveBanned();

      const banDoc = await Banned.findOne({ username });
      if (banDoc) {
        // 🆕 UID unban bhi karo
        if (banDoc.firebaseUid) {
          bannedUids.delete(banDoc.firebaseUid);
          saveBannedUids();
        }
        banDoc.unbanCount = (banDoc.unbanCount || 0) + 1;
        banDoc.banHistory = banDoc.banHistory || [];
        banDoc.banHistory.push({ action: "unban", reason: "Admin unban", by: "Discord Admin", at: new Date() });
        await banDoc.save();
        if (banDoc.ip) tempBannedIPs.delete(banDoc.ip);
        return safeReply(`✅ **${username}** unban ho gaya!\n🔥 UID unban: ${banDoc.firebaseUid ? "Yes" : "N/A"}\n🔢 Total unban: ${banDoc.unbanCount}`);
      } else {
        return safeReply(`✅ **${username}** ban list se hata diya gaya`);
      }
    }

    // ─── /panel kick ─────────────────────────────────────────────
    else if (sub === "kick") {
      const reason     = options.getString("reason") || "Admin kick";
      const onlineUser = Object.values(activeUsers).find(u => u.name.toLowerCase() === username);
      if (!onlineUser) return safeReply(`❌ **${username}** online nahi hai.`);

      io.to(onlineUser.socketId).emit("force_logout", `👢 Admin ne kick kiya. Reason: ${reason}`);
      setTimeout(() => { const s = io.sockets.sockets.get(onlineUser.socketId); if (s) s.disconnect(true); }, 500);
      return safeReply(`👢 **${username}** kick ho gaya!\n📝 ${reason}`);
    }

    // ─── /panel warn ─────────────────────────────────────────────
    else if (sub === "warn") {
      const reason = options.getString("reason") || "Admin warning";

      let warning = await Warning.findOne({ username });
      if (!warning) {
        warning = new Warning({ username, count: 1, reason, messages: [{ text: `[Admin] ${reason}`, date: new Date() }] });
      } else {
        warning.count += 1;
        warning.messages.push({ text: `[Admin] ${reason}`, date: new Date() });
        warning.lastWarningAt = new Date();
      }
      await warning.save();

      const onlineUser = Object.values(activeUsers).find(u => u.name.toLowerCase() === username);
      if (onlineUser) {
        io.to(onlineUser.socketId).emit("profanity_warning", { count: warning.count, message: `⚠️ Admin Warning ${warning.count}/3: ${reason}` });
      }

      if (warning.count >= 3) {
        bannedUsernames.add(username);
        saveBanned();
        const fbUid = onlineUser?.firebaseUid;
        if (fbUid) { bannedUids.add(fbUid); saveBannedUids(); }

        await Banned.updateOne({ username }, {
          $set: { username, reason: "3 warnings" },
          $inc: { banCount: 1 },
          $push: { banHistory: { action: "ban", reason: "3 warnings", by: "System", at: new Date() } },
        }, { upsert: true });

        if (onlineUser) {
          io.to(onlineUser.socketId).emit("force_logout", "🚫 3 warnings ke baad auto-ban!");
          setTimeout(() => { const s = io.sockets.sockets.get(onlineUser.socketId); if (s) s.disconnect(true); }, 500);
        }
        return safeReply(`🚫 **${username}** 3rd warning → AUTO-BAN!\n📝 ${reason}`);
      }

      return safeReply(`⚠️ **${username}** warning #${warning.count}/3!\n📝 ${reason}`);
    }

    // ─── /panel clearwarn ────────────────────────────────────────
    else if (sub === "clearwarn") {
      const result = await Warning.deleteOne({ username: { $regex: new RegExp("^" + username + "$", "i") } });
      if (result.deletedCount > 0) {
        const onlineUser = Object.values(activeUsers).find(u => u.name.toLowerCase() === username);
        if (onlineUser) io.to(onlineUser.socketId).emit("profanity_warning", { count: 0, message: "✅ Aapki warnings clear ho gayi." });
        return safeReply(`✅ **${username}** ki saari warnings clear!`);
      }
      return safeReply(`❓ **${username}** ki koi warning nahi mili.`);
    }

    // ─── /panel list ─────────────────────────────────────────────
    else if (sub === "list") {
      await interaction.deferReply({ flags: 64 });
      const filter = options.getString("filter") || "";
      const query  = filter ? { $or: [{ username: { $regex: filter, $options: "i" } }, { ip: filter }] } : {};
      const users  = await Banned.find(query).lean();

      if (!users.length) return interaction.editReply(`📭 ${filter ? `"${filter}" mein koi nahi.` : "Banned list khali."}`);

      const list = users.slice(0, 25).map((u, i) =>
        `**${i+1}.** \`${u.username}\` | 🌐 \`${u.ip||"N/A"}\` | 🔥 \`${u.firebaseUid||"N/A"}\` | 🔨 ${u.banCount||1}x`
      ).join("\n");

      const embed = new EmbedBuilder()
        .setColor(0xff3c5f)
        .setTitle(`🔨 Banned Users (${users.length})`)
        .setDescription(list)
        .setFooter({ text: "HeyyYuki Panel v6.0" })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }

    // ─── /panel online ───────────────────────────────────────────
    else if (sub === "online") {
      const users = Object.values(activeUsers);
      if (!users.length) return safeReply("📭 Koi online nahi.");

      const list = users.map((u, i) =>
        `**${i+1}.** ${u.name}${isUserAdmin(u.name.toLowerCase())?" 👑":isUserVip(u.name.toLowerCase())?" 💎":""} | 🌐 \`${u.ip||"N/A"}\` | 🔥 \`${u.firebaseUid||"N/A"}\``
      ).join("\n");

      const embed = new EmbedBuilder()
        .setColor(0x00f5a0)
        .setTitle(`🌐 Online Users (${users.length})`)
        .setDescription(list.substring(0, 2000))
        .setFooter({ text: "HeyyYuki Panel v6.0" })
        .setTimestamp();

      return safeEmbedReply(embed);
    }

    // ─── /panel stats ────────────────────────────────────────────
    else if (sub === "stats") {
      await interaction.deferReply({ flags: 64 });
      const [msgCount, banCount, warnCount, reportCount, dmCount, groupCount] = await Promise.all([
        Message.countDocuments(), Banned.countDocuments(), Warning.countDocuments(),
        Report.countDocuments(), DM.countDocuments(), Group.countDocuments(),
      ]);

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle("📊 StrangerToStranger Stats")
        .addFields(
          { name: "🟢 Online",          value: String(Object.keys(activeUsers).length), inline: true },
          { name: "💬 Messages",         value: String(msgCount),   inline: true },
          { name: "🔨 Banned",           value: String(banCount),   inline: true },
          { name: "🔥 UID Banned",       value: String(bannedUids.size), inline: true },
          { name: "⚠️ Warned",           value: String(warnCount),  inline: true },
          { name: "🚨 Reports",          value: String(reportCount),inline: true },
          { name: "💌 DMs",             value: String(dmCount),    inline: true },
          { name: "👥 Groups",           value: String(groupCount), inline: true },
          { name: "🔥 Firebase Admin",   value: firebaseAdminReady ? "✅ Active" : "❌ Off", inline: true },
          { name: "🤖 Discord",          value: discordReady ? "✅ Online" : "❌ Offline", inline: true },
          { name: "🗄️ MongoDB",          value: mongoose.connection.readyState===1 ? "✅ Connected" : "❌ Down", inline: true },
        )
        .setFooter({ text: "HeyyYuki Panel v6.0" })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }

    // ─── /panel ann ──────────────────────────────────────────────
    else if (sub === "ann") {
      const message = options.getString("message");
      await new Announcement({ text: message, expiresAt: new Date(Date.now() + 24*60*60*1000) }).save();
      io.emit("announcement", { text: message, from: "Admin", createdAt: new Date() });
      sendEmbed(STATUS_CHANNEL_ID, { color: 0x00f5a0, title: "📢 Announcement", description: message });
      return safeReply(`📢 Bhej di:\n> ${message}`);
    }

    // ─── /panel vip ──────────────────────────────────────────────
    else if (sub === "vip") {
      const action = options.getString("action");
      if (action === "add") {
        vips.add(username); saveVips();
        await Vip.updateOne({ username }, { username }, { upsert: true });
        const onlineUser = Object.values(activeUsers).find(u => u.name.toLowerCase() === username);
        if (onlineUser) { onlineUser.isVip = true; io.emit("user list", buildUserList()); }
        return safeReply(`💎 **${username}** VIP ho gaya!`);
      } else {
        vips.delete(username); saveVips();
        await Vip.deleteOne({ username });
        const onlineUser = Object.values(activeUsers).find(u => u.name.toLowerCase() === username);
        if (onlineUser) { onlineUser.isVip = false; io.emit("user list", buildUserList()); }
        return safeReply(`❌ **${username}** se VIP hata diya.`);
      }
    }

    // ─── /panel shadow ───────────────────────────────────────────
    else if (sub === "shadow") {
      if (shadowBanned.has(username)) {
        shadowBanned.delete(username);
        return safeReply(`👻 **${username}** shadow ban hata diya.`);
      } else {
        shadowBanned.add(username);
        return safeReply(`👻 **${username}** shadow banned.`);
      }
    }

    // ─── /panel banuid (🆕 Firebase UID se direct ban) ───────────
    else if (sub === "banuid") {
      const uid    = options.getString("uid")?.trim();
      const reason = options.getString("reason") || "Admin UID ban";

      if (!uid) return safeReply("❌ UID required hai.");

      bannedUids.add(uid);
      saveBannedUids();

      // Online koi hai is UID se?
      const onlineUser = Object.values(activeUsers).find(u => u.firebaseUid === uid);
      if (onlineUser) {
        bannedUsernames.add(onlineUser.name.toLowerCase());
        saveBanned();
        io.to(onlineUser.socketId).emit("force_logout", `🚫 Firebase UID ban: ${reason}`);
        setTimeout(() => { const s = io.sockets.sockets.get(onlineUser.socketId); if (s) s.disconnect(true); }, 500);
      }

      await Banned.findOneAndUpdate(
        { firebaseUid: uid },
        { $set: { firebaseUid: uid, username: onlineUser?.name?.toLowerCase() || "uid_" + uid.substring(0,8), reason }, $inc: { banCount: 1 }, $push: { banHistory: { action: "ban", reason, by: "Discord Admin (UID)", at: new Date() } } },
        { upsert: true }
      );

      sendEmbed(BANNED_LOG_CHANNEL_ID, {
        color: 0xff3c5f,
        title: "🔥 Firebase UID Ban",
        fields: [
          { name: "🔑 UID",    value: `\`${uid}\``,    inline: true },
          { name: "📝 Reason", value: `\`${reason}\``, inline: true },
          { name: "👤 User",   value: onlineUser ? `\`${onlineUser.name}\`` : "Offline tha", inline: true },
        ],
      });

      return safeReply(`🔥 Firebase UID \`${uid}\` permanently banned!\n👤 User: ${onlineUser ? onlineUser.name : "Was offline"}`);
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
  try {
    discordClient.user?.setActivity(`${Object.keys(activeUsers).length} Online 🌐`, { type: ActivityType.Watching });
  } catch (e) {}
}

async function sendEmbed(channelId, opts) {
  if (!discordReady || !channelId) return;
  try {
    const ch = discordClient.channels.cache.get(channelId);
    if (!ch) return;
    const embed = new EmbedBuilder()
      .setColor(opts.color || 0x00f5a0)
      .setTitle(opts.title || "")
      .setTimestamp()
      .setFooter({ text: "HeyyYuki 2026" });
    if (opts.description) embed.setDescription(opts.description);
    if (opts.fields)       embed.addFields(opts.fields);
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
      .setColor(colors[type] || 0xff3c5f)
      .setTitle(`${icons[type]} ${type.toUpperCase()}`)
      .setDescription("```" + String(msg).substring(0, 1900) + "```")
      .setTimestamp()
      .setFooter({ text: "HeyyYuki Monitor" });
    ch.send({ embeds: [embed] });
  } catch (e) {}
}

// ══════════════════════════════════════════════════════════════════
// 🔌 SOCKET.IO
// ══════════════════════════════════════════════════════════════════
io.on("connection", (socket) => {
  const ipData    = getAllIPs(socket);
  const userIP    = ipData.primary;
  const userAgent = socket.handshake.headers["user-agent"] || "";
  const { browser, os, isMobile } = parseUserAgent(userAgent);
  let currentUser = null;

  // ── JOIN ─────────────────────────────────────────────────────────
  socket.on("join", async (data) => {
    try {
      const name          = (data.name          || "").trim();
      const bio           = (data.bio           || "No bio").trim();
      const avatar        = data.avatar         || "";
      const color         = data.color          || "#00f5a0";
      const firebaseToken = data.firebaseToken  || null; // 🆕 Client se token aayega
      const incognitoHint = data.incognitoHint  || false;
      const nameLower     = name.toLowerCase();

      if (!name || name.length < 2) {
        return socket.emit("error_msg", "Username kam se kam 2 characters ka ho");
      }

      // ── 🆕 FIREBASE TOKEN VERIFICATION ───────────────────────────
      let firebaseUid   = null;
      let firebaseEmail = null;

      if (firebaseAdminReady && firebaseToken) {
        const decoded = await verifyFirebaseToken(firebaseToken);
        if (!decoded) {
          // Token invalid — join block karo
          return socket.emit("auth_error", "❌ Invalid session. Please login again.");
        }
        firebaseUid   = decoded.uid;
        firebaseEmail = decoded.email || null;

        // 🆕 Firebase UID ban check
        if (bannedUids.has(firebaseUid)) {
          return socket.emit("duplicate", "🚫 Aapka account permanently ban ho chuka hai.");
        }
      }
      // Note: Agar firebaseAdminReady=false ya token nahi aaya,
      // toh gracefully continue karte hain bina block kiye
      // (useful for testing / fallback)

      // IP ban check
      if (tempBannedIPs.has(userIP)) {
        const ban = tempBannedIPs.get(userIP);
        if (Date.now() < ban.expiry) return socket.emit("duplicate", "🚫 Aap banned hain.");
        else tempBannedIPs.delete(userIP);
      }

      // Username ban check
      if (bannedUsernames.has(nameLower)) {
        return socket.emit("duplicate", "🚫 Aap permanently banned hain");
      }

      // Duplicate username check
      const duplicate = Object.values(activeUsers).find(u => u.name.toLowerCase() === nameLower);
      if (duplicate) {
        return socket.emit("duplicate", "⚠️ Ye username liya hua hai");
      }

      const userIsAdmin = isUserAdmin(nameLower);
      const userIsVip   = isUserVip(nameLower);

      currentUser = {
        socketId:      socket.id,
        name,
        bio,
        avatar,
        color,
        ip:            userIP,
        firebaseUid,           // 🆕
        firebaseEmail,         // 🆕
        isVip:         userIsVip,
        isAdmin:       userIsAdmin,
        room:          "global",
      };

      activeUsers[socket.id] = currentUser;
      socket.join("global");

      // 🆕 Session upsert — Firebase data bhi save karo
      try {
        await UserSession.findOneAndUpdate(
          { username: nameLower },
          {
            $set: {
              username:      nameLower,
              firebaseUid,           // 🆕
              firebaseEmail,         // 🆕
              ip:            userIP,
              forwardedFor:  ipData.allForwarded.join(", ") || userIP,
              userAgent,
              browser,
              os,
              isMobile,
              incognitoHint,
              vpnDetected:   ipData.vpnHint,
              lastSeen:      new Date(),
            },
            $setOnInsert: { connectedAt: new Date(), sessionCount: 1 },
          },
          { upsert: true, new: true }
        );
        await UserSession.updateOne({ username: nameLower }, { $inc: { sessionCount: 1 } });
      } catch (sessionErr) {
        console.error("Session save error:", sessionErr.message);
      }

      // Message history load
      const history = await Message.find({ room: "global" }).sort({ createdAt: 1 }).limit(100).lean();
      const normalizedHistory = history.map(m => ({
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

      io.to("global").emit("chat message", {
        id:        "sys_" + Date.now(),
        sender:    "System",
        message:   `${name} joined`,
        type:      "system",
        room:      "global",
        createdAt: new Date(),
      });

      io.emit("user list", buildUserList());
      socket.emit("joined", currentUser);
      updateDiscordStatus();

      // Groups load
      const groups = await Group.find({}).sort({ createdAt: -1 }).lean();
      socket.emit("groups_list", groups.map(g => ({ ...g, hasPassword: !!g.password })));

      // Join/Leave Discord log
      sendEmbed(JOIN_LEAVE_CHANNEL_ID, {
        color: 0x00f5a0,
        title: "🟢 User Joined",
        fields: [
          { name: "👤 Name",           value: `\`${name}\``,              inline: true },
          { name: "🌐 IP",             value: `\`${userIP}\``,            inline: true },
          { name: "🔥 Firebase UID",   value: `\`${firebaseUid||"N/A"}\``,inline: true },
          { name: "📧 Email",          value: firebaseEmail||"N/A",        inline: true },
          { name: "🌏 Browser",        value: browser,                     inline: true },
          { name: "💾 OS",             value: os,                          inline: true },
          { name: "📱 Device",         value: isMobile?"Mobile":"Desktop", inline: true },
          { name: "🛡️ VPN",           value: ipData.vpnHint?"⚠️ Possible":"No", inline: true },
        ],
      });

    } catch (err) {
      console.error("join error:", err);
      socket.emit("error_msg", "Join failed");
    }
  });

  // ── CHAT MESSAGE ────────────────────────────────────────────────
  socket.on("chat message", async (data) => {
    if (!currentUser) return;
    try {
      const room    = data.room    || "global";
      const message = data.message || "";

      // Profanity check
      if (containsProfanity(message)) {
        const nameLower = currentUser.name.toLowerCase();
        let warning     = await Warning.findOne({ username: nameLower });

        if (!warning) {
          warning = new Warning({ username: nameLower, count: 1, reason: "Profanity", messages: [{ text: message, date: new Date() }] });
        } else {
          warning.count += 1;
          warning.messages.push({ text: message, date: new Date() });
          warning.lastWarningAt = new Date();
        }
        await warning.save();

        if (warning.count >= 3) {
          bannedUsernames.add(nameLower);
          saveBanned();

          // 🆕 Firebase UID bhi ban karo
          if (currentUser.firebaseUid) {
            bannedUids.add(currentUser.firebaseUid);
            saveBannedUids();
          }

          await Banned.findOneAndUpdate(
            { username: nameLower },
            {
              $set: {
                username:    nameLower,
                firebaseUid: currentUser.firebaseUid || null,
                ip:          currentUser.ip,
                forwardedIp: ipData.allForwarded.join(", "),
                reason:      "3x Profanity Auto-Ban",
              },
              $inc:  { banCount: 1 },
              $push: { banHistory: { action: "ban", reason: "3 profanity warnings", by: "System", at: new Date() } },
            },
            { upsert: true }
          );

          tempBannedIPs.set(currentUser.ip, { expiry: Date.now() + 999*365*24*60*60*1000, reservedName: currentUser.name });

          sendEmbed(BANNED_LOG_CHANNEL_ID, {
            color: 0x7289da,
            title: "🔒 AUTO-BANNED (Profanity)",
            fields: [
              { name: "👤 Username",     value: `\`${currentUser.name}\``,             inline: true },
              { name: "🌐 IP",           value: `\`${currentUser.ip}\``,               inline: true },
              { name: "🔥 Firebase UID", value: `\`${currentUser.firebaseUid||"N/A"}\``,inline: true },
              { name: "📧 Email",        value: currentUser.firebaseEmail||"N/A",       inline: true },
              { name: "📝 Reason",       value: "3/3 Profanity",                       inline: false },
              { name: "🤬 Messages",     value: warning.messages.slice(-3).map(m=>`• "${m.text}"`).join("\n").substring(0,800), inline: false },
            ],
          });

          io.to(socket.id).emit("force_logout", "🚫 3 baar gali — PERMANENTLY IP & UID BAN!");
          setTimeout(() => { const s = io.sockets.sockets.get(socket.id); if (s) s.disconnect(true); }, 500);
          return;

        } else {
          io.to(socket.id).emit("profanity_warning", { count: warning.count, message: `⚠️ WARNING ${warning.count}/3: Galiyan mat use karo!` });
          sendEmbed(PROFANITY_CHANNEL_ID, {
            color: 0xffd60a,
            title: `⚠️ Profanity Warning #${warning.count}`,
            fields: [
              { name: "Username", value: `\`${currentUser.name}\``, inline: true },
              { name: "Warnings", value: `${warning.count}/3`,       inline: true },
              { name: "Message",  value: `"${message}"`,             inline: false },
            ],
          });
          return;
        }
      }

      // Normal message
      const payload = {
        id:          data.id || socket.id + "_" + Date.now(),
        sender:      currentUser.name,
        senderAvatar:currentUser.avatar,
        senderColor: currentUser.color,
        isVip:       currentUser.isVip,
        message,
        type:        data.type    || "text",
        caption:     data.caption || "",
        mediaUrl:    data.mediaUrl|| "",
        replyTo:     data.replyTo || null,
        room,
        createdAt:   new Date(),
      };

      const msgDoc = new Message({
        room,
        senderId:    socket.id,
        senderName:  currentUser.name,
        senderAvatar:currentUser.avatar,
        senderColor: currentUser.color,
        text:        message,
        type:        data.type || "text",
        mediaUrl:    data.mediaUrl || "",
        isVip:       currentUser.isVip,
      });
      await msgDoc.save();
      payload._id = msgDoc._id.toString();

      if (!shadowBanned.has(currentUser.name.toLowerCase())) {
        io.to(room).emit("chat message", payload);
      } else {
        socket.emit("chat message", payload);
      }

      if (room === "global") {
        try {
          const ch = discordClient.channels.cache.get(CHAT_CHANNEL_ID);
          if (ch && discordReady) ch.send(`**${currentUser.name}:** ${message.substring(0, 1900)}`);
        } catch (e) {}
      }
    } catch (err) {
      console.error("chat message error:", err);
    }
  });

  // ── DELETE MESSAGE ───────────────────────────────────────────────
  socket.on("delete message", async (id) => {
    try { await Message.findByIdAndDelete(id).catch(() => null); } catch (e) {}
    io.emit("delete message", id);
  });

  // ── CLEAR ALL CHATS (Admin command) ─────────────────────────────
  socket.on("manual_clear_all", async () => {
    if (!currentUser || !isUserAdmin(currentUser.name.toLowerCase())) {
      return socket.emit("error_msg", "Only admin can clear messages.");
    }
    try {
      await Message.deleteMany({ room: "global" });
      io.emit("messages_cleared", { room: "global" });
    } catch (err) {
      socket.emit("error_msg", "Clear failed.");
    }
  });

  // ── TYPING ──────────────────────────────────────────────────────
  socket.on("typing", (data) => {
    if (!currentUser) return;
    const room = data?.room || "global";
    socket.to(room).emit("typing", { user: currentUser.name });
  });

  // ── PRIVATE MESSAGE ─────────────────────────────────────────────
  socket.on("private message", async (data) => {
    if (!currentUser) return;
    try {
      const receiverName = data.receiver;
      const toUser       = Object.values(activeUsers).find(u => u.name.toLowerCase() === receiverName?.toLowerCase());
      const channelId    = getDMChannelId(currentUser.name, receiverName);

      let dmDoc = await DM.findOne({ channelId });
      if (!dmDoc) {
        dmDoc = new DM({ channelId, participantNames: [currentUser.name, receiverName], messages: [] });
      }

      const msgObj = {
        senderName:  currentUser.name,
        senderAvatar:currentUser.avatar,
        senderColor: currentUser.color,
        text:        data.message,
        type:        data.type    || "text",
        mediaUrl:    data.mediaUrl|| "",
        caption:     data.caption || "",
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
        type:        data.type    || "text",
        mediaUrl:    data.mediaUrl|| "",
        caption:     data.caption || "",
        createdAt:   new Date(),
      };

      socket.emit("private message", payload);
      if (toUser) io.to(toUser.socketId).emit("private message", payload);
    } catch (err) {
      console.error("private message error:", err);
    }
  });

  // ── DM HISTORY ──────────────────────────────────────────────────
  socket.on("dm_history", async ({ withUser }) => {
    if (!currentUser) return;
    try {
      const channelId = getDMChannelId(currentUser.name, withUser);
      const dmDoc     = await DM.findOne({ channelId }).lean();
      const messages  = (dmDoc?.messages || []).map(m => ({
        sender:      m.senderName,
        senderAvatar:m.senderAvatar,
        senderColor: m.senderColor,
        message:     m.text,
        type:        m.type,
        mediaUrl:    m.mediaUrl,
        caption:     m.caption || "",
        createdAt:   m.createdAt,
      }));
      socket.emit("dm_history_data", { channelId, withUser, messages });
    } catch (err) {
      console.error("dm_history error:", err);
    }
  });

  // ── DM TYPING ───────────────────────────────────────────────────
  socket.on("dm_typing", ({ toUser, isTyping }) => {
    if (!currentUser) return;
    const target = Object.values(activeUsers).find(u => u.name.toLowerCase() === toUser?.toLowerCase());
    if (target) io.to(target.socketId).emit("dm_typing_update", { fromUser: currentUser.name, isTyping });
  });

  // ── GROUP JOIN ──────────────────────────────────────────────────
  socket.on("join_group", async ({ groupId, password }) => {
    try {
      const group = await Group.findById(groupId);
      if (!group) return socket.emit("group_error", "Group not found");
      if (group.password && group.password !== password) return socket.emit("group_error", "Wrong password");

      const room = "group_" + groupId;
      socket.join(room);
      if (currentUser) currentUser.room = room;

      const history = await Message.find({ room }).sort({ createdAt: 1 }).limit(100).lean();
      socket.emit("group_joined", { group, history });
    } catch (err) {
      console.error("join_group error:", err);
    }
  });

  // ── GROUP CREATE ─────────────────────────────────────────────────
  socket.on("create_group", async ({ name, description, password, icon }) => {
    if (!currentUser) return;
    try {
      const group = new Group({ name, description: description||"", password: password||"", adminName: currentUser.name, icon: icon||"👥", members: [currentUser.name] });
      await group.save();
      socket.emit("group_created", group);
      const groups = await Group.find({}).sort({ createdAt: -1 }).lean();
      io.emit("groups_list", groups.map(g => ({ ...g, hasPassword: !!g.password })));
    } catch (err) {
      console.error("create_group error:", err);
    }
  });

  // ── GET GROUPS ───────────────────────────────────────────────────
  socket.on("get_groups", async () => {
    try {
      const groups = await Group.find({}).sort({ createdAt: -1 }).lean();
      socket.emit("groups_list", groups.map(g => ({ ...g, hasPassword: !!g.password })));
    } catch (err) {
      console.error("get_groups error:", err);
    }
  });

  // ── REPORT USER ─────────────────────────────────────────────────
  socket.on("report user", async (data) => {
    try {
      const device = isMobile ? "📱 Mobile" : "🖥️ Desktop";
      await new Report({
        reportedUser:  data.reportedUser,
        reporterUser:  data.reportedBy || currentUser?.name,
        reporterEmail: data.email,
        category:      data.reason,
        reason:        data.description || data.reason,
        device,
      }).save();

      sendEmbed(REPORT_CHANNEL_ID, {
        color: 0xff3c5f,
        title: "🚨 New Report",
        fields: [
          { name: "Reported",  value: `\`${data.reportedUser}\``,       inline: true },
          { name: "Reporter",  value: `\`${data.reportedBy||"—"}\``,   inline: true },
          { name: "Category",  value: `\`${data.reason||"—"}\``,       inline: false },
          { name: "Details",   value: (data.description||"—").substring(0,1000), inline: false },
        ],
      });
      socket.emit("report_success");
    } catch (err) {
      socket.emit("report_error", "Report failed");
    }
  });

  // ── PROFILE UPDATE ───────────────────────────────────────────────
  socket.on("update profile", ({ bio, avatar, color, name }) => {
    if (!currentUser) return;
    if (bio    !== undefined) currentUser.bio    = bio;
    if (avatar !== undefined) currentUser.avatar = avatar;
    if (color  !== undefined) currentUser.color  = color;
    if (name && name !== currentUser.name) {
      const nameLower = name.toLowerCase();
      const dup = Object.values(activeUsers).find(u => u.name.toLowerCase() === nameLower && u.socketId !== socket.id);
      if (!dup) currentUser.name = name;
    }
    activeUsers[socket.id] = currentUser;
    io.emit("user list", buildUserList());
    socket.emit("profile_updated", currentUser);
  });

  // ── DISCONNECT ───────────────────────────────────────────────────
  socket.on("disconnect", () => {
    if (!currentUser) return;
    io.emit("chat message", {
      id:        "sys_" + Date.now(),
      sender:    "System",
      message:   `${currentUser.name} left`,
      type:      "system",
      room:      currentUser.room || "global",
      createdAt: new Date(),
    });
    UserSession.updateOne({ username: currentUser.name.toLowerCase() }, { $set: { lastSeen: new Date() } }).catch(() => {});
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

app.get("/", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

app.post("/api/report", async (req, res) => {
  try {
    const device = /Mobi|Android/i.test(req.headers["user-agent"] || "") ? "📱 Mobile" : "🖥️ Desktop";
    await new Report({ ...req.body, device }).save();
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ ok: false }); }
});

app.get("/health", (req, res) => res.json({
  status:          "ok",
  online:          Object.keys(activeUsers).length,
  discord:         discordReady,
  mongo:           mongoose.connection.readyState === 1 ? "connected" : "disconnected",
  firebaseAdmin:   firebaseAdminReady,
}));

app.get("/api/session/:username", async (req, res) => {
  try {
    const session = await UserSession.findOne({ username: { $regex: new RegExp("^" + req.params.username + "$", "i") } }).lean();
    if (!session) return res.status(404).json({ error: "Not found" });
    res.json(session);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════════════════════════════
// 🎛️ WEB ADMIN PANEL REST API
// ══════════════════════════════════════════════════════════════════
function requireAdmin(req, res, next) {
  const token = req.headers["x-admin-token"] || req.query.token;
  if (token !== PANEL_PASSWORD) return res.status(401).json({ error: "Unauthorized" });
  next();
}

app.get("/admin", (req, res) => res.sendFile(path.join(__dirname, "public", "admin.html")));

app.get("/api/admin/stats", requireAdmin, async (req, res) => {
  try {
    const [msgCount, banCount, warnCount, reportCount, dmCount, groupCount] = await Promise.all([
      Message.countDocuments(), Banned.countDocuments(), Warning.countDocuments(),
      Report.countDocuments(), DM.countDocuments(), Group.countDocuments(),
    ]);
    res.json({
      online: Object.keys(activeUsers).length, messages: msgCount, banned: banCount,
      bannedUids: bannedUids.size, warned: warnCount, reports: reportCount,
      dms: dmCount, groups: groupCount, discord: discordReady, firebaseAdmin: firebaseAdminReady,
      mongo: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/admin/online", requireAdmin, (req, res) => {
  res.json(Object.values(activeUsers).map(u => ({
    name: u.name, ip: u.ip, firebaseUid: u.firebaseUid, firebaseEmail: u.firebaseEmail,
    isVip: u.isVip, isAdmin: u.isAdmin, room: u.room, socketId: u.socketId,
  })));
});

app.get("/api/admin/banned", requireAdmin, async (req, res) => {
  try {
    const filter = req.query.filter || "";
    const query  = filter ? { $or: [{ username: { $regex: filter, $options: "i" } }, { ip: filter }, { firebaseUid: filter }] } : {};
    res.json(await Banned.find(query).sort({ _id: -1 }).limit(100).lean());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/admin/warnings",  requireAdmin, async (req, res) => { try { res.json(await Warning.find({}).sort({ count: -1 }).limit(50).lean()); } catch (e) { res.status(500).json({ error: e.message }); } });
app.get("/api/admin/reports",   requireAdmin, async (req, res) => { try { res.json(await Report.find({}).sort({ createdAt: -1 }).limit(50).lean()); } catch (e) { res.status(500).json({ error: e.message }); } });
app.get("/api/admin/messages",  requireAdmin, async (req, res) => { try { res.json((await Message.find({ room: "global" }).sort({ createdAt: -1 }).limit(50).lean()).reverse()); } catch (e) { res.status(500).json({ error: e.message }); } });

app.get("/api/admin/user/:username", requireAdmin, async (req, res) => {
  try {
    const uname = req.params.username.toLowerCase();
    const regex = new RegExp("^" + uname + "$", "i");
    const [session, banRecord, warnRecord] = await Promise.all([
      UserSession.findOne({ username: regex }).sort({ lastSeen: -1 }).lean(),
      Banned.findOne({ username: regex }).lean(),
      Warning.findOne({ username: regex }).lean(),
    ]);
    const onlineUser = Object.values(activeUsers).find(u => u.name.toLowerCase() === uname);
    res.json({
      username: uname, online: !!onlineUser,
      isVip: isUserVip(uname), isAdmin: isUserAdmin(uname),
      isBanned: bannedUsernames.has(uname) || !!banRecord,
      isUidBanned: session?.firebaseUid ? bannedUids.has(session.firebaseUid) : false,
      session: session || null, ban: banRecord || null, warning: warnRecord || null,
      liveData: onlineUser ? { ip: onlineUser.ip, room: onlineUser.room, firebaseUid: onlineUser.firebaseUid, firebaseEmail: onlineUser.firebaseEmail } : null,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/admin/ban", requireAdmin, async (req, res) => {
  try {
    const { username, reason = "Admin ban" } = req.body;
    if (!username) return res.status(400).json({ error: "Username required" });
    const uname      = username.toLowerCase();
    bannedUsernames.add(uname); saveBanned();

    const onlineUser = Object.values(activeUsers).find(u => u.name.toLowerCase() === uname);
    const session    = await UserSession.findOne({ username: { $regex: new RegExp("^" + uname + "$", "i") } }).lean();
    const fbUid      = onlineUser?.firebaseUid || session?.firebaseUid;
    if (fbUid) { bannedUids.add(fbUid); saveBannedUids(); }

    await Banned.findOneAndUpdate(
      { username: uname },
      { $set: { username: uname, ip: onlineUser?.ip || session?.ip || "Unknown", reason, firebaseUid: fbUid || null }, $inc: { banCount: 1 }, $push: { banHistory: { action: "ban", reason, by: "Web Panel", at: new Date() } } },
      { upsert: true }
    );

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

    const banDoc = await Banned.findOne({ username: uname });
    if (banDoc) {
      if (banDoc.firebaseUid) { bannedUids.delete(banDoc.firebaseUid); saveBannedUids(); }
      banDoc.unbanCount = (banDoc.unbanCount || 0) + 1;
      banDoc.banHistory = banDoc.banHistory || [];
      banDoc.banHistory.push({ action: "unban", reason: "Web Panel", by: "Web Admin Panel", at: new Date() });
      await banDoc.save();
      if (banDoc.ip) tempBannedIPs.delete(banDoc.ip);
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/admin/kick", requireAdmin, (req, res) => {
  try {
    const { username, reason = "Admin kick" } = req.body;
    if (!username) return res.status(400).json({ error: "Username required" });
    const onlineUser = Object.values(activeUsers).find(u => u.name.toLowerCase() === username.toLowerCase());
    if (!onlineUser) return res.status(404).json({ error: "Not online" });
    io.to(onlineUser.socketId).emit("force_logout", `👢 Kick: ${reason}`);
    setTimeout(() => { const s = io.sockets.sockets.get(onlineUser.socketId); if (s) s.disconnect(true); }, 500);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/admin/warn", requireAdmin, async (req, res) => {
  try {
    const { username, reason = "Admin warning" } = req.body;
    if (!username) return res.status(400).json({ error: "Username required" });
    const uname = username.toLowerCase();
    let warning = await Warning.findOne({ username: uname });
    if (!warning) {
      warning = new Warning({ username: uname, count: 1, reason, messages: [{ text: `[Admin] ${reason}`, date: new Date() }] });
    } else {
      warning.count += 1;
      warning.messages.push({ text: `[Admin] ${reason}`, date: new Date() });
      warning.lastWarningAt = new Date();
    }
    await warning.save();

    const onlineUser = Object.values(activeUsers).find(u => u.name.toLowerCase() === uname);
    if (onlineUser) io.to(onlineUser.socketId).emit("profanity_warning", { count: warning.count, message: `⚠️ Warning ${warning.count}/3: ${reason}` });

    if (warning.count >= 3) {
      bannedUsernames.add(uname); saveBanned();
      const fbUid = onlineUser?.firebaseUid;
      if (fbUid) { bannedUids.add(fbUid); saveBannedUids(); }
      await Banned.findOneAndUpdate({ username: uname }, { $set: { username: uname, reason: "3 warnings", firebaseUid: fbUid||null }, $inc: { banCount: 1 }, $push: { banHistory: { action: "ban", reason: "Auto: 3 warnings", by: "System", at: new Date() } } }, { upsert: true });
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
  try {
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: "Username required" });
    await Warning.deleteOne({ username: username.toLowerCase() });
    const onlineUser = Object.values(activeUsers).find(u => u.name.toLowerCase() === username.toLowerCase());
    if (onlineUser) io.to(onlineUser.socketId).emit("profanity_warning", { count: 0, message: "✅ Warnings clear." });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/admin/announce", requireAdmin, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: "Message required" });
    await new Announcement({ text: message, expiresAt: new Date(Date.now() + 24*60*60*1000) }).save();
    io.emit("announcement", { text: message, from: "Admin", createdAt: new Date() });
    sendEmbed(STATUS_CHANNEL_ID, { color: 0x00f5a0, title: "📢 Announcement", description: message });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/admin/vip", requireAdmin, async (req, res) => {
  try {
    const { username, action } = req.body;
    if (!username || !action) return res.status(400).json({ error: "username & action required" });
    const uname = username.toLowerCase();
    if (action === "add") {
      vips.add(uname); saveVips();
      await Vip.updateOne({ username: uname }, { username: uname }, { upsert: true });
      const u = Object.values(activeUsers).find(u => u.name.toLowerCase() === uname);
      if (u) { u.isVip = true; io.emit("user list", buildUserList()); }
    } else {
      vips.delete(uname); saveVips();
      await Vip.deleteOne({ username: uname });
      const u = Object.values(activeUsers).find(u => u.name.toLowerCase() === uname);
      if (u) { u.isVip = false; io.emit("user list", buildUserList()); }
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/admin/shadow", requireAdmin, (req, res) => {
  try {
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: "Username required" });
    const uname = username.toLowerCase();
    if (shadowBanned.has(uname)) { shadowBanned.delete(uname); res.json({ ok: true, shadow: false }); }
    else { shadowBanned.add(uname); res.json({ ok: true, shadow: true }); }
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/admin/deletemsgs", requireAdmin, async (req, res) => {
  try {
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: "Username required" });
    const result = await Message.deleteMany({ senderName: { $regex: new RegExp("^" + username + "$", "i") } });
    io.emit("reload_messages");
    res.json({ ok: true, deleted: result.deletedCount });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 🆕 Ban by Firebase UID via REST
app.post("/api/admin/banuid", requireAdmin, async (req, res) => {
  try {
    const { uid, reason = "Admin UID ban" } = req.body;
    if (!uid) return res.status(400).json({ error: "UID required" });
    bannedUids.add(uid); saveBannedUids();

    const onlineUser = Object.values(activeUsers).find(u => u.firebaseUid === uid);
    if (onlineUser) {
      bannedUsernames.add(onlineUser.name.toLowerCase()); saveBanned();
      io.to(onlineUser.socketId).emit("force_logout", `🚫 UID Ban: ${reason}`);
      setTimeout(() => { const s = io.sockets.sockets.get(onlineUser.socketId); if (s) s.disconnect(true); }, 500);
    }

    await Banned.findOneAndUpdate(
      { firebaseUid: uid },
      { $set: { firebaseUid: uid, username: onlineUser?.name?.toLowerCase() || "uid_" + uid.substring(0,8), reason }, $inc: { banCount: 1 }, $push: { banHistory: { action: "ban", reason, by: "Web Panel (UID)", at: new Date() } } },
      { upsert: true }
    );
    res.json({ ok: true, userWasOnline: !!onlineUser });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════════════════════════════
// 🚀 START SERVER
// ══════════════════════════════════════════════════════════════════
http.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📋 Admin: ${ADMIN_NAME}`);
  console.log(`🔥 Firebase Admin: ${firebaseAdminReady ? "ACTIVE" : "DISABLED (add service account)"}`);
  console.log(`🚨 Profanity detection: ACTIVE`);
  console.log(`🎛️  /panel command: ACTIVE`);
});

// ══════════════════════════════════════════════════════════════════
// 🛡️ CRASH PROTECTION
// ══════════════════════════════════════════════════════════════════
process.on("unhandledRejection", (err) => {
  console.error("⚠️ Unhandled Rejection:", err);
  logToDiscordError(`💥 Unhandled Rejection:\n${String(err).substring(0, 1500)}`);
});

process.on("uncaughtException", (err) => {
  console.error("⚠️ Uncaught Exception:", err);
  logToDiscordError(`💥 Uncaught Exception:\n${err.message}\n${(err.stack||"").substring(0, 1000)}`);
});
