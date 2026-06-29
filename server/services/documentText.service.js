// services/documentText.service.js
// Extracts plain text from PDF, DOCX, DOC, XLS/XLSX, and CSV buffers.
// All functions return a trimmed string — the caller passes this to the AI as text.

const path = require('path');

/**
 * @param {Buffer} buffer
 * @param {string} mimetype  - e.g. 'application/pdf'
 * @param {string} filename  - original filename (used for extension fallback)
 * @returns {Promise<string>} plain-text content
 */
async function extractText(buffer, mimetype, filename) {
  const ext = path.extname(filename || '').toLowerCase();

  if (mimetype === 'application/pdf' || ext === '.pdf') {
    return extractPdf(buffer);
  }

  if (
    mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mimetype === 'application/msword' ||
    ext === '.docx' || ext === '.doc'
  ) {
    return extractWord(buffer);
  }

  if (
    mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    mimetype === 'application/vnd.ms-excel' ||
    ext === '.xlsx' || ext === '.xls'
  ) {
    return extractExcel(buffer);
  }

  if (mimetype === 'text/csv' || ext === '.csv') {
    return extractCsv(buffer);
  }

  if (mimetype.startsWith('text/') || ext === '.txt') {
    return buffer.toString('utf8').trim();
  }

  throw new Error(`Unsupported file type: ${mimetype || ext}`);
}

async function extractPdf(buffer) {
  const pdfParse = require('pdf-parse');
  const data = await pdfParse(buffer);
  return (data.text || '').trim();
}

async function extractWord(buffer) {
  const mammoth = require('mammoth');
  const result = await mammoth.extractRawText({ buffer });
  return (result.value || '').trim();
}

function extractExcel(buffer) {
  const XLSX = require('xlsx');
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const lines = [];
  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    for (const row of rows) {
      const line = row.map(String).join('\t').trim();
      if (line) lines.push(line);
    }
  }
  return lines.join('\n').trim();
}

function extractCsv(buffer) {
  const Papa = require('papaparse');
  const text = buffer.toString('utf8');
  const result = Papa.parse(text, { skipEmptyLines: true });
  return result.data
    .map((row) => row.map(String).join('\t'))
    .join('\n')
    .trim();
}

module.exports = { extractText };
