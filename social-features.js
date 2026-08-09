"use strict";

const crypto = require("crypto");

module.exports = function installSocialFeatures(ctx) {
  const {
    app, io, mongoose, admin, requireFirebaseUser, requireAdmin,
    UserProfile, Message, DM, Group, Report, Warning, UserSession,
    activeUsers, safeDB, isFirebaseAdminUid,
  } = ctx;

  const INTERESTS = ["Gaming","Coding","Movies","Music","Study","Anime","Sports","Tech","Books","Art","Travel","Science","Business","Fitness","Photography"];
  const LANGUAGES = ["Hindi","English","Hinglish","Spanish","French","German","Japanese","Korean","Tamil","Telugu","Marathi","Bengali","Gujarati","Punjabi"];
  const STATUSES = ["online","away","busy","invisible"];
  const REPORT_CATEGORIES = ["spam","bullying","impersonation","unsafe-content","scam","harassment","hate","other"];
  const EMOJIS = ["❤️","😂","👍","😮","😢","🔥"];
  const USERNAME_COOLDOWN_DAYS = 30;

  // Extend the existing models instead of creating parallel user/message/group stores.
  UserProfile.schema.add({
    interests: [{ type: String }],
    languages: [{ type: String }],
    country: { type: String, default: "" },
    timezone: { type: String, default: "" },
    selectedTopics: [{ type: String }],
    presenceStatus: { type: String, enum: STATUSES, default: "online" },
    customStatus: { type: String, default: "" },
    lastSeenPrivacy: { type: String, enum: ["everyone","connections","nobody"], default: "connections" },
    discoverable: { type: Boolean, default: true },
    matchFilters: {
      sameCountry: { type: Boolean, default: false },
      languages: [{ type: String }],
      interests: [{ type: String }],
      timezone: { type: String, default: "" },
    },
    blockedUids: [{ type: String }],
    mutedUids: [{ type: String }],
    reputation: { type: Number, default: 50, min: 0, max: 100 },
    xp: { type: Number, default: 0, min: 0 },
    streak: { type: Number, default: 0, min: 0 },
    lastActiveDate: Date,
    badges: [{ type: String }],
    profileLevel: { type: String, enum: ["Beginner","Active","Regular","Trusted"], default: "Beginner" },
    verified: { type: Boolean, default: false },
    banner: { type: String, default: "" },
    avatarFrame: { type: String, default: "none" },
    chatTheme: { type: String, default: "default" },
    accessibility: {
      largeText: { type: Boolean, default: false },
      reducedMotion: { type: Boolean, default: false },
      highContrast: { type: Boolean, default: false },
    },
    notificationPrefs: {
      dm: { type: Boolean, default: true },
      connection: { type: Boolean, default: true },
      mention: { type: Boolean, default: true },
      groupInvite: { type: Boolean, default: true },
    },
    chatSettings: {
      enterToSend: { type: Boolean, default: true },
      showTimestamps: { type: Boolean, default: true },
      compactMode: { type: Boolean, default: false },
      notificationSound: { type: Boolean, default: true },
      desktopNotifications: { type: Boolean, default: false },
      hideBlockedMessages: { type: Boolean, default: true },
    },
    usernameChangedAt: Date,
    savedMessageIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Message" }],
    premium: {
      plan: { type: String, enum: ["free","premium","creator"], default: "free" },
      status: { type: String, enum: ["inactive","active","past_due","cancelled"], default: "inactive" },
      expiresAt: Date,
    },
    lastSeen: { type: Date, default: Date.now },
  });

  Message.schema.add({
    reactions: [{ emoji: String, userUids: [String] }],
    editedAt: Date,
    pinned: { type: Boolean, default: false },
    pinnedBy: String,
    expiresAt: Date,
    forwardedFrom: { messageId: String, sender: String },
    readBy: [{ uid: String, at: Date }],
    language: { type: String, default: "unknown" },
    moderation: {
      flagged: { type: Boolean, default: false },
      score: { type: Number, default: 0 },
      reasons: [String],
    },
  });

  const dmMessageSchema = DM.schema.path("messages")?.schema;
  if (dmMessageSchema) dmMessageSchema.add({
    senderUid: String,
    receiverUid: String,
    editedAt: Date,
    expiresAt: Date,
    readAt: Date,
    deliveredAt: Date,
    forwardedFrom: { messageId: String, sender: String },
    reactions: [{ emoji: String, userUids: [String] }],
  });

  Group.schema.add({
    visibility: { type: String, enum: ["public","private"], default: "public" },
    joinApproval: { type: Boolean, default: false },
    rules: [{ type: String }],
    slowModeSeconds: { type: Number, default: 0, min: 0, max: 3600 },
    announcementsOnly: { type: Boolean, default: false },
    category: { type: String, default: "General" },
    isCommunity: { type: Boolean, default: false },
    roles: [{ uid: String, name: String, role: { type: String, enum: ["owner","admin","moderator","member"], default: "member" } }],
    pendingMembers: [{ uid: String, name: String, requestedAt: { type: Date, default: Date.now } }],
    inviteCode: { type: String, index: true },
    inviteExpiresAt: Date,
    branding: { banner: String, accent: String },
    maxMembers: { type: Number, default: 200, min: 2, max: 10000 },
    polls: [{
      question: String,
      options: [{ text: String, voters: [String] }],
      createdBy: String,
      createdAt: { type: Date, default: Date.now },
      closesAt: Date,
    }],
    events: [{
      title: String,
      description: String,
      startsAt: Date,
      createdBy: String,
      createdAt: { type: Date, default: Date.now },
    }],
    notes: [{
      text: String,
      authorUid: String,
      authorName: String,
      updatedAt: { type: Date, default: Date.now },
    }],
  });

  Report.schema.add({
    status: { type: String, enum: ["open","reviewing","resolved","dismissed"], default: "open" },
    moderatorNotes: String,
    reviewedAt: Date,
    reviewedBy: String,
  });

  const Connection = mongoose.models.Connection || mongoose.model("Connection", new mongoose.Schema({
    pairKey: { type: String, unique: true, index: true },
    requesterUid: { type: String, index: true },
    addresseeUid: { type: String, index: true },
    status: { type: String, enum: ["pending","accepted","declined"], default: "pending" },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  }));

  const Notification = mongoose.models.Notification || mongoose.model("Notification", new mongoose.Schema({
    uid: { type: String, index: true },
    type: String,
    text: String,
    data: mongoose.Schema.Types.Mixed,
    read: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
  }));

  const MatchHistory = mongoose.models.MatchHistory || mongoose.model("MatchHistory", new mongoose.Schema({
    sessionId: { type: String, index: true },
    uids: [String],
    score: Number,
    commonInterests: [String],
    commonLanguages: [String],
    startedAt: { type: Date, default: Date.now },
    endedAt: Date,
    endedReason: String,
  }));

  const Appeal = mongoose.models.Appeal || mongoose.model("Appeal", new mongoose.Schema({
    uid: { type: String, index: true },
    email: String,
    displayName: String,
    reason: String,
    status: { type: String, enum: ["open","reviewing","accepted","rejected"], default: "open" },
    moderatorNote: String,
    createdAt: { type: Date, default: Date.now },
    reviewedAt: Date,
  }));

  const AuditLog = mongoose.models.AuditLog || mongoose.model("AuditLog", new mongoose.Schema({
    actor: String,
    action: String,
    target: String,
    metadata: mongoose.Schema.Types.Mixed,
    createdAt: { type: Date, default: Date.now },
  }));

  const BlockHistory = mongoose.models.BlockHistory || mongoose.model("BlockHistory", new mongoose.Schema({
    ownerUid: { type: String, index: true },
    targetUid: { type: String, index: true },
    targetName: { type: String, default: "User" },
    action: { type: String, enum: ["block","unblock"], required: true },
    createdAt: { type: Date, default: Date.now, index: true },
  }));

  const GameScore = mongoose.models.GameScore || mongoose.model("GameScore", new mongoose.Schema({
    uid: { type: String, index: true },
    displayName: String,
    game: { type: String, enum: ["rps","quiz","tictactoe"] },
    wins: { type: Number, default: 0 },
    losses: { type: Number, default: 0 },
    draws: { type: Number, default: 0 },
    updatedAt: { type: Date, default: Date.now },
  }));

  function cleanArray(v, allowed = null, max = 12) {
    const arr = Array.isArray(v) ? v : [];
    const out = [...new Set(arr.map(x => String(x).trim()).filter(Boolean))].slice(0, max);
    return allowed ? out.filter(x => allowed.includes(x)) : out;
  }
  function pairKey(a,b) { return [String(a),String(b)].sort().join("::"); }
  function todayKey(d = new Date()) { return d.toISOString().slice(0,10); }
  function levelForXp(xp) { return xp >= 1500 ? "Trusted" : xp >= 600 ? "Regular" : xp >= 150 ? "Active" : "Beginner"; }
  function accountAge(profile) {
    const days = Math.max(0, Math.floor((Date.now() - new Date(profile?.createdAt || Date.now()).getTime()) / 86400000));
    if (days < 30) return `${days} day${days===1?"":"s"}`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months} month${months===1?"":"s"}`;
    const years = Math.floor(months / 12);
    return `${years} year${years===1?"":"s"}`;
  }
  function publicProfile(p, viewerUid, connection = false) {
    if (!p) return null;
    const lastSeenAllowed = p.lastSeenPrivacy === "everyone" || (p.lastSeenPrivacy === "connections" && connection) || p.firebaseUid === viewerUid;
    return {
      uid: p.firebaseUid,
      displayName: p.displayName || "User",
      bio: p.bio || "",
      avatar: p.avatar || "",
      color: p.color || "#00f5a0",
      country: p.country || "",
      timezone: p.timezone || "",
      interests: p.interests || [],
      languages: p.languages || [],
      selectedTopics: p.selectedTopics || [],
      presenceStatus: p.presenceStatus === "invisible" && p.firebaseUid !== viewerUid ? "offline" : (p.presenceStatus || "offline"),
      customStatus: p.customStatus || "",
      reputation: Number(p.reputation ?? 50),
      xp: Number(p.xp || 0),
      profileLevel: p.profileLevel || levelForXp(p.xp || 0),
      badges: p.badges || [],
      verified: !!p.verified,
      accountAge: accountAge(p),
      lastSeen: lastSeenAllowed ? p.lastSeen : null,
      banner: p.banner || "",
      avatarFrame: p.avatarFrame || "none",
      premium: p.premium?.status === "active" ? { plan: p.premium.plan, active: true } : { plan: "free", active: false },
    };
  }
  async function getProfile(uid, lean = true) {
    const q = UserProfile.findOne({ firebaseUid: uid });
    return safeDB(() => lean ? q.lean() : q, null);
  }
  async function ensureProfile(decoded) {
    let p = await getProfile(decoded.uid, false);
    if (!p) {
      p = await new UserProfile({
        firebaseUid: decoded.uid,
        email: decoded.email || "",
        displayName: decoded.name || (decoded.email ? decoded.email.split("@")[0] : "User"),
        verified: !!decoded.email_verified,
        lastSeen: new Date(),
      }).save();
    } else {
      p.verified = !!decoded.email_verified;
      p.lastSeen = new Date();
      await p.save();
    }
    return p;
  }
  async function acceptedConnection(uidA, uidB) {
    if (!uidA || !uidB) return false;
    const c = await safeDB(() => Connection.findOne({ pairKey: pairKey(uidA,uidB), status: "accepted" }).lean(), null);
    return !!c;
  }
  async function isBlockedEitherWay(uidA, uidB) {
    if (!uidA || !uidB) return true;
    const docs = await safeDB(() => UserProfile.find({ firebaseUid: { $in: [uidA,uidB] } }).select("firebaseUid blockedUids").lean(), []);
    const a = docs.find(x => x.firebaseUid === uidA), b = docs.find(x => x.firebaseUid === uidB);
    return !!(a?.blockedUids?.includes(uidB) || b?.blockedUids?.includes(uidA));
  }
  async function notify(uid, type, text, data = {}) {
    if (!uid) return;
    if (data?.fromUid && await isBlockedEitherWay(uid, String(data.fromUid))) return;
    const target = await getProfile(uid);
    const prefKey = type === "dm" ? "dm" : type === "connection" ? "connection" : type === "mention" ? "mention" : type === "groupInvite" ? "groupInvite" : null;
    if (prefKey && target?.notificationPrefs?.[prefKey] === false) return;
    await safeDB(() => new Notification({ uid, type, text: String(text).slice(0,240), data }).save());
    const live = Object.values(activeUsers).find(u => u.firebaseUid === uid);
    if (live && live.presenceStatus !== "invisible") io.to(live.socketId).emit("social:notification", { type, text, data, createdAt: new Date() });
  }
  async function awardXp(uid, amount, badge) {
    if (!uid || !amount) return;
    const profile = await getProfile(uid, false);
    if (!profile) return;
    const now = new Date();
    const prev = profile.lastActiveDate ? todayKey(profile.lastActiveDate) : "";
    const today = todayKey(now);
    const yesterday = todayKey(new Date(now.getTime() - 86400000));
    if (prev !== today) profile.streak = prev === yesterday ? (profile.streak || 0) + 1 : 1;
    profile.lastActiveDate = now;
    profile.xp = Math.max(0, (profile.xp || 0) + amount);
    profile.profileLevel = levelForXp(profile.xp);
    const badges = new Set(profile.badges || []);
    if (profile.streak >= 7) badges.add("7-Day Active");
    if (profile.xp >= 150) badges.add("Active Member");
    if (profile.xp >= 600) badges.add("Community Contributor");
    if (badge) badges.add(badge);
    profile.badges = [...badges];
    await profile.save();
  }
  async function recomputeReputation(uid) {
    const p = await getProfile(uid, false); if (!p) return 50;
    const [warnings, reportsAgainst, accepted] = await Promise.all([
      safeDB(() => Warning.findOne({ username: String(p.displayName||"").toLowerCase() }).lean(), null),
      safeDB(() => Report.countDocuments({ reportedUser: { $regex: new RegExp("^" + String(p.displayName||"").replace(/[.*+?^${}()|[\]\\]/g,"\\$&") + "$", "i") }, status: { $in: ["open","reviewing","resolved"] } }), 0),
      safeDB(() => Connection.countDocuments({ $or: [{requesterUid:uid},{addresseeUid:uid}], status:"accepted" }), 0),
    ]);
    const ageBonus = Math.min(10, Math.floor((Date.now()-new Date(p.createdAt||Date.now()).getTime())/(30*86400000)));
    const score = Math.max(0, Math.min(100, 50 + ageBonus + Math.min(15, accepted) - ((warnings?.count||0)*8) - Math.min(30, reportsAgainst*4)));
    p.reputation = score;
    if (score >= 80) { const b = new Set(p.badges||[]); b.add("Trusted Member"); p.badges=[...b]; }
    await p.save();
    return score;
  }
  function detectLanguage(text) {
    const s = String(text || "");
    if (!s.trim()) return "unknown";
    if (/[\u0900-\u097F]/.test(s)) return "Hindi";
    if (/[\u3040-\u30ff]/.test(s)) return "Japanese";
    if (/[\uac00-\ud7af]/.test(s)) return "Korean";
    if (/[\u0400-\u04ff]/.test(s)) return "Russian";
    const low = s.toLowerCase();
    if (/\b(hola|gracias|como|que|por|para)\b/.test(low)) return "Spanish";
    if (/\b(bonjour|merci|avec|pour|est)\b/.test(low)) return "French";
    if (/\b(hai|nahi|kya|mera|tum|aap|kaise|bhai)\b/.test(low)) return "Hinglish";
    return "English";
  }
  function autoModerate(text) {
    const s = String(text || "");
    const reasons = [];
    if (/(https?:\/\/[^\s]+.*){3,}/i.test(s)) reasons.push("excessive-links");
    if (/(.)\1{10,}/.test(s)) reasons.push("repeated-characters");
    if ((s.match(/@/g)||[]).length > 8) reasons.push("excessive-mentions");
    if (/\b(free money|guaranteed profit|send otp|share otp|password here|crypto giveaway)\b/i.test(s)) reasons.push("possible-scam");
    const score = Math.min(100, reasons.length * 30);
    return { flagged: score >= 30, score, reasons };
  }
  function starterFor(topic) {
    const t = String(topic || "General").trim().slice(0,60);
    const templates = [
      `What got you interested in ${t}?`,
      `What is one ${t} thing you learned recently?`,
      `If you had one free day for ${t}, what would you do?`,
      `What is an underrated part of ${t}?`,
      `Which beginner mistake in ${t} would you help someone avoid?`,
    ];
    return templates;
  }
  function simpleSummary(messages) {
    const list = (Array.isArray(messages) ? messages : []).map(x => String(x?.text ?? x ?? "").trim()).filter(Boolean).slice(-100);
    if (!list.length) return "No messages to summarize.";
    const sentences = list.join(" ").split(/(?<=[.!?])\s+/).filter(Boolean);
    const picks = sentences.filter((s,i) => i===0 || s.length>60).slice(0,5);
    return picks.join(" ").slice(0,1200) || list.slice(-5).join(" • ").slice(0,1200);
  }
  function groupRole(group, uid) {
    if (!group || !uid) return null;
    if (group.adminUid === uid) return "owner";
    return group.roles?.find(r => r.uid === uid)?.role || null;
  }
  function hasGroupPower(group, uid, levels = ["owner","admin","moderator"]) { return levels.includes(groupRole(group, uid)); }

  async function accessibleMessageRooms(uid) {
    const groups = await safeDB(() => Group.find({
      $or: [
        { adminUid: uid },
        { roles: { $elemMatch: { uid } } },
      ],
    }).select("_id").lean(), []);
    return ["global", ...(groups || []).map(g => `group_${g._id}`)];
  }

  async function canAccessMessageRoom(uid, room) {
    if (!room || room === "global") return true;
    if (!room.startsWith("group_")) return false;
    const id = room.slice(6);
    if (!mongoose.isValidObjectId(id)) return false;
    const g = await safeDB(() => Group.findOne({
      _id: id,
      $or: [
        { adminUid: uid },
        { roles: { $elemMatch: { uid } } },
      ],
    }).select("_id").lean(), null);
    return !!g;
  }
  function normalizeInvite() { return crypto.randomBytes(9).toString("base64url"); }
  function activeByUid(uid) { return Object.values(activeUsers).find(u => u.firebaseUid === uid); }

  // Audit all web-admin actions registered after this module. Password/token values are never stored.
  app.use("/api/admin", (req, res, next) => {
    const started = Date.now();
    res.on("finish", () => {
      if (req.method !== "GET") safeDB(() => new AuditLog({ actor: "web-admin", action: `${req.method} ${req.path}`, target: String(req.body?.username || req.body?.uid || req.body?.id || ""), metadata: { statusCode: res.statusCode, durationMs: Date.now() - started } }).save());
    });
    next();
  });

  // ------------------------------- REST: BOOTSTRAP / PROFILE
  app.get("/api/social/config", (req,res) => res.json({ interests: INTERESTS, languages: LANGUAGES, statuses: STATUSES, reportCategories: REPORT_CATEGORIES, reactions: EMOJIS, usernameCooldownDays: USERNAME_COOLDOWN_DAYS }));

  app.get("/api/social/bootstrap", requireFirebaseUser, async (req,res) => {
    const decoded = req.firebaseUser;
    const p = await ensureProfile(decoded);
    const [connections, pendingIn, pendingOut, unread, warnings] = await Promise.all([
      safeDB(() => Connection.find({ $or:[{requesterUid:decoded.uid},{addresseeUid:decoded.uid}], status:"accepted" }).lean(), []),
      safeDB(() => Connection.find({ addresseeUid: decoded.uid, status:"pending" }).lean(), []),
      safeDB(() => Connection.find({ requesterUid: decoded.uid, status:"pending" }).lean(), []),
      safeDB(() => Notification.countDocuments({ uid:decoded.uid, read:false }), 0),
      safeDB(() => Warning.findOne({ username:String(p.displayName||"").toLowerCase() }).lean(), null),
    ]);
    const otherUids = [...new Set([...connections.map(c => c.requesterUid===decoded.uid?c.addresseeUid:c.requesterUid), ...pendingIn.map(c=>c.requesterUid), ...pendingOut.map(c=>c.addresseeUid)])];
    const profiles = await safeDB(() => UserProfile.find({ firebaseUid:{ $in:otherUids } }).lean(), []);
    const byUid = Object.fromEntries(profiles.map(x => [x.firebaseUid, publicProfile(x, decoded.uid, connections.some(c => c.pairKey===pairKey(decoded.uid,x.firebaseUid)))]));
    await recomputeReputation(decoded.uid);
    const fresh = await getProfile(decoded.uid);
    res.json({
      profile: { ...publicProfile(fresh,decoded.uid,true), email: fresh?.email || decoded.email || "", lastSeenPrivacy:fresh?.lastSeenPrivacy||"connections", discoverable:fresh?.discoverable!==false, matchFilters:fresh?.matchFilters||{}, accessibility:fresh?.accessibility||{}, notificationPrefs:fresh?.notificationPrefs||{}, chatSettings:fresh?.chatSettings||{enterToSend:true,showTimestamps:true,compactMode:false,notificationSound:true,desktopNotifications:false,hideBlockedMessages:true}, chatTheme:fresh?.chatTheme||"default", premium:fresh?.premium||{plan:"free",status:"inactive"} },
      connections: connections.map(c => ({...c, other:byUid[c.requesterUid===decoded.uid?c.addresseeUid:c.requesterUid]})),
      pendingReceived: pendingIn.map(c => ({...c, other:byUid[c.requesterUid]})),
      pendingSent: pendingOut.map(c => ({...c, other:byUid[c.addresseeUid]})),
      unreadNotifications: unread,
      warningCount: warnings?.count || 0,
    });
  });

  app.put("/api/social/profile", requireFirebaseUser, async (req,res) => {
    const decoded = req.firebaseUser; const p = await ensureProfile(decoded); const b=req.body||{};
    if (b.displayName !== undefined && String(b.displayName).trim() !== p.displayName) {
      const last = p.usernameChangedAt ? new Date(p.usernameChangedAt).getTime() : 0;
      const remain = USERNAME_COOLDOWN_DAYS*86400000 - (Date.now()-last);
      if (last && remain > 0) return res.status(429).json({ error:`Username can be changed again in ${Math.ceil(remain/86400000)} day(s).` });
      const name=String(b.displayName).trim();
      if (name.length<2||name.length>30||!/^[\p{L}\p{N}_. -]+$/u.test(name)) return res.status(400).json({error:"Invalid display name"});
      const exists=await safeDB(()=>UserProfile.findOne({displayName:{$regex:new RegExp("^"+name.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+"$","i")},firebaseUid:{$ne:decoded.uid}}).lean(),null);
      if(exists) return res.status(409).json({error:"Display name already taken"});
      p.displayName=name; p.usernameChangedAt=new Date();
    }
    if (b.bio !== undefined) p.bio=String(b.bio).slice(0,240);
    if (b.country !== undefined) p.country=String(b.country).slice(0,80);
    if (b.timezone !== undefined) p.timezone=String(b.timezone).slice(0,80);
    if (b.interests !== undefined) p.interests=cleanArray(b.interests,INTERESTS,10);
    if (b.languages !== undefined) p.languages=cleanArray(b.languages,LANGUAGES,8);
    if (b.selectedTopics !== undefined) p.selectedTopics=cleanArray(b.selectedTopics,null,10);
    if (STATUSES.includes(b.presenceStatus)) p.presenceStatus=b.presenceStatus;
    if (b.customStatus !== undefined) p.customStatus=String(b.customStatus).slice(0,80);
    if (["everyone","connections","nobody"].includes(b.lastSeenPrivacy)) p.lastSeenPrivacy=b.lastSeenPrivacy;
    if (typeof b.discoverable === "boolean") p.discoverable=b.discoverable;
    if (b.matchFilters && typeof b.matchFilters === "object") p.matchFilters={sameCountry:!!b.matchFilters.sameCountry,languages:cleanArray(b.matchFilters.languages,LANGUAGES,8),interests:cleanArray(b.matchFilters.interests,INTERESTS,10),timezone:String(b.matchFilters.timezone||"").slice(0,80)};
    const premiumActive = p.premium?.status === "active" && ["premium","creator"].includes(p.premium?.plan);
    if (b.banner !== undefined) {
      const banner=String(b.banner||"").trim();
      if (banner && !/^#[0-9a-f]{6}$/i.test(banner)) return res.status(400).json({error:"Banner must be a 6-digit hex color, e.g. #16213e"});
      p.banner=banner;
    }
    if (b.avatarFrame !== undefined) {
      const frame=String(b.avatarFrame);
      if (!["none","neon","orbit","gold"].includes(frame)) return res.status(400).json({error:"Invalid avatar frame"});
      if (["orbit","gold"].includes(frame) && !premiumActive) return res.status(403).json({error:"This avatar frame requires an active Premium or Creator plan"});
      p.avatarFrame=frame;
    }
    if (b.chatTheme !== undefined) {
      const theme=String(b.chatTheme);
      if (!["default","ocean","forest","amoled","sunset","aurora"].includes(theme)) return res.status(400).json({error:"Invalid chat theme"});
      if (["sunset","aurora"].includes(theme) && !premiumActive) return res.status(403).json({error:"This theme requires an active Premium or Creator plan"});
      p.chatTheme=theme;
    }
    if (b.accessibility && typeof b.accessibility === "object") p.accessibility={largeText:!!b.accessibility.largeText,reducedMotion:!!b.accessibility.reducedMotion,highContrast:!!b.accessibility.highContrast};
    if (b.notificationPrefs && typeof b.notificationPrefs === "object") p.notificationPrefs={dm:b.notificationPrefs.dm!==false,connection:b.notificationPrefs.connection!==false,mention:b.notificationPrefs.mention!==false,groupInvite:b.notificationPrefs.groupInvite!==false};
    if (b.chatSettings && typeof b.chatSettings === "object") p.chatSettings={
      enterToSend:b.chatSettings.enterToSend!==false,
      showTimestamps:b.chatSettings.showTimestamps!==false,
      compactMode:!!b.chatSettings.compactMode,
      notificationSound:b.chatSettings.notificationSound!==false,
      desktopNotifications:!!b.chatSettings.desktopNotifications,
      hideBlockedMessages:b.chatSettings.hideBlockedMessages!==false,
    };
    p.verified=!!decoded.email_verified; p.updatedAt=new Date(); p.lastSeen=new Date(); await p.save(); await awardXp(decoded.uid,2);
    const live=activeByUid(decoded.uid); if(live){live.name=p.displayName;live.bio=p.bio;live.avatar=p.avatar;live.color=p.color;live.presenceStatus=p.presenceStatus;live.customStatus=p.customStatus;live.verified=!!p.verified;io.emit("user list", Object.values(activeUsers).filter(u=>u.presenceStatus!=="invisible").map(u=>({socketId:u.socketId,uid:u.firebaseUid||"",name:u.name,rawName:u.name,bio:u.bio,avatar:u.avatar,color:u.color,isVip:!!u.isVip,isAdmin:!!u.isAdmin,status:u.presenceStatus||"online",customStatus:u.customStatus||"",verified:!!u.verified})));}
    res.json({ok:true,profile:publicProfile(p.toObject(),decoded.uid,true)});
  });

  app.get("/api/social/profile/:uid", requireFirebaseUser, async (req,res) => {
    const target=await getProfile(req.params.uid); if(!target) return res.status(404).json({error:"User not found"});
    if(await isBlockedEitherWay(req.firebaseUser.uid,target.firebaseUid)) return res.status(403).json({error:"Profile unavailable"});
    const conn=await acceptedConnection(req.firebaseUser.uid,target.firebaseUid); res.json(publicProfile(target,req.firebaseUser.uid,conn));
  });

  // ------------------------------- DISCOVERY / MATCH FILTERS
  app.get("/api/social/discover", requireFirebaseUser, async (req,res) => {
    const me=await getProfile(req.firebaseUser.uid); if(!me) return res.json([]);
    const q={firebaseUid:{$ne:req.firebaseUser.uid},discoverable:{$ne:false}};
    if(req.query.country) q.country=String(req.query.country).slice(0,80);
    if(req.query.language) q.languages=String(req.query.language).slice(0,30);
    if(req.query.interest) q.interests=String(req.query.interest).slice(0,30);
    const excluded=new Set(me.blockedUids||[]);
    const conns=await safeDB(()=>Connection.find({$or:[{requesterUid:req.firebaseUser.uid},{addresseeUid:req.firebaseUser.uid}],status:"accepted"}).lean(),[]);
    conns.forEach(c=>excluded.add(c.requesterUid===req.firebaseUser.uid?c.addresseeUid:c.requesterUid));
    const users=await safeDB(()=>UserProfile.find(q).sort({reputation:-1,lastSeen:-1}).limit(60).lean(),[]);
    const filtered=users.filter(u=>!excluded.has(u.firebaseUid)&&!(u.blockedUids||[]).includes(req.firebaseUser.uid)).slice(0,30);
    res.json(filtered.map(u=>publicProfile(u,req.firebaseUser.uid,false)));
  });

  // ------------------------------- CONNECTIONS / BLOCK / MUTE
  app.get("/api/social/connections", requireFirebaseUser, async (req,res) => {
    const uid=req.firebaseUser.uid; const cs=await safeDB(()=>Connection.find({$or:[{requesterUid:uid},{addresseeUid:uid}]}).sort({updatedAt:-1}).lean(),[]);
    const ids=[...new Set(cs.map(c=>c.requesterUid===uid?c.addresseeUid:c.requesterUid))]; const [ps,dms]=await Promise.all([safeDB(()=>UserProfile.find({firebaseUid:{$in:ids}}).lean(),[]),safeDB(()=>DM.find({channelId:{$in:ids.map(x=>pairKey(uid,x))}}).lean(),[])]); const map=Object.fromEntries(ps.map(p=>[p.firebaseUid,p]));const dmMap=Object.fromEntries(dms.map(d=>[d.channelId,d]));
    res.json(cs.map(c=>{const oid=c.requesterUid===uid?c.addresseeUid:c.requesterUid,dm=dmMap[pairKey(uid,oid)],unread=(dm?.messages||[]).filter(m=>m.receiverUid===uid&&!m.readAt).length;return {...c,unread,other:publicProfile(map[oid],uid,c.status==="accepted")};}));
  });

  app.post("/api/social/connections/request", requireFirebaseUser, async (req,res) => {
    const from=req.firebaseUser.uid,to=String(req.body?.uid||""); if(!to||to===from) return res.status(400).json({error:"Invalid user"});
    if(await isBlockedEitherWay(from,to)) return res.status(403).json({error:"Connection unavailable"});
    const target=await getProfile(to); if(!target) return res.status(404).json({error:"User not found"});
    const key=pairKey(from,to); const existing=await safeDB(()=>Connection.findOne({pairKey:key}),null);
    if(existing?.status==="accepted") return res.json({ok:true,status:"accepted"});
    const c=await safeDB(()=>Connection.findOneAndUpdate({pairKey:key},{$set:{pairKey:key,requesterUid:from,addresseeUid:to,status:"pending",updatedAt:new Date()},$setOnInsert:{createdAt:new Date()}},{upsert:true,returnDocument:"after"}),null);
    const me=await getProfile(from); await notify(to,"connection",`${me?.displayName||"Someone"} sent you a connection request.`,{connectionId:c?._id?.toString(),fromUid:from}); await awardXp(from,3);
    res.json({ok:true,status:"pending"});
  });

  app.post("/api/social/connections/respond", requireFirebaseUser, async (req,res) => {
    const uid=req.firebaseUser.uid,id=String(req.body?.id||""),accept=!!req.body?.accept; if(!mongoose.isValidObjectId(id)) return res.status(400).json({error:"Invalid request"});
    const c=await safeDB(()=>Connection.findOne({_id:id,addresseeUid:uid,status:"pending"}),null); if(!c) return res.status(404).json({error:"Request not found"});
    c.status=accept?"accepted":"declined";c.updatedAt=new Date();await c.save(); const me=await getProfile(uid); await notify(c.requesterUid,"connection",`${me?.displayName||"Someone"} ${accept?"accepted":"declined"} your connection request.`,{connectionId:id,status:c.status});
    if(accept){await awardXp(uid,10,"First Connection");await awardXp(c.requesterUid,10,"First Connection");}
    res.json({ok:true,status:c.status});
  });

  app.delete("/api/social/connections/:uid", requireFirebaseUser, async (req,res)=>{await safeDB(()=>Connection.deleteOne({pairKey:pairKey(req.firebaseUser.uid,req.params.uid)}));res.json({ok:true});});

  app.get("/api/social/blocks", requireFirebaseUser, async (req,res) => {
    const me=await getProfile(req.firebaseUser.uid);
    if(!me) return res.json({blocked:[],history:[]});
    const ids=[...new Set(me.blockedUids||[])];
    const [profiles,history]=await Promise.all([
      safeDB(()=>UserProfile.find({firebaseUid:{$in:ids}}).select("firebaseUid displayName avatar color customStatus verified").lean(),[]),
      safeDB(()=>BlockHistory.find({ownerUid:req.firebaseUser.uid}).sort({createdAt:-1}).limit(100).lean(),[]),
    ]);
    const map=Object.fromEntries(profiles.map(x=>[x.firebaseUid,x]));
    res.json({
      blocked:ids.map(uid=>({uid,displayName:map[uid]?.displayName||"Unknown user",avatar:map[uid]?.avatar||"",color:map[uid]?.color||"#6c63ff",customStatus:map[uid]?.customStatus||"",verified:!!map[uid]?.verified})),
      history:history.map(h=>({id:String(h._id),uid:h.targetUid,displayName:h.targetName||"User",action:h.action,createdAt:h.createdAt}))
    });
  });

  app.post("/api/social/block", requireFirebaseUser, async (req,res) => {
    const me=await getProfile(req.firebaseUser.uid,false),target=String(req.body?.uid||""); if(!me||!target||target===req.firebaseUser.uid)return res.status(400).json({error:"Invalid user"});
    const targetProfile=await getProfile(target); if(!targetProfile)return res.status(404).json({error:"User not found"});
    const set=new Set(me.blockedUids||[]);
    const wantsBlocked=req.body?.blocked!==false;
    const wasBlocked=set.has(target);
    if(wantsBlocked)set.add(target);else set.delete(target);
    me.blockedUids=[...set];await me.save();
    if(wantsBlocked)await safeDB(()=>Connection.deleteOne({pairKey:pairKey(req.firebaseUser.uid,target)}));
    if(wasBlocked!==wantsBlocked) await safeDB(()=>new BlockHistory({ownerUid:req.firebaseUser.uid,targetUid:target,targetName:targetProfile.displayName||"User",action:wantsBlocked?"block":"unblock"}).save());
    res.json({ok:true,blocked:wantsBlocked,uid:target,displayName:targetProfile.displayName||"User"});
  });
  app.post("/api/social/mute", requireFirebaseUser, async (req,res) => {
    const me=await getProfile(req.firebaseUser.uid,false),target=String(req.body?.uid||""); if(!me||!target||target===req.firebaseUser.uid)return res.status(400).json({error:"Invalid user"});
    const set=new Set(me.mutedUids||[]); if(req.body?.muted===false)set.delete(target);else set.add(target);me.mutedUids=[...set];await me.save();res.json({ok:true,muted:set.has(target)});
  });

  app.post("/api/social/reports", requireFirebaseUser, async (req,res) => {
    const targetUid=String(req.body?.uid||""), category=String(req.body?.category||"other").toLowerCase(), details=String(req.body?.details||"").trim().slice(0,1200);
    if(!targetUid||targetUid===req.firebaseUser.uid)return res.status(400).json({error:"Invalid report target"});
    if(!REPORT_CATEGORIES.includes(category))return res.status(400).json({error:"Invalid report category"});
    const [target,me]=await Promise.all([getProfile(targetUid),getProfile(req.firebaseUser.uid)]);if(!target)return res.status(404).json({error:"User not found"});
    const recent=await safeDB(()=>Report.findOne({reporterEmail:req.firebaseUser.email||"",reportedUser:target.displayName,createdAt:{$gte:new Date(Date.now()-10*60000)}}).lean(),null);if(recent)return res.status(429).json({error:"You recently reported this user. Moderators will review it."});
    const r=await safeDB(()=>new Report({reportedUser:target.displayName,reporterUser:me?.displayName||"User",reporterEmail:req.firebaseUser.email||"",category,reason:details||category,device:"Web/PWA",status:"open"}).save(),null);
    await awardXp(req.firebaseUser.uid,1);res.json({ok:true,id:r?._id});
  });
  app.get("/api/social/warnings/me", requireFirebaseUser, async (req,res)=>{const p=await getProfile(req.firebaseUser.uid);const w=await safeDB(()=>Warning.findOne({username:String(p?.displayName||"").toLowerCase()}).lean(),null);res.json(w||{username:p?.displayName||"",count:0,messages:[]});});

  // ------------------------------- NOTIFICATIONS
  app.get("/api/social/notifications", requireFirebaseUser, async (req,res)=>res.json(await safeDB(()=>Notification.find({uid:req.firebaseUser.uid}).sort({createdAt:-1}).limit(100).lean(),[])));
  app.post("/api/social/notifications/read", requireFirebaseUser, async (req,res)=>{const ids=cleanArray(req.body?.ids,null,100).filter(mongoose.isValidObjectId);const q={uid:req.firebaseUser.uid};if(ids.length)q._id={$in:ids};await safeDB(()=>Notification.updateMany(q,{$set:{read:true}}));res.json({ok:true});});

  // ------------------------------- MESSAGES: search, save, media, enhanced actions
  app.get("/api/social/messages/search", requireFirebaseUser, async (req,res)=>{
    const q=String(req.query.q||"").trim();
    if(q.length<2)return res.json([]);
    const rooms=await accessibleMessageRooms(req.firebaseUser.uid);
    const escaped=q.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
    const rows=await safeDB(()=>Message.find({room:{$in:rooms},text:{$regex:new RegExp(escaped,"i")}}).sort({createdAt:-1}).limit(50).lean(),[]);
    res.json(rows.map(m=>({id:m._id,sender:m.senderName,text:m.text,room:m.room,type:m.type,createdAt:m.createdAt,pinned:!!m.pinned,editedAt:m.editedAt})));
  });
  app.post("/api/social/messages/:id/save", requireFirebaseUser, async (req,res)=>{
    if(!mongoose.isValidObjectId(req.params.id))return res.status(400).json({error:"Invalid id"});
    const msg=await safeDB(()=>Message.findById(req.params.id).select("room").lean(),null);
    if(!msg)return res.status(404).json({error:"Message missing"});
    if(!(await canAccessMessageRoom(req.firebaseUser.uid,msg.room)))return res.status(403).json({error:"You cannot access this message"});
    const p=await getProfile(req.firebaseUser.uid,false);if(!p)return res.status(404).json({error:"Profile missing"});
    const set=new Set((p.savedMessageIds||[]).map(String));
    const premiumActive=p.premium?.status==="active"&&["premium","creator"].includes(p.premium?.plan);const limit=premiumActive?1000:100;
    if(req.body?.saved===false)set.delete(req.params.id);else if(!set.has(req.params.id)&&set.size>=limit)return res.status(429).json({error:`Saved message limit reached (${limit})`});else set.add(req.params.id);
    p.savedMessageIds=[...set].filter(mongoose.isValidObjectId);await p.save();res.json({ok:true,saved:set.has(req.params.id),limit,count:set.size});
  });
  app.get("/api/social/saved", requireFirebaseUser, async (req,res)=>{
    const p=await getProfile(req.firebaseUser.uid);const ids=(p?.savedMessageIds||[]).filter(mongoose.isValidObjectId);
    const rooms=await accessibleMessageRooms(req.firebaseUser.uid);
    const rows=await safeDB(()=>Message.find({_id:{$in:ids},room:{$in:rooms}}).sort({createdAt:-1}).lean(),[]);res.json(rows);
  });
  app.get("/api/social/media", requireFirebaseUser, async (req,res)=>{
    const room=String(req.query.room||"global").slice(0,100);
    if(!(await canAccessMessageRoom(req.firebaseUser.uid,room)))return res.status(403).json({error:"You cannot access this room"});
    const rows=await safeDB(()=>Message.find({room,type:{$in:["image","video","voice","gif","file"]}}).sort({createdAt:-1}).limit(100).lean(),[]);res.json(rows);
  });

  // ------------------------------- ADVANCED GROUPS / ROOMS
  app.post("/api/social/groups", requireFirebaseUser, async (req,res)=>{
    const p=await getProfile(req.firebaseUser.uid);const b=req.body||{};const name=String(b.name||"").trim().slice(0,60);if(name.length<2)return res.status(400).json({error:"Group name must be at least 2 characters"});
    const password=String(b.password||"");if(password&&password.length<4)return res.status(400).json({error:"Password must be at least 4 characters"});
    const passwordHash=password?await require("bcrypt").hash(password,12):"";
    const g=await safeDB(()=>new Group({name,description:String(b.description||"").slice(0,300),passwordHash,adminName:p?.displayName||"User",adminUid:req.firebaseUser.uid,icon:String(b.icon||"👥").slice(0,10),members:[p?.displayName||"User"],visibility:["public","private"].includes(b.visibility)?b.visibility:"public",joinApproval:!!b.joinApproval,rules:cleanArray(b.rules,null,20).map(x=>x.slice(0,200)),category:String(b.category||"General").slice(0,40),slowModeSeconds:Math.max(0,Math.min(3600,Number(b.slowModeSeconds)||0)),announcementsOnly:!!b.announcementsOnly,isCommunity:!!b.isCommunity,roles:[{uid:req.firebaseUser.uid,name:p?.displayName||"User",role:"owner"}],maxMembers:Math.max(2,Math.min(10000,Number(b.maxMembers)||200))}).save(),null);
    if(!g)return res.status(503).json({error:"Database unavailable"});await awardXp(req.firebaseUser.uid,10,"Community Creator");res.json({ok:true,groupId:String(g._id)});
  });
  app.get("/api/social/rooms", requireFirebaseUser, async (req,res)=>{
    const groups=await safeDB(()=>Group.find({}).sort({createdAt:-1}).limit(100).lean(),[]);const activeCounts={};Object.values(activeUsers).forEach(u=>{if(u.room?.startsWith("group_"))activeCounts[u.room.slice(6)]=(activeCounts[u.room.slice(6)]||0)+1;});
    const out=groups.filter(g=>g.visibility!=="private"||groupRole(g,req.firebaseUser.uid)).map(g=>({id:g._id,name:g.name,description:g.description,icon:g.icon,visibility:g.visibility||"public",category:g.category||"General",isCommunity:!!g.isCommunity,members:g.roles?.length||g.members?.length||0,online:activeCounts[String(g._id)]||0,joinApproval:!!g.joinApproval,rules:g.rules||[],slowModeSeconds:g.slowModeSeconds||0,announcementsOnly:!!g.announcementsOnly,branding:g.branding||{},role:groupRole(g,req.firebaseUser.uid)}));
    out.sort((a,b)=>b.online-a.online||b.members-a.members);res.json(out);
  });
  app.get("/api/social/groups/:id", requireFirebaseUser, async (req,res)=>{
    if(!mongoose.isValidObjectId(req.params.id))return res.status(400).json({error:"Invalid group"});
    const g=await safeDB(()=>Group.findById(req.params.id).lean(),null);
    if(!g)return res.status(404).json({error:"Group missing"});
    const role=groupRole(g,req.firebaseUser.uid);
    if(g.visibility==="private"&&!role)return res.status(403).json({error:"Group membership required"});
    const canModerate=["owner","admin","moderator"].includes(role);
    const polls=(g.polls||[]).map(p=>({
      id:String(p._id),question:p.question,createdAt:p.createdAt,closesAt:p.closesAt,
      options:(p.options||[]).map(o=>({text:o.text,count:(o.voters||[]).length,voted:(o.voters||[]).includes(req.firebaseUser.uid)}))
    }));
    res.json({
      id:String(g._id),name:g.name,description:g.description||"",icon:g.icon||"👥",visibility:g.visibility||"public",
      category:g.category||"General",isCommunity:!!g.isCommunity,joinApproval:!!g.joinApproval,rules:g.rules||[],
      slowModeSeconds:g.slowModeSeconds||0,announcementsOnly:!!g.announcementsOnly,branding:g.branding||{},maxMembers:g.maxMembers||200,
      role,members:(g.roles||[]).map(r=>({uid:r.uid,name:r.name,role:r.role})),pending:canModerate?(g.pendingMembers||[]).map(x=>({uid:x.uid,name:x.name,requestedAt:x.requestedAt})):[],
      polls,events:(g.events||[]).slice().sort((a,b)=>new Date(a.startsAt)-new Date(b.startsAt)).map(e=>({id:String(e._id),title:e.title,description:e.description||"",startsAt:e.startsAt,createdAt:e.createdAt})),
      notes:(g.notes||[]).slice(-50).map(n=>({id:String(n._id),text:n.text,authorName:n.authorName,updatedAt:n.updatedAt}))
    });
  });
  app.post("/api/social/groups/:id/settings", requireFirebaseUser, async (req,res)=>{
    if(!mongoose.isValidObjectId(req.params.id))return res.status(400).json({error:"Invalid group"});const g=await safeDB(()=>Group.findById(req.params.id),null);if(!g)return res.status(404).json({error:"Group missing"});if(!hasGroupPower(g,req.firebaseUser.uid,["owner","admin"]))return res.status(403).json({error:"Owner/admin only"});const b=req.body||{};
    if(["public","private"].includes(b.visibility))g.visibility=b.visibility;if(typeof b.joinApproval==="boolean")g.joinApproval=b.joinApproval;if(Array.isArray(b.rules))g.rules=cleanArray(b.rules,null,20).map(x=>x.slice(0,200));if(Number.isFinite(Number(b.slowModeSeconds)))g.slowModeSeconds=Math.max(0,Math.min(3600,Number(b.slowModeSeconds)));if(typeof b.announcementsOnly==="boolean")g.announcementsOnly=b.announcementsOnly;if(b.category!==undefined)g.category=String(b.category).slice(0,40);if(typeof b.isCommunity==="boolean")g.isCommunity=b.isCommunity;if(b.branding&&typeof b.branding==="object")g.branding={banner:String(b.branding.banner||"").slice(0,300000),accent:/^#[0-9a-f]{6}$/i.test(String(b.branding.accent||""))?b.branding.accent:""};await g.save();res.json({ok:true});
  });
  app.post("/api/social/groups/:id/invite", requireFirebaseUser, async (req,res)=>{if(!mongoose.isValidObjectId(req.params.id))return res.status(400).json({error:"Invalid group"});const g=await safeDB(()=>Group.findById(req.params.id),null);if(!g)return res.status(404).json({error:"Group missing"});if(!hasGroupPower(g,req.firebaseUser.uid))return res.status(403).json({error:"Moderator access required"});g.inviteCode=normalizeInvite();const hours=Math.max(1,Math.min(168,Number(req.body?.hours||24)));g.inviteExpiresAt=new Date(Date.now()+hours*3600000);await g.save();res.json({ok:true,code:g.inviteCode,expiresAt:g.inviteExpiresAt,path:`/social.html?invite=${g.inviteCode}`});});
  app.post("/api/social/groups/join-invite", requireFirebaseUser, async (req,res)=>{const code=String(req.body?.code||"");const g=await safeDB(()=>Group.findOne({inviteCode:code,inviteExpiresAt:{$gt:new Date()}}),null);if(!g)return res.status(404).json({error:"Invite invalid or expired"});if((g.roles||[]).some(r=>r.uid===req.firebaseUser.uid))return res.json({ok:true,groupId:g._id});const p=await getProfile(req.firebaseUser.uid);if(g.joinApproval){if(!(g.pendingMembers||[]).some(x=>x.uid===req.firebaseUser.uid))g.pendingMembers.push({uid:req.firebaseUser.uid,name:p?.displayName||"User"});await g.save();return res.json({ok:true,pending:true,groupId:g._id});}g.roles.push({uid:req.firebaseUser.uid,name:p?.displayName||"User",role:"member"});await g.save();res.json({ok:true,groupId:g._id});});
  app.post("/api/social/groups/:id/approve", requireFirebaseUser, async (req,res)=>{const g=await safeDB(()=>Group.findById(req.params.id),null);if(!g)return res.status(404).json({error:"Group missing"});if(!hasGroupPower(g,req.firebaseUser.uid))return res.status(403).json({error:"Moderator access required"});const target=String(req.body?.uid||"");const pending=(g.pendingMembers||[]).find(x=>x.uid===target);if(!pending)return res.status(404).json({error:"Request missing"});g.pendingMembers=g.pendingMembers.filter(x=>x.uid!==target);if(req.body?.approve!==false&&!g.roles.some(r=>r.uid===target))g.roles.push({uid:target,name:pending.name,role:"member"});await g.save();await notify(target,"groupInvite",req.body?.approve===false?`Your request to join ${g.name} was declined.`:`You were approved to join ${g.name}.`,{groupId:String(g._id)});res.json({ok:true});});
  app.post("/api/social/groups/:id/role", requireFirebaseUser, async (req,res)=>{const g=await safeDB(()=>Group.findById(req.params.id),null);if(!g)return res.status(404).json({error:"Group missing"});if(groupRole(g,req.firebaseUser.uid)!=="owner")return res.status(403).json({error:"Owner only"});const role=String(req.body?.role||"");if(!["admin","moderator","member"].includes(role))return res.status(400).json({error:"Invalid role"});const r=g.roles.find(x=>x.uid===String(req.body?.uid||""));if(!r)return res.status(404).json({error:"Member missing"});r.role=role;await g.save();res.json({ok:true});});
  app.post("/api/social/groups/:id/polls", requireFirebaseUser, async (req,res)=>{const g=await safeDB(()=>Group.findById(req.params.id),null);if(!g||!groupRole(g,req.firebaseUser.uid))return res.status(403).json({error:"Group membership required"});const question=String(req.body?.question||"").slice(0,180),options=cleanArray(req.body?.options,null,6).map(t=>({text:t.slice(0,100),voters:[]}));if(!question||options.length<2)return res.status(400).json({error:"Question + at least 2 options required"});g.polls.push({question,options,createdBy:req.firebaseUser.uid,closesAt:req.body?.closesAt?new Date(req.body.closesAt):undefined});await g.save();res.json({ok:true,poll:g.polls[g.polls.length-1]});});
  app.post("/api/social/groups/:id/polls/:pollId/vote", requireFirebaseUser, async (req,res)=>{const g=await safeDB(()=>Group.findById(req.params.id),null);if(!g||!groupRole(g,req.firebaseUser.uid))return res.status(403).json({error:"Group membership required"});const poll=g.polls.id(req.params.pollId);if(!poll)return res.status(404).json({error:"Poll missing"});if(poll.closesAt&&new Date(poll.closesAt)<new Date())return res.status(410).json({error:"Poll closed"});poll.options.forEach(o=>o.voters=o.voters.filter(u=>u!==req.firebaseUser.uid));const idx=Number(req.body?.option);if(!Number.isInteger(idx)||!poll.options[idx])return res.status(400).json({error:"Invalid option"});poll.options[idx].voters.push(req.firebaseUser.uid);await g.save();res.json({ok:true,poll});});
  app.post("/api/social/groups/:id/events", requireFirebaseUser, async (req,res)=>{const g=await safeDB(()=>Group.findById(req.params.id),null);if(!g||!hasGroupPower(g,req.firebaseUser.uid))return res.status(403).json({error:"Moderator access required"});const title=String(req.body?.title||"").slice(0,120),startsAt=new Date(req.body?.startsAt);if(!title||Number.isNaN(startsAt.getTime()))return res.status(400).json({error:"Valid title/date required"});g.events.push({title,description:String(req.body?.description||"").slice(0,500),startsAt,createdBy:req.firebaseUser.uid});await g.save();res.json({ok:true,event:g.events[g.events.length-1]});});
  app.post("/api/social/groups/:id/notes", requireFirebaseUser, async (req,res)=>{const g=await safeDB(()=>Group.findById(req.params.id),null);if(!g||!groupRole(g,req.firebaseUser.uid))return res.status(403).json({error:"Group membership required"});const p=await getProfile(req.firebaseUser.uid);const text=String(req.body?.text||"").slice(0,3000);if(!text)return res.status(400).json({error:"Note required"});g.notes.push({text,authorUid:req.firebaseUser.uid,authorName:p?.displayName||"User",updatedAt:new Date()});if(g.notes.length>100)g.notes=g.notes.slice(-100);await g.save();res.json({ok:true,note:g.notes[g.notes.length-1]});});

  // ------------------------------- DAILY / XP / LEADERBOARD / GAMES
  app.get("/api/social/daily", requireFirebaseUser, (req,res)=>{const prompts=["What skill are you learning right now?","What small win did you have today?","Which app could you not live without?","What would you build if you had one free week?","What is one thing you changed your mind about recently?","What song or movie would you recommend today?","What is one study trick that actually works for you?"];const i=Math.floor(Date.now()/86400000)%prompts.length;res.json({question:prompts[i],discussion:`Today’s discussion: ${prompts[(i+3)%prompts.length]}`});});
  app.get("/api/social/leaderboard", requireFirebaseUser, async (req,res)=>{const ps=await safeDB(()=>UserProfile.find({discoverable:{$ne:false}}).sort({xp:-1,reputation:-1}).limit(50).lean(),[]);res.json(ps.map((p,i)=>({rank:i+1,...publicProfile(p,req.firebaseUser.uid,false)})));});
  app.post("/api/social/activity", requireFirebaseUser, async (req,res)=>{const allowed={helpful:5,study:3,daily:2,report_valid:4};const type=String(req.body?.type||"");await awardXp(req.firebaseUser.uid,allowed[type]||1);res.json({ok:true});});
  app.post("/api/social/games/result", requireFirebaseUser, async (req,res)=>{const game=String(req.body?.game||"");const result=String(req.body?.result||"");if(!["rps","quiz","tictactoe"].includes(game)||!["win","loss","draw"].includes(result))return res.status(400).json({error:"Invalid game result"});const p=await getProfile(req.firebaseUser.uid);const inc=result==="win"?{wins:1}:result==="loss"?{losses:1}:{draws:1};await safeDB(()=>GameScore.findOneAndUpdate({uid:req.firebaseUser.uid,game},{$set:{displayName:p?.displayName||"User",updatedAt:new Date()},$inc:inc},{upsert:true}));await awardXp(req.firebaseUser.uid,result==="win"?5:1,result==="win"?"Game Winner":null);res.json({ok:true});});

  // ------------------------------- SAFETY / APPEALS / AI-ASSISTED LOCAL TOOLS
  app.get("/api/social/safety", requireFirebaseUser, (req,res)=>res.json({rules:["Keep personal contact details private until you trust someone.","Use Block for unwanted contact and Report for policy violations.","Never share passwords, OTPs or payment credentials.","Exact live location is intentionally not used for matching.","Suspicious links should be opened only when you trust the source."],reportCategories:REPORT_CATEGORIES}));
  app.post("/api/social/appeals", requireFirebaseUser, async (req,res)=>{const p=await getProfile(req.firebaseUser.uid);const reason=String(req.body?.reason||"").trim().slice(0,2000);if(reason.length<20)return res.status(400).json({error:"Please explain the appeal in at least 20 characters"});const existing=await safeDB(()=>Appeal.findOne({uid:req.firebaseUser.uid,status:{$in:["open","reviewing"]}}).lean(),null);if(existing)return res.status(409).json({error:"You already have an open appeal"});const a=await safeDB(()=>new Appeal({uid:req.firebaseUser.uid,email:req.firebaseUser.email||"",displayName:p?.displayName||"User",reason}).save(),null);res.json({ok:true,id:a?._id});});
  app.get("/api/social/ai/starter", requireFirebaseUser, (req,res)=>res.json({topic:String(req.query.topic||"General"),starters:starterFor(req.query.topic)}));
  app.post("/api/social/ai/language", requireFirebaseUser, (req,res)=>res.json({language:detectLanguage(req.body?.text)}));
  app.post("/api/social/ai/moderate", requireFirebaseUser, (req,res)=>res.json(autoModerate(req.body?.text)));
  app.post("/api/social/ai/summary", requireFirebaseUser, (req,res)=>res.json({summary:simpleSummary(req.body?.messages)}));
  app.post("/api/social/ai/translate", requireFirebaseUser, async (req,res)=>{
    const text=String(req.body?.text||"").slice(0,4000),target=String(req.body?.target||"English");
    // Provider hook: configure TRANSLATION_API_URL to a trusted translation service you control.
    if(!process.env.TRANSLATION_API_URL) return res.status(501).json({error:"Translation provider not configured",detectedLanguage:detectLanguage(text),target});
    try{const r=await fetch(process.env.TRANSLATION_API_URL,{method:"POST",headers:{"content-type":"application/json",...(process.env.TRANSLATION_API_KEY?{"authorization":`Bearer ${process.env.TRANSLATION_API_KEY}`}:{})},body:JSON.stringify({text,target})});if(!r.ok)throw new Error(`provider ${r.status}`);const data=await r.json();res.json({translation:data.translation||data.text||"",detectedLanguage:data.detectedLanguage||detectLanguage(text),target});}catch(e){res.status(502).json({error:"Translation provider failed"});}
  });

  // ------------------------------- ACCOUNT / PRIVACY / SESSIONS / PREMIUM STATUS
  app.get("/api/social/account/export", requireFirebaseUser, async (req,res)=>{const uid=req.firebaseUser.uid,p=await getProfile(uid);const cs=await safeDB(()=>Connection.find({$or:[{requesterUid:uid},{addresseeUid:uid}]}).lean(),[]);const ns=await safeDB(()=>Notification.find({uid}).lean(),[]);const sessions=await safeDB(()=>UserSession.find({firebaseUid:uid}).lean(),[]);const blockHistory=await safeDB(()=>BlockHistory.find({ownerUid:uid}).sort({createdAt:-1}).lean(),[]);res.json({exportedAt:new Date(),profile:p,connections:cs,notifications:ns,blockHistory,sessions:sessions.map(s=>({browser:s.browser,os:s.os,isMobile:s.isMobile,connectedAt:s.connectedAt,lastSeen:s.lastSeen}))});});
  app.get("/api/social/sessions", requireFirebaseUser, async (req,res)=>{const rows=await safeDB(()=>UserSession.find({firebaseUid:req.firebaseUser.uid}).sort({lastSeen:-1}).lean(),[]);res.json(rows.map(s=>({id:s._id,browser:s.browser,os:s.os,isMobile:s.isMobile,connectedAt:s.connectedAt,lastSeen:s.lastSeen})));});
  app.post("/api/social/sessions/revoke-all", requireFirebaseUser, async (req,res)=>{try{await admin.auth().revokeRefreshTokens(req.firebaseUser.uid);await safeDB(()=>UserSession.deleteMany({firebaseUid:req.firebaseUser.uid}));res.json({ok:true});}catch(e){res.status(500).json({error:"Could not revoke sessions"});}});
  app.get("/api/social/subscription", requireFirebaseUser, async (req,res)=>{const p=await getProfile(req.firebaseUser.uid);const premium=p?.premium||{plan:"free",status:"inactive"};res.json({plan:premium.status==="active"?premium.plan:"free",status:premium.status||"inactive",expiresAt:premium.expiresAt||null,benefits:{premium:["Premium profile themes","Animated avatar frames","Extra saved media allowance","Advanced room customization","No ads if ads are enabled later"],creator:["Creator/community room branding","Higher community member limits","Advanced moderation tools"]},billingConfigured:false,note:"Payment checkout is intentionally not faked. Connect your payment provider before enabling purchases."});});
  app.delete("/api/social/account", requireFirebaseUser, async (req,res)=>{if(String(req.body?.confirm||"")!=="DELETE")return res.status(400).json({error:'Send confirm: "DELETE"'});const uid=req.firebaseUser.uid,p=await getProfile(uid);await Promise.all([safeDB(()=>Connection.deleteMany({$or:[{requesterUid:uid},{addresseeUid:uid}]})),safeDB(()=>Notification.deleteMany({uid})),safeDB(()=>MatchHistory.deleteMany({uids:uid})),safeDB(()=>Appeal.deleteMany({uid})),safeDB(()=>GameScore.deleteMany({uid})),safeDB(()=>BlockHistory.deleteMany({$or:[{ownerUid:uid},{targetUid:uid}]})),safeDB(()=>UserSession.deleteMany({firebaseUid:uid})),safeDB(()=>UserProfile.deleteOne({firebaseUid:uid}))]);if(p?.displayName)await safeDB(()=>Message.updateMany({senderId:uid},{$set:{senderName:"Deleted User",senderAvatar:""}}));try{await admin.auth().deleteUser(uid);}catch(e){}res.json({ok:true});});

  // ------------------------------- ADMIN ANALYTICS / MOD QUEUE / AUDIT
  app.get("/api/social/admin/analytics", requireAdmin, async (req,res)=>{
    const since24=new Date(Date.now()-86400000),since7=new Date(Date.now()-7*86400000);
    const [users,totalMessages,messages24,reportsOpen,newUsers7,activeUsers24,connections,appeals,groups,gamePlayers] = await Promise.all([
      safeDB(()=>UserProfile.countDocuments(),0),safeDB(()=>Message.countDocuments(),0),safeDB(()=>Message.countDocuments({createdAt:{$gte:since24}}),0),safeDB(()=>Report.countDocuments({status:{$in:["open","reviewing"]}}),0),safeDB(()=>UserProfile.countDocuments({createdAt:{$gte:since7}}),0),safeDB(()=>UserProfile.countDocuments({lastSeen:{$gte:since24}}),0),safeDB(()=>Connection.countDocuments({status:"accepted"}),0),safeDB(()=>Appeal.countDocuments({status:{$in:["open","reviewing"]}}),0),safeDB(()=>Group.countDocuments(),0),safeDB(()=>GameScore.distinct("uid"),[])
    ]);
    const reportCats=await safeDB(()=>Report.aggregate([{$group:{_id:"$category",count:{$sum:1}}},{$sort:{count:-1}},{$limit:10}]),[]);
    const daily=await safeDB(()=>Message.aggregate([{$match:{createdAt:{$gte:since7}}},{$group:{_id:{$dateToString:{format:"%Y-%m-%d",date:"$createdAt"}},count:{$sum:1}}},{$sort:{_id:1}}]),[]);
    const userGrowth=await safeDB(()=>UserProfile.aggregate([{$match:{createdAt:{$gte:since7}}},{$group:{_id:{$dateToString:{format:"%Y-%m-%d",date:"$createdAt"}},count:{$sum:1}}},{$sort:{_id:1}}]),[]);
    res.json({online:Object.keys(activeUsers).length,activeUsers24,users,totalMessages,messages24,reportsOpen,newUsers7,connections,appeals,groups,gamePlayers:gamePlayers.length,reportCategories:reportCats,dailyMessages:daily,userGrowth,server:{node:process.version,uptimeSeconds:Math.round(process.uptime()),memoryMB:Math.round(process.memoryUsage().rss/1024/1024)}});
  });
  app.get("/api/social/admin/modqueue", requireAdmin, async (req,res)=>{const [reports,appeals,flagged]=await Promise.all([safeDB(()=>Report.find({status:{$in:["open","reviewing"]}}).sort({createdAt:-1}).limit(100).lean(),[]),safeDB(()=>Appeal.find({status:{$in:["open","reviewing"]}}).sort({createdAt:-1}).limit(100).lean(),[]),safeDB(()=>Message.find({"moderation.flagged":true}).sort({createdAt:-1}).limit(100).lean(),[])]);res.json({reports,appeals,flaggedMessages:flagged.map(m=>({id:m._id,sender:m.senderName,text:m.text,room:m.room,moderation:m.moderation,createdAt:m.createdAt}))});});
  app.get("/api/social/admin/appeals", requireAdmin, async (req,res)=>res.json(await safeDB(()=>Appeal.find({}).sort({createdAt:-1}).limit(100).lean(),[])));
  app.post("/api/social/admin/appeals/:id", requireAdmin, async (req,res)=>{if(!mongoose.isValidObjectId(req.params.id))return res.status(400).json({error:"Invalid appeal"});const status=String(req.body?.status||"");if(!["reviewing","accepted","rejected"].includes(status))return res.status(400).json({error:"Invalid status"});const a=await safeDB(()=>Appeal.findByIdAndUpdate(req.params.id,{$set:{status,moderatorNote:String(req.body?.note||"").slice(0,1000),reviewedAt:new Date()}},{returnDocument:"after"}),null);if(!a)return res.status(404).json({error:"Appeal missing"});await safeDB(()=>new AuditLog({actor:"web-admin",action:"appeal-"+status,target:a.uid,metadata:{appealId:String(a._id)}}).save());await notify(a.uid,"moderation",`Your appeal was ${status}.`,{appealId:String(a._id)});res.json({ok:true});});
  app.post("/api/social/admin/reports/:id", requireAdmin, async (req,res)=>{
    if(!mongoose.isValidObjectId(req.params.id))return res.status(400).json({error:"Invalid report"});
    const status=String(req.body?.status||"");if(!["reviewing","resolved","dismissed"].includes(status))return res.status(400).json({error:"Invalid status"});
    const r=await safeDB(()=>Report.findByIdAndUpdate(req.params.id,{$set:{status,moderatorNote:String(req.body?.note||"").slice(0,1000),reviewedAt:new Date(),reviewedBy:"web-admin"}},{returnDocument:"after"}),null);
    if(!r)return res.status(404).json({error:"Report missing"});
    await safeDB(()=>new AuditLog({actor:"web-admin",action:"report-"+status,target:r.reportedUser||"",metadata:{reportId:String(r._id)}}).save());
    res.json({ok:true,report:r});
  });
  app.post("/api/social/admin/premium", requireAdmin, async (req,res)=>{
    const uid=String(req.body?.uid||"").trim();const plan=String(req.body?.plan||"free"),status=String(req.body?.status||"inactive");
    if(!uid||!["free","premium","creator"].includes(plan)||!["inactive","active","past_due","cancelled"].includes(status))return res.status(400).json({error:"Invalid premium update"});
    const expiresAt=req.body?.expiresAt?new Date(req.body.expiresAt):null;if(expiresAt&&Number.isNaN(expiresAt.getTime()))return res.status(400).json({error:"Invalid expiry"});
    const p=await safeDB(()=>UserProfile.findOneAndUpdate({firebaseUid:uid},{$set:{premium:{plan,status,expiresAt},updatedAt:new Date()}},{returnDocument:"after"}),null);
    if(!p)return res.status(404).json({error:"User missing"});
    await safeDB(()=>new AuditLog({actor:"web-admin",action:"premium-update",target:uid,metadata:{plan,status,expiresAt}}).save());
    await notify(uid,"system",status==="active"?`${plan} access is active.`:"Your premium status changed.",{plan,status});
    res.json({ok:true,premium:p.premium});
  });
  app.get("/api/social/admin/audit", requireAdmin, async (req,res)=>res.json(await safeDB(()=>AuditLog.find({}).sort({createdAt:-1}).limit(200).lean(),[])));

  // ------------------------------- REAL-TIME SMART MATCH + TEMP CHAT + ENHANCED MESSAGES
  const matchQueue = new Map(); // uid -> {socketId, profile, filters, queuedAt}
  const liveMatches = new Map(); // uid -> {sessionId, partnerUid, room}
  const messageRate = new Map(); // uid -> timestamps
  const groupLastMessage = new Map();

  function compatible(a,b) {
    if(!a||!b)return {score:-1,commonInterests:[],commonLanguages:[]};
    if(a.blockedUids?.includes(b.firebaseUid)||b.blockedUids?.includes(a.firebaseUid))return {score:-1,commonInterests:[],commonLanguages:[]};
    const ai=(a.interests||[]),bi=(b.interests||[]),al=(a.languages||[]),bl=(b.languages||[]),at=(a.selectedTopics||[]),bt=(b.selectedTopics||[]);
    const commonInterests=ai.filter(x=>bi.includes(x)),commonLanguages=al.filter(x=>bl.includes(x)),commonTopics=at.filter(x=>bt.includes(x));
    let score=commonInterests.length*5+commonLanguages.length*4+commonTopics.length*3;
    if(a.country&&b.country&&a.country===b.country)score+=3;if(a.timezone&&b.timezone&&a.timezone===b.timezone)score+=1;
    const fa=a.matchFilters||{},fb=b.matchFilters||{};
    if(fa.sameCountry&&a.country!==b.country)return {score:-1,commonInterests,commonLanguages};
    if(fb.sameCountry&&a.country!==b.country)return {score:-1,commonInterests,commonLanguages};
    if((fa.languages||[]).length&&!fa.languages.some(x=>bl.includes(x)))return {score:-1,commonInterests,commonLanguages};
    if((fb.languages||[]).length&&!fb.languages.some(x=>al.includes(x)))return {score:-1,commonInterests,commonLanguages};
    if((fa.interests||[]).length&&!fa.interests.some(x=>bi.includes(x)))return {score:-1,commonInterests,commonLanguages};
    if((fb.interests||[]).length&&!fb.interests.some(x=>ai.includes(x)))return {score:-1,commonInterests,commonLanguages};
    if(fa.timezone&&b.timezone!==fa.timezone)return {score:-1,commonInterests,commonLanguages};
    if(fb.timezone&&a.timezone!==fb.timezone)return {score:-1,commonInterests,commonLanguages};
    return {score,commonInterests,commonLanguages};
  }
  function rateAllowed(uid) {const now=Date.now(),arr=(messageRate.get(uid)||[]).filter(t=>now-t<10000);if(arr.length>=12)return false;arr.push(now);messageRate.set(uid,arr);return true;}
  async function endMatch(uid,reason="left",requeuePartner=false){const m=liveMatches.get(uid);if(!m)return;liveMatches.delete(uid);const pm=liveMatches.get(m.partnerUid);if(pm)liveMatches.delete(m.partnerUid);const me=activeByUid(uid),partner=activeByUid(m.partnerUid);if(me)me.socketId&&io.to(me.socketId).emit("social:match:ended",{reason});if(partner)partner.socketId&&io.to(partner.socketId).emit("social:match:ended",{reason:reason==="skip"?"partner-skipped":reason});await safeDB(()=>MatchHistory.updateOne({sessionId:m.sessionId},{$set:{endedAt:new Date(),endedReason:reason}}));if(requeuePartner&&partner){const p=await getProfile(m.partnerUid);if(p?.discoverable!==false)matchQueue.set(m.partnerUid,{socketId:partner.socketId,profile:p,filters:p.matchFilters||{},queuedAt:Date.now()});}}

  io.on("connection", socket => {
    socket.on("social:match:find", async () => {
      const live=activeUsers[socket.id]; if(!live?.firebaseUid)return socket.emit("social:error","Join the authenticated chat first."); const uid=live.firebaseUid;
      if(liveMatches.has(uid))return socket.emit("social:error","You are already matched."); const profile=await getProfile(uid); if(!profile||profile.discoverable===false)return socket.emit("social:error","Enable Discoverable in profile first.");
      let best=null; for(const [otherUid,item] of matchQueue){if(otherUid===uid)continue;const c=compatible(profile,item.profile);if(c.score<0)continue;if(!best||c.score>best.compat.score)best={otherUid,item,compat:c};}
      if(!best){matchQueue.set(uid,{socketId:socket.id,profile,filters:profile.matchFilters||{},queuedAt:Date.now()});return socket.emit("social:match:searching",{queued:true});}
      matchQueue.delete(best.otherUid);matchQueue.delete(uid);const sessionId=crypto.randomBytes(12).toString("hex"),room=`match_${sessionId}`;socket.join(room);const otherSocket=io.sockets.sockets.get(best.item.socketId);if(otherSocket)otherSocket.join(room);liveMatches.set(uid,{sessionId,partnerUid:best.otherUid,room});liveMatches.set(best.otherUid,{sessionId,partnerUid:uid,room});const otherProfile=best.item.profile;
      await safeDB(()=>new MatchHistory({sessionId,uids:[uid,best.otherUid],score:best.compat.score,commonInterests:best.compat.commonInterests,commonLanguages:best.compat.commonLanguages}).save());
      socket.emit("social:match:found",{sessionId,score:best.compat.score,commonInterests:best.compat.commonInterests,commonLanguages:best.compat.commonLanguages,partner:publicProfile(otherProfile,uid,false)});
      if(otherSocket)otherSocket.emit("social:match:found",{sessionId,score:best.compat.score,commonInterests:best.compat.commonInterests,commonLanguages:best.compat.commonLanguages,partner:publicProfile(profile,best.otherUid,false)});await awardXp(uid,2);await awardXp(best.otherUid,2);
    });
    socket.on("social:match:message", async data => {const live=activeUsers[socket.id];if(!live?.firebaseUid)return;const m=liveMatches.get(live.firebaseUid);if(!m||String(data?.sessionId||"")!==m.sessionId)return;if(!rateAllowed(live.firebaseUid))return socket.emit("social:error","Too many messages. Slow down.");const text=String(data?.text||"").trim().slice(0,2000);if(!text)return;const moderation=autoModerate(text);if(moderation.score>=60)return socket.emit("social:error","Message blocked by safety filter.");const language=detectLanguage(text);socket.to(m.room).emit("social:match:message",{sessionId:m.sessionId,from:{uid:live.firebaseUid,name:live.name,avatar:live.avatar},text,language,createdAt:new Date(),moderation:{flagged:moderation.flagged}});});
    socket.on("social:match:typing", data=>{const live=activeUsers[socket.id];if(!live?.firebaseUid)return;const m=liveMatches.get(live.firebaseUid);if(m)socket.to(m.room).emit("social:match:typing",{typing:!!data?.typing});});
    socket.on("social:match:skip", async()=>{const live=activeUsers[socket.id];if(live?.firebaseUid)await endMatch(live.firebaseUid,"skip",true);socket.emit("social:match:ready");});
    socket.on("social:match:leave", async()=>{const live=activeUsers[socket.id];if(live?.firebaseUid)await endMatch(live.firebaseUid,"left",false);});

    socket.on("social:dm:send", async data=>{
      const live=activeUsers[socket.id];if(!live?.firebaseUid)return;const toUid=String(data?.toUid||"");if(!toUid||!(await acceptedConnection(live.firebaseUid,toUid))||await isBlockedEitherWay(live.firebaseUid,toUid))return socket.emit("social:error","Permanent DMs require an accepted connection.");if(!rateAllowed(live.firebaseUid))return socket.emit("social:error","Too many messages. Slow down.");const text=String(data?.text||"").trim().slice(0,4000);if(!text)return;const moderation=autoModerate(text);if(moderation.score>=60)return socket.emit("social:error","Message blocked by safety filter.");const recipient=await getProfile(toUid);const channelId=pairKey(live.firebaseUid,toUid);let doc=await safeDB(()=>DM.findOne({channelId}),null);if(!doc)doc=new DM({channelId,participantNames:[live.name,recipient?.displayName||"User"],messages:[]});doc.messages.push({senderUid:live.firebaseUid,receiverUid:toUid,senderName:live.name,senderAvatar:live.avatar,senderColor:live.color,text,type:"text",createdAt:new Date(),deliveredAt:activeByUid(toUid)?new Date():undefined});if(doc.messages.length>500)doc.messages=doc.messages.slice(-500);doc.updatedAt=new Date();await safeDB(()=>doc.save());const saved=doc.messages[doc.messages.length-1];const payload={id:saved?._id?.toString(),channelId,fromUid:live.firebaseUid,toUid,sender:live.name,text,createdAt:saved?.createdAt,deliveredAt:saved?.deliveredAt};socket.emit("social:dm:message",payload);const target=activeByUid(toUid);if(target)io.to(target.socketId).emit("social:dm:message",payload);else await notify(toUid,"dm",`${live.name} sent you a message.`,{fromUid:live.firebaseUid});await awardXp(live.firebaseUid,1,"First Conversation");
    });
    socket.on("social:dm:history", async data=>{const live=activeUsers[socket.id];if(!live?.firebaseUid)return;const toUid=String(data?.toUid||"");if(!(await acceptedConnection(live.firebaseUid,toUid)))return;const doc=await safeDB(()=>DM.findOne({channelId:pairKey(live.firebaseUid,toUid)}),null);if(!doc)return socket.emit("social:dm:history",{toUid,messages:[]});let changed=false;for(const m of doc.messages){if(m.receiverUid===live.firebaseUid&&!m.readAt){m.readAt=new Date();changed=true;}}if(changed)await safeDB(()=>doc.save());socket.emit("social:dm:history",{toUid,messages:(doc.messages||[]).map(m=>({id:m._id?.toString(),fromUid:m.senderUid,toUid:m.receiverUid,sender:m.senderName,text:m.text,type:m.type,mediaUrl:m.mediaUrl,caption:m.caption,createdAt:m.createdAt,deliveredAt:m.deliveredAt,readAt:m.readAt,editedAt:m.editedAt,reactions:m.reactions||[]}))});const target=activeByUid(toUid);if(target)io.to(target.socketId).emit("social:dm:read",{byUid:live.firebaseUid,channelId:pairKey(live.firebaseUid,toUid),at:new Date()});});

    socket.on("social:message:react", async data=>{const live=activeUsers[socket.id];if(!live?.firebaseUid||!mongoose.isValidObjectId(data?.id)||!EMOJIS.includes(data?.emoji))return;const m=await safeDB(()=>Message.findById(data.id),null);if(!m||!(await canAccessMessageRoom(live.firebaseUid,m.room)))return;let r=(m.reactions||[]).find(x=>x.emoji===data.emoji);if(!r){m.reactions.push({emoji:data.emoji,userUids:[live.firebaseUid]});}else{const set=new Set(r.userUids||[]);set.has(live.firebaseUid)?set.delete(live.firebaseUid):set.add(live.firebaseUid);r.userUids=[...set];}await m.save();io.to(m.room||"global").emit("social:message:reaction",{id:String(m._id),reactions:m.reactions});});
    socket.on("social:message:edit", async data=>{const live=activeUsers[socket.id];if(!live?.firebaseUid||!mongoose.isValidObjectId(data?.id))return;const m=await safeDB(()=>Message.findById(data.id),null);if(!m||!(await canAccessMessageRoom(live.firebaseUid,m.room))||m.senderId!==live.firebaseUid)return socket.emit("social:error","You can only edit your own accessible message.");if(Date.now()-new Date(m.createdAt).getTime()>15*60000)return socket.emit("social:error","Edit window is 15 minutes.");const text=String(data?.text||"").trim().slice(0,4000);if(!text)return;m.text=text;m.editedAt=new Date();m.language=detectLanguage(text);m.moderation=autoModerate(text);await m.save();io.to(m.room||"global").emit("social:message:edited",{id:String(m._id),text:m.text,editedAt:m.editedAt});});
    socket.on("social:message:pin", async data=>{const live=activeUsers[socket.id];if(!live?.firebaseUid||!mongoose.isValidObjectId(data?.id))return;const m=await safeDB(()=>Message.findById(data.id),null);if(!m)return;let allowed=!!live.isAdmin;if(!allowed&&m.room?.startsWith("group_")){const gid=m.room.slice(6);const g=await safeDB(()=>Group.findById(gid).lean(),null);allowed=hasGroupPower(g,live.firebaseUid);}if(!allowed)return socket.emit("social:error","Moderator access required to pin.");m.pinned=data?.pinned!==false;m.pinnedBy=live.firebaseUid;await m.save();io.to(m.room||"global").emit("social:message:pinned",{id:String(m._id),pinned:m.pinned});});
    socket.on("social:message:read", async data=>{const live=activeUsers[socket.id];if(!live?.firebaseUid||!mongoose.isValidObjectId(data?.id))return;const m=await safeDB(()=>Message.findById(data.id),null);if(!m||!(await canAccessMessageRoom(live.firebaseUid,m.room)))return;if(!(m.readBy||[]).some(x=>x.uid===live.firebaseUid))m.readBy.push({uid:live.firebaseUid,at:new Date()});await m.save();io.to(m.room||"global").emit("social:message:read",{id:String(m._id),uid:live.firebaseUid,at:new Date()});});

    socket.on("disconnect", async()=>{const live=activeUsers[socket.id];if(live?.firebaseUid){matchQueue.delete(live.firebaseUid);await endMatch(live.firebaseUid,"disconnect",false);await safeDB(()=>UserProfile.updateOne({firebaseUid:live.firebaseUid},{$set:{lastSeen:new Date()}}));}});
  });

  // Expire temporary messages once per minute.
  setInterval(async()=>{await safeDB(()=>Message.deleteMany({expiresAt:{$lte:new Date()}}));},60000).unref?.();

  return { Connection, Notification, MatchHistory, Appeal, AuditLog, BlockHistory, GameScore, constants:{INTERESTS,LANGUAGES,STATUSES,REPORT_CATEGORIES,EMOJIS}, helpers:{ detectLanguage, autoModerate, awardXp, acceptedConnection, isBlockedEitherWay, notify, groupRole, hasGroupPower } };
};
