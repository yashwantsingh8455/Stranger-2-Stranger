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

function validVisitorId(value) {
  return typeof value === 'string' && value.length >= 8 && value.length <= 256;
}

function botLike(userAgent = '') {
  return /bot|crawler|spider|slurp|headless|lighthouse|pagespeed|preview/i.test(String(userAgent));
}

function hashIdentity(value) {
  // Raw browser IDs are never stored in MongoDB.
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

module.exports = function registerVisitorAnalytics(app) {
  if (!app) throw new Error('registerVisitorAnalytics requires the Express app');

  const visitorSchema = new mongoose.Schema({
    visitorHash: { type: String, required: true, unique: true, index: true },
    firstSeen: { type: Date, default: Date.now, index: true },
    lastSeen: { type: Date, default: Date.now, index: true },
    // Start at zero because the first request increments this value to one.
    visitCount: { type: Number, default: 0 },
    firstPath: { type: String, default: '/' },
    lastPath: { type: String, default: '/' },
  }, { versionKey: false });

  const visitorDaySchema = new mongoose.Schema({
    visitorHash: { type: String, required: true, index: true },
    dateKey: { type: String, required: true, index: true }, // UTC YYYY-MM-DD
    firstSeen: { type: Date, default: Date.now, index: true },
    lastSeen: { type: Date, default: Date.now },
    // Start at zero because the first request increments this value to one.
    views: { type: Number, default: 0 },
  }, { versionKey: false });

  // One daily row per browser visitor. Refreshes only increment views.
  visitorDaySchema.index({ visitorHash: 1, dateKey: 1 }, { unique: true });

  const Visitor = mongoose.models.SiteVisitor || mongoose.model('SiteVisitor', visitorSchema);
  const VisitorDay = mongoose.models.SiteVisitorDay || mongoose.model('SiteVisitorDay', visitorDaySchema);

  function dbReady(req, res, next) {
    if (mongoose.connection.readyState !== 1) {
      res.set('Cache-Control', 'no-store');
      return res.status(503).json({
        error: 'Analytics database is not connected',
        database: 'disconnected',
      });
    }
    next();
  }

  // POST /api/analytics/visit
  // One browser profile gets one all-time unique record. Repeat visits do not
  // increase totalUnique; they only update lastSeen/visitCount and daily views.
  app.post('/api/analytics/visit', dbReady, async (req, res) => {
    try {
      if (botLike(req.get('user-agent') || '')) {
        return res.json({ ok: true, ignored: true });
      }

      const browserId = String(req.body?.browserId || '').trim();
      if (!validVisitorId(browserId)) {
        return res.status(400).json({ error: 'Invalid visitor id' });
      }

      // Browser ID is intentionally the stable dedupe anchor. If the same browser
      // later logs in/out or switches Guest/Firebase mode, it remains one visitor.
      const visitorHash = hashIdentity(`browser:${browserId}`);
      const now = new Date();
      const dateKey = ymd(startOfUtcDay(now));
      const visitPath = String(req.body?.path || '/').slice(0, 240);

      const result = await Visitor.updateOne(
        { visitorHash },
        {
          $setOnInsert: {
            visitorHash,
            firstSeen: now,
            firstPath: visitPath,
          },
          $set: {
            lastSeen: now,
            lastPath: visitPath,
          },
          $inc: { visitCount: 1 },
        },
        { upsert: true, setDefaultsOnInsert: true }
      );

      await VisitorDay.updateOne(
        { visitorHash, dateKey },
        {
          $setOnInsert: {
            visitorHash,
            dateKey,
            firstSeen: now,
          },
          $set: { lastSeen: now },
          $inc: { views: 1 },
        },
        { upsert: true, setDefaultsOnInsert: true }
      );

      const totalUnique = await Visitor.estimatedDocumentCount();
      res.set('Cache-Control', 'no-store');
      return res.json({
        ok: true,
        newUnique: Boolean(result.upsertedCount || result.upsertedId),
        totalUnique,
      });
    } catch (err) {
      // A simultaneous first request can race against the unique indexes.
      // That still represents the same visitor, not a server failure.
      if (err?.code === 11000) {
        const totalUnique = await Visitor.estimatedDocumentCount().catch(() => 0);
        return res.json({ ok: true, duplicate: true, totalUnique });
      }

      console.error('Visitor analytics record error:', err);
      return res.status(500).json({ error: 'Could not record analytics' });
    }
  });

  // GET /api/analytics/summary
  app.get('/api/analytics/summary', dbReady, async (req, res) => {
    try {
      const now = new Date();
      const today = startOfUtcDay(now);
      const tomorrow = addUtcDays(today, 1);
      const todayKey = ymd(today);
      const sevenDaysAgo = addUtcDays(today, -6);
      const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
      const yearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
      const yearEnd = new Date(Date.UTC(now.getUTCFullYear() + 1, 0, 1));

      const [
        totalUnique,
        todayUnique,
        last7Distinct,
        monthDistinct,
        yearDistinct,
        visitAgg,
      ] = await Promise.all([
        Visitor.estimatedDocumentCount(),
        VisitorDay.countDocuments({ dateKey: todayKey }),
        VisitorDay.distinct('visitorHash', { firstSeen: { $gte: sevenDaysAgo, $lt: tomorrow } }),
        VisitorDay.distinct('visitorHash', { firstSeen: { $gte: monthStart, $lt: monthEnd } }),
        VisitorDay.distinct('visitorHash', { firstSeen: { $gte: yearStart, $lt: yearEnd } }),
        Visitor.aggregate([{ $group: { _id: null, total: { $sum: '$visitCount' } } }]),
      ]);

      res.set('Cache-Control', 'no-store');
      return res.json({
        totalUnique,
        todayUnique,
        last7DaysUnique: last7Distinct.length,
        thisMonthUnique: monthDistinct.length,
        thisYearUnique: yearDistinct.length,
        totalVisits: Number(visitAgg?.[0]?.total || 0),
        currentYear: now.getUTCFullYear(),
        database: 'connected',
      });
    } catch (err) {
      console.error('Analytics summary error:', err);
      return res.status(500).json({ error: 'Could not load analytics summary' });
    }
  });

  // GET /api/analytics/years
  app.get('/api/analytics/years', dbReady, async (req, res) => {
    try {
      const rows = await VisitorDay.aggregate([
        { $group: { _id: { $year: '$firstSeen' } } },
        { $sort: { _id: -1 } },
      ]);

      const currentYear = new Date().getUTCFullYear();
      const years = rows.map((row) => Number(row._id)).filter(Boolean);
      if (!years.includes(currentYear)) years.unshift(currentYear);

      res.set('Cache-Control', 'no-store');
      return res.json({ years: [...new Set(years)].sort((a, b) => b - a) });
    } catch (err) {
      console.error('Analytics years error:', err);
      return res.status(500).json({ error: 'Could not load analytics years' });
    }
  });

  // GET /api/analytics/series?period=day|week|month|year&year=2026&month=8
  app.get('/api/analytics/series', dbReady, async (req, res) => {
    try {
      const now = new Date();
      const period = ['day', 'week', 'month', 'year'].includes(req.query.period)
        ? req.query.period
        : 'day';
      const year = Math.max(2000, Math.min(2200, Number(req.query.year) || now.getUTCFullYear()));
      const month = Math.max(1, Math.min(12, Number(req.query.month) || (now.getUTCMonth() + 1)));

      let points = [];

      if (period === 'day') {
        const start = new Date(Date.UTC(year, month - 1, 1));
        const end = new Date(Date.UTC(year, month, 1));
        const rows = await VisitorDay.aggregate([
          { $match: { firstSeen: { $gte: start, $lt: end } } },
          { $group: { _id: '$dateKey', value: { $sum: 1 } } },
          { $sort: { _id: 1 } },
        ]);

        const valueByDate = new Map(rows.map((row) => [row._id, Number(row.value || 0)]));
        const cursor = new Date(start);
        while (cursor < end) {
          const key = ymd(cursor);
          points.push({
            key,
            label: cursor.toLocaleDateString('en-US', {
              timeZone: 'UTC', day: '2-digit', month: 'short', year: 'numeric',
            }),
            shortLabel: String(cursor.getUTCDate()).padStart(2, '0'),
            value: valueByDate.get(key) || 0,
          });
          cursor.setUTCDate(cursor.getUTCDate() + 1);
        }
      }

      if (period === 'week') {
        // Include records belonging to the selected ISO week-year. A small date
        // buffer handles the first/last ISO week that crosses calendar-year edges.
        const start = new Date(Date.UTC(year - 1, 11, 20));
        const end = new Date(Date.UTC(year + 1, 0, 10));
        const rows = await VisitorDay.aggregate([
          { $match: { firstSeen: { $gte: start, $lt: end } } },
          {
            $group: {
              _id: {
                y: { $isoWeekYear: '$firstSeen' },
                w: { $isoWeek: '$firstSeen' },
                v: '$visitorHash',
              },
            },
          },
          { $group: { _id: { y: '$_id.y', w: '$_id.w' }, value: { $sum: 1 } } },
          { $sort: { '_id.y': 1, '_id.w': 1 } },
        ]);

        const weekMap = new Map(
          rows
            .filter((row) => Number(row._id.y) === year)
            .map((row) => [Number(row._id.w), Number(row.value || 0)])
        );

        const maxWeek = Math.max(1, ...weekMap.keys());
        for (let week = 1; week <= maxWeek; week += 1) {
          points.push({
            key: `${year}-W${String(week).padStart(2, '0')}`,
            label: `Week ${week}, ${year}`,
            shortLabel: `W${week}`,
            value: weekMap.get(week) || 0,
          });
        }
      }

      if (period === 'month') {
        const start = new Date(Date.UTC(year, 0, 1));
        const end = new Date(Date.UTC(year + 1, 0, 1));
        const rows = await VisitorDay.aggregate([
          { $match: { firstSeen: { $gte: start, $lt: end } } },
          { $group: { _id: { m: { $month: '$firstSeen' }, v: '$visitorHash' } } },
          { $group: { _id: '$_id.m', value: { $sum: 1 } } },
          { $sort: { _id: 1 } },
        ]);

        const valueByMonth = new Map(rows.map((row) => [Number(row._id), Number(row.value || 0)]));
        const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        points = names.map((name, index) => ({
          key: `${year}-${String(index + 1).padStart(2, '0')}`,
          label: `${name} ${year}`,
          shortLabel: name,
          value: valueByMonth.get(index + 1) || 0,
        }));
      }

      if (period === 'year') {
        const rows = await VisitorDay.aggregate([
          { $group: { _id: { y: { $year: '$firstSeen' }, v: '$visitorHash' } } },
          { $group: { _id: '$_id.y', value: { $sum: 1 } } },
          { $sort: { _id: 1 } },
        ]);

        const currentYear = now.getUTCFullYear();
        const valueByYear = new Map(rows.map((row) => [Number(row._id), Number(row.value || 0)]));
        const minYear = rows.length ? Math.min(...rows.map((row) => Number(row._id))) : currentYear;
        for (let y = minYear; y <= currentYear; y += 1) {
          points.push({
            key: String(y), label: String(y), shortLabel: String(y), value: valueByYear.get(y) || 0,
          });
        }
      }

      res.set('Cache-Control', 'no-store');
      return res.json({ period, year, month, points });
    } catch (err) {
      console.error('Analytics series error:', err);
      return res.status(500).json({ error: 'Could not load analytics series' });
    }
  });
};
