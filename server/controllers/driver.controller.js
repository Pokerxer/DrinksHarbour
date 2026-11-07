// controllers/driver.controller.js

const Driver = require('../models/Driver');
const Delivery = require('../models/Delivery');
const asyncHandler = require('../utils/asyncHandler');
const { getTenantId } = require('../utils/tenantContext');
const { NotFoundError, ValidationError, ConflictError } = require('../utils/errors');

const EDITABLE_FIELDS = [
  'name',
  'phone',
  'email',
  'vehicle',
  'licenseNumber',
  'licenseExpiry',
  'licenseDocUrl',
  'status',
  'notes',
  'user',
];

/**
 * @desc    List drivers for the caller's tenant
 * @route   GET /api/drivers
 */
exports.listDrivers = asyncHandler(async (req, res) => {
  const tenantId = getTenantId(req);
  const { status, active, search } = req.query;

  const filter = { tenant: tenantId };
  if (status) filter.status = status;
  if (active !== undefined) filter.isActive = active === 'true';
  if (search) {
    const rx = new RegExp(String(search).trim(), 'i');
    filter.$or = [{ name: rx }, { phone: rx }, { 'vehicle.plateNumber': rx }];
  }

  const drivers = await Driver.find(filter).sort({ name: 1 }).lean({ virtuals: true });

  res.status(200).json({ success: true, data: { drivers } });
});

/**
 * @desc    Single driver, with their currently active trip if any
 * @route   GET /api/drivers/:id
 */
exports.getDriver = asyncHandler(async (req, res) => {
  const tenantId = getTenantId(req);

  const driver = await Driver.findOne({ _id: req.params.id, tenant: tenantId }).lean({
    virtuals: true,
  });
  if (!driver) throw new NotFoundError('Driver not found.');

  const activeTrip = await Delivery.findOne({
    tenant: tenantId,
    driver: driver._id,
    status: { $in: ['assigned', 'dispatched', 'in_progress'] },
  })
    .select('deliveryNumber status totals scheduledFor dispatchedAt')
    .lean();

  res.status(200).json({ success: true, data: { driver, activeTrip } });
});

/**
 * @desc    Create a driver
 * @route   POST /api/drivers
 */
exports.createDriver = asyncHandler(async (req, res) => {
  const tenantId = getTenantId(req);

  const payload = pick(req.body, EDITABLE_FIELDS);
  if (!payload.name || !payload.phone) {
    throw new ValidationError('Name and phone are required.');
  }

  let driver;
  try {
    driver = await Driver.create({
      ...payload,
      tenant: tenantId,
      createdBy: req.user?._id,
    });
  } catch (err) {
    // The compound {tenant, phone} unique index — surfaced as a readable
    // message rather than a raw E11000.
    if (err?.code === 11000) {
      throw new ConflictError('A driver with that phone number already exists.');
    }
    throw err;
  }

  res.status(201).json({ success: true, message: 'Driver created', data: { driver } });
});

/**
 * @desc    Update a driver
 * @route   PATCH /api/drivers/:id
 */
exports.updateDriver = asyncHandler(async (req, res) => {
  const tenantId = getTenantId(req);

  const driver = await Driver.findOne({ _id: req.params.id, tenant: tenantId });
  if (!driver) throw new NotFoundError('Driver not found.');

  const payload = pick(req.body, EDITABLE_FIELDS);

  const changesStatus = payload.status && payload.status !== driver.status;
  if (changesStatus && (driver.status === 'on_trip' || driver.legacyTrip || driver.managedTrip)) {
    throw new ValidationError('This driver is on an active trip. Complete or reconcile the trip to change their status.');
  }
  // An unchanged submitted status is not a status write; contact edits remain
  // allowed while durable trip claims protect physical availability.
  if (payload.status === driver.status) delete payload.status;
  let saved;
  try {
    saved = await Driver.findOneAndUpdate(
      { _id:driver._id, tenant:tenantId, ...(changesStatus ? {status:driver.status,legacyTrip:null,managedTrip:null}: {}) },
      { $set:payload }, { returnDocument:'after', runValidators:true }
    );
  } catch (err) {
    if (err?.code === 11000) throw new ConflictError('A driver with that phone number already exists.');
    throw err;
  }
  if (!saved) throw new ValidationError('Driver changed or was claimed by a trip; reload before changing availability.');
  res.status(200).json({ success: true, message: 'Driver updated', data: { driver:saved } });
});

/**
 * @desc    Deactivate a driver (soft — trips keep referencing them)
 * @route   DELETE /api/drivers/:id
 */
exports.deactivateDriver = asyncHandler(async (req, res) => {
  const tenantId = getTenantId(req);

  const driver = await Driver.findOne({ _id: req.params.id, tenant: tenantId });
  if (!driver) throw new NotFoundError('Driver not found.');

  const saved=await Driver.findOneAndUpdate(
    {_id:driver._id,tenant:tenantId,status:{$ne:'on_trip'},legacyTrip:null,managedTrip:null},
    {$set:{isActive:false,status:'off_duty'}},{returnDocument:'after',runValidators:true}
  );
  if(!saved)throw new ValidationError('This driver is on an active trip and cannot be deactivated yet.');

  res.status(200).json({ success: true, message: 'Driver deactivated', data: { driver:saved } });
});

function pick(source, keys) {
  const out = {};
  if (!source || typeof source !== 'object') return out;
  for (const key of keys) {
    if (source[key] !== undefined) out[key] = source[key];
  }
  return out;
}
