'use strict';

const chatbotService = require('../services/chatbot.service');
const { successResponse, errorResponse } = require('../utils/response');

/**
 * Extract readable text from an uploaded document buffer.
 * Supports: PDF (pdf-parse), DOCX (mammoth), XLSX/XLS/CSV (xlsx), plain text.
 * Returns null if nothing readable could be extracted.
 */
const extractFileText = async (file) => {
  const name = (file.originalname || '').toLowerCase();
  const mime = file.mimetype || '';

  try {
    if (mime === 'application/pdf' || name.endsWith('.pdf')) {
      const pdfParse = require('pdf-parse');
      const parsed = await pdfParse(file.buffer);
      return parsed.text?.trim() || null;
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

/**
 * POST /api/chatbot/greeting
 * Public — initial greeting shown when the widget opens.
 */
exports.greeting = async (req, res) => {
  try {
    const result = await chatbotService.getGreetingResponse();
    return successResponse(res, result, 'Greeting');
  } catch (err) {
    return errorResponse(res, 'Failed to get greeting', 500, err);
  }
};

/**
 * POST /api/chatbot/query
 * Public — multipart: query (text), images[] (files), file (single doc),
 * conversationHistory (JSON string of { role, content }[]).
 */
exports.query = async (req, res) => {
  try {
    const { query, tenantId } = req.body;
    const conversationHistory = req.body.conversationHistory
      ? JSON.parse(req.body.conversationHistory)
      : [];

    const imageFiles = req.files?.images || [];
    const imageUrls = imageFiles.map(
      (f) => `data:${f.mimetype};base64,${f.buffer.toString('base64')}`
    );

    const docFile = req.files?.file?.[0];
    let fileContent;
    let fileName = docFile?.originalname;
    let fileUnreadable = false;
    if (docFile) {
      fileContent = await extractFileText(docFile);
      if (!fileContent) fileUnreadable = true;
    }

    const result = await chatbotService.handleChatbotQuery({
      query,
      imageUrls,
      tenantId,
      conversationHistory,
      fileContent,
      fileName,
      fileUnreadable,
    });

    return successResponse(res, result, 'Chatbot response');
  } catch (err) {
    return errorResponse(res, 'Chatbot request failed', 500, err);
  }
};
