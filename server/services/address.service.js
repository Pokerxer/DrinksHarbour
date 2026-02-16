// services/address.service.js
const Address = require('../models/Address');
const User = require('../models/User');
const { NotFoundError } = require('../utils/errors');

/**
 * Get all addresses for a user
 */
exports.getAddressesByUser = async (userId) => {
  const addresses = await Address.find({ 
    user: userId, 
    status: 'active' 
  }).sort({ isDefaultShipping: -1, isDefaultBilling: -1, createdAt: -1 });
  
  return addresses;
};

/**
 * Create a new address
 */
exports.createAddress = async (data) => {
  const { user, isDefaultShipping, isDefaultBilling, ...addressData } = data;
  
  // If setting as default, clear other defaults for that type
  if (isDefaultShipping) {
    await Address.updateMany(
      { user, status: 'active' },
      { isDefaultShipping: false }
    );
  }
  
  if (isDefaultBilling) {
    await Address.updateMany(
      { user, status: 'active' },
      { isDefaultBilling: false }
    );
  }
  
  const address = new Address({
    user,
    ...addressData,
    isDefaultShipping: isDefaultShipping || false,
    isDefaultBilling: isDefaultBilling || false,
  });
  
  await address.save();
  return address;
};

/**
 * Update an address
 */
exports.updateAddress = async (addressId, userId, data) => {
  const address = await Address.findOne({ _id: addressId, user: userId, status: 'active' });
  
  if (!address) {
    throw new NotFoundError('Address not found');
  }
  
  const { isDefaultShipping, isDefaultBilling, ...updateData } = data;
  
  // Handle default flags
  if (isDefaultShipping !== undefined) {
    if (isDefaultShipping) {
      await Address.updateMany(
        { user: userId, status: 'active', _id: { $ne: addressId } },
        { isDefaultShipping: false }
      );
    }
    updateData.isDefaultShipping = isDefaultShipping;
  }
  
  if (isDefaultBilling !== undefined) {
    if (isDefaultBilling) {
      await Address.updateMany(
        { user: userId, status: 'active', _id: { $ne: addressId } },
        { isDefaultBilling: false }
      );
    }
    updateData.isDefaultBilling = isDefaultBilling;
  }
  
  Object.assign(address, updateData);
  await address.save();
  
  return address;
};

/**
 * Delete an address (soft delete)
 */
exports.deleteAddress = async (addressId, userId) => {
  const address = await Address.findOneAndUpdate(
    { _id: addressId, user: userId, status: 'active' },
    { status: 'archived' },
    { new: true }
  );
  
  if (!address) {
    throw new NotFoundError('Address not found');
  }
  
  return address;
};

/**
 * Set default address for shipping or billing
 */
exports.setDefaultAddress = async (addressId, userId, type) => {
  const field = type === 'shipping' ? 'isDefaultShipping' : 'isDefaultBilling';
  const otherField = type === 'shipping' ? 'isDefaultBilling' : 'isDefaultShipping';
  
  // Clear other defaults
  await Address.updateMany(
    { user: userId, status: 'active' },
    { [field]: false }
  );
  
  // Set new default
  const address = await Address.findOneAndUpdate(
    { _id: addressId, user: userId, status: 'active' },
    { [field]: true },
    { new: true }
  );
  
  if (!address) {
    throw new NotFoundError('Address not found');
  }
  
  return address;
};

/**
 * Get single address
 */
exports.getAddressById = async (addressId, userId) => {
  const address = await Address.findOne({ _id: addressId, user: userId, status: 'active' });
  
  if (!address) {
    throw new NotFoundError('Address not found');
  }
  
  return address;
};
