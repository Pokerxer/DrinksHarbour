'use strict';

const mongoose = require('mongoose');
const User = require('../models/User');
const Address = require('../models/Address');
const Order = require('../models/Order');
const { resolvePackageState, listDeliveryLgas } = require('../data/nigeriaDeliveryAreas');
const { normalizePhone } = require('./contact.helpers');
const { escapeRegex } = require('../utils/escapeRegex');
const { ValidationError, ConflictError, NotFoundError } = require('../utils/errors');

const scope = { role: 'customer', tenant: null, status: { $nin: ['suspended', 'deleted', 'inactive'] } };
const projection = 'firstName lastName email phone loyaltyPoints loyaltyTier';

function phonePattern(value, partial = false) {
  const digits = normalizePhone(value);
  if (!/^\d{2,15}$/.test(digits)) return null;
  const national = digits.replace(/^(234|0)(?=[789])/, '');
  const prefix = national === digits && !/^[789]/.test(digits)
    ? '\\+?' : '(?:(?:\\+?2[\\s().-]*3[\\s().-]*4|0)[\\s().-]*)?';
  const pattern = national.split('').join('[\\s().-]*');
  return new RegExp(partial ? pattern : `^${prefix}${pattern}$`);
}

function profile(user) {
  return {
    _id: String(user._id), firstName: user.firstName, lastName: user.lastName || '',
    email: user.email, phone: user.phone || '', loyaltyPoints: user.loyaltyPoints || 0,
    loyaltyTier: user.loyaltyTier || 'cork',
  };
}

async function listCustomers(search) {
  const term = typeof search === 'string' ? search.trim().slice(0, 100) : '';
  const filter = { ...scope };
  if (term.length >= 2) {
    const nameParts = term.split(/\s+/).filter(Boolean);
    const exact = new RegExp(escapeRegex(term), 'i');
    const phone = phonePattern(term, true);
    filter.$or = [
      { email: exact }, { displayName: exact },
      { $and: nameParts.map(part => {
        const pattern = new RegExp(escapeRegex(part), 'i');
        return { $or: [{ firstName: pattern }, { lastName: pattern }] };
      }) },
      ...(phone ? [{ phone }] : []),
    ];
  }
  const customers = await User.find(filter).sort({ updatedAt: -1 }).limit(8).select(projection).lean();
  return customers.map(profile);
}

async function saveCustomer(input = {}) {
  const clean = name => typeof input?.[name] === 'string' ? input[name].trim() : '';
  const firstName = clean('firstName');
  const lastName = clean('lastName');
  const email = clean('email').toLowerCase();
  const phone = normalizePhone(clean('phone'));
  if (!firstName || !lastName || firstName.length > 50 || lastName.length > 50 ||
      email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^\d{7,15}$/.test(phone)) {
    throw new ValidationError('Enter the customer’s first name, last name, email and phone number');
  }
  const existing = await User.findOne({ ...scope, $or: [{ email }, { phone: phonePattern(phone) }] }).select(projection).lean();
  if (existing) {
    if (existing.email === email) return profile(existing);
    throw new ConflictError('This phone number is already saved. Search for the existing customer.');
  }
  try {
    const customer = await User.create({
      firstName, lastName, email, phone: clean('phone'), role: 'customer',
      tenant: null, status: 'active', isEmailVerified: false, isAgeVerified: false,
    });
    return profile(customer);
  } catch (error) {
    if (error?.code === 11000) {
      const customer = await User.findOne({ ...scope, email }).select(projection).lean();
      if (customer) return profile(customer);
      throw new ConflictError('This email is already in use');
    }
    throw error;
  }
}

async function resolveOrderCustomer(customer, selectedId) {
  const email = typeof customer?.email === 'string' ? customer.email.trim().toLowerCase() : '';
  if (selectedId !== undefined) {
    if (typeof selectedId !== 'string' || !mongoose.isObjectIdOrHexString(selectedId)) {
      throw new ValidationError('Select a valid customer');
    }
    const user = await User.findOne({ ...scope, _id: selectedId });
    if (!user || user.email !== email) throw new ValidationError('Select the customer again to confirm their email');
    return user;
  }

  // Older clients and restored drafts may still send contact details only.
  const byEmail = email ? await User.findOne({ ...scope, email }) : null;
  if (byEmail) return byEmail;
  const phone = phonePattern(customer?.phone);
  if (!phone) return null;
  const matches = await User.find({ ...scope, phone }).limit(2);
  return matches.length === 1 ? matches[0] : null;
}

function deliveryAddress(row, id, label) {
  const address = [row.addressLine1, row.addressLine2].filter(Boolean).join(', ').trim();
  const state = resolvePackageState(row.state);
  if (!address || !state) return null;
  const area = (row.lga || row.city || '').trim().toLowerCase();
  const lga = listDeliveryLgas(state).find(value => value.toLowerCase() === area) || '';
  const lat = row.coordinates?.latitude ?? row.coordinates?.lat;
  const lon = row.coordinates?.longitude ?? row.coordinates?.lng;
  const validPin = Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
  return {
    id: String(id), label, address, lga,
    state: state === 'Federal Capital Territory' ? 'FCT - Abuja' : state,
    zipCode: row.postalCode || '', country: 'Nigeria',
    ...(validPin ? { pin: { lat, lon } } : {}),
  };
}

async function getCustomerContext(customerId) {
  if (!mongoose.isObjectIdOrHexString(customerId)) throw new ValidationError('Select a valid customer');
  const customer = await User.findOne({ ...scope, _id: customerId }).select(projection).lean();
  if (!customer) throw new NotFoundError('Customer not found');
  const [saved, previous] = await Promise.all([
    Address.find({ user: customerId, country: 'Nigeria', status: 'active' })
      .sort({ isDefaultShipping: -1, updatedAt: -1 }).limit(5)
      .select('label addressLine1 addressLine2 city state postalCode coordinates').lean(),
    Order.findOne({
      user: customerId, tenant: null, status: 'delivered',
      $or: [{ source: { $in: ['web', 'app', null] } }, { source: 'manual', originChannel: 'whatsapp' }],
      'gift.isGift': { $ne: true }, 'shippingAddress.country': 'Nigeria',
    }).sort({ placedAt: -1 }).select('shippingAddress').lean(),
  ]);
  const addresses = saved.map(row => deliveryAddress(row, row._id, row.label || 'Saved address')).filter(Boolean);
  if (previous?.shippingAddress) {
    const last = deliveryAddress(previous.shippingAddress, previous._id, 'Last delivered order');
    if (last && !addresses.some(row => row.address.toLowerCase() === last.address.toLowerCase() &&
        row.state === last.state && row.lga === last.lga)) addresses.push(last);
  }
  return { customer: profile(customer), addresses };
}

module.exports = { listCustomers, saveCustomer, resolveOrderCustomer, getCustomerContext };
