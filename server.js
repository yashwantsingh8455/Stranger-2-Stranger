  // ── 1. CONFIGURATION & MODULES ──────────────────────────────────────────────
  require("dotenv").config();
  const express = require("express");
  const app = express();
  const http = require("http").createServer(app);
  const io = require("socket.io")(http);
  const path = require("path");
  const fs = require("fs");

  const {
    Client,
    GatewayIntentBits,
    EmbedBuilder,
    ActivityType,
    REST,
    Routes,
    SlashCommandBuilder,
  } = require("discord.js");

  // ── 2. GLOBAL STATE & PERSISTENCE ───────────────────────────────────────────
  let users = {};
  let tempBannedIPs = new Map(); // 🕒 Tracks temporary kicked IPs and their expiry timestamps
  let shadowBanned = new Set();
  let vips = new Set();
  const ADMIN_NAME = "Yashwant";

  const BANNED_FILE = path.join(__dirname, "banned-usernames.json");
  const VIPS_FILE = path.join(__dirname, "vip-users.json");

  let bannedUsernames = new Set();

  // Load Banned Users
  if (fs.existsSync(BANNED_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(BANNED_FILE, "utf8"));
      bannedUsernames = new Set(data);
    } catch (e) {
      console.error("Error loading ban list:", e);
    }
  }

  // Load VIP Users
  if (fs.existsSync(VIPS_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(VIPS_FILE, "utf8"));
      vips = new Set(data);
    } catch (e) {
      console.error("Error loading VIP list:", e);
    }
  }

  function saveBanned() {
    fs.writeFileSync(BANNED_FILE, JSON.stringify([...bannedUsernames]), "utf8");
  }

  function saveVips() {
    fs.writeFileSync(VIPS_FILE, JSON.stringify([...vips]), "utf8");
  }

  // ── 3. DISCORD BOT SETUP ────────────────────────────────────────────────────
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
  });

  const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
  const CLIENT_ID = process.env.CLIENT_ID || "1478767384398528573";

  // 🎯 ALL DEDICATED CHANNELS FOR YUKI MONITORING
  const CONTROL_CHANNEL_ID = "1485501424891727952"; // Slash commands running area
  const STATUS_CHANNEL_ID = "1503654154457845900";  // Server status counter channel
  const CHAT_CHANNEL_ID = "1503653808105062480";    // Pure Text logs
  const MEDIA_LOG_CHANNEL_ID = "1503653995246518292"; // Images, Videos, Audio previews
  const JOIN_LEAVE_CHANNEL_ID = "1503653732372447273"; // Live user tracking
  const MOD_LOG_CHANNEL_ID = "1503653357229969540";   // Reports, Bans, Violations
  const VIP_LOG_CHANNEL_ID = "1505848329790029844";   // VIP Add/Remove logs

  // ── 4. REGISTER SLASH COMMANDS ──────────────────────────────────────────────
  const commands = [
    new SlashCommandBuilder()
      .setName("ann")
      .setDescription("Send a global announcement popup to website")
      .addStringOption((opt) =>
        opt.setName("message").setDescription("Announcement text").setRequired(true)
      ),

    new SlashCommandBuilder()
      .setName("kick")
      .setDescription("Kick an active user from web chat via IP (5 Minutes Restrictions)")
      .addStringOption((opt) =>
        opt.setName("username").setDescription("Username to kick").setRequired(true)
      ),

    new SlashCommandBuilder()
      .setName("ban")
      .setDescription("Permanently ban a username from web app")
      .addStringOption((opt) =>
        opt.setName("username").setDescription("Username to ban").setRequired(true)
      ),

    new SlashCommandBuilder()
      .setName("unban")
      .setDescription("Remove permanent ban from a username")
      .addStringOption((opt) =>
        opt.setName("username").setDescription("Username to unban").setRequired(true)
      ),

    new SlashCommandBuilder()
      .setName("addvip")
      .setDescription("Assign VIP status (Adds Blue Tick on Website)")
      .addStringOption((opt) =>
        opt.setName("username").setDescription("Username for VIP status").setRequired(true)
      ),

    new SlashCommandBuilder()
      .setName("removevip")
      .setDescription("Revoke VIP status and remove Blue Tick")
      .addStringOption((opt) =>
        opt.setName("username").setDescription("Username to remove VIP status").setRequired(true)
      ),

    new SlashCommandBuilder()
      .setName("online")
      .setDescription("Show detailed info of all online web users"),
  ].map((cmd) => cmd.toJSON());

  const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);

  (async () => {
    try {
      console.log("🔄 Started refreshing application (/) commands...");
      await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
      console.log("✅ Successfully reloaded application (/) commands inside Discord.");
    } catch (error) {
      console.error("❌ Slash command Registration Error:", error);
    }
  })();

  // ── 5. HELPERS ──────────────────────────────────────────────────────────────
  function getIP(socket) {
    const raw = socket.handshake.headers["x-forwarded-for"] || socket.handshake.address;
    return (raw || "127.0.0.1").split(",")[0].trim();
  }

  function buildUserList() {
    return Object.values(users).map((u) => ({
      name: u.name,
      bio: u.bio,
      isVip: u.isVip,
    }));
  }

  async function updateDiscordStatus() {
    try {
      const count = Object.keys(users).length;
      client.user?.setActivity(`${count} Strangers Online`, {
        type: ActivityType.Watching,
      });

      const channel = await client.channels.fetch(STATUS_CHANNEL_ID).catch(() => null);
      if (channel && channel.isTextBased()) {
        await channel.setName(`🟢-active-${count}`).catch(() => {});
      }
    } catch (e) {
      console.log("Status Update Error:", e.message);
    }
  }

  // ── 6. DISCORD INTERACTION (SLASH COMMANDS) ─────────────────────────────────
  client.on("interactionCreate", async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.channelId !== CONTROL_CHANNEL_ID) {
      return interaction.reply({
        content: `❌ Security Bypass Blocked! Run Yuki commands only inside <#${CONTROL_CHANNEL_ID}> channel!`,
        ephemeral: true,
      });
    }

    const { commandName, options } = interaction;

    // 1. GLOBAL ANNOUNCEMENT
    if (commandName === "ann") {
      const msg = options.getString("message");
      io.emit("announcement", msg);
      await interaction.reply(`📢 Global Announcement broadcasted on website: **${msg}**`);
    }

    // 2. KICK USER FROM CHAT (ADVANCED 5-MINUTE IP BAN)
  // 2. KICK USER FROM CHAT (ADVANCED 5-MINUTE IP & NAME LOCK)
    if (commandName === "kick") {
      const target = options.getString("username").toLowerCase();
      const sid = Object.keys(users).find((id) => users[id].name.toLowerCase() === target);

      if (sid) {
        const targetIP = users[sid].ip;
        const originalName = users[sid].name; // Capital casing wala asli naam save karein
        const banExpiry = Date.now() + 5 * 60 * 1000; 
        
        // IP ke sath naam bhi lock kar diya jail mein
        tempBannedIPs.set(targetIP, {
          expiry: banExpiry,
          reservedName: originalName
        });

        // Frontend ko signal bhein ki tum kick ho chuke ho aur tumhara naam ye hai
        io.to(sid).emit("kicked_signal", {
          message: "👢 You have been kicked for 5 minutes. Relax, we will re-login you automatically!",
          name: originalName,
          bio: users[sid].bio,
          expiry: banExpiry
        });

        io.sockets.sockets.get(sid)?.disconnect();

        setTimeout(() => {
          if (tempBannedIPs.has(targetIP)) {
            tempBannedIPs.delete(targetIP);
            console.log(`[Scheduler] 🔓 IP ${targetIP} released. Purana user ab login kar sakta hai.`);
          }
        }, 5 * 60 * 1000);

        const kickEmbed = new EmbedBuilder()
          .setColor("#e67e22")
          .setTitle("👢 Temporary IP & Name Lock Enforced")
          .setDescription(`**User:** \`${originalName}\`\n**Network IP:** \`${targetIP}\`\n**Duration:** \`5 Minutes\`\n**Status:** Name reserved. No other username allowed from this IP.`)
          .setTimestamp();
        client.channels.cache.get(MOD_LOG_CHANNEL_ID)?.send({ embeds: [kickEmbed] });

        await interaction.reply(`✅ Target Neutralized: **${originalName}** has been kicked. Name reserved for 5 mins.`);
      } else {
        await interaction.reply("❌ Action Failed: User is currently offline.");
      }
    }

    // 3. PERMANENT BAN
    if (commandName === "ban") {
      const target = options.getString("username").toLowerCase();
      bannedUsernames.add(target);
      saveBanned();

      const sid = Object.keys(users).find((id) => users[id].name.toLowerCase() === target);
      if (sid) {
        io.to(sid).emit("duplicate", "🚫 Your Username has been Permanently Banned.");
        io.sockets.sockets.get(sid)?.disconnect();
      }

      const banEmbed = new EmbedBuilder()
        .setColor("#ff4757")
        .setTitle("🚫 Username Permanently Banned")
        .setDescription(`**Username:** ${target}\n**Enforced By:** Admin via Discord Control Room`)
        .setTimestamp();
      client.channels.cache.get(MOD_LOG_CHANNEL_ID)?.send({ embeds: [banEmbed] });

      await interaction.reply(`🚫 Verified: **${target}** has been added to blacklist repository.`);
    }

    // 4. UNBAN USERNAME
    if (commandName === "unban") {
      const target = options.getString("username").toLowerCase();
      if (bannedUsernames.has(target)) {
        bannedUsernames.delete(target);
        saveBanned();

        const unbanEmbed = new EmbedBuilder()
          .setColor("#2ed573")
          .setTitle("🔓 Username Unbanned")
          .setDescription(`**Username:** ${target}\n**Action Type:** Cleared from blacklist database`)
          .setTimestamp();
        client.channels.cache.get(MOD_LOG_CHANNEL_ID)?.send({ embeds: [unbanEmbed] });

        await interaction.reply(`✅ Restored: **${target}** is now allowed to connect again.`);
      } else {
        await interaction.reply("❌ Error: Target username is not restricted in global blacklist.");
      }
    }

    // 5. ASSIGN VIP (BLUE TICK ADD)
    if (commandName === "addvip") {
      const target = options.getString("username").toLowerCase();
      vips.add(target);
      saveVips();

      Object.keys(users).forEach((sid) => {
        if (users[sid].name.toLowerCase() === target) {
          users[sid].isVip = true;
        }
      });

      io.emit("vip_update", { username: target, action: "grant" });
      io.emit("user list", buildUserList());

      const vipAddEmbed = new EmbedBuilder()
        .setColor("#1e90ff")
        .setTitle("💎 VIP Access Granted")
        .setDescription(`**User:** ${target}\n**Perks:** Automatic Blue Verification Badge activated across sessions.`)
        .setTimestamp();
      client.channels.cache.get(VIP_LOG_CHANNEL_ID)?.send({ embeds: [vipAddEmbed] });

      await interaction.reply(`💎 Premium Level Sync: **${target}** has received a verified status.`);
    }

    // 6. REVOKE VIP (BLUE TICK REMOVE)
    if (commandName === "removevip") {
      const target = options.getString("username").toLowerCase();
      if (vips.has(target)) {
        vips.delete(target);
        saveVips();

        Object.keys(users).forEach((sid) => {
          if (users[sid].name.toLowerCase() === target && users[sid].name !== ADMIN_NAME) {
            users[sid].isVip = false;
          }
        });

        io.emit("vip_update", { username: target, action: "revoke" });
        io.emit("user list", buildUserList());

        const vipRevokeEmbed = new EmbedBuilder()
          .setColor("#ffa500")
          .setTitle("⚠️ VIP Status Revoked")
          .setDescription(`**User:** ${target}\n**Action:** Blue verification tick badge stripped.`)
          .setTimestamp();
        client.channels.cache.get(VIP_LOG_CHANNEL_ID)?.send({ embeds: [vipRevokeEmbed] });

        await interaction.reply(`⚠️ Sync Updated: VIP credentials removed from **${target}**.`);
      } else {
        await interaction.reply("❌ Validation Fail: This user is not listed under VIP accounts.");
      }
    }

    // 7. ONLINE STATUS CONTROL
    if (commandName === "online") {
      const list = Object.values(users)
        .map((u) => `• **${u.name}** ${u.isVip ? "🔹(VIP)" : ""} | IP: \`${u.ip}\` | Bio: *${u.bio}*`)
        .join("\n") || "No live sessions running on server.";

      await interaction.reply(`📊 **Active Sessions Logged (${Object.keys(users).length}):**\n${list}`);
    }
  });

  // ── 7. DISCORD CHAT MIRRORING (ADMIN TRANSMITTER) ───────────────────────────
  client.on("messageCreate", (message) => {
    if (message.author.bot || message.channel.id !== CHAT_CHANNEL_ID) return;
    if (message.content.startsWith("/")) return;

    io.emit("chat message", {
      id: "d-" + Date.now(),
      sender: "Admin",
      message: message.content,
      type: "text",
      isVip: true,
      createdAt: new Date(),
    });
  });

  // ── 8. SOCKET.IO (WEB MONITORING ENVIRONMENT) ────────────────────────────────
  io.on("connection", (socket) => {
    const userIP = getIP(socket);
    let currentUserName = "";

  socket.on("join", (data) => {
      const name = (data.name || "").trim();
      const bio = (data.bio || "No bio added").trim();
      const nameLower = name.toLowerCase();

      // 🕒 1. Smart 5-Minute IP & Name Lockdown Checker
      if (tempBannedIPs.has(userIP)) {
        const banData = tempBannedIPs.get(userIP);
        
        if (Date.now() < banData.expiry) {
          const remainingMin = Math.ceil((banData.expiry - Date.now()) / 60000);
          
          // Agar user kisi naye naam se aane ki koshish karega toh block ho jayega
          if (nameLower !== banData.reservedName.toLowerCase()) {
            return socket.emit("duplicate", `🚫 Access Denied! You are temporary kicked username: "${banData.reservedName}". Please wait for 5-10 mins!`);
          }
          
          // Agar sahi naam se aayega par timer bacha hai, toh batao kitna time bacha hai
          return socket.emit("kick_timer", {
            message: `👢 You are temporarily kicked. Automatic re-login in ${remainingMin} minutes.`,
            remainingTime: banData.expiry - Date.now()
          });
        } else {
          tempBannedIPs.delete(userIP);
        }
      }

      // 🚫 2. Permanent Username Ban Check
      if (bannedUsernames.has(nameLower))
        return socket.emit("duplicate", "You are permanently banned from this chat app.");

      // ⚔️ 3. Identity Collision Check
      if (Object.values(users).some((u) => u.name.toLowerCase() === nameLower))
        return socket.emit("duplicate", "Username identity collision. Already active.");

      // 🔥 User Active Verified
      currentUserName = name;
      users[socket.id] = {
        name,
        bio,
        ip: userIP,
        isVip: vips.has(nameLower) || name === ADMIN_NAME,
      };

      socket.join(`user:${nameLower}`);
      socket.emit("joined");

      io.emit("user list", buildUserList());
      io.emit("system message", `${name} joined the chatroom`);
      updateDiscordStatus();

      const joinMessage = `\`[CORE_SYS]\` 📥 **Inbound Connection Established**\n\`\`\`yaml\nUSER_ID  : "${name}"\nIP_INDEX : "${userIP}"\nBIO_DATA : "${bio}"\nSTATUS   : "ONLINE_SESSION_ACTIVE"\n\`\`\``;
      client.channels.cache.get(JOIN_LEAVE_CHANNEL_ID)?.send(joinMessage);
    });

    socket.on("chat message", (data) => {
      if (!currentUserName) return;

      const payload = {
        ...data,
        sender: currentUserName,
        isVip: users[socket.id]?.isVip || false,
        createdAt: new Date(),
      };

      if (!shadowBanned.has(currentUserName.toLowerCase())) {
        socket.broadcast.emit("chat message", payload);

        if (payload.type === "text") {
          client.channels.cache
            .get(CHAT_CHANNEL_ID)
            .send(`💬 **${currentUserName}** ${payload.isVip ? "🔹" : ""}: ${payload.message}`);
        } else {
          const mediaEmbed = new EmbedBuilder()
            .setColor("#9b59b6")
            .setTitle(`🖼️ Content Alert: Upload Detected`)
            .setDescription(`👤 **From User:** ${currentUserName} ${payload.isVip ? "🔹" : ""}\n📦 **Data Format:** \`${payload.type.toUpperCase()}\``)
            .setTimestamp();

          if (payload.type === "image") {
            mediaEmbed.setImage(payload.message);
          } else {
            mediaEmbed.addFields({
              name: "Media Attachment URL",
              value: `[Click to view asset payload](${payload.message})`,
            });
          }

          client.channels.cache.get(MEDIA_LOG_CHANNEL_ID)?.send({ embeds: [mediaEmbed] });
        }
      } else {
        socket.emit("chat message", payload);
      }
    });

    socket.on("private message", (data) => {
      if (!currentUserName) return;
      socket.to(`user:${data.receiver.toLowerCase()}`).emit("private message", {
        ...data,
        sender: currentUserName,
        createdAt: new Date(),
      });
    });

    socket.on("report user", (data) => {
      const embed = new EmbedBuilder()
        .setColor("#ff4757")
        .setTitle("🚩 Core Intercept: Abuse Report Submitted")
        .addFields(
          { name: "Target Accused", value: `\`${data.reportedUser}\``, inline: true },
          { name: "Trigger Reason", value: `\`${data.reason}\``, inline: true },
          { name: "Reporter Origin", value: `\`${data.reportedBy}\``, inline: true },
          { name: "Incident Description", value: data.description || "*No supplementary documentation added.*" },
        )
        .setTimestamp();
      client.channels.cache.get(MOD_LOG_CHANNEL_ID)?.send({ embeds: [embed] });
    });

    socket.on("typing", () => socket.broadcast.emit("typing", { user: currentUserName }));
    socket.on("delete message", (id) => io.emit("delete message", id));

    socket.on("disconnect", () => {
      // 🔴 FILTER CHECK: Leave terminal log only executes for actively authenticated users
      if (currentUserName) {
        io.emit("system message", `${currentUserName} left the chatroom`);

        // 🔴 TERMINAL NOTIFICATION: Safe processing for disconnect alerts
        const leaveMessage = `\`[CORE_SYS]\` 📤 **Outbound Connection Terminated**\n\`\`\`prolog\nUSER_ID  : '${currentUserName}'\nIP_INDEX : '${userIP}'\nSTATUS   : 'SESSION_CLOSED_BY_USER'\n\`\`\``;
        client.channels.cache.get(JOIN_LEAVE_CHANNEL_ID)?.send(leaveMessage);

        delete users[socket.id];
        io.emit("user list", buildUserList());
        updateDiscordStatus();
      }
    });
  });

  // ── 9. START SERVER SYSTEM ───────────────────────────────────────────────────
  app.use(express.static(path.join(__dirname, "public")));
  const PORT = process.env.PORT || 4000;

  client.on("clientReady", () => {
    console.log(`✅ System Active: Yuki Ecosystem fully initialized inside Discord as ${client.user.tag}`);
    updateDiscordStatus();
  });

  client
    .login(DISCORD_TOKEN)
    .catch((err) => console.error("🛑 System Authentication Failed for Yuki Bot Token:", err));

  app.get("/sw.js", (req, res) => res.sendFile(path.resolve(__dirname, "sw.js")));
  app.get("/manifest.json", (req, res) => res.sendFile(path.resolve(__dirname, "manifest.json")));

  app.use("/.well-known", express.static(path.join(__dirname, ".well-known"), { dotfiles: "allow" }));

  http.listen(PORT, () => {
    console.log(`🚀 Enterprise Architecture dashboard processing on port ${PORT}`);
  });

  // ── 10. CRASH PROTECTION CRITICAL GUARDRAILS ───────────────────────────────
  process.on("unhandledRejection", (error) => {
    console.error("⚠️ [Yuki Intercept] Unhandled promise rejection (Caught to prevent crash):", error);
  });

  process.on("uncaughtException", (error) => {
    console.error("⚠️ [Yuki Intercept] Uncaught exception (Caught to prevent crash):", error);
  });
