const crypto = require('crypto');

const TOPICS = [
  { slug:'coding', name:'Coding & Dev', icon:'💻', description:'Programming, web, apps, cloud and developer help.', interests:['Coding','Web Development','Cloud','AI'], audience:'all' },
  { slug:'study', name:'Study Lounge', icon:'📚', description:'Study sessions, college life, exams and productivity.', interests:['Study','College','Productivity'], audience:'all' },
  { slug:'gaming', name:'Gaming', icon:'🎮', description:'Games, co-op, esports and gaming discussions.', interests:['Gaming','Esports'], audience:'all' },
  { slug:'movies', name:'Movies & Series', icon:'🎬', description:'Movies, shows, recommendations and spoiler-safe chat.', interests:['Movies','Series'], audience:'all' },
  { slug:'music', name:'Music', icon:'🎵', description:'Artists, playlists, instruments and music discovery.', interests:['Music'], audience:'all' },
  { slug:'anime', name:'Anime', icon:'🌸', description:'Anime, manga and community discussions.', interests:['Anime','Manga'], audience:'all' },
  { slug:'sports', name:'Sports', icon:'⚽', description:'Cricket, football, fitness and sports talk.', interests:['Sports','Cricket','Football'], audience:'all' },
  { slug:'india', name:'India Lounge', icon:'🇮🇳', description:'India-focused culture, student and everyday conversations.', interests:['India','Culture'], audience:'all' },
  { slug:'teen-lounge', name:'Teen Lounge', icon:'🫶', description:'Age-separated social space for users aged 13–17.', interests:['Friends','Study','Music','Gaming'], audience:'teen' },
  { slug:'adult-lounge', name:'18+ General Lounge', icon:'☕', description:'Age-separated general social space for adults.', interests:['General','Work','Hobbies'], audience:'adult' },
];

const DAILY_QUESTIONS = [
  'Which skill would you learn instantly if you could?',
  'What small habit improved your day the most?',
  'Which app do you wish existed right now?',
  'What is one topic you can talk about for hours?',
  'If you could visit one place this year, where would you go?',
  'What is a project you would love to build with a team?',
  'Which game, movie or book deserves more attention?',
  'What is one useful thing you learned this week?',
  'Would you rather master design, coding, communication or business?',
  'What makes an online community feel welcoming to you?',
  'Which technology do you think will matter most in five years?',
  'What is your favorite way to take a study break?',
  'What is one goal you want to complete this month?',
  'Which hobby would you recommend to a stranger?',
];

const STARTERS = {
  Coding: ['What are you building these days?', 'Which language do you enjoy most and why?', 'What bug took you the longest to solve?'],
  Gaming: ['Which game are you playing lately?', 'Single-player or multiplayer?', 'Which game deserves a remake?'],
  Study: ['Which subject are you focusing on this week?', 'What study method actually works for you?', 'Morning study or late-night study?'],
  Music: ['What song have you had on repeat lately?', 'Which artist would you see live?', 'Do you prefer playlists or full albums?'],
  Movies: ['What is the last movie you genuinely liked?', 'Which series are you watching?', 'Comedy, thriller or sci-fi?'],
  Anime: ['Which anime would you recommend to a beginner?', 'Sub or dub?', 'Which anime world would you visit?'],
  default: ['What is something interesting you learned recently?', 'What are you looking forward to this week?', 'Which hobby are you into right now?'],
};

function dayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}
function safeText(v, max = 500) { return String(v || '').trim().slice(0, max); }
function htmlEscape(v){ return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function slugify(v) {
  return safeText(v, 80).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
}
function pairKey(a,b) { return [String(a),String(b)].sort().join('::'); }
function ageBandFromDob(raw) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(raw || ''))) return null;
  const d = new Date(String(raw) + 'T00:00:00.000Z');
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0,10) !== String(raw)) return null;
  const now = new Date();
  let age = now.getUTCFullYear() - d.getUTCFullYear();
  const md = now.getUTCMonth() - d.getUTCMonth();
  if (md < 0 || (md === 0 && now.getUTCDate() < d.getUTCDate())) age--;
  if (age < 13 || age > 120) return null;
  return age < 18 ? 'teen' : 'adult';
}
function publicProfile(p) {
  if (!p) return null;
  const r = p.reputation || {};
  return {
    authId: p.authId,
    displayName: p.displayName,
    authType: p.authType,
    country: p.country || '',
    ageBand: p.ageBand || '',
    interests: Array.isArray(p.interests) ? p.interests : [],
    languages: Array.isArray(p.languages) ? p.languages : [],
    dmPolicy: p.dmPolicy || 'friends',
    streak: Number(p.streak || 0),
    reputation: { helpful:Number(r.helpful||0), friendly:Number(r.friendly||0), respectful:Number(r.respectful||0) },
    achievements: Array.isArray(p.achievements) ? p.achievements : [],
    lastSeen: p.lastSeen || null,
  };
}
function computeAchievements(p) {
  const a = [];
  if ((p.streak || 0) >= 3) a.push('3-day streak');
  if ((p.streak || 0) >= 7) a.push('7-day streak');
  const r = p.reputation || {};
  if ((r.helpful || 0) >= 5) a.push('Helpful member');
  if ((r.friendly || 0) >= 5) a.push('Friendly member');
  if ((r.respectful || 0) >= 5) a.push('Respectful member');
  if (((r.helpful||0)+(r.friendly||0)+(r.respectful||0)) >= 25) a.push('Trusted member');
  return a;
}
function touchStreak(p) {
  const today = dayKey();
  if (!p.lastActiveDay) p.streak = 1;
  else if (p.lastActiveDay !== today) {
    const yesterday = dayKey(new Date(Date.now() - 86400000));
    p.streak = p.lastActiveDay === yesterday ? Math.max(1, Number(p.streak||0) + 1) : 1;
  }
  p.lastActiveDay = today;
  p.lastSeen = new Date();
  p.achievements = computeAchievements(p);
}
function safetyCheck(text, state = {}) {
  const raw = safeText(text, 4000);
  const lower = raw.toLowerCase();
  const blocked = ['send nudes','explicit pic','credit card number','cvv','otp code','bank password'];
  const scam = ['guaranteed profit','double your money','send otp','share otp','investment guaranteed','free crypto'];
  const abusive = ['kill yourself','kys','motherfucker','madarchod','behenchod','chutiya','cunt'];
  let score = 0; const flags = [];
  if (blocked.some(x => lower.includes(x))) { score += 5; flags.push('unsafe-request'); }
  if (scam.some(x => lower.includes(x))) { score += 4; flags.push('scam-risk'); }
  if (abusive.some(x => lower.includes(x))) { score += 3; flags.push('abusive-language'); }
  const links = (raw.match(/https?:\/\//gi) || []).length;
  if (links >= 3) { score += 3; flags.push('link-spam'); }
  if (state.lastText && state.lastText === lower && Date.now() - (state.lastAt||0) < 10000) { score += 2; flags.push('duplicate-spam'); }
  return { allowed: score < 5, score, flags, suggestion: score >= 5 ? 'Message blocked by Smart Safety.' : score >= 3 ? 'Consider rewriting this more respectfully.' : '' };
}
function summarizeMessages(messages) {
  const texts = (messages || []).map(m => safeText(m.text, 400)).filter(Boolean).slice(-40);
  if (!texts.length) return 'No messages to summarize yet.';
  const words = new Map();
  for (const t of texts) for (const w of t.toLowerCase().match(/[a-z0-9]{4,}/g) || []) {
    if (['this','that','with','have','from','your','about','what','when','where','there','would','could','should'].includes(w)) continue;
    words.set(w, (words.get(w)||0)+1);
  }
  const top = [...words.entries()].sort((a,b)=>b[1]-a[1]).slice(0,5).map(([w])=>w);
  const sample = texts.slice(-3).map(t => t.length > 110 ? t.slice(0,107)+'…' : t);
  return `Recent discussion themes: ${top.length ? top.join(', ') : 'general conversation'}. Recent points: ${sample.join(' • ')}`;
}

module.exports = function initSocialFeatures(opts) {
  const { app, io, mongoose, verifyFirebaseToken, verifyGuestToken, firebaseAdminReady, UserProfile, GuestUser, mongoReady } = opts;

  const SocialProfileSchema = new mongoose.Schema({
    authId:{type:String,unique:true,index:true,required:true},
    displayName:{type:String,index:true,required:true}, authType:{type:String,enum:['firebase','guest'],required:true},
    country:{type:String,default:''}, ageBand:{type:String,enum:['teen','adult',''],default:''}, ageVerifiedAt:Date,
    interests:[String], languages:[String], dmPolicy:{type:String,enum:['everyone','friends','none'],default:'friends'},
    streak:{type:Number,default:0}, lastActiveDay:String,
    reputation:{ helpful:{type:Number,default:0}, friendly:{type:Number,default:0}, respectful:{type:Number,default:0} },
    achievements:[String], safetyStrikes:{type:Number,default:0}, restrictedUntil:Date, lastSeen:{type:Date,default:Date.now}, createdAt:{type:Date,default:Date.now}, updatedAt:{type:Date,default:Date.now},
  });
  const SocialProfile = mongoose.models.SocialProfile || mongoose.model('SocialProfile', SocialProfileSchema);

  const FriendRequestSchema = new mongoose.Schema({
    pairKey:{type:String,index:true}, fromId:{type:String,index:true}, fromName:String, toId:{type:String,index:true}, toName:String,
    status:{type:String,enum:['pending','accepted','declined'],default:'pending'}, createdAt:{type:Date,default:Date.now}, updatedAt:{type:Date,default:Date.now},
  });
  FriendRequestSchema.index({ pairKey:1, status:1 });
  const FriendRequest = mongoose.models.FriendRequest || mongoose.model('FriendRequest', FriendRequestSchema);

  const BlockSchema = new mongoose.Schema({ blockerId:{type:String,index:true}, targetId:{type:String,index:true}, createdAt:{type:Date,default:Date.now} });
  BlockSchema.index({ blockerId:1,targetId:1 }, { unique:true });
  const SocialBlock = mongoose.models.SocialBlock || mongoose.model('SocialBlock', BlockSchema);

  const MuteSchema = new mongoose.Schema({ muterId:{type:String,index:true}, targetId:{type:String,index:true}, targetName:String, createdAt:{type:Date,default:Date.now} });
  MuteSchema.index({ muterId:1,targetId:1 }, { unique:true });
  const SocialMute = mongoose.models.SocialMute || mongoose.model('SocialMute', MuteSchema);

  const SocialReportSchema = new mongoose.Schema({ reporterId:String, reporterName:String, targetId:String, targetName:String, reason:String, createdAt:{type:Date,default:Date.now}, status:{type:String,default:'open'} });
  const SocialReport = mongoose.models.SocialReport || mongoose.model('SocialReport', SocialReportSchema);

  const MatchSessionSchema = new mongoose.Schema({
    sessionId:{type:String,unique:true,index:true}, participants:[String], participantNames:[String], commonInterests:[String],
    ageBand:{type:String,index:true}, durationMinutes:Number, startedAt:{type:Date,default:Date.now}, expiresAt:{type:Date,index:true}, endedAt:Date,
    status:{type:String,enum:['active','ended','expired'],default:'active'},
    messages:[{ senderId:String,senderName:String,text:String,createdAt:{type:Date,default:Date.now} }],
  });
  const MatchSession = mongoose.models.MatchSession || mongoose.model('MatchSession', MatchSessionSchema);

  const TopicMessageSchema = new mongoose.Schema({
    slug:{type:String,index:true}, senderId:String, senderName:String, text:String,
    reactions:{type:Map,of:[String],default:{}}, createdAt:{type:Date,default:Date.now},
  });
  const TopicMessage = mongoose.models.TopicMessage || mongoose.model('TopicMessage', TopicMessageSchema);

  const CommunitySchema = new mongoose.Schema({
    name:String, slug:{type:String,unique:true,index:true}, description:String, tags:[String], ownerId:String, ownerName:String,
    ageBand:{type:String,enum:['teen','adult','all'],default:'all'}, members:[{authId:String,name:String}], createdAt:{type:Date,default:Date.now},
    pinnedMessageIds:[String],
  });
  const Community = mongoose.models.Community || mongoose.model('Community', CommunitySchema);
  const CommunityMessageSchema = new mongoose.Schema({
    communityId:{type:String,index:true}, senderId:String, senderName:String, text:String,
    reactions:{type:Map,of:[String],default:{}}, pinned:{type:Boolean,default:false}, createdAt:{type:Date,default:Date.now},
  });
  const CommunityMessage = mongoose.models.CommunityMessage || mongoose.model('CommunityMessage', CommunityMessageSchema);

  const CommunityThreadSchema = new mongoose.Schema({
    communityId:{type:String,index:true}, title:String, body:String, createdBy:String, createdByName:String, createdAt:{type:Date,default:Date.now},
    replies:[{senderId:String,senderName:String,text:String,createdAt:{type:Date,default:Date.now}}]
  });
  const CommunityThread = mongoose.models.CommunityThread || mongoose.model('CommunityThread', CommunityThreadSchema);

  const CommunityEventSchema = new mongoose.Schema({
    communityId:{type:String,index:true}, title:String, description:String, startsAt:Date, createdBy:String, createdByName:String, attendees:[String], createdAt:{type:Date,default:Date.now}
  });
  const CommunityEvent = mongoose.models.CommunityEvent || mongoose.model('CommunityEvent', CommunityEventSchema);

  const PollSchema = new mongoose.Schema({
    scope:{type:String,enum:['topic','community'],required:true}, scopeId:{type:String,index:true}, question:String,
    options:[{ text:String, voters:[String] }], createdBy:String, createdByName:String, createdAt:{type:Date,default:Date.now}, expiresAt:Date,
  });
  const Poll = mongoose.models.Poll || mongoose.model('Poll', PollSchema);

  const DailyAnswerSchema = new mongoose.Schema({
    day:{type:String,index:true}, authId:String, displayName:String, answer:String, createdAt:{type:Date,default:Date.now},
  });
  DailyAnswerSchema.index({ day:1, authId:1 }, { unique:true });
  const DailyAnswer = mongoose.models.DailyAnswer || mongoose.model('DailyAnswer', DailyAnswerSchema);

  const NotificationSchema = new mongoose.Schema({
    toId:{type:String,index:true}, type:String, text:String, link:String, read:{type:Boolean,default:false}, createdAt:{type:Date,default:Date.now},
  });
  const SocialNotification = mongoose.models.SocialNotification || mongoose.model('SocialNotification', NotificationSchema);

  const EndorsementSchema = new mongoose.Schema({ fromId:String,toId:String,category:String,day:String,createdAt:{type:Date,default:Date.now} });
  EndorsementSchema.index({ fromId:1,toId:1,category:1,day:1 }, { unique:true });
  const Endorsement = mongoose.models.Endorsement || mongoose.model('Endorsement', EndorsementSchema);

  const VoiceRoomSchema = new mongoose.Schema({
    roomKey:{type:String,unique:true,index:true}, title:String, ownerId:String, ownerName:String, ageBand:{type:String,enum:['teen','adult'],required:true},
    topic:String, createdAt:{type:Date,default:Date.now}, expiresAt:{type:Date,expires:0},
  });
  const VoiceRoom = mongoose.models.VoiceRoom || mongoose.model('VoiceRoom', VoiceRoomSchema);

  const online = new Map(); // authId -> {socketId,name,ageBand,interests}
  const queue = new Map();  // authId -> entry
  const safetyState = new Map();
  const topicCounts = new Map();

  async function resolveIdentityFromTokens(firebaseToken, guestToken) {
    if (guestToken) {
      const guest = await verifyGuestToken(guestToken);
      if (!guest) return null;
      return { authId:`guest:${guest.guestId}`, authType:'guest', displayName:guest.displayName, country:guest.country||'', ageBand:guest.ageBand||'', raw:guest };
    }
    if (firebaseToken && firebaseAdminReady()) {
      const decoded = await verifyFirebaseToken(firebaseToken);
      if (!decoded) return null;
      const p = mongoReady() ? await UserProfile.findOne({firebaseUid:decoded.uid}).lean().catch(()=>null) : null;
      return { authId:`firebase:${decoded.uid}`, authType:'firebase', displayName:p?.displayName || decoded.name || decoded.email?.split('@')[0] || 'User', country:p?.location||'', ageBand:p?.ageBand||'', raw:decoded };
    }
    return null;
  }

  async function resolveHttpIdentity(req) {
    const guestToken = String(req.headers['x-guest-token'] || '');
    const auth = String(req.headers.authorization || '');
    const firebaseToken = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    return resolveIdentityFromTokens(firebaseToken, guestToken);
  }

  async function ensureSocialProfile(identity) {
    if (!mongoReady()) throw new Error('Database unavailable');
    let p = await SocialProfile.findOne({authId:identity.authId});
    if (!p) p = new SocialProfile({ authId:identity.authId, displayName:identity.displayName, authType:identity.authType, country:identity.country||'', ageBand:identity.ageBand||'' });
    p.displayName = identity.displayName || p.displayName;
    p.authType = identity.authType;
    if (identity.country && !p.country) p.country = identity.country;
    if (identity.ageBand && !p.ageBand) p.ageBand = identity.ageBand;
    touchStreak(p);
    p.updatedAt = new Date();
    await p.save();
    return p;
  }

  async function checkSocialMessage(authId,text){
    const p=await SocialProfile.findOne({authId});
    if(p?.restrictedUntil && p.restrictedUntil>new Date())return {allowed:false,score:9,flags:['temporary-restriction'],suggestion:'Messaging is temporarily limited because Smart Safety detected repeated risky or spam-like messages.'};
    const prev=safetyState.get(authId)||{}; const now=Date.now(); const times=(prev.times||[]).filter(t=>now-t<8000); times.push(now); const check=safetyCheck(text,prev); if(times.length>6){check.score+=4;check.flags.push('rate-spam');check.allowed=false;check.suggestion='You are sending messages too quickly. Slow down and try again.';}
    safetyState.set(authId,{lastText:String(text).toLowerCase(),lastAt:now,times});
    if(!check.allowed && p){p.safetyStrikes=Number(p.safetyStrikes||0)+1;if(p.safetyStrikes>=3){p.restrictedUntil=new Date(Date.now()+10*60000);p.safetyStrikes=0;}await p.save().catch(()=>{});}
    return check;
  }

  async function authMiddleware(req,res,next) {
    if (!mongoReady()) return res.status(503).json({error:'Database is required for social features.'});
    const identity = await resolveHttpIdentity(req);
    if (!identity) return res.status(401).json({error:'Sign in or continue as guest first.'});
    try {
      req.socialIdentity = identity;
      req.socialProfile = await ensureSocialProfile(identity);
      next();
    } catch (e) { res.status(500).json({error:'Could not load social profile.'}); }
  }

  async function notify(toId,type,text,link='') {
    if (!toId) return;
    await SocialNotification.create({toId,type,text,link}).catch(()=>{});
    const live = online.get(toId);
    if (live) social.to(live.socketId).emit('notification',{type,text,link,createdAt:new Date()});
  }

  async function areFriends(a,b) {
    return !!await FriendRequest.findOne({pairKey:pairKey(a,b),status:'accepted'}).lean();
  }
  async function isBlockedEither(a,b) {
    return !!await SocialBlock.findOne({$or:[{blockerId:a,targetId:b},{blockerId:b,targetId:a}]}).lean();
  }
  async function findProfileByName(name) {
    const p = await SocialProfile.findOne({displayName:{$regex:new RegExp('^'+String(name).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'$','i')}});
    if (p) return p;
    const fp = await UserProfile.findOne({displayName:{$regex:new RegExp('^'+String(name).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'$','i')}}).lean().catch(()=>null);
    if (fp) return ensureSocialProfile({authId:`firebase:${fp.firebaseUid}`,authType:'firebase',displayName:fp.displayName,country:fp.location||'',ageBand:fp.ageBand||''});
    const gp = await GuestUser.findOne({usernameLower:String(name).toLowerCase()}).lean().catch(()=>null);
    if (gp) return ensureSocialProfile({authId:`guest:${gp.guestId}`,authType:'guest',displayName:gp.displayName,country:gp.country||'',ageBand:gp.ageBand||''});
    return null;
  }

  function dailyQuestion() {
    const key = dayKey();
    const days = Math.floor(Date.parse(key+'T00:00:00Z') / 86400000);
    return { day:key, question:DAILY_QUESTIONS[Math.abs(days) % DAILY_QUESTIONS.length] };
  }

  async function trendingPayload() {
    const topicStats = await Promise.all(TOPICS.map(async t => ({
      slug:t.slug,name:t.name,icon:t.icon,audience:t.audience,
      online:Number(topicCounts.get(t.slug)||0),
      messages:await TopicMessage.countDocuments({slug:t.slug,createdAt:{$gte:new Date(Date.now()-24*3600*1000)}}).catch(()=>0),
    })));
    topicStats.sort((a,b)=>(b.online*5+b.messages)-(a.online*5+a.messages));
    return topicStats;
  }

  // REST: bootstrap/profile
  app.get('/api/social/bootstrap', authMiddleware, async (req,res) => {
    const p = req.socialProfile;
    const [incoming,outgoing,friends,notes,communities,recentMatches,trending,answerCount,mutes] = await Promise.all([
      FriendRequest.find({toId:p.authId,status:'pending'}).sort({createdAt:-1}).lean(),
      FriendRequest.find({fromId:p.authId,status:'pending'}).sort({createdAt:-1}).lean(),
      FriendRequest.find({$or:[{fromId:p.authId},{toId:p.authId}],status:'accepted'}).sort({updatedAt:-1}).lean(),
      SocialNotification.find({toId:p.authId}).sort({createdAt:-1}).limit(30).lean(),
      Community.find({$or:[{'members.authId':p.authId}, {ageBand:'all'}, {ageBand:p.ageBand||'__none__'}]}).sort({createdAt:-1}).limit(50).lean(),
      MatchSession.find({participants:p.authId,status:{$in:['ended','expired']}}).sort({startedAt:-1}).limit(8).lean(),
      trendingPayload(),
      DailyAnswer.countDocuments({day:dayKey()}),
      SocialMute.find({muterId:p.authId}).sort({createdAt:-1}).lean(),
    ]);
    const friendViews = friends.map(f => ({requestId:String(f._id), authId:f.fromId===p.authId?f.toId:f.fromId, name:f.fromId===p.authId?f.toName:f.fromName, since:f.updatedAt}));
    res.json({
      profile:publicProfile(p), topics:TOPICS, trending, daily:{...dailyQuestion(),answerCount},
      incoming:incoming.map(x=>({...x,_id:String(x._id)})), outgoing:outgoing.map(x=>({...x,_id:String(x._id)})), friends:friendViews,
      notifications:notes.map(n=>({...n,_id:String(n._id)})), communities:communities.map(c=>({...c,_id:String(c._id),memberCount:c.members?.length||0})),
      recentMatches:recentMatches.map(m=>({sessionId:m.sessionId,names:m.participantNames,commonInterests:m.commonInterests,startedAt:m.startedAt})),
      muted:mutes.map(m=>({authId:m.targetId,name:m.targetName})), starters:STARTERS,
    });
  });

  app.put('/api/social/profile', authMiddleware, async (req,res) => {
    const p = req.socialProfile;
    const b = req.body && typeof req.body==='object' ? req.body : {};
    if (b.dob) {
      const band = ageBandFromDob(String(b.dob));
      if (!band) return res.status(400).json({error:'Enter a valid DOB. Social discovery is available for age 13+.'});
      p.ageBand = band; p.ageVerifiedAt = new Date();
      if (p.authType === 'guest') await GuestUser.updateOne({guestId:p.authId.replace('guest:','')},{$set:{ageBand:band}}).catch(()=>{});
      else await UserProfile.updateOne({firebaseUid:p.authId.replace('firebase:','')},{$set:{ageBand:band,ageVerifiedAt:new Date()}}).catch(()=>{});
    }
    if (Array.isArray(b.interests)) p.interests = [...new Set(b.interests.map(x=>safeText(x,30)).filter(Boolean))].slice(0,12);
    if (Array.isArray(b.languages)) p.languages = [...new Set(b.languages.map(x=>safeText(x,30)).filter(Boolean))].slice(0,6);
    if (['everyone','friends','none'].includes(b.dmPolicy)) p.dmPolicy = b.dmPolicy;
    p.updatedAt = new Date(); touchStreak(p); await p.save();
    res.json({ok:true,profile:publicProfile(p)});
  });

  app.get('/api/social/daily', authMiddleware, async (req,res)=>{
    const d=dailyQuestion(); const [count,mine,answers]=await Promise.all([
      DailyAnswer.countDocuments({day:d.day}), DailyAnswer.findOne({day:d.day,authId:req.socialProfile.authId}).lean(), DailyAnswer.find({day:d.day}).sort({createdAt:-1}).limit(30).lean()
    ]);
    res.json({...d,count,mine:mine?.answer||'',answers:answers.map(a=>({name:a.displayName,answer:a.answer,createdAt:a.createdAt}))});
  });
  app.post('/api/social/daily', authMiddleware, async (req,res)=>{
    const answer=safeText(req.body?.answer,280); if(answer.length<2)return res.status(400).json({error:'Write a little more.'}); const check=await checkSocialMessage(req.socialProfile.authId,answer); if(!check.allowed)return res.status(400).json({error:check.suggestion});
    const d=dailyQuestion(); await DailyAnswer.findOneAndUpdate({day:d.day,authId:req.socialProfile.authId},{$set:{displayName:req.socialProfile.displayName,answer}},{upsert:true});
    res.json({ok:true,count:await DailyAnswer.countDocuments({day:d.day})});
  });

  // Friends / block / reputation
  app.post('/api/social/friends/request', authMiddleware, async (req,res)=>{
    const target = await findProfileByName(safeText(req.body?.username,40));
    if(!target || target.authId===req.socialProfile.authId)return res.status(404).json({error:'User not found.'});
    if(await isBlockedEither(req.socialProfile.authId,target.authId))return res.status(403).json({error:'Friend request unavailable.'});
    if(!req.socialProfile.ageBand || !target.ageBand || req.socialProfile.ageBand!==target.ageBand)return res.status(403).json({error:'Friend discovery is limited to the same age group.'});
    const pk=pairKey(req.socialProfile.authId,target.authId);
    const accepted=await FriendRequest.findOne({pairKey:pk,status:'accepted'}).lean(); if(accepted)return res.status(409).json({error:'You are already friends.'});
    const existing=await FriendRequest.findOne({pairKey:pk,status:'pending'}).lean(); if(existing)return res.status(409).json({error:'A request is already pending.'});
    const fr=await FriendRequest.create({pairKey:pk,fromId:req.socialProfile.authId,fromName:req.socialProfile.displayName,toId:target.authId,toName:target.displayName});
    await notify(target.authId,'friend_request',`${req.socialProfile.displayName} sent you a friend request.`,'/discover.html#friends');
    res.json({ok:true,requestId:String(fr._id)});
  });
  app.post('/api/social/friends/respond', authMiddleware, async (req,res)=>{
    const fr=await FriendRequest.findOne({_id:req.body?.requestId,toId:req.socialProfile.authId,status:'pending'}); if(!fr)return res.status(404).json({error:'Request not found.'});
    const action=req.body?.action==='accept'?'accepted':'declined'; fr.status=action; fr.updatedAt=new Date(); await fr.save();
    if(action==='accepted')await notify(fr.fromId,'friend_accepted',`${req.socialProfile.displayName} accepted your friend request.`,'/discover.html#friends');
    res.json({ok:true,status:action});
  });
  app.post('/api/social/block', authMiddleware, async (req,res)=>{
    const target=await findProfileByName(safeText(req.body?.username,40)); if(!target||target.authId===req.socialProfile.authId)return res.status(404).json({error:'User not found.'});
    await SocialBlock.updateOne({blockerId:req.socialProfile.authId,targetId:target.authId},{$setOnInsert:{createdAt:new Date()}},{upsert:true});
    queue.delete(req.socialProfile.authId); await FriendRequest.updateMany({pairKey:pairKey(req.socialProfile.authId,target.authId),status:'pending'},{$set:{status:'declined'}});
    res.json({ok:true});
  });
  app.post('/api/social/unblock', authMiddleware, async (req,res)=>{ const target=await findProfileByName(safeText(req.body?.username,40)); if(target)await SocialBlock.deleteOne({blockerId:req.socialProfile.authId,targetId:target.authId}); res.json({ok:true}); });
  app.post('/api/social/mute', authMiddleware, async (req,res)=>{
    const target=await findProfileByName(safeText(req.body?.username,40)); if(!target||target.authId===req.socialProfile.authId)return res.status(404).json({error:'User not found.'});
    await SocialMute.updateOne({muterId:req.socialProfile.authId,targetId:target.authId},{$set:{targetName:target.displayName},$setOnInsert:{createdAt:new Date()}},{upsert:true}); res.json({ok:true});
  });
  app.post('/api/social/unmute', authMiddleware, async (req,res)=>{ const target=await findProfileByName(safeText(req.body?.username,40)); if(target)await SocialMute.deleteOne({muterId:req.socialProfile.authId,targetId:target.authId}); res.json({ok:true}); });
  app.post('/api/social/report', authMiddleware, async (req,res)=>{
    const target=await findProfileByName(safeText(req.body?.username,40)); const reason=safeText(req.body?.reason,500); if(!target||target.authId===req.socialProfile.authId)return res.status(404).json({error:'User not found.'});
    await SocialReport.create({reporterId:req.socialProfile.authId,reporterName:req.socialProfile.displayName,targetId:target.authId,targetName:target.displayName,reason:reason||'Safety concern'}); res.json({ok:true});
  });
  app.post('/api/social/endorse', authMiddleware, async (req,res)=>{
    const target=await findProfileByName(safeText(req.body?.username,40)); const category=String(req.body?.category||'');
    if(!target||target.authId===req.socialProfile.authId||!['helpful','friendly','respectful'].includes(category))return res.status(400).json({error:'Invalid endorsement.'});
    if(!await areFriends(req.socialProfile.authId,target.authId))return res.status(403).json({error:'Endorsements are available between friends.'});
    try{await Endorsement.create({fromId:req.socialProfile.authId,toId:target.authId,category,day:dayKey()});}
    catch(e){return res.status(409).json({error:'You already gave this endorsement today.'});}
    const updated=await SocialProfile.findOneAndUpdate({authId:target.authId},{$inc:{[`reputation.${category}`]:1}},{new:true});
    updated.achievements=computeAchievements(updated); await updated.save();
    await notify(target.authId,'reputation',`${req.socialProfile.displayName} marked you as ${category}.`,'/discover.html#friends');
    res.json({ok:true,reputation:publicProfile(updated).reputation,achievements:updated.achievements});
  });

  app.post('/api/social/notifications/read', authMiddleware, async (req,res)=>{ await SocialNotification.updateMany({toId:req.socialProfile.authId,read:false},{$set:{read:true}}); res.json({ok:true}); });

  // Communities
  app.get('/api/social/communities', authMiddleware, async (req,res)=>{
    const q = req.socialProfile.ageBand ? {$or:[{ageBand:'all'},{ageBand:req.socialProfile.ageBand}]} : {ageBand:'all'};
    const rows=await Community.find(q).sort({createdAt:-1}).limit(100).lean(); res.json(rows.map(c=>({...c,_id:String(c._id),memberCount:c.members?.length||0})));
  });
  app.post('/api/social/communities', authMiddleware, async (req,res)=>{
    if(!req.socialProfile.ageBand)return res.status(400).json({error:'Verify your age group first.'});
    const name=safeText(req.body?.name,60), description=safeText(req.body?.description,300); if(name.length<3)return res.status(400).json({error:'Community name is too short.'});
    let slug=slugify(name)||crypto.randomBytes(4).toString('hex'); if(await Community.findOne({slug}))slug += '-' + crypto.randomBytes(2).toString('hex');
    const c=await Community.create({name,slug,description,tags:(req.body?.tags||[]).map(x=>safeText(x,24)).slice(0,6),ownerId:req.socialProfile.authId,ownerName:req.socialProfile.displayName,ageBand:req.body?.ageBand==='all'?'all':req.socialProfile.ageBand,members:[{authId:req.socialProfile.authId,name:req.socialProfile.displayName}]});
    res.json({ok:true,community:{...c.toObject(),_id:String(c._id),memberCount:1}});
  });
  app.post('/api/social/communities/:id/join', authMiddleware, async (req,res)=>{
    const c=await Community.findById(req.params.id); if(!c)return res.status(404).json({error:'Community not found.'});
    if(c.ageBand!=='all' && c.ageBand!==req.socialProfile.ageBand)return res.status(403).json({error:'This community is for a different age group.'});
    if(!c.members.some(m=>m.authId===req.socialProfile.authId)){c.members.push({authId:req.socialProfile.authId,name:req.socialProfile.displayName});await c.save();}
    res.json({ok:true});
  });
  app.get('/api/social/communities/:id/messages', authMiddleware, async (req,res)=>{
    const c=await Community.findById(req.params.id).lean(); if(!c)return res.status(404).json({error:'Community not found.'});
    if(c.ageBand!=='all'&&c.ageBand!==req.socialProfile.ageBand)return res.status(403).json({error:'Not available for your age group.'});
    const [msgs,polls,threads,events]=await Promise.all([
      CommunityMessage.find({communityId:String(c._id)}).sort({createdAt:1}).limit(100).lean(),
      Poll.find({scope:'community',scopeId:String(c._id),$or:[{expiresAt:null},{expiresAt:{$gt:new Date()}}]}).sort({createdAt:-1}).lean(),
      CommunityThread.find({communityId:String(c._id)}).sort({createdAt:-1}).limit(30).lean(),
      CommunityEvent.find({communityId:String(c._id),startsAt:{$gte:new Date(Date.now()-86400000)}}).sort({startsAt:1}).limit(30).lean()
    ]);
    res.json({community:{...c,_id:String(c._id)},messages:msgs.map(m=>({...m,_id:String(m._id)})),polls,threads:threads.map(t=>({...t,_id:String(t._id)})),events:events.map(e=>({...e,_id:String(e._id)}))});
  });
  app.post('/api/social/communities/:id/threads', authMiddleware, async (req,res)=>{
    const c=await Community.findById(req.params.id).lean(); if(!c||!c.members.some(m=>m.authId===req.socialProfile.authId))return res.status(403).json({error:'Join the community first.'});
    const title=safeText(req.body?.title,120),body=safeText(req.body?.body,1800); if(title.length<3||body.length<2)return res.status(400).json({error:'Thread needs a title and message.'}); const check=await checkSocialMessage(req.socialProfile.authId,title+' '+body); if(!check.allowed)return res.status(400).json({error:check.suggestion});
    const t=await CommunityThread.create({communityId:String(c._id),title,body,createdBy:req.socialProfile.authId,createdByName:req.socialProfile.displayName}); res.json({ok:true,thread:{...t.toObject(),_id:String(t._id)}});
  });
  app.post('/api/social/threads/:id/reply', authMiddleware, async (req,res)=>{
    const t=await CommunityThread.findById(req.params.id); if(!t)return res.status(404).json({error:'Thread not found.'}); const c=await Community.findById(t.communityId).lean(); if(!c||!c.members.some(m=>m.authId===req.socialProfile.authId))return res.status(403).json({error:'Join the community first.'});
    const text=safeText(req.body?.text,1000); if(!text)return res.status(400).json({error:'Reply cannot be empty.'}); const check=await checkSocialMessage(req.socialProfile.authId,text); if(!check.allowed)return res.status(400).json({error:check.suggestion}); t.replies.push({senderId:req.socialProfile.authId,senderName:req.socialProfile.displayName,text}); if(t.replies.length>100)t.replies=t.replies.slice(-100);await t.save();res.json({ok:true,thread:{...t.toObject(),_id:String(t._id)}});
  });
  app.post('/api/social/communities/:id/events', authMiddleware, async (req,res)=>{
    const c=await Community.findById(req.params.id).lean(); if(!c||!c.members.some(m=>m.authId===req.socialProfile.authId))return res.status(403).json({error:'Join the community first.'}); const startsAt=new Date(req.body?.startsAt); if(Number.isNaN(startsAt.getTime())||startsAt<Date.now()-60000)return res.status(400).json({error:'Choose a future event time.'});
    const title=safeText(req.body?.title,120),description=safeText(req.body?.description,500); if(title.length<3)return res.status(400).json({error:'Event title is too short.'}); const e=await CommunityEvent.create({communityId:String(c._id),title,description,startsAt,createdBy:req.socialProfile.authId,createdByName:req.socialProfile.displayName,attendees:[req.socialProfile.authId]}); res.json({ok:true,event:{...e.toObject(),_id:String(e._id)}});
  });
  app.post('/api/social/events/:id/rsvp', authMiddleware, async (req,res)=>{ const e=await CommunityEvent.findById(req.params.id); if(!e)return res.status(404).json({error:'Event not found.'}); if(!e.attendees.includes(req.socialProfile.authId))e.attendees.push(req.socialProfile.authId);await e.save();res.json({ok:true,count:e.attendees.length}); });

  app.get('/api/social/communities/:id/summary', authMiddleware, async (req,res)=>{
    const msgs=await CommunityMessage.find({communityId:req.params.id}).sort({createdAt:-1}).limit(40).lean(); res.json({summary:summarizeMessages(msgs.reverse())});
  });

  // Polls
  app.post('/api/social/polls', authMiddleware, async (req,res)=>{
    const scope=req.body?.scope==='community'?'community':'topic'; const scopeId=safeText(req.body?.scopeId,80); const question=safeText(req.body?.question,160);
    const options=(req.body?.options||[]).map(x=>safeText(x,80)).filter(Boolean).slice(0,6); if(question.length<3||options.length<2)return res.status(400).json({error:'Poll needs a question and at least two options.'});
    if(scope==='topic') { const t=TOPICS.find(x=>x.slug===scopeId); if(!t)return res.status(404).json({error:'Topic not found.'}); if(t.audience!=='all'&&t.audience!==req.socialProfile.ageBand)return res.status(403).json({error:'Topic not available.'}); }
    else { const c=await Community.findById(scopeId).lean(); if(!c||!c.members.some(m=>m.authId===req.socialProfile.authId))return res.status(403).json({error:'Join the community first.'}); }
    const poll=await Poll.create({scope,scopeId,question,options:options.map(text=>({text,voters:[]})),createdBy:req.socialProfile.authId,createdByName:req.socialProfile.displayName,expiresAt:new Date(Date.now()+7*86400000)});
    social.to(`${scope}:${scopeId}`).emit('poll_update',{action:'created',poll}); res.json({ok:true,poll});
  });
  app.post('/api/social/polls/:id/vote', authMiddleware, async (req,res)=>{
    const poll=await Poll.findById(req.params.id); if(!poll)return res.status(404).json({error:'Poll not found.'});
    const idx=Number(req.body?.optionIndex); if(!Number.isInteger(idx)||idx<0||idx>=poll.options.length)return res.status(400).json({error:'Invalid option.'});
    for(const o of poll.options)o.voters=o.voters.filter(v=>v!==req.socialProfile.authId); poll.options[idx].voters.push(req.socialProfile.authId); await poll.save();
    social.to(`${poll.scope}:${poll.scopeId}`).emit('poll_update',{action:'voted',poll}); res.json({ok:true,poll});
  });

  // Voice rooms
  app.post('/api/social/voice-rooms', authMiddleware, async (req,res)=>{
    if(!req.socialProfile.ageBand)return res.status(400).json({error:'Verify your age group first.'});
    const roomKey='s2s-voice-'+crypto.randomBytes(18).toString('hex');
    const room=await VoiceRoom.create({roomKey,title:safeText(req.body?.title,80)||'Voice room',ownerId:req.socialProfile.authId,ownerName:req.socialProfile.displayName,ageBand:req.socialProfile.ageBand,topic:safeText(req.body?.topic,40),expiresAt:new Date(Date.now()+6*3600000)});
    res.json({ok:true,room:{roomKey,title:room.title,url:`/voice/${roomKey}`}});
  });
  app.get('/api/social/voice-rooms/:roomKey', authMiddleware, async (req,res)=>{
    const room=await VoiceRoom.findOne({roomKey:req.params.roomKey,expiresAt:{$gt:new Date()}}).lean().catch(()=>null);
    if(!room)return res.status(404).json({error:'Voice room expired or not found.'});
    if(room.ageBand!==req.socialProfile.ageBand)return res.status(403).json({error:'This voice room is for a different age group.'});
    res.json({ok:true,room:{roomKey:room.roomKey,title:room.title,ownerName:room.ownerName,ageBand:room.ageBand}});
  });
  app.get('/voice/:roomKey', async (req,res)=>{
    const room=await VoiceRoom.findOne({roomKey:req.params.roomKey,expiresAt:{$gt:new Date()}}).lean().catch(()=>null);
    if(!room)return res.status(404).send('Voice room expired or not found.');
    res.sendFile(require('path').join(__dirname,'public','voice-gate.html'));
  });

  // SEO topic pages
  app.get('/rooms/:slug', async (req,res,next)=>{
    const t=TOPICS.find(x=>x.slug===req.params.slug); if(!t)return next();
    const canonical=`${req.protocol}://${req.get('host')}/rooms/${t.slug}`;
    res.type('html').send(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${t.name} Chat Room | Stranger 2 Stranger</title><meta name="description" content="Join the ${t.name} discussion room on Stranger 2 Stranger. ${t.description}"><link rel="canonical" href="${canonical}"><link rel="stylesheet" href="/white-sky-ui.css"></head><body style="margin:0;background:#f7fbff;color:#0f172a;font-family:Inter,system-ui,sans-serif"><main style="max-width:760px;margin:10vh auto;padding:32px"><div style="background:white;border:1px solid #dbeafe;border-radius:24px;padding:34px;box-shadow:0 16px 40px rgba(14,165,233,.08)"><div style="font-size:44px">${t.icon}</div><h1>${t.name} Chat Room</h1><p style="font-size:18px;line-height:1.7;color:#475569">${t.description}</p><p>Meet people around shared interests with age-separated matching, reporting, blocking and smart safety controls.</p><a href="/discover.html?topic=${t.slug}" style="display:inline-block;margin-top:14px;background:#0ea5e9;color:white;text-decoration:none;padding:13px 20px;border-radius:12px;font-weight:700">Open ${t.name}</a></div></main></body></html>`);
  });

  app.get('/robots.txt', (req,res)=>{ res.type('text/plain').send('User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\nSitemap: '+req.protocol+'://'+req.get('host')+'/sitemap.xml\n'); });
  app.get('/sitemap.xml', async (req,res)=>{
    const base=req.protocol+'://'+req.get('host'); const communities=mongoReady()?await Community.find({}).select('slug createdAt').sort({createdAt:-1}).limit(500).lean().catch(()=>[]):[];
    const urls=[`${base}/`,`${base}/discover.html`,...TOPICS.map(t=>`${base}/rooms/${t.slug}`),...communities.map(c=>`${base}/community/${c.slug}`)];
    res.type('application/xml').send('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+urls.map(u=>`<url><loc>${u.replace(/&/g,'&amp;')}</loc></url>`).join('')+'</urlset>');
  });

  app.get('/community/:slug', async (req,res,next)=>{
    const c=await Community.findOne({slug:req.params.slug}).lean().catch(()=>null); if(!c)return next(); const canonical=`${req.protocol}://${req.get('host')}/community/${c.slug}`;
    res.type('html').send(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${htmlEscape(safeText(c.name,80))} Community | Stranger 2 Stranger</title><meta name="description" content="${htmlEscape(safeText(c.description||'Join this community on Stranger 2 Stranger.',150))}"><link rel="canonical" href="${canonical}"><link rel="stylesheet" href="/white-sky-ui.css"></head><body style="margin:0;background:#f7fbff;color:#0f172a;font-family:Inter,system-ui,sans-serif"><main style="max-width:760px;margin:10vh auto;padding:32px"><div style="background:#fff;border:1px solid #dbeafe;border-radius:24px;padding:34px"><h1>${htmlEscape(safeText(c.name,80))}</h1><p>${htmlEscape(safeText(c.description,300))}</p><p>${c.members?.length||0} members • ${c.ageBand==='all'?'Public audience':c.ageBand==='teen'?'13–17 space':'18+ space'}</p><a href="/discover.html?community=${c._id}" style="display:inline-block;background:#0ea5e9;color:#fff;padding:13px 20px;border-radius:12px;text-decoration:none;font-weight:700">Open community</a></div></main></body></html>`);
  });

  const social = io.of('/social');
  social.on('connection', socket => {
    let user = null;
    let joinedTopic = '';
    let joinedCommunity = '';

    socket.on('social_join', async data => {
      try {
        const id=await resolveIdentityFromTokens(data?.firebaseToken||'',data?.guestToken||''); if(!id)return socket.emit('social_error','Authentication required.');
        const p=await ensureSocialProfile(id); user=publicProfile(p); online.set(user.authId,{socketId:socket.id,name:user.displayName,ageBand:user.ageBand,interests:user.interests});
        socket.emit('social_ready',{profile:user,online:online.size}); social.emit('social_online',{online:online.size});
      } catch(e){socket.emit('social_error','Could not start social session.');}
    });

    socket.on('find_match', async data => {
      if(!user)return; if(!user.ageBand)return socket.emit('match_error','Verify your age group first.');
      const interests=[...new Set((data?.interests||user.interests||[]).map(x=>safeText(x,30)).filter(Boolean))].slice(0,12); if(!interests.length)return socket.emit('match_error','Choose at least one interest.');
      const duration=[10,15,20,30,60].includes(Number(data?.duration))?Number(data.duration):15;
      queue.delete(user.authId);
      let best=null,bestScore=-1;
      for(const q of queue.values()){
        if(q.ageBand!==user.ageBand||q.authId===user.authId)continue;
        if(await isBlockedEither(user.authId,q.authId))continue;
        const common=interests.filter(i=>q.interests.includes(i)); const score=common.length;
        if(score>bestScore){best={q,common};bestScore=score;}
      }
      if(best){
        queue.delete(best.q.authId);
        const sessionId=crypto.randomUUID(); const expiresAt=new Date(Date.now()+duration*60000);
        await MatchSession.create({sessionId,participants:[user.authId,best.q.authId],participantNames:[user.displayName,best.q.name],commonInterests:best.common,durationMinutes:duration,expiresAt});
        setTimeout(async()=>{const x=await MatchSession.findOne({sessionId,status:'active'});if(x){x.status='expired';x.endedAt=new Date();x.messages=[];await x.save();social.to('match:'+sessionId).emit('match_ended',{reason:'Temporary conversation finished.'});}},duration*60000+500);
        const room='match:'+sessionId; socket.join(room); const otherSocket=social.sockets.get(best.q.socketId); if(otherSocket)otherSocket.join(room);
        const myStarter=(STARTERS[best.common[0]]||STARTERS.default)[Math.floor(Math.random()*3)];
        socket.emit('match_found',{sessionId,partner:{authId:best.q.authId,name:best.q.name,country:best.q.country||'',interests:best.q.interests},commonInterests:best.common,expiresAt,starter:myStarter});
        if(otherSocket)otherSocket.emit('match_found',{sessionId,partner:{authId:user.authId,name:user.displayName,country:user.country||'',interests},commonInterests:best.common,expiresAt,starter:myStarter});
      } else {
        queue.set(user.authId,{authId:user.authId,socketId:socket.id,name:user.displayName,country:user.country||'',ageBand:user.ageBand,interests,duration,queuedAt:Date.now()});
        socket.emit('match_waiting',{queued:true,available:[...queue.values()].filter(x=>x.ageBand===user.ageBand).length});
      }
    });
    socket.on('cancel_match',()=>{if(user)queue.delete(user.authId);socket.emit('match_waiting',{queued:false});});
    socket.on('match_message', async data => {
      if(!user)return; const session=await MatchSession.findOne({sessionId:data?.sessionId,participants:user.authId,status:'active'}); if(!session)return socket.emit('match_error','Match ended.');
      if(session.expiresAt<new Date()){session.status='expired';session.endedAt=new Date();session.messages=[];await session.save();social.to('match:'+session.sessionId).emit('match_ended',{reason:'Time is up.'});return;}
      const text=safeText(data?.text,1200); if(!text)return;
      const check=await checkSocialMessage(user.authId,text); if(!check.allowed)return socket.emit('safety_notice',{message:check.suggestion,flags:check.flags});
      session.messages.push({senderId:user.authId,senderName:user.displayName,text}); if(session.messages.length>200)session.messages=session.messages.slice(-200); await session.save();
      social.to('match:'+session.sessionId).emit('match_message',{sessionId:session.sessionId,senderId:user.authId,senderName:user.displayName,text,createdAt:new Date(),safetyHint:check.suggestion});
    });
    socket.on('end_match', async ({sessionId}={})=>{if(!user)return;const s=await MatchSession.findOne({sessionId,participants:user.authId,status:'active'});if(!s)return;s.status='ended';s.endedAt=new Date();s.messages=[];await s.save();social.to('match:'+sessionId).emit('match_ended',{reason:'Conversation ended.'});});

    socket.on('rematch_request', async ({username}={})=>{
      if(!user)return;
      const target=await findProfileByName(safeText(username,40));
      if(!target||target.authId===user.authId)return socket.emit('match_error','User not found.');
      if(!user.ageBand||!target.ageBand||user.ageBand!==target.ageBand)return socket.emit('match_error','Rematch is limited to the same age group.');
      if(await isBlockedEither(user.authId,target.authId))return socket.emit('match_error','Rematch unavailable.');
      const live=online.get(target.authId); if(!live)return socket.emit('match_error','That person is offline right now.');
      social.to(live.socketId).emit('rematch_invite',{fromId:user.authId,fromName:user.displayName,interests:user.interests||[]});
      socket.emit('rematch_sent',{toName:target.displayName});
    });
    socket.on('rematch_accept', async ({fromId}={})=>{
      if(!user)return; const requester=online.get(String(fromId||'')); if(!requester)return socket.emit('match_error','That person is no longer online.');
      const requesterProfile=await SocialProfile.findOne({authId:fromId}).lean(); if(!requesterProfile||requesterProfile.ageBand!==user.ageBand)return socket.emit('match_error','Rematch unavailable.');
      if(await isBlockedEither(user.authId,fromId))return socket.emit('match_error','Rematch unavailable.');
      const common=(user.interests||[]).filter(i=>(requesterProfile.interests||[]).includes(i)); const duration=15; const sessionId=crypto.randomUUID(); const expiresAt=new Date(Date.now()+duration*60000);
      await MatchSession.create({sessionId,participants:[user.authId,fromId],participantNames:[user.displayName,requesterProfile.displayName],commonInterests:common,durationMinutes:duration,expiresAt});
      setTimeout(async()=>{const x=await MatchSession.findOne({sessionId,status:'active'});if(x){x.status='expired';x.endedAt=new Date();x.messages=[];await x.save();social.to('match:'+sessionId).emit('match_ended',{reason:'Temporary conversation finished.'});}},duration*60000+500);
      const room='match:'+sessionId; socket.join(room); const otherSocket=social.sockets.get(requester.socketId); if(otherSocket)otherSocket.join(room); const starter=(STARTERS[common[0]]||STARTERS.default)[0];
      socket.emit('match_found',{sessionId,partner:{authId:fromId,name:requesterProfile.displayName,country:requesterProfile.country||'',interests:requesterProfile.interests||[]},commonInterests:common,expiresAt,starter});
      if(otherSocket)otherSocket.emit('match_found',{sessionId,partner:{authId:user.authId,name:user.displayName,country:user.country||'',interests:user.interests||[]},commonInterests:common,expiresAt,starter});
    });

    socket.on('topic_join', async ({slug}={})=>{
      if(!user)return;const t=TOPICS.find(x=>x.slug===slug);if(!t)return socket.emit('social_error','Topic not found.');if(t.audience!=='all'&&t.audience!==user.ageBand)return socket.emit('social_error','This room is for a different age group.');
      if(joinedTopic){socket.leave('topic:'+joinedTopic);topicCounts.set(joinedTopic,Math.max(0,(topicCounts.get(joinedTopic)||1)-1));}
      joinedTopic=slug;socket.join('topic:'+slug);topicCounts.set(slug,(topicCounts.get(slug)||0)+1);
      const [messages,polls]=await Promise.all([TopicMessage.find({slug}).sort({createdAt:1}).limit(100).lean(),Poll.find({scope:'topic',scopeId:slug,$or:[{expiresAt:null},{expiresAt:{$gt:new Date()}}]}).sort({createdAt:-1}).lean()]);
      socket.emit('topic_history',{slug,messages:messages.map(m=>({...m,_id:String(m._id)})),polls,online:Number(topicCounts.get(slug)||0)});social.to('topic:'+slug).emit('topic_presence',{slug,online:Number(topicCounts.get(slug)||0)});
    });
    socket.on('topic_message',async ({slug,text}={})=>{
      if(!user||joinedTopic!==slug)return;const clean=safeText(text,1800);if(!clean)return;const check=await checkSocialMessage(user.authId,clean);if(!check.allowed)return socket.emit('safety_notice',{message:check.suggestion,flags:check.flags});
      const m=await TopicMessage.create({slug,senderId:user.authId,senderName:user.displayName,text:clean});social.to('topic:'+slug).emit('topic_message',{...m.toObject(),_id:String(m._id),reactions:{}});
    });
    socket.on('topic_react',async ({messageId,emoji}={})=>{
      if(!user||!['👍','❤️','😂','💡','👏'].includes(emoji))return;const m=await TopicMessage.findById(messageId);if(!m)return;const arr=(m.reactions.get(emoji)||[]).filter(x=>x!==user.authId);arr.push(user.authId);m.reactions.set(emoji,arr);await m.save();social.to('topic:'+m.slug).emit('topic_reaction',{messageId,emoji,count:arr.length});
    });

    socket.on('community_join_socket',async ({communityId}={})=>{
      if(!user)return;const c=await Community.findById(communityId);if(!c)return socket.emit('social_error','Community not found.');if(c.ageBand!=='all'&&c.ageBand!==user.ageBand)return socket.emit('social_error','Community not available.');if(!c.members.some(m=>m.authId===user.authId))return socket.emit('social_error','Join the community first.');
      if(joinedCommunity)socket.leave('community:'+joinedCommunity);joinedCommunity=String(c._id);socket.join('community:'+joinedCommunity);socket.emit('community_socket_ready',{communityId:joinedCommunity});
    });
    socket.on('community_message',async ({communityId,text}={})=>{
      if(!user||joinedCommunity!==String(communityId))return;const clean=safeText(text,1800);if(!clean)return;const check=await checkSocialMessage(user.authId,clean);if(!check.allowed)return socket.emit('safety_notice',{message:check.suggestion,flags:check.flags});
      const m=await CommunityMessage.create({communityId:String(communityId),senderId:user.authId,senderName:user.displayName,text:clean});social.to('community:'+communityId).emit('community_message',{...m.toObject(),_id:String(m._id),reactions:{}});
    });
    socket.on('community_react',async ({messageId,emoji}={})=>{
      if(!user||!['👍','❤️','😂','💡','👏'].includes(emoji))return;const m=await CommunityMessage.findById(messageId);if(!m)return;const arr=(m.reactions.get(emoji)||[]).filter(x=>x!==user.authId);arr.push(user.authId);m.reactions.set(emoji,arr);await m.save();social.to('community:'+m.communityId).emit('community_reaction',{messageId,emoji,count:arr.length});
    });
    socket.on('community_pin',async ({messageId}={})=>{
      if(!user)return;const m=await CommunityMessage.findById(messageId);if(!m)return;const c=await Community.findById(m.communityId);if(!c||c.ownerId!==user.authId)return socket.emit('social_error','Only the community owner can pin messages.');m.pinned=!m.pinned;await m.save();social.to('community:'+m.communityId).emit('community_pin_update',{messageId,pinned:m.pinned});
    });

    socket.on('disconnect',()=>{
      if(!user)return;queue.delete(user.authId);online.delete(user.authId);if(joinedTopic){topicCounts.set(joinedTopic,Math.max(0,(topicCounts.get(joinedTopic)||1)-1));social.to('topic:'+joinedTopic).emit('topic_presence',{slug:joinedTopic,online:Number(topicCounts.get(joinedTopic)||0)});}social.emit('social_online',{online:online.size});
    });
  });

  return { SocialProfile, FriendRequest, SocialBlock, SocialMute, SocialReport, MatchSession, TopicMessage, Community, CommunityMessage, CommunityThread, CommunityEvent, Poll, DailyAnswer, SocialNotification, VoiceRoom };
};
