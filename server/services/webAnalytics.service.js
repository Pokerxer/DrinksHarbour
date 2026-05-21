'use strict';

const WebAnalytics = require('../models/WebAnalytics');
const User         = require('../models/User');
const Order        = require('../models/Order');

// ─── Date helpers ────────────────────────────────────────────────────────────

function startOf(date, unit) {
  const d = new Date(date);
  if (unit === 'day')   { d.setHours(0, 0, 0, 0); }
  if (unit === 'month') { d.setDate(1); d.setHours(0, 0, 0, 0); }
  return d;
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function addMonths(date, n) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + n);
  return d;
}

const DAY_NAMES   = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Fix 6: handle NaN/Infinity
function pctChange(current, previous) {
  if (typeof current !== 'number' || typeof previous !== 'number') return 0;
  if (isNaN(current) || isNaN(previous)) return 0;
  if (previous === 0) return current > 0 ? 100 : 0;
  const result = ((current - previous) / previous) * 100;
  return isFinite(result) ? parseFloat(result.toFixed(2)) : 0;
}

// ─── 1. recordPageView ───────────────────────────────────────────────────────

async function recordPageView(data) {
  // Count existing pages in this session to set pageViewsInSession
  const existingCount = await WebAnalytics.countDocuments({ sessionId: data.sessionId });
  const pageViewsInSession = existingCount + 1;

  // If this is not the first page in the session, mark previous docs as not bounced
  if (existingCount > 0) {
    await WebAnalytics.updateMany(
      { sessionId: data.sessionId, bounced: true },
      { $set: { bounced: false } }
    );
  }

  const doc = await WebAnalytics.create({
    ...data,
    pageViewsInSession,
  });

  return doc;
}

// ─── 2. updatePageDuration ───────────────────────────────────────────────────

async function updatePageDuration({ sessionId, page, duration }) {
  // Update the most recent doc matching sessionId + page
  await WebAnalytics.findOneAndUpdate(
    { sessionId, page },
    { $set: { duration } },
    { sort: { createdAt: -1 } }
  );

  // Recalculate total session duration as sum of all page durations
  const result = await WebAnalytics.aggregate([
    { $match: { sessionId } },
    { $group: { _id: '$sessionId', totalDuration: { $sum: '$duration' } } },
  ]);

  const totalDuration = result.length > 0 ? result[0].totalDuration : 0;

  // Apply sessionDuration to all docs in this session
  await WebAnalytics.updateMany({ sessionId }, { $set: { sessionDuration: totalDuration } });

  return { sessionDuration: totalDuration };
}

// ─── 3. getOverview ──────────────────────────────────────────────────────────

async function getOverview(period = 30) {
  const now       = new Date();
  const curStart  = startOf(addDays(now, -period), 'day');
  const prevStart = startOf(addDays(now, -(period * 2)), 'day');
  const prevEnd   = new Date(curStart);

  async function computeMetrics(start, end) {
    // Aggregate per session
    const sessions = await WebAnalytics.aggregate([
      { $match: { createdAt: { $gte: start, $lt: end } } },
      {
        $group: {
          _id: '$sessionId',
          allBounced:      { $min: { $cond: ['$bounced', 1, 0] } },
          anyConverted:    { $max: { $cond: ['$converted', 1, 0] } },
          sessionDuration: { $max: '$sessionDuration' },
          pageViews:       { $sum: 1 },
        },
      },
    ]);

    const totalSessions = sessions.length;
    if (totalSessions === 0) {
      return { traffic: 0, bounceRate: 0, conversionRate: 0, avgSessionDuration: 0 };
    }

    const bouncedSessions   = sessions.filter(s => s.allBounced === 1).length;
    const convertedSessions = sessions.filter(s => s.anyConverted === 1).length;
    const totalDuration     = sessions.reduce((sum, s) => sum + (s.sessionDuration || 0), 0);

    return {
      traffic:            totalSessions,
      bounceRate:         parseFloat(((bouncedSessions / totalSessions) * 100).toFixed(2)),
      conversionRate:     parseFloat(((convertedSessions / totalSessions) * 100).toFixed(2)),
      avgSessionDuration: parseFloat((totalDuration / totalSessions).toFixed(2)),
    };
  }

  const [cur, prev] = await Promise.all([
    computeMetrics(curStart, now),
    computeMetrics(prevStart, prevEnd),
  ]);

  return {
    traffic: {
      current:   cur.traffic,
      previous:  prev.traffic,
      pctChange: pctChange(cur.traffic, prev.traffic),
    },
    bounceRate: {
      current:   cur.bounceRate,
      previous:  prev.bounceRate,
      pctChange: pctChange(cur.bounceRate, prev.bounceRate),
    },
    conversionRate: {
      current:   cur.conversionRate,
      previous:  prev.conversionRate,
      pctChange: pctChange(cur.conversionRate, prev.conversionRate),
    },
    avgSessionDuration: {
      current:   cur.avgSessionDuration,
      previous:  prev.avgSessionDuration,
      pctChange: pctChange(cur.avgSessionDuration, prev.avgSessionDuration),
    },
  };
}

// ─── 4. getAcquisitionData ───────────────────────────────────────────────────

async function getAcquisitionData() {
  const now   = new Date();
  const start = startOf(addDays(now, -30), 'day');

  const raw = await WebAnalytics.aggregate([
    { $match: { createdAt: { $gte: start } } },
    {
      $group: {
        _id: {
          dayOfWeek: { $dayOfWeek: '$createdAt' }, // 1=Sun, 7=Sat
          sessionId: '$sessionId',
        },
        bounced:  { $min: { $cond: ['$bounced', 1, 0] } },
        pgViews:  { $sum: 1 },
      },
    },
    {
      $group: {
        _id:           '$_id.dayOfWeek',
        totalSessions: { $sum: 1 },
        bouncedCount:  { $sum: '$bounced' },
        totalPageViews:{ $sum: '$pgViews' },
      },
    },
  ]);

  // Build Mon-Sun order (dayOfWeek: 1=Sun,2=Mon,...,7=Sat)
  // We want Mon(2)..Sun(1) → [2,3,4,5,6,7,1]
  const order = [
    { label: 'Mon', dow: 2 },
    { label: 'Tue', dow: 3 },
    { label: 'Wed', dow: 4 },
    { label: 'Thu', dow: 5 },
    { label: 'Fri', dow: 6 },
    { label: 'Sat', dow: 7 },
    { label: 'Sun', dow: 1 },
  ];

  const map = {};
  for (const r of raw) {
    map[r._id] = r;
  }

  return order.map(({ label, dow }) => {
    const d = map[dow];
    if (!d) return { day: label, bounceRate: 0, pageSession: 0 };
    const bounceRate   = d.totalSessions > 0
      ? parseFloat(((d.bouncedCount / d.totalSessions) * 100).toFixed(2))
      : 0;
    return { day: label, bounceRate, pageSession: d.totalPageViews };
  });
}

// ─── 5. getDeviceSessions ────────────────────────────────────────────────────

async function getDeviceSessions() {
  const now      = new Date();
  const start30  = startOf(addDays(now, -30), 'day');
  const start7   = startOf(addDays(now, -7), 'day');

  // Totals for last 30 days
  const totalsRaw = await WebAnalytics.aggregate([
    { $match: { createdAt: { $gte: start30 } } },
    {
      $group: {
        _id: { sessionId: '$sessionId', device: '$device' },
      },
    },
    {
      $group: {
        _id:   '$_id.device',
        count: { $sum: 1 },
      },
    },
  ]);

  const totals = { mobile: 0, desktop: 0, tablet: 0 };
  for (const r of totalsRaw) {
    if (r._id === 'mobile')  totals.mobile  = r.count;
    if (r._id === 'desktop') totals.desktop = r.count;
    if (r._id === 'tablet')  totals.tablet  = r.count;
  }

  // By day for last 7 days
  const byDayRaw = await WebAnalytics.aggregate([
    { $match: { createdAt: { $gte: start7 } } },
    {
      $group: {
        _id: {
          date:      { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          dayOfWeek: { $dayOfWeek: '$createdAt' },
          sessionId: '$sessionId',
          device:    '$device',
        },
      },
    },
    {
      $group: {
        _id: {
          date:      '$_id.date',
          dayOfWeek: '$_id.dayOfWeek',
          device:    '$_id.device',
        },
        count: { $sum: 1 },
      },
    },
    { $sort: { '_id.date': 1 } },
  ]);

  // Collect unique dates in last 7 days
  const dateSet = new Set();
  for (const r of byDayRaw) dateSet.add(r._id.date);

  // Build map: date → { mobile, desktop, others }
  const dateMap = {};
  for (const r of byDayRaw) {
    const date = r._id.date;
    if (!dateMap[date]) {
      dateMap[date] = { date, dow: r._id.dayOfWeek, mobile: 0, desktop: 0, others: 0 };
    }
    if (r._id.device === 'mobile')       dateMap[date].mobile  += r.count;
    else if (r._id.device === 'desktop') dateMap[date].desktop += r.count;
    else                                 dateMap[date].others  += r.count;
  }

  const byDay = Object.values(dateMap)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(d => ({
      day:     DAY_NAMES[d.dow - 1] || d.date,
      mobile:  d.mobile,
      desktop: d.desktop,
      others:  d.others,
    }));

  return { totals, byDay };
}

// ─── 6. getTrafficSources ────────────────────────────────────────────────────

async function getTrafficSources() {
  const now   = new Date();
  const start = startOf(addDays(now, -30), 'day');

  const raw = await WebAnalytics.aggregate([
    { $match: { createdAt: { $gte: start } } },
    {
      $group: {
        _id: { sessionId: '$sessionId', source: '$source' },
      },
    },
    {
      $group: {
        _id:   '$_id.source',
        count: { $sum: 1 },
      },
    },
  ]);

  const groups = { 'Social Media': 0, 'Google': 0, 'Email': 0, 'Referral': 0 };
  const social = new Set(['facebook', 'instagram', 'youtube', 'twitter']);

  for (const r of raw) {
    const src = r._id || 'other';
    if (social.has(src))     groups['Social Media'] += r.count;
    else if (src === 'google') groups['Google']      += r.count;
    else if (src === 'email')  groups['Email']       += r.count;
    else                       groups['Referral']    += r.count;
  }

  return Object.entries(groups).map(([name, value]) => ({ name, value }));
}

// ─── 7. getAudienceMetrics ───────────────────────────────────────────────────

// Fix 4: add period parameter with week/month/year grouping
async function getAudienceMetrics(period = 'year') {
  const now = new Date();

  if (period === 'week') {
    // Last 7 days, group by day
    const start = startOf(addDays(now, -6), 'day');

    const raw = await WebAnalytics.aggregate([
      { $match: { createdAt: { $gte: start } } },
      {
        $group: {
          _id: {
            year:      { $year: '$createdAt' },
            month:     { $month: '$createdAt' },
            day:       { $dayOfMonth: '$createdAt' },
            dayOfWeek: { $dayOfWeek: '$createdAt' },
            sessionId: '$sessionId',
          },
          userId:    { $first: '$userId' },
          isNewUser: { $max: { $cond: ['$isNewUser', 1, 0] } },
        },
      },
      {
        $group: {
          _id: {
            year:      '$_id.year',
            month:     '$_id.month',
            day:       '$_id.day',
            dayOfWeek: '$_id.dayOfWeek',
          },
          totalSessions:   { $sum: 1 },
          newUserSessions: { $sum: '$isNewUser' },
          uniqueUsers: {
            $addToSet: {
              $cond: [{ $ne: ['$userId', null] }, '$userId', '$_id.sessionId'],
            },
          },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
    ]);

    // Build last 7 days scaffold
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = startOf(addDays(now, -i), 'day');
      days.push({
        year:      d.getFullYear(),
        month:     d.getMonth() + 1,
        day:       d.getDate(),
        label:     DAY_NAMES[d.getDay()],
      });
    }

    const map = {};
    for (const r of raw) {
      map[`${r._id.year}-${r._id.month}-${r._id.day}`] = r;
    }

    return days.map(({ year, month, day, label }) => {
      const key = `${year}-${month}-${day}`;
      const r   = map[key];
      if (!r) return { month: label, newUser: 0, user: 0, sessions: 0 };
      const uniqueCount = (r.uniqueUsers || []).length;
      return {
        month:    label,
        newUser:  r.newUserSessions,
        user:     Math.max(0, uniqueCount - r.newUserSessions),
        sessions: r.totalSessions,
      };
    });
  }

  if (period === 'month') {
    // Last 30 days, group by ISO week
    const start = startOf(addDays(now, -29), 'day');

    const raw = await WebAnalytics.aggregate([
      { $match: { createdAt: { $gte: start } } },
      {
        $group: {
          _id: {
            week:      { $week: '$createdAt' },
            year:      { $year: '$createdAt' },
            sessionId: '$sessionId',
          },
          userId:    { $first: '$userId' },
          isNewUser: { $max: { $cond: ['$isNewUser', 1, 0] } },
        },
      },
      {
        $group: {
          _id: {
            week: '$_id.week',
            year: '$_id.year',
          },
          totalSessions:   { $sum: 1 },
          newUserSessions: { $sum: '$isNewUser' },
          uniqueUsers: {
            $addToSet: {
              $cond: [{ $ne: ['$userId', null] }, '$userId', '$_id.sessionId'],
            },
          },
        },
      },
      { $sort: { '_id.year': 1, '_id.week': 1 } },
    ]);

    // Collect unique week keys in order and assign Wk labels
    const seen = new Map();
    for (const r of raw) {
      const key = `${r._id.year}-${r._id.week}`;
      if (!seen.has(key)) seen.set(key, r);
    }

    let wkNum = 1;
    return Array.from(seen.values()).map(r => {
      const uniqueCount = (r.uniqueUsers || []).length;
      return {
        month:    `Wk ${wkNum++}`,
        newUser:  r.newUserSessions,
        user:     Math.max(0, uniqueCount - r.newUserSessions),
        sessions: r.totalSessions,
      };
    });
  }

  // Default: year — keep original 12-month behavior
  const start = startOf(addMonths(now, -12), 'month');

  const raw = await WebAnalytics.aggregate([
    { $match: { createdAt: { $gte: start } } },
    {
      $group: {
        _id: {
          year:  { $year: '$createdAt' },
          month: { $month: '$createdAt' },
          sessionId: '$sessionId',
        },
        userId:    { $first: '$userId' },
        isNewUser: { $max: { $cond: ['$isNewUser', 1, 0] } },
      },
    },
    {
      $group: {
        _id: {
          year:  '$_id.year',
          month: '$_id.month',
        },
        totalSessions:   { $sum: 1 },
        newUserSessions: { $sum: '$isNewUser' },
        uniqueUsers: {
          $addToSet: {
            $cond: [{ $ne: ['$userId', null] }, '$userId', '$_id.sessionId'],
          },
        },
      },
    },
    { $sort: { '_id.year': 1, '_id.month': 1 } },
  ]);

  // Build last 12 months scaffold
  const months = [];
  for (let i = 11; i >= 0; i--) {
    const d = addMonths(now, -i);
    months.push({ year: d.getFullYear(), month: d.getMonth() + 1 });
  }

  const map = {};
  for (const r of raw) {
    map[`${r._id.year}-${r._id.month}`] = r;
  }

  return months.map(({ year, month }) => {
    const key = `${year}-${month}`;
    const r   = map[key];
    if (!r) return { month: MONTH_NAMES[month - 1], newUser: 0, user: 0, sessions: 0 };
    const uniqueCount = (r.uniqueUsers || []).length;
    return {
      month:    MONTH_NAMES[month - 1],
      newUser:  r.newUserSessions,
      user:     Math.max(0, uniqueCount - r.newUserSessions),
      sessions: r.totalSessions,
    };
  });
}

// ─── 8. getConversionsByLocation ─────────────────────────────────────────────

// Fix 5: add period parameter
async function getConversionsByLocation(period = 'year') {
  const now = new Date();

  const periodDays = { week: 7, month: 30, year: 365 };
  const days = periodDays[period] || 365;
  const start = startOf(addDays(now, -days), 'day');

  const raw = await Order.aggregate([
    { $match: { createdAt: { $gte: start } } },
    {
      $group: {
        _id:   { $ifNull: ['$shippingAddress.state', 'Other'] },
        count: { $sum: 1 },
      },
    },
    {
      $project: {
        _id:     0,
        country: { $cond: [{ $eq: ['$_id', ''] }, 'Other', '$_id'] },
        amount:  '$count',
      },
    },
    { $sort: { amount: -1 } },
    { $limit: 6 },
  ]);

  return raw;
}

// ─── 9. getGoalAccomplished ───────────────────────────────────────────────────

async function getGoalAccomplished() {
  const now        = new Date();
  const monthStart = startOf(now, 'month');
  const MONTHLY_TARGET = 100;

  // New customers this month
  const newCustomers = await User.countDocuments({ createdAt: { $gte: monthStart } });
  const newCustPct   = Math.min(100, parseFloat(((newCustomers / MONTHLY_TARGET) * 100).toFixed(2)));

  // Conversion rate (last 30 days)
  const start30 = startOf(addDays(now, -30), 'day');
  const sessions = await WebAnalytics.aggregate([
    { $match: { createdAt: { $gte: start30 } } },
    {
      $group: {
        _id:          '$sessionId',
        anyConverted: { $max: { $cond: ['$converted', 1, 0] } },
        pageViews:    { $sum: 1 },
      },
    },
  ]);

  const totalSessions     = sessions.length;
  const convertedSessions = sessions.filter(s => s.anyConverted === 1).length;
  const convRate          = totalSessions > 0
    ? parseFloat(((convertedSessions / totalSessions) * 100).toFixed(2))
    : 0;
  const convPct = Math.min(100, convRate);

  // Avg pages per session
  const totalPageViews = sessions.reduce((sum, s) => sum + s.pageViews, 0);
  const avgPagesPerSession = totalSessions > 0
    ? parseFloat((totalPageViews / totalSessions).toFixed(2))
    : 0;
  // Cap at 100 (treat 10 pages/session as 100%)
  const pageSessionTarget = 10;
  const pageSessionPct    = Math.min(100, parseFloat(((avgPagesPerSession / pageSessionTarget) * 100).toFixed(2)));

  return {
    newCustomers:   { value: newCustomers, percentage: newCustPct },
    conversionRate: { value: `${convRate}%`, percentage: convPct },
    pageSession:    { value: `${avgPagesPerSession}`, percentage: pageSessionPct },
  };
}

// ─── 10. getPageMetrics ──────────────────────────────────────────────────────

// Fix 3: add avgDuration to group, fix createdAt format
async function getPageMetrics() {
  const now   = new Date();
  const start = startOf(addDays(now, -30), 'day');

  // Get total page views for share calculation
  const totalViews = await WebAnalytics.countDocuments({ createdAt: { $gte: start } });

  // Build last 15 days labels
  const last15 = [];
  for (let i = 14; i >= 0; i--) {
    const d = startOf(addDays(now, -i), 'day');
    last15.push({ label: String(15 - i), date: d });
  }

  const raw = await WebAnalytics.aggregate([
    { $match: { createdAt: { $gte: start } } },
    {
      $group: {
        _id: '$page',
        totalViews:     { $sum: 1 },
        uniqueSessions: { $addToSet: '$sessionId' },
        firstSeen:      { $min: '$createdAt' },
        lastSeen:       { $max: '$createdAt' },
        avgDuration:    { $avg: '$duration' },
      },
    },
    {
      $project: {
        page:           '$_id',
        totalViews:     1,
        uniquePreviews: { $size: '$uniqueSessions' },
        firstSeen:      1,
        lastSeen:       1,
        avgDuration:    1,
      },
    },
    { $sort: { uniquePreviews: -1 } },
    { $limit: 15 },
  ]);

  // For each page in the top-15, get daily counts for last 15 days
  const pageNames = raw.map(r => r._id);

  const dailyRaw = await WebAnalytics.aggregate([
    {
      $match: {
        createdAt: { $gte: last15[0].date },
        page: { $in: pageNames },
      },
    },
    {
      $group: {
        _id: {
          page: '$page',
          date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        },
        count: { $sum: 1 },
      },
    },
  ]);

  // Map daily counts: { page → { dateStr → count } }
  const dailyMap = {};
  for (const r of dailyRaw) {
    if (!dailyMap[r._id.page]) dailyMap[r._id.page] = {};
    dailyMap[r._id.page][r._id.date] = r.count;
  }

  return raw.map((r, idx) => {
    const pageMap = dailyMap[r._id] || {};
    const chart   = last15.map(({ label, date }) => {
      const dateStr = date.toISOString().slice(0, 10);
      return { label, count: pageMap[dateStr] || 0 };
    });

    // Encode avgDuration as HH:MM:SS on the lastSeen date
    const avgSec = Math.round(r.avgDuration || 0);
    const d = new Date(r.lastSeen || Date.now());
    d.setUTCHours(0, Math.floor(avgSec / 60), avgSec % 60, 0);

    return {
      id:             r._id || String(idx),
      pages:          r._id,
      trafficShare:   totalViews > 0
        ? parseFloat(((r.totalViews / totalViews) * 100).toFixed(2))
        : 0,
      uniquePreviews: r.uniquePreviews,
      chart,
      createdAt:      d.toISOString(),
      updatedAt:      r.lastSeen ? r.lastSeen.toISOString() : null,
    };
  });
}

// ─── 11. getAccountRetention ─────────────────────────────────────────────────

// Fix 1: eliminate N+1 queries, return { data, summary }
async function getAccountRetention() {
  const now    = new Date();
  const start7 = startOf(addDays(now, -6), 'day');

  const days = [];
  for (let i = 6; i >= 0; i--) {
    const dayStart = startOf(addDays(now, -i), 'day');
    const dayEnd   = new Date(dayStart);
    dayEnd.setHours(23, 59, 59, 999);
    days.push({ dayStart, dayEnd, label: DAY_NAMES[dayStart.getDay()] });
  }

  // Step a: Get all orders from last 7 days grouped by user+date
  const ordersInWindow = await Order.aggregate([
    { $match: { createdAt: { $gte: start7 }, user: { $ne: null } } },
    {
      $group: {
        _id: {
          user:    '$user',
          dateStr: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        },
        minCreatedAt: { $min: '$createdAt' },
      },
    },
  ]);

  // Collect unique userIds from the window
  const userIdSet = new Set();
  for (const o of ordersInWindow) {
    userIdSet.add(String(o._id.user));
  }
  const userIds = Array.from(userIdSet).map(id => {
    // Re-use original ObjectId from the aggregation result
    return ordersInWindow.find(o => String(o._id.user) === id)._id.user;
  });

  // Step b: Get first-order date for all those users in one query
  const firstOrderRaw = userIds.length > 0
    ? await Order.aggregate([
        { $match: { user: { $in: userIds } } },
        { $group: { _id: '$user', firstOrder: { $min: '$createdAt' } } },
      ])
    : [];

  const firstOrderMap = {};
  for (const r of firstOrderRaw) {
    firstOrderMap[String(r._id)] = r.firstOrder;
  }

  // Build map: dateStr → Set of userIds who ordered that day
  const dateUserMap = {};
  for (const o of ordersInWindow) {
    const ds = o._id.dateStr;
    if (!dateUserMap[ds]) dateUserMap[ds] = new Set();
    dateUserMap[ds].add(String(o._id.user));
  }

  // Step c: Get last-order date for all users (for cancellations)
  const lastOrderRaw = await Order.aggregate([
    { $match: { user: { $ne: null } } },
    { $group: { _id: '$user', lastOrder: { $max: '$createdAt' } } },
  ]);

  const data = days.map(({ dayStart, dayEnd, label }) => {
    const dateStr = dayStart.toISOString().slice(0, 10);
    const usersToday = dateUserMap[dateStr] || new Set();

    // Expansions: users who ordered today AND whose first order was before today's start
    let expansions = 0;
    for (const uid of usersToday) {
      const firstOrder = firstOrderMap[uid];
      if (firstOrder && firstOrder < dayStart) {
        expansions++;
      }
    }

    // Cancellations: users whose last order is < (dayStart - 60 days)
    const cutoff = addDays(dayStart, -60);
    let cancellations = 0;
    for (const r of lastOrderRaw) {
      if (r.lastOrder < cutoff) cancellations++;
    }

    return { day: label, expansions, cancellations };
  });

  const totalExpansions     = data.reduce((sum, d) => sum + d.expansions, 0);
  const todayCancellations  = data.length > 0 ? data[data.length - 1].cancellations : 0;

  return {
    data,
    summary: {
      expansions:    totalExpansions,
      cancellations: todayCancellations,
    },
  };
}

// ─── 12. getWebsiteChannels ──────────────────────────────────────────────────

// Fix 2: fix engagementTime format
async function getWebsiteChannels() {
  const now   = new Date();
  const start = startOf(addDays(now, -30), 'day');

  // Build last 20 days labels
  const last20 = [];
  for (let i = 19; i >= 0; i--) {
    const d = startOf(addDays(now, -i), 'day');
    last20.push({ label: String(20 - i), date: d });
  }

  const raw = await WebAnalytics.aggregate([
    { $match: { createdAt: { $gte: start } } },
    {
      $group: {
        _id: {
          source:    '$source',
          sessionId: '$sessionId',
        },
        bounced:         { $min: { $cond: ['$bounced', 1, 0] } },
        sessionDuration: { $sum: '$duration' },
        userId:          { $first: '$userId' },
        firstSeen:       { $min: '$createdAt' },
        lastSeen:        { $max: '$createdAt' },
      },
    },
    {
      $group: {
        _id:             '$_id.source',
        sessions:        { $sum: 1 },
        bouncedCount:    { $sum: '$bounced' },
        totalDuration:   { $sum: '$sessionDuration' },
        uniqueUsers:     { $addToSet: { $cond: [{ $ne: ['$userId', null] }, '$userId', '$_id.sessionId'] } },
        firstSeen:       { $min: '$firstSeen' },
        lastSeen:        { $max: '$lastSeen' },
      },
    },
  ]);

  // Get daily breakdown per source for last 20 days
  const sources = raw.map(r => r._id);

  const dailyRaw = await WebAnalytics.aggregate([
    {
      $match: {
        createdAt: { $gte: last20[0].date },
        source: { $in: sources },
      },
    },
    {
      $group: {
        _id: {
          source: '$source',
          date:   { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        },
        count: { $sum: 1 },
      },
    },
  ]);

  const dailyMap = {};
  for (const r of dailyRaw) {
    if (!dailyMap[r._id.source]) dailyMap[r._id.source] = {};
    dailyMap[r._id.source][r._id.date] = r.count;
  }

  return raw.map((r, idx) => {
    const totalSessions   = r.sessions;
    const bounceRate      = totalSessions > 0
      ? parseFloat(((r.bouncedCount / totalSessions) * 100).toFixed(2))
      : 0;
    const engagementRate  = parseFloat((100 - bounceRate).toFixed(2));
    const avgDuration     = totalSessions > 0
      ? Math.round(r.totalDuration / totalSessions)
      : 0;

    // Encode avgDuration as HH:MM:SS on the lastSeen date
    const d = new Date(r.lastSeen || Date.now());
    d.setUTCHours(0, Math.floor(avgDuration / 60), avgDuration % 60, 0);
    const engagementTime = d.toISOString();

    const srcMap = dailyMap[r._id] || {};
    const chart  = last20.map(({ label, date }) => {
      const dateStr = date.toISOString().slice(0, 10);
      return { label, count: srcMap[dateStr] || 0 };
    });

    const usersCount = (r.uniqueUsers || []).length;

    return {
      id:             r._id || String(idx),
      channel:        r._id || 'other',
      users:          usersCount,
      sessions:       totalSessions,
      engagementRate,
      engagementTime,
      bounceRate,
      chart,
      createdAt:      r.firstSeen ? r.firstSeen.toISOString() : null,
      updatedAt:      r.lastSeen  ? r.lastSeen.toISOString()  : null,
    };
  });
}

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  recordPageView,
  updatePageDuration,
  getOverview,
  getAcquisitionData,
  getDeviceSessions,
  getTrafficSources,
  getAudienceMetrics,
  getConversionsByLocation,
  getGoalAccomplished,
  getPageMetrics,
  getAccountRetention,
  getWebsiteChannels,
};
