const asyncHandler = require('express-async-handler');
const Task = require('../models/Task');
const { NotFoundError, ValidationError, ForbiddenError } = require('../utils/errors');

const resolveTenantId = async (req) => {
  if (req.tenant?._id) return req.tenant._id;
  if (req.user?.tenant) {
    const t = req.user.tenant;
    return typeof t === 'object' && t._id ? t._id : t;
  }
  throw new ForbiddenError('Tenant context required');
};

// GET /api/tasks?vendor=&status=&priority=
const getTasks = asyncHandler(async (req, res) => {
  const { vendor, status, priority } = req.query;
  const tenantId = await resolveTenantId(req);

  const query = { tenant: tenantId };
  if (vendor)   query.vendor   = vendor;
  if (status)   query.status   = status;
  if (priority) query.priority = priority;

  const tasks = await Task.find(query)
    .sort({ dueDate: 1, createdAt: -1 })
    .lean();

  res.json({ success: true, data: tasks });
});

// POST /api/tasks
const createTask = asyncHandler(async (req, res) => {
  const tenantId = await resolveTenantId(req);
  const { title, description, vendor, status, priority, dueDate, assignedTo, tags, notes } = req.body;

  if (!title?.trim()) throw new ValidationError('Title is required');
  if (!vendor)        throw new ValidationError('Vendor is required');

  const task = await Task.create({
    tenant:      tenantId,
    vendor,
    title:       title.trim(),
    description: description?.trim() || undefined,
    status:      status   || 'todo',
    priority:    priority || 'medium',
    dueDate:     dueDate ? new Date(dueDate) : undefined,
    assignedTo:  assignedTo?.trim() || undefined,
    tags:        Array.isArray(tags) ? tags.filter(Boolean) : [],
    notes:       notes?.trim() || undefined,
    createdBy:   req.user?._id,
  });

  res.status(201).json({ success: true, data: task });
});

// PUT /api/tasks/:id
const updateTask = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const tenantId = await resolveTenantId(req);

  const task = await Task.findOne({ _id: id, tenant: tenantId });
  if (!task) throw new NotFoundError('Task not found');

  const allowed = ['title', 'description', 'status', 'priority', 'dueDate', 'assignedTo', 'tags', 'notes'];
  allowed.forEach((k) => {
    if (req.body[k] !== undefined) {
      task[k] = (k === 'dueDate' && req.body[k]) ? new Date(req.body[k]) : req.body[k];
    }
  });

  await task.save();
  res.json({ success: true, data: task });
});

// DELETE /api/tasks/:id
const deleteTask = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const tenantId = await resolveTenantId(req);

  const task = await Task.findOne({ _id: id, tenant: tenantId });
  if (!task) throw new NotFoundError('Task not found');

  await Task.findByIdAndDelete(id);
  res.json({ success: true, message: 'Task deleted' });
});

module.exports = { getTasks, createTask, updateTask, deleteTask };
