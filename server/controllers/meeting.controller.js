const asyncHandler = require('express-async-handler');
const Meeting = require('../models/Meeting');
const { NotFoundError, ValidationError, ForbiddenError } = require('../utils/errors');

const resolveTenantId = async (req) => {
  if (req.tenant?._id) return req.tenant._id;
  if (req.user?.tenant) {
    const t = req.user.tenant;
    return typeof t === 'object' && t._id ? t._id : t;
  }
  throw new ForbiddenError('Tenant context required');
};

// GET /api/meetings?vendor=&start=&end=
const getMeetings = asyncHandler(async (req, res) => {
  const { vendor, start, end } = req.query;
  const tenantId = await resolveTenantId(req);

  const query = { tenant: tenantId };
  if (vendor) query.vendor = vendor;
  if (start || end) {
    query.start = {};
    if (start) query.start.$gte = new Date(start);
    if (end) query.start.$lte = new Date(end);
  }

  const meetings = await Meeting.find(query).sort({ start: 1 }).lean();
  res.json({ success: true, data: meetings });
});

// POST /api/meetings
const createMeeting = asyncHandler(async (req, res) => {
  const tenantId = await resolveTenantId(req);
  const { title, description, start, end, vendor, allDay, location, attendees, notes } = req.body;

  if (!title?.trim()) throw new ValidationError('Title is required');
  if (!start) throw new ValidationError('Start date is required');
  if (!end) throw new ValidationError('End date is required');
  if (!vendor) throw new ValidationError('Vendor is required');

  const startDate = new Date(start);
  const endDate = new Date(end);
  if (endDate <= startDate) throw new ValidationError('End must be after start');

  const meeting = await Meeting.create({
    tenant: tenantId,
    vendor,
    title: title.trim(),
    description: description?.trim() || undefined,
    start: startDate,
    end: endDate,
    allDay: allDay || false,
    location: location?.trim() || undefined,
    attendees: Array.isArray(attendees) ? attendees : [],
    notes: notes?.trim() || undefined,
    createdBy: req.user?._id,
    status: 'scheduled',
  });

  res.status(201).json({ success: true, data: meeting });
});

// PUT /api/meetings/:id
const updateMeeting = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const tenantId = await resolveTenantId(req);

  const meeting = await Meeting.findOne({ _id: id, tenant: tenantId });
  if (!meeting) throw new NotFoundError('Meeting not found');

  const allowed = ['title', 'description', 'start', 'end', 'allDay', 'location', 'attendees', 'notes', 'status'];
  allowed.forEach((k) => {
    if (req.body[k] !== undefined) {
      if (k === 'start' || k === 'end') meeting[k] = new Date(req.body[k]);
      else meeting[k] = req.body[k];
    }
  });

  await meeting.save();
  res.json({ success: true, data: meeting });
});

// DELETE /api/meetings/:id
const deleteMeeting = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const tenantId = await resolveTenantId(req);

  const meeting = await Meeting.findOne({ _id: id, tenant: tenantId });
  if (!meeting) throw new NotFoundError('Meeting not found');

  await Meeting.findByIdAndDelete(id);
  res.json({ success: true, message: 'Meeting deleted' });
});

module.exports = { getMeetings, createMeeting, updateMeeting, deleteMeeting };
