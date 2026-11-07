'use strict';
const extractFileText = async (file) => {
  const name = (file.originalname || '').toLowerCase();
  const mime = file.mimetype || '';

  try {
    if (mime === 'application/pdf' || name.endsWith('.pdf')) {
      // pdf-parse v2: class API loading from memory (`data`). destroy() frees
      // the PDF.js worker after the text pass.
      const { PDFParse } = require('pdf-parse');
      const parser = new PDFParse({ data: file.buffer });
      try {
        const parsed = await parser.getText();
        return parsed.text?.trim() || null;
      } finally {
        await parser.destroy();
      }
    }

    if (
      mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      name.endsWith('.docx')
    ) {
      const mammoth = require('mammoth');
      const result = await mammoth.extractRawText({ buffer: file.buffer });
      return result.value?.trim() || null;
    }

    if (
      mime.includes('spreadsheet') || mime.includes('ms-excel') ||
      name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.csv')
    ) {
      const XLSX = require('xlsx');
      const workbook = XLSX.read(file.buffer, { type: 'buffer' });
      const lines = [];
      for (const sheetName of workbook.SheetNames) {
        const csv = XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName], { blankrows: false });
        if (csv.trim()) lines.push(csv.trim());
      }
      return lines.length > 0 ? lines.join('\n') : null;
    }

    // Plain text / unknown — decode as utf-8 and sanity-check it's not binary
    const text = file.buffer.toString('utf-8');
    const controlChars = (text.match(/[\x00-\x08\x0B\x0C\x0E-\x1F\uFFFD]/g) || []).length;
    if (text.length > 0 && controlChars > text.length * 0.05) return null; // likely binary
    return text.trim() || null;
  } catch (err) {
    console.error(`extractFileText failed for ${name}:`, err.message);
    return null;
  }
};
module.exports={extractFileText};
