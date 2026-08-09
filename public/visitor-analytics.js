'use strict';

const crypto = require('crypto');
const mongoose = require('mongoose');

function startOfUtcDay(d = new Date()) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
function addUtcDays(d, days) {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + days);
  return x;
}
function ymd(d) {
  return d.toISOString().slice(0, 10);
}
function validVisitorId(v) {
  return typeof v === 'string' && v.length >= 8 && v.length <= 256;
}
function botLike(ua='') {
  return /bot|crawler|spider|slurp|headless|lighthouse|pagespeed|preview/i.test(String(ua));
}
function hashIdentity(value) {
  // No raw browser/account identifier is stored in MongoDB.
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

module.exports = function registerVisitorAnalytics(app) {
  if (!app) throw new Error('registerVisitorAnalytics requires the Express app');

  const visitorSchema = new mongoose.Schema({
    visitorHash: { type:String, required:true, unique:true, index:true },
    firstSeen:   { type:Date, default:Date.now, index:true },
    lastSeen:    { type:Date, default:Date.now, index:true },
    visitCount:  { type:Number, default:1 },
    firstPath:   { type:String, default:'/' },
    lastPath:    { type:String, default:'/' }
  }, { versionKey:false });

  const visitorDaySchema = new mongoose.Schema({
    visitorHash: { type:String, required:true, index:true },
    dateKey:     { type:String, required:true, index:true }, // UTC YYYY-MM-DD
    firstSeen:   { type:Date, default:Date.now, index:true },
    lastSeen:    { type:Date, default:Date.now },
    views:       { type:Number, default:1 }
  }, { versionKey:false });
  visitorDaySchema.index({ visitorHash:1, dateKey:1 }, { unique:true });

  const Visitor = mongoose.models.SiteVisitor || mongoose.model('SiteVisitor', visitorSchema);
  const VisitorDay = mongoose.models.SiteVisitorDay || mongoose.model('SiteVisitorDay', visitorDaySchema);

  async function dbReady(req, res, next) {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error:'Analytics database is not connected' });
    }
    next();
  }

  // Record one page visit. Repeated visits increment visitCount/views but DO NOT create a new unique visitor.
  app.post('/api/analytics/visit', dbReady, async (req, res) => {
    try {
      if (botLike(req.get('user-agent') || '')) return res.json({ ignored:true });

      const browserId = String(req.body?.browserId || '').trim();
      if (!validVisitorId(browserId)) return res.status(400).json({ error:'Invalid visitor id' });

      // Browser ID is the stable dedupe anchor. Account hint helps keep the same signed-in identity
      // stable if you later decide to migrate to account-first analytics.
      const accountType = String(req.body?.accountType || 'browser').slice(0, 24);
      const accountId = String(req.body?.accountId || '').slice(0, 256);
      const identityMaterial = accountId ? `${accountType}:${accountId}|browser:${browserId}` : `browser:${browserId}`;
      const visitorHash = hashIdentity(identityMaterial);

      const now = new Date();
      const dateKey = ymd(startOfUtcDay(now));
      const path = String(req.body?.path || '/').slice(0, 240);

      const result = await Visitor.updateOne(
        { visitorHash },
        {
          $setOnInsert:{ visitorHash, firstSeen:now, firstPath:path },
          $set:{ lastSeen:now, lastPath:path },
          $inc:{ visitCount:1 }
        },
        { upsert:true }
      );

      await VisitorDay.updateOne(
        { visitorHash, dateKey },
        {
          $setOnInsert:{ visitorHash, dateKey, firstSeen:now },
          $set:{ lastSeen:now },
          $inc:{ views:1 }
        },
        { upsert:true }
      );

      const totalUnique = await Visitor.estimatedDocumentCount();
      return res.json({
        ok:true,
        newUnique:Boolean(result.upsertedCount || result.upsertedId),
        totalUnique
      });
    } catch (err) {
      if (err?.code === 11000) return res.json({ ok:true, duplicate:true });
      console.error('Visitor analytics record error:', err);
      res.status(500).json({ error:'Could not record analytics' });
    }
  });

  app.get('/api/analytics/summary', dbReady, async (req, res) => {
    try {
      const now = new Date();
      const today = startOfUtcDay(now);
      const todayKey = ymd(today);
      const sevenDaysAgo = addUtcDays(today, -6);
      const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      const yearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));

      const [
        totalUnique,
        todayUnique,
        last7Distinct,
        monthDistinct,
        yearDistinct,
        visitAgg
      ] = await Promise.all([
        Visitor.estimatedDocumentCount(),
        VisitorDay.countDocuments({ dateKey:todayKey }),
        VisitorDay.distinct('visitorHash', { firstSeen:{ $gte:sevenDaysAgo } }),
        VisitorDay.distinct('visitorHash', { firstSeen:{ $gte:monthStart } }),
        VisitorDay.distinct('visitorHash', { firstSeen:{ $gte:yearStart } }),
        Visitor.aggregate([{ $group:{ _id:null, total:{ $sum:'$visitCount' } } }])
      ]);

      res.set('Cache-Control','no-store');
      res.json({
        totalUnique,
        todayUnique,
        last7DaysUnique:last7Distinct.length,
        thisMonthUnique:monthDistinct.length,
        thisYearUnique:yearDistinct.length,
        totalVisits:Number(visitAgg?.[0]?.total || 0),
        currentYear:now.getUTCFullYear(),
        database:'connected'
      });
    } catch (err) {
      console.error('Analytics summary error:', err);
      res.status(500).json({ error:'Could not load analytics summary' });
    }
  });

  app.get('/api/analytics/years', dbReady, async (req, res) => {
    try {
      const rows = await VisitorDay.aggregate([
        { $group:{ _id:{ $year:'$firstSeen' } } },
        { $sort:{ _id:-1 } }
      ]);
      const current = new Date().getUTCFullYear();
      const years = rows.map(x => Number(x._id)).filter(Boolean);
      if (!years.includes(current)) years.unshift(current);
      res.set('Cache-Control','no-store');
      res.json({ years:[...new Set(years)].sort((a,b)=>b-a) });
    } catch (err) {
      res.status(500).json({ error:'Could not load analytics years' });
    }
  });

  app.get('/api/analytics/series', dbReady, async (req, res) => {
    try {
      const now = new Date();
      const period = ['day','week','month','year'].includes(req.query.period) ? req.query.period : 'day';
      const year = Math.max(2000, Math.min(2200, Number(req.query.year) || now.getUTCFullYear()));
      const month = Math.max(1, Math.min(12, Number(req.query.month) || (now.getUTCMonth()+1)));

      let start, end, firstGroup, secondGroup, points = [];

      if (period === 'day') {
        start = new Date(Date.UTC(year, month-1, 1));
        end = new Date(Date.UTC(year, month, 1));
        const rows = await VisitorDay.aggregate([
          { $match:{ firstSeen:{ $gte:start, $lt:end } } },
          { $group:{ _id:'$dateKey', value:{ $sum:1 } } },
          { $sort:{ _id:1 } }
        ]);
        const map = new Map(rows.map(r => [r._id, Number(r.value||0)]));
        const cursor = new Date(start);
        while (cursor < end) {
          const key = ymd(cursor);
          points.push({
            key,
            label:cursor.toLocaleDateString('en-US',{timeZone:'UTC',day:'2-digit',month:'short',year:'numeric'}),
            shortLabel:String(cursor.getUTCDate()).padStart(2,'0'),
            value:map.get(key)||0
          });
          cursor.setUTCDate(cursor.getUTCDate()+1);
        }
      }

      if (period === 'week') {
        start = new Date(Date.UTC(year,0,1));
        end = new Date(Date.UTC(year+1,0,1));
        // First group removes duplicate visitor-days inside the same ISO week.
        const rows = await VisitorDay.aggregate([
          { $match:{ firstSeen:{ $gte:start, $lt:end } } },
          { $group:{ _id:{ y:{ $isoWeekYear:'$firstSeen' }, w:{ $isoWeek:'$firstSeen' }, v:'$visitorHash' } } },
          { $group:{ _id:{ y:'$_id.y', w:'$_id.w' }, value:{ $sum:1 } } },
          { $sort:{ '_id.y':1, '_id.w':1 } }
        ]);
        points = rows.filter(r => Number(r._id.y) === year).map(r => ({
          key:`${r._id.y}-W${String(r._id.w).padStart(2,'0')}`,
          label:`Week ${r._id.w}, ${r._id.y}`,
          shortLabel:`W${r._id.w}`,
          value:Number(r.value||0)
        }));
      }

      if (period === 'month') {
        start = new Date(Date.UTC(year,0,1));
        end = new Date(Date.UTC(year+1,0,1));
        const rows = await VisitorDay.aggregate([
          { $match:{ firstSeen:{ $gte:start, $lt:end } } },
          { $group:{ _id:{ m:{ $month:'$firstSeen' }, v:'$visitorHash' } } },
          { $group:{ _id:'$_id.m', value:{ $sum:1 } } },
          { $sort:{ _id:1 } }
        ]);
        const map = new Map(rows.map(r => [Number(r._id), Number(r.value||0)]));
        const names=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        points = names.map((name,i)=>({
          key:`${year}-${String(i+1).padStart(2,'0')}`,
          label:`${name} ${year}`,
          shortLabel:name,
          value:map.get(i+1)||0
        }));
      }

      if (period === 'year') {
        const rows = await VisitorDay.aggregate([
          { $group:{ _id:{ y:{ $year:'$firstSeen' }, v:'$visitorHash' } } },
          { $group:{ _id:'$_id.y', value:{ $sum:1 } } },
          { $sort:{ _id:1 } }
        ]);
        const currentYear = now.getUTCFullYear();
        const map = new Map(rows.map(r => [Number(r._id), Number(r.value||0)]));
        const minYear = rows.length ? Math.min(...rows.map(r=>Number(r._id))) : currentYear;
        for (let y=minYear; y<=currentYear; y++) {
          points.push({ key:String(y), label:String(y), shortLabel:String(y), value:map.get(y)||0 });
        }
      }

      res.set('Cache-Control','no-store');
      res.json({ period, year, month, points });
    } catch (err) {
      console.error('Analytics series error:', err);
      res.status(500).json({ error:'Could not load analytics series' });
    }
  });
};
