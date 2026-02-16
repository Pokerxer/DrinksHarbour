// middleware/upload.middleware.js

const multer = require('multer');
const { ValidationError } = require('../utils/errors');

// Configure storage (memory storage for processing)
const storage = multer.memoryStorage();

// File filter
const fileFilter = (req, file, cb) => {
  // Allowed file types
  const allowedMimes = [
    'text/csv',
    'application/json',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new ValidationError(
        'Invalid file type. Only CSV, JSON, XLS, and XLSX files are allowed.'
      ),
      false
    );
  }
};

// Create multer instance
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
  },
});

module.exports = { upload };