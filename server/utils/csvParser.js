// utils/csvParser.js

const Papa = require('papaparse');

/**
 * Parse CSV buffer to JSON
 */
const parseCSV = (buffer) => {
  return new Promise((resolve, reject) => {
    const csvString = buffer.toString('utf-8');

    Papa.parse(csvString, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
      complete: (results) => {
        if (results.errors.length > 0) {
          reject(new Error(`CSV parsing errors: ${results.errors[0].message}`));
        } else {
          resolve(results.data);
        }
      },
      error: (error) => {
        reject(error);
      },
    });
  });
};

/**
 * Generate CSV from JSON array
 */
const generateCSV = (data) => {
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('Data must be a non-empty array');
  }

  const csv = Papa.unparse(data, {
    header: true,
    skipEmptyLines: true,
  });

  return csv;
};

module.exports = {
  parseCSV,
  generateCSV,
};