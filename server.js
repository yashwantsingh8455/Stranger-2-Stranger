// ╔══════════════════════════════════════════════════════════════╗
// ║   StrangerToStranger — HeyyYuki Powered Server v4.1 FINAL   ║
// ║   Profanity Detection | Warning System | DM Persistence     ║
// ║   Complete Working Solution 2026                            ║
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
const CLIENT_ID = process.env.CLIENT_ID || "1478767384398528573";
const DISCORD_TOKEN = process.env.DISCORD_TOKEN || "";

const CONTROL_CHANNEL_IDS = ["1506573109728247848"];
const GUILD_ID = "1485522389403173004";

const STATUS_CHANNEL_ID =
  process.env.STATUS_CHANNEL_ID || "1506573109728247848";
const CHAT_CHANNEL_ID = process.env.CHAT_CHANNEL_ID || "1506240430260621312";
const MEDIA_LOG_CHANNEL_ID =
  process.env.MEDIA_LOG_CHANNEL_ID || "1506573109728247848";
const JOIN_LEAVE_CHANNEL_ID =
  process.env.JOIN_LEAVE_CHANNEL_ID || "1506240499361775707";
const MOD_LOG_CHANNEL_ID =
  process.env.MOD_LOG_CHANNEL_ID || "1506573109728247848";
const VIP_LOG_CHANNEL_ID =
  process.env.VIP_LOG_CHANNEL_ID || "1506573109728247848";
const REPORT_CHANNEL_ID =
  process.env.REPORT_CHANNEL_ID || "1506573109728247848";
const ERROR_CHANNEL_ID = process.env.ERROR_CHANNEL_ID || "1506240662381658162";
const PROFANITY_CHANNEL_ID =
  process.env.PROFANITY_CHANNEL_ID || REPORT_CHANNEL_ID; // 👈 Profanity alerts yahan jayenge

const ADMIN_NAME = process.env.ADMIN_NAME || "Yashwant";
const PORT = process.env.PORT || 4000;



// Apne naye channel ki ID yahan daal do
const BANNED_LOG_CHANNEL_ID = process.env.BANNED_LOG_CHANNEL_ID || "1512753547765223632";





// ══════════════════════════════════════════════════════════════
// 🧠 PROFANITY DETECTION SETUP
// ══════════════════════════════════════════════════════════════
// Hinglish + Hindi + English profanity words
const PROFANITY_WORDS = new Set([
  // Hindi/Hinglish
  "gandu",
  "gaandu",
  "madarchod",
  "behenchod",
  "bhaanchod",
  "lavda",
  "lund",
  "chutiya",
  "chutia",
  "chutiye",
  "bhag",
  "sala",
  "salle",
  "saala",
  "mc",
  "bc",
  "randi",
  "randi",
  "kutti",
  "kutty",
  "kutiya",
  "kuthi",
  "kamina",
  "kamine",
  "nalayak",
  "besharam",
  "aayashi",
  "teri maa",
  "teri mummy",
  "tere baap",
  "bhenji",
  "bhagi",
  "pehli baar",
  "gaali",
  "gaaliyan",
  "saand",
  "budha",
  "buddha",
  "bawli",
  "bewakoof",
  "bakwas",
  "jhooth",
  "jhuthe",
  "saath",
  "jadughar",
  "naakaara",
  "napunsak",
  "nakarad",
  "nakarad",

  // English
  "fuck",
  "shit",
  "ass",
  "bitch",
  "bastard",
  "damn",
  "crap",
  "whore",
  "asshole",
  "dickhead",
  "motherfucker",
  "arsehole",
  "dumbass",
  "prick",
  "bloody",
  "cunt",
  "twat",
  "wanker",
  "bollocks",
  "bugger",
  "arse",
  "cock",
  "dick",
  "pussy",
  "slut",
  "whore",
  "screw",

  // Abbreviations
  "wtf",
  "stfu",
  "ffs",
  "gtfo",
]);

// Function to check if message contains profanity
function containsProfanity(text) {
  const words = text.toLowerCase().split(/\s+/);
  return words.some((word) => {
    // Remove punctuation from word
    const cleanWord = word.replace(/[.,!?;:'-]/g, "");
    return PROFANITY_WORDS.has(cleanWord);
  });
}

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
  room: { type: String, default: "global" },
  senderId: String,
  senderName: String,
  senderAvatar: String,
  senderColor: String,
  text: String,
  type: { type: String, default: "text" },
  mediaUrl: String,
  isVip: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});
const Message = mongoose.model("Message", MsgSchema);

// 💬 DM Schema - PERMANENT STORAGE
const DMSchema = new mongoose.Schema({
  channelId: { type: String, unique: true },
  participantNames: [String],
  messages: [
    {
      senderName: String,
      senderAvatar: String,
      senderColor: String,
      text: String,
      mediaUrl: String,
      type: { type: String, default: "text" },
      caption: String, // GIF caption
      createdAt: { type: Date, default: Date.now },
    },
  ],
  updatedAt: { type: Date, default: Date.now },
});
const DM = mongoose.model("DM", DMSchema);

const GroupSchema = new mongoose.Schema({
  name: String,
  description: String,
  password: String,
  adminName: String,
  icon: { type: String, default: "👥" },
  members: [String],
  createdAt: { type: Date, default: Date.now },
});
const Group = mongoose.model("Group", GroupSchema);

const ReportSchema = new mongoose.Schema({
  reportedUser: String,
  reporterUser: String,
  reporterEmail: String,
  category: String,
  reason: String,
  device: String,
  createdAt: { type: Date, default: Date.now },
});
const Report = mongoose.model("Report", ReportSchema);

// 🚨 WARNING SYSTEM SCHEMA
const WarningSchema = new mongoose.Schema({
  username: { type: String, index: true },
  count: { type: Number, default: 1 },
  lastWarningAt: { type: Date, default: Date.now },
  reason: String,
  messages: [{ text: String, date: Date }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});
const Warning = mongoose.model("Warning", WarningSchema);

const AnnouncementSchema = new mongoose.Schema({
  text: String,
  expiresAt: Date,
  createdAt: { type: Date, default: Date.now },
});
const Announcement =
  mongoose.models.Announcement ||
  mongoose.model("Announcement", AnnouncementSchema);

const BanSchema = new mongoose.Schema({
  username: { type: String, unique: true },
  ip: { type: String },
  reason: { type: String, default: "Profanity/Abuse" },
  country: { type: String, default: "Unknown" }
});

const VipSchema = new mongoose.Schema({
  username: { type: String, unique: true },
});
const Banned = mongoose.model("Banned", BanSchema);
const Vip = mongoose.model("Vip", VipSchema);

// ══════════════════════════════════════════════════════════════
// 📁 FILE-BASED PERSISTENCE
// ══════════════════════════════════════════════════════════════
const BANNED_FILE = path.join(__dirname, "banned-usernames.json");
const VIPS_FILE = path.join(__dirname, "vip-users.json");
const ADMINS_FILE = path.join(__dirname, "admin-users.json");

let bannedUsernames = new Set();
let vips = new Set();
let admins = new Set();

function loadJSON(file) {
  try {
    return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : [];
  } catch (e) {
    return [];
  }
}

bannedUsernames = new Set(loadJSON(BANNED_FILE));
vips = new Set(loadJSON(VIPS_FILE));
admins = new Set(loadJSON(ADMINS_FILE));

function saveBanned() {
  fs.writeFileSync(BANNED_FILE, JSON.stringify([...bannedUsernames]));
}
function saveVips() {
  fs.writeFileSync(VIPS_FILE, JSON.stringify([...vips]));
}
function saveAdmins() {
  fs.writeFileSync(ADMINS_FILE, JSON.stringify([...admins]));
}

// ══════════════════════════════════════════════════════════════
// 🧠 IN-MEMORY STATE
// ══════════════════════════════════════════════════════════════
const activeUsers = {};
const tempBannedIPs = new Map();
const shadowBanned = new Set();

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
    const nameLower = u.name.toLowerCase();
    const userIsAdmin = isUserAdmin(nameLower);
    const userIsVip = isUserVip(nameLower);
    let displayName = u.name;

    if (userIsAdmin) displayName = "👑 " + displayName;
    else if (userIsVip) displayName = displayName + " 💎";

    return {
      socketId: u.socketId,
      name: displayName,
      rawName: u.name,
      bio: u.bio,
      avatar: u.avatar,
      color: u.color,
      isVip: userIsVip,
      isAdmin: userIsAdmin,
    };
  });
}

// ══════════════════════════════════════════════════════════════
// 🤖 DISCORD BOT SETUP
// ══════════════════════════════════════════════════════════════
const discordClient = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

let discordReady = false;

// Slash Commands
const commands = [
  new SlashCommandBuilder()
    .setName("ann")
    .setDescription("Global announcement bhejo")
    .addStringOption((o) =>
      o
        .setName("message")
        .setDescription("Announcement text")
        .setRequired(true),
    ),

  new SlashCommandBuilder()
    .setName("kick")
    .setDescription("User ko 5 minute kick karo")
    .addStringOption((o) =>
      o.setName("username").setDescription("Username").setRequired(true),
    ),

  new SlashCommandBuilder()
    .setName("ban")
    .setDescription("User ko permanently ban karo")
    .addStringOption((o) =>
      o.setName("username").setDescription("Username").setRequired(true),
    ),

  new SlashCommandBuilder()
    .setName("unban")
    .setDescription("User ko unban karo")
    .addStringOption((o) =>
      o.setName("username").setDescription("Username").setRequired(true),
    ),

    new SlashCommandBuilder()
    .setName("banlist")
    .setDescription("Banned users ki list filter karo")
    .addStringOption(o => o.setName("username").setDescription("Username se search karo"))
    .addStringOption(o => o.setName("country").setDescription("Country code se search karo (e.g., IN, US)"))
    .addStringOption(o => o.setName("ip").setDescription("IP address se search karo")),

  new SlashCommandBuilder()
    .setName("addvip")
    .setDescription("VIP do")
    .addStringOption((o) =>
      o.setName("username").setDescription("Username").setRequired(true),
    ),

  new SlashCommandBuilder()
    .setName("removevip")
    .setDescription("VIP hatao")
    .addStringOption((o) =>
      o.setName("username").setDescription("Username").setRequired(true),
    ),

  new SlashCommandBuilder()
    .setName("online")
    .setDescription("Online users dekho"),

  new SlashCommandBuilder()
    .setName("stats")
    .setDescription("Server statistics"),

  new SlashCommandBuilder()
    .setName("assignadmin")
    .setDescription("Admin banao")
    .addStringOption((o) =>
      o.setName("username").setDescription("Username").setRequired(true),
    ),

  new SlashCommandBuilder()
    .setName("removeadmin")
    .setDescription("Admin status hatao")
    .addStringOption((o) =>
      o.setName("username").setDescription("Username").setRequired(true),
    ),

  new SlashCommandBuilder()
    .setName("clearmessages")
    .setDescription("Global chat clear karo"),

  new SlashCommandBuilder()
    .setName("warnings")
    .setDescription("User ke warnings dekho")
    .addStringOption((o) =>
      o.setName("username").setDescription("Username").setRequired(true),
    ),

    

  new SlashCommandBuilder()
    .setName("clearwarnings")
    .setDescription("User ke warnings reset karo")
    .addStringOption((o) =>
      o.setName("username").setDescription("Username").setRequired(true),
    ),
].map((c) => c.toJSON());

// Register Commands
if (DISCORD_TOKEN) {
  const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);
  (async () => {
    try {
      await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
        body: commands,
      });
      console.log("✅ Slash commands registered");
    } catch (e) {
      console.error("❌ Slash command error:", e.message);
    }
  })();
}

// Discord Bot Ready
discordClient.once("ready", () => {
  discordReady = true;
  console.log(`🤖 HeyyYuki online as ${discordClient.user.tag}`);
  discordClient.user.setActivity("StrangerToStranger 🌐 | 24/7", {
    type: ActivityType.Watching,
  });
  updateDiscordStatus();
  logToDiscordError(`🤖 HeyyYuki Bot Started`, "info");
});

// Discord Message Mirror
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

// ══════════════════════════════════════════════════════════════
// 🤖 DISCORD INTERACTION HANDLER
// ══════════════════════════════════════════════════════════════
discordClient.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (!CONTROL_CHANNEL_IDS.includes(interaction.channelId)) {
    return interaction.reply({
      content: `❌ Access Denied! Channel ID: \`${interaction.channelId}\``,
      flags: 64,
    });
  }

  const { commandName, options } = interaction;
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
    // 📢 /ann
    if (commandName === "ann") {
      const text = options.getString("message");
      io.emit("chat message", {
        id: "ann_" + Date.now(),
        sender: "📢 Announcement",
        message: text,
        type: "system",
        room: "global",
        createdAt: new Date(),
      });
      return safeReply(`✅ Announcement bhej diya gaya`);
    }

    // 👢 /kick
    else if (commandName === "kick") {
      const target = options.getString("username").trim().toLowerCase();
      const entry = Object.entries(activeUsers).find(
        ([, u]) => u.name.toLowerCase() === target,
      );
      if (!entry) return safeReply(`❌ User online nahi hai`);

      const [sid, user] = entry;
      tempBannedIPs.set(user.ip, {
        expiry: Date.now() + 5 * 60 * 1000,
        reservedName: user.name,
      });

      io.to(sid).emit("kicked", {
        message: "👢 Aapko admin ne 5 min ke liye kick kiya hai",
      });
      setTimeout(() => {
        const sock = io.sockets.sockets.get(sid);
        if (sock) sock.disconnect(true);
      }, 800);

      return safeReply(`✅ ${user.name} kicked`);
    }

    // 🔨 /ban
    else if (commandName === "ban") {
      const target = options.getString("username").trim().toLowerCase();
      if (bannedUsernames.has(target)) {
        return safeReply(`⚠️ ${target} pehle se banned hai`);
      }

      bannedUsernames.add(target);
      saveBanned();
      await Banned.updateOne(
        { username: target },
        { username: target },
        { upsert: true },
      );

      const entry = Object.entries(activeUsers).find(
        ([, u]) => u.name.toLowerCase() === target,
      );
      if (entry) {
        const [sid] = entry;
        io.to(sid).emit("duplicate", "🚫 Aap permanently ban ho gaye");
        setTimeout(() => {
          const sock = io.sockets.sockets.get(sid);
          if (sock) sock.disconnect(true);
        }, 800);
      }

      return safeReply(`✅ ${target} permanently banned`);
    }

    // ✅ /unban
// ✅ /unban (Upgraded for IP + Username Unban)
    else if (commandName === "unban") {
      const target = options.getString("username").trim().toLowerCase();
      
      if (!bannedUsernames.has(target)) {
        return safeReply(`⚠️ ${target} banned nahi hai`);
      }

      // 1. Pehle dhoondho ki is username ki IP kya thi database mein
      const bannedUserData = await Banned.findOne({ username: target });
      if (bannedUserData && bannedUserData.ip) {
        // Agar IP mili, toh use active memory (tempBannedIPs) se turant hatao
        tempBannedIPs.delete(bannedUserData.ip);
      }

      // 2. Set aur Local Storage se username hatao
      bannedUsernames.delete(target);
      saveBanned();

      // 3. MongoDB Database se record saaf karo
      await Banned.deleteOne({ username: target });
      
      // 4. Warning schema se bhi uske purane pichle saare pap (warnings) mita do
      await Warning.deleteOne({ username: { $regex: new RegExp(target, "i") } });

      return safeReply(`✅ ${target} aur uski IP Address ko successfully unban kar diya gaya hai! 🔓`);
    }

    // 💎 /addvip
    else if (commandName === "addvip") {
      const target = options.getString("username").trim().toLowerCase();
      if (vips.has(target)) {
        return safeReply(`⚠️ ${target} pehle se VIP hai`);
      }

      vips.add(target);
      saveVips();
      await Vip.updateOne(
        { username: target },
        { username: target },
        { upsert: true },
      );

      const entry = Object.entries(activeUsers).find(
        ([, u]) => u.name.toLowerCase() === target,
      );
      if (entry) {
        const [sid] = entry;
        activeUsers[sid].isVip = true;
      }
      io.emit("user list", buildUserList());

      return safeReply(`✅ ${target} ko VIP de diya`);
    }

    // ❌ /removevip
    else if (commandName === "removevip") {
      const target = options.getString("username").trim().toLowerCase();
      if (!vips.has(target)) {
        return safeReply(`⚠️ ${target} VIP nahi hai`);
      }
      vips.delete(target);
      saveVips();
      await Vip.deleteOne({ username: target });

      const entry = Object.entries(activeUsers).find(
        ([, u]) => u.name.toLowerCase() === target,
      );
      if (entry) {
        const [sid] = entry;
        activeUsers[sid].isVip = false;
      }
      io.emit("user list", buildUserList());

      return safeReply(`⚠️ ${target} ka VIP status hataya`);
    }

    // 👥 /online
    else if (commandName === "online") {
      const users = Object.values(activeUsers);
      if (users.length === 0) return safeReply("📭 Koi online nahi");

      const list = users
        .map((u, i) => {
          const badge = isUserAdmin(u.name.toLowerCase())
            ? "👑"
            : isUserVip(u.name.toLowerCase())
              ? "💎"
              : "👤";
          return `${i + 1}. ${badge} \`${u.name}\` — \`${u.ip}\``;
        })
        .join("\n");

      return safeReply(`**🟢 Online (${users.length}):**\n${list}`);
    }

    // 📊 /stats
    else if (commandName === "stats") {
      await interaction.deferReply({ flags: 64 });

      const [
        totalMsg,
        totalDMs,
        totalReports,
        totalBanned,
        totalVips,
        totalWarnings,
      ] = await Promise.all([
        Message.countDocuments(),
        DM.countDocuments(),
        Report.countDocuments(),
        Banned.countDocuments(),
        Vip.countDocuments(),
        Warning.countDocuments(),
      ]);

      const onlineCount = Object.keys(activeUsers).length;

      return interaction.editReply(
        `📊 **Server Stats**\n\n` +
          `🟢 Online: ${onlineCount}\n` +
          `💬 Messages: ${totalMsg}\n` +
          `📨 DMs: ${totalDMs}\n` +
          `🚨 Reports: ${totalReports}\n` +
          `⚠️ Warnings: ${totalWarnings}\n` +
          `🔨 Banned: ${totalBanned}\n` +
          `💎 VIPs: ${totalVips}\n` +
          `👑 Admins: ${admins.size}`,
      );
    }

    // 👑 /assignadmin
    else if (commandName === "assignadmin") {
      const target = options.getString("username").trim().toLowerCase();
      if (isUserAdmin(target)) {
        return safeReply(`⚠️ ${target} pehle se admin hai`);
      }

      admins.add(target);
      saveAdmins();
      vips.add(target);
      saveVips();
      await Vip.updateOne(
        { username: target },
        { username: target },
        { upsert: true },
      );

      const entry = Object.entries(activeUsers).find(
        ([, u]) => u.name.toLowerCase() === target,
      );
      if (entry) {
        const [sid] = entry;
        activeUsers[sid].isAdmin = true;
        activeUsers[sid].isVip = true;
      }
      io.emit("user list", buildUserList());

      return safeReply(`✅ ${target} admin ban gaya 👑`);
    }

    // ❌ /removeadmin
    else if (commandName === "removeadmin") {
      const target = options.getString("username").trim().toLowerCase();
      if (!admins.has(target)) {
        return safeReply(`⚠️ ${target} admin nahi hai`);
      }
      admins.delete(target);
      saveAdmins();

      const entry = Object.entries(activeUsers).find(
        ([, u]) => u.name.toLowerCase() === target,
      );
      if (entry) {
        const [sid] = entry;
        activeUsers[sid].isAdmin = false;
      }
      io.emit("user list", buildUserList());

      return safeReply(`⚠️ ${target} ka admin status hataya`);
    }

    // 🧹 /clearmessages
    else if (commandName === "clearmessages") {
      await interaction.deferReply({ flags: 64 });
      const result = await Message.deleteMany({ room: "global" });
      io.emit("messages_cleared", { room: "global" });

      return interaction.editReply(
        `✅ **${result.deletedCount}** messages delete ho gaye`,
      );
    }

    // ⚠️ /warnings
    else if (commandName === "warnings") {
      const target = options.getString("username").trim().toLowerCase();
      const warning = await Warning.findOne({
        username: { $regex: new RegExp(target, "i") },
      });

      if (!warning) {
        return safeReply(`✅ \`${target}\` ke koi warnings nahi hain`);
      }

      return safeReply(
        `⚠️ **${target}** ke **${warning.count}/3** warnings\n` +
          `Reason: ${warning.reason}\n` +
          `${warning.count >= 3 ? "🚫 BANNED LE LI!" : ""}`,
      );
    }

// 🔄 /clearwarnings
    else if (commandName === "clearwarnings") {
      const target = options.getString("username").trim().toLowerCase();
      await Warning.deleteOne({ username: { $regex: new RegExp(target, "i") } });
      return safeReply(`✅ ${target} ke warnings clear ho gaye`);
    }

    // 🔨 /banlist (Fixed Syntax)
else if (commandName === "banlist") {
      await interaction.deferReply({ flags: 64 });
      
      const username = options.getString("username");
      const country = options.getString("country");
      const ip = options.getString("ip");

      let query = {};
      if (username) query.username = { $regex: new RegExp(username, "i") };
      if (country) query.country = { $regex: new RegExp(country, "i") };
      if (ip) query.ip = { $regex: new RegExp(ip, "i") };

      const results = await Banned.find(query).lean();

      if (!results.length) return interaction.editReply("📭 **Koi match nahi mila!**");

      const list = results.map((u, i) => 
        `**${i + 1}.** 👤 \`${u.username}\` | 🌐 \`${u.ip}\` | 🌍 \`${u.country}\` | 📝 \`${u.reason}\``
      ).join("\n");

      return interaction.editReply(`🔍 **Search Results (${results.length}):**\n\n${list.substring(0, 1900)}`);
    }

    // Unknown
    else {
      return safeReply(`⚠️ Command unknown`);
    }
  } catch (err) {
    console.error(`❌ Command Error [${commandName}]:`, err);
    try {
      await safeReply("❌ Error aaya");
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
    discordClient.user?.setActivity(`${count} Online 🌐`, {
      type: ActivityType.Watching,
    });
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
    if (opts.fields) embed.addFields(opts.fields);
    ch.send({ embeds: [embed] });
  } catch (e) {}
}

async function logToDiscordError(msg, type = "error") {
  if (!discordReady || !ERROR_CHANNEL_ID) return;
  try {
    const ch = discordClient.channels.cache.get(ERROR_CHANNEL_ID);
    if (!ch) return;
    const colors = { error: 0xff3c5f, warn: 0xffd60a, info: 0x00f5a0 };
    const icons = { error: "❌", warn: "⚠️", info: "ℹ️" };
    const embed = new EmbedBuilder()
      .setColor(colors[type] || 0xff3c5f)
      .setTitle(`${icons[type]} ${type.toUpperCase()}`)
      .setDescription("```" + msg.substring(0, 1900) + "```")
      .setTimestamp()
      .setFooter({ text: "HeyyYuki Monitor" });
    ch.send({ embeds: [embed] });
  } catch (e) {}
}

// ══════════════════════════════════════════════════════════════
// 🔌 SOCKET.IO
// ══════════════════════════════════════════════════════════════
io.on("connection", (socket) => {
  const userIP = getIP(socket);
  let currentUser = null;

  // ── JOIN ──
  socket.on("join", async (data) => {
    try {
      const name = (data.name || "").trim();
      const bio = (data.bio || "No bio").trim();
      const avatar = data.avatar || "";
      const color = data.color || "#00f5a0";
      const nameLower = name.toLowerCase();

      if (!name || name.length < 2) {
        return socket.emit(
          "error_msg",
          "Username kam se kam 2 characters ka ho",
        );
      }


      // Permanent & Temp IP check on Join
      if (tempBannedIPs.has(userIP)) {
         return socket.emit("duplicate", "🚫 You are banned by admin.");
      }

      // IP kick check
      if (tempBannedIPs.has(userIP)) {
        const ban = tempBannedIPs.get(userIP);
        if (Date.now() < ban.expiry) {
          if (nameLower !== ban.reservedName.toLowerCase()) {
            return socket.emit(
              "duplicate",
              `🚫 Aap kicked hain. Sirf "${ban.reservedName}" allowed hai`,
            );
          }
          return socket.emit("kick_timer", {
            message: `👢 ${Math.ceil((ban.expiry - Date.now()) / 60000)} min wait karein`,
            remainingTime: ban.expiry - Date.now(),
          });
        } else {
          tempBannedIPs.delete(userIP);
        }
      }

      // Ban check
      if (bannedUsernames.has(nameLower)) {
        return socket.emit("duplicate", "🚫 Aap permanently banned hain");
      }

      // Duplicate check
      const duplicate = Object.values(activeUsers).find(
        (u) => u.name.toLowerCase() === nameLower,
      );
      if (duplicate) {
        return socket.emit("duplicate", "⚠️ Ye username liya hua hai");
      }

      const userIsAdmin = isUserAdmin(nameLower);
      const userIsVip = isUserVip(nameLower);

      currentUser = {
        socketId: socket.id,
        name,
        bio,
        avatar,
        color,
        ip: userIP,
        isVip: userIsVip,
        isAdmin: userIsAdmin,
        room: "global",
      };

      activeUsers[socket.id] = currentUser;
      socket.join("global");

      // Load message history
      const history = await Message.find({ room: "global" })
        .sort({ createdAt: 1 })
        .limit(100)
        .lean();

      const normalizedHistory = history.map((m) => ({
        id: m._id.toString(),
        sender: m.senderName,
        senderAvatar: m.senderAvatar,
        senderColor: m.senderColor,
        message: m.text,
        type: m.type || "text",
        mediaUrl: m.mediaUrl,
        isVip: m.isVip,
        room: m.room,
        createdAt: m.createdAt,
      }));

      socket.emit("history", normalizedHistory);

      // Join notification
      io.to("global").emit("chat message", {
        id: "sys_" + Date.now(),
        sender: "System",
        message: `${name} joined`,
        type: "system",
        room: "global",
        createdAt: new Date(),
      });

      io.emit("user list", buildUserList());
      socket.emit("joined", currentUser);
      updateDiscordStatus();

      // Load groups
      const groups = await Group.find({}).sort({ createdAt: -1 }).lean();
      socket.emit(
        "groups_list",
        groups.map((g) => ({ ...g, hasPassword: !!g.password })),
      );
    } catch (err) {
      console.error("join error:", err);
      socket.emit("error_msg", "Join failed");
    }
  });

  // ── CHAT MESSAGE WITH PROFANITY CHECK ──
  socket.on("chat message", async (data) => {
    if (!currentUser) return;
    try {
      const room = data.room || "global";
      const message = data.message || "";

      // 🚨 PROFANITY CHECK
      if (containsProfanity(message)) {
        const nameLower = currentUser.name.toLowerCase();
        let warning = await Warning.findOne({ username: nameLower });

        if (!warning) {
          warning = new Warning({
            username: nameLower,
            count: 1,
            reason: "Profanity/Abuse",
            messages: [{ text: message, date: new Date() }],
          });
        } else {
          warning.count += 1;
          warning.messages.push({ text: message, date: new Date() });
          warning.lastWarningAt = new Date();
        }

        await warning.save();

// 🚨 3 warnings = Auto IP Ban + Username Ban
        if (warning.count >= 3) {
          const userIP = currentUser.ip;

          bannedUsernames.add(nameLower);
          saveBanned();

          await Banned.updateOne(
            { username: nameLower },
            { username: nameLower, ip: userIP },
            { upsert: true }
          );

          tempBannedIPs.set(userIP, {
            expiry: Date.now() + 999 * 365 * 24 * 60 * 60 * 1000, 
            reservedName: currentUser.name,
          });

          // 📢 1. Normal alert Profanity Channel mein bhej rahe hain
          sendEmbed(PROFANITY_CHANNEL_ID, {
            color: 0xffd60a,
            title: "⚠️ User Crossed Warning Limit",
            description: `**${currentUser.name}** ne 3 warnings cross kar li hain aur use ban list mein daal diya gaya hai.`
          });

          // 🚫 2. [NEW] Banned Users Wale Special Channel Mein Entry
          sendEmbed(BANNED_LOG_CHANNEL_ID, {
            color: 0x7289da, // Discord Blurple color ya Red
            title: "🔒 NEW BANNED USER REGISTRY",
            fields: [
              { name: "👤 Username", value: `\`${currentUser.name}\``, inline: true },
              { name: "🌐 User IP", value: `\`${userIP}\``, inline: true },
              { name: "🕒 Banned At", value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false },
              { name: "📝 Reason", value: "Website par baar-baar abuse words/galiyan use karna (3/3 Warnings).", inline: false },
              {
                name: "🤬 Un-redacted Chat Log",
                value: warning.messages
                  .slice(-3)
                  .map((m) => `• "${m.text}"`)
                  .join("\n"),
                inline: false,
              },
            ],
          });

          // 🖥️ 3. Frontend Action
          io.to(socket.id).emit("force_logout", "🚫 Aap 3 baar gali dene ki wajah se PERMANENTLY IP BAN ho chuke hain!");
          
          setTimeout(() => {
            const sock = io.sockets.sockets.get(socket.id);
            if (sock) sock.disconnect(true);
          }, 500);
          return;
          
        } else {
          // ⚠️ 3. Normal Warning (For Warning 1 and 2)
          io.to(socket.id).emit("profanity_warning", {
            count: warning.count,
            message: `⚠️ WARNING ${warning.count}/3: Galiyan don't use! Next time ban hojayega!`,
          });

          // 📢 Discord Notification for Warning 1 & 2
          sendEmbed(PROFANITY_CHANNEL_ID, {
            color: 0xffd60a,
            title: `⚠️ Profanity Warning #${warning.count}`,
            fields: [
              { name: "Username", value: `\`${currentUser.name}\``, inline: true },
              { name: "Warnings", value: `${warning.count}/3`, inline: true },
              { name: "Message Spoken", value: `"${message}"`, inline: false },
            ],
          });

          return; // 👈 Message block ho gaya, aage nahi jayega
        }
      }

      // Normal message (no profanity)
      const payload = {
        id: data.id || socket.id + "_" + Date.now(),
        sender: currentUser.name,
        senderAvatar: currentUser.avatar,
        senderColor: currentUser.color,
        isVip: currentUser.isVip,
        message: message,
        type: data.type || "text",
        mediaUrl: data.mediaUrl || "",
        replyTo: data.replyTo || null,
        room,
        createdAt: new Date(),
      };

      const msgDoc = new Message({
        room,
        senderId: socket.id,
        senderName: currentUser.name,
        senderAvatar: currentUser.avatar,
        senderColor: currentUser.color,
        text: message,
        type: data.type || "text",
        mediaUrl: data.mediaUrl || "",
        isVip: currentUser.isVip,
      });
      await msgDoc.save();
      payload._id = msgDoc._id.toString();

      if (!shadowBanned.has(currentUser.name.toLowerCase())) {
        io.to(room).emit("chat message", payload);
      } else {
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
    } catch (e) {}
    io.emit("delete message", id);
  });

  // ── TYPING ──
  socket.on("typing", (data) => {
    if (!currentUser) return;
    const room = data && data.room ? data.room : "global";
    socket.to(room).emit("typing", { user: currentUser.name });
  });

  // ── PRIVATE MESSAGE (PERSISTENT STORAGE) ──
  socket.on("private message", async (data) => {
    if (!currentUser) return;
    try {
      const receiverName = data.receiver;
      const toUser = Object.values(activeUsers).find(
        (u) => u.name.toLowerCase() === receiverName?.toLowerCase(),
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
        senderName: currentUser.name,
        senderAvatar: currentUser.avatar,
        senderColor: currentUser.color,
        text: data.message,
        type: data.type || "text",
        mediaUrl: data.mediaUrl || "",
        caption: data.caption || "",
        createdAt: new Date(),
      };
      dmDoc.messages.push(msgObj);
      dmDoc.updatedAt = new Date();
      await dmDoc.save();

      const payload = {
        channelId,
        id: data.id || genId(),
        sender: currentUser.name,
        senderAvatar: currentUser.avatar,
        senderColor: currentUser.color,
        receiver: receiverName,
        message: data.message,
        type: data.type || "text",
        mediaUrl: data.mediaUrl || "",
        caption: data.caption || "",
        createdAt: new Date(),
      };

      socket.emit("private message", payload);
      if (toUser) io.to(toUser.socketId).emit("private message", payload);
    } catch (err) {
      console.error("private message error:", err);
    }
  });

  // ── DM HISTORY (LOADS FROM DATABASE) ──
  socket.on("dm_history", async ({ withUser }) => {
    if (!currentUser) return;
    try {
      const channelId = getDMChannelId(currentUser.name, withUser);
      const dmDoc = await DM.findOne({ channelId }).lean();
      const messages = (dmDoc ? dmDoc.messages : []).map((m) => ({
        sender: m.senderName,
        senderAvatar: m.senderAvatar,
        senderColor: m.senderColor,
        message: m.text,
        type: m.type,
        mediaUrl: m.mediaUrl,
        caption: m.caption || "",
        createdAt: m.createdAt,
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
      (u) => u.name.toLowerCase() === toUser?.toLowerCase(),
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
      if (!group) return socket.emit("group_error", "Group not found");
      if (group.password && group.password !== password) {
        return socket.emit("group_error", "Wrong password");
      }

      const room = "group_" + groupId;
      socket.join(room);
      if (currentUser) currentUser.room = room;

      const history = await Message.find({ room })
        .sort({ createdAt: 1 })
        .limit(100)
        .lean();

      socket.emit("group_joined", { group, history });
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
        password: password || "",
        adminName: currentUser.name,
        icon: icon || "👥",
        members: [currentUser.name],
      });
      await group.save();
      socket.emit("group_created", group);

      const groups = await Group.find({}).sort({ createdAt: -1 }).lean();
      io.emit(
        "groups_list",
        groups.map((g) => ({ ...g, hasPassword: !!g.password })),
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
        groups.map((g) => ({ ...g, hasPassword: !!g.password })),
      );
    } catch (err) {
      console.error("get_groups error:", err);
    }
  });

  // ── REPORT USER ──
  socket.on("report user", async (data) => {
    try {
      const device = /Mobi|Android/i.test(
        socket.handshake.headers["user-agent"] || "",
      )
        ? "📱 Mobile"
        : "🖥️ Desktop";

      await new Report({
        reportedUser: data.reportedUser,
        reporterUser: data.reportedBy || data.reporterUser || currentUser?.name,
        reporterEmail: data.email,
        category: data.reason,
        reason: data.description || data.reason,
        device,
      }).save();

      sendEmbed(REPORT_CHANNEL_ID, {
        color: 0xff3c5f,
        title: "🚨 New Report",
        fields: [
          { name: "Reported", value: `\`${data.reportedUser}\``, inline: true },
          {
            name: "Reporter",
            value: `\`${data.reportedBy || "—"}\``,
            inline: true,
          },
          {
            name: "Category",
            value: `\`${data.reason || "—"}\``,
            inline: false,
          },
          {
            name: "Details",
            value: (data.description || "—").substring(0, 1000),
            inline: false,
          },
        ],
      });

      socket.emit("report_success");
    } catch (err) {
      socket.emit("report_error", "Report failed");
    }
  });

  // ── PROFILE UPDATE ──
  socket.on("update profile", ({ bio, avatar, color, name }) => {
    if (!currentUser) return;
    if (bio !== undefined) currentUser.bio = bio;
    if (avatar !== undefined) currentUser.avatar = avatar;
    if (color !== undefined) currentUser.color = color;
    if (name && name !== currentUser.name) {
      const nameLower = name.toLowerCase();
      const dup = Object.values(activeUsers).find(
        (u) => u.name.toLowerCase() === nameLower && u.socketId !== socket.id,
      );
      if (!dup) currentUser.name = name;
    }

    activeUsers[socket.id] = currentUser;
    io.emit("user list", buildUserList());
    socket.emit("profile_updated", currentUser);
  });

  // ── DISCONNECT ──
  socket.on("disconnect", () => {
    if (!currentUser) return;

    io.emit("chat message", {
      id: "sys_" + Date.now(),
      sender: "System",
      message: `${currentUser.name} left`,
      type: "system",
      room: currentUser.room || "global",
      createdAt: new Date(),
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
  }),
);

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.post("/api/report", async (req, res) => {
  try {
    const device = /Mobi|Android/i.test(req.headers["user-agent"] || "")
      ? "📱 Mobile"
      : "🖥️ Desktop";
    const data = { ...req.body, device };
    await new Report(data).save();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false });
  }
});

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    online: Object.keys(activeUsers).length,
    discord: discordReady,
    mongo: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
  });
});

// ══════════════════════════════════════════════════════════════
// 🚀 START SERVER
// ══════════════════════════════════════════════════════════════
http.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📋 Admin: ${ADMIN_NAME}`);
  console.log(`🚨 Profanity detection: ACTIVE`);
});

// ══════════════════════════════════════════════════════════════
// 🛡️ CRASH PROTECTION
// ══════════════════════════════════════════════════════════════
process.on("unhandledRejection", (err) => {
  console.error("⚠️ Unhandled Rejection:", err);
  logToDiscordError(
    `💥 Unhandled Rejection:\n${String(err).substring(0, 1500)}`,
  );
});

process.on("uncaughtException", (err) => {
  console.error("⚠️ Uncaught Exception:", err);
  logToDiscordError(
    `💥 Uncaught Exception:\n${err.message}\n${(err.stack || "").substring(0, 1000)}`,
  );
});
