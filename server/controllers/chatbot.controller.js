'use strict';

const chatbotService = require('../services/chatbot.service');
const escalationService = require('../services/chatEscalation.service');
const { successResponse, errorResponse } = require('../utils/response');
const { parseGeneration } = require('../utils/occasionGeneration');
const { clampQuery, parseConversationHistory } = require('../utils/chatbotInputLimits');

/**
 * Extract readable text from an uploaded document buffer.
 * Supports: PDF (pdf-parse), DOCX (mammoth), XLSX/XLS/CSV (xlsx), plain text.
 * Returns null if nothing readable could be extracted.
 */
const { extractFileText } = require('../utils/extractOccasionDocument');

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
    if (req.body.mode === 'occasion') return errorResponse(res, 'Occasion planning is now reviewed by our team. Submit your requirements through the occasion request form.', 410);
    const { tenantId } = req.body;

    // Both fields are forwarded to a paid model on an unauthenticated route, so
    // both are bounded before anything reads them. The history in particular
    // used to be JSON.parse'd with no size check: one request could carry
    // megabytes and be billed as input tokens, and a stranger's malformed JSON
    // threw here and left as an opaque 500 rather than the 400 it is.
    const query = clampQuery(req.body.query);
    const { history: conversationHistory, error: historyError } =
      parseConversationHistory(req.body.conversationHistory);
    if (historyError) return errorResponse(res, historyError, 400);

    const generation = req.body.mode === 'occasion' ? parseGeneration(req.body.generation) : {};
    if (generation.error) return errorResponse(res, generation.error, 400);
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
      mode: req.body.mode === 'occasion' ? 'occasion' : undefined,
      occasion: ['weddings', 'corporate', 'house-parties', 'gifting', 'bulk'].includes(req.body.occasion) ? req.body.occasion : 'general',
      imageUrls,
      generation: generation.value,
      tenantId,
      conversationHistory,
      fileContent,
      fileName,
      fileUnreadable,
    });

    return successResponse(res, result, 'Chatbot response');
  } catch (err) {
    if (req.body?.mode === 'occasion' && err.code === 'OCCASION_CATALOGUE_UNAVAILABLE') return errorResponse(res, 'The catalogue is temporarily unavailable. Please try again.', 503);
    return errorResponse(res, req.body?.mode === 'occasion' && req.body?.generation ? 'Could not generate your drinks list. Please try again.' : 'Chatbot request failed', 500, err);
  }
};

/**
 * POST /api/chatbot/escalate
 * Public — "talk to a human". Files the visitor's message in the support inbox
 * as real mail with Reply-To set to them.
 *
 * The visitor's own validation errors are returned as 400s with their message,
 * because "that email address isn't valid" is something they can act on.
 * Anything else is reported generically: this endpoint is unauthenticated, and
 * whether a mailbox exists or which SMTP host refused is not a stranger's
 * business. The failure is still logged, and it is never dressed up as a send —
 * a visitor told "a human will get back to you" over a message that was never
 * delivered is the outcome this whole path exists to prevent.
 */
exports.escalate = async (req, res) => {
  try {
    const result = await escalationService.escalate(req.body || {});
    return successResponse(res, result, 'A support agent has been notified');
  } catch (err) {
    if (err?.statusCode === 400) {
      return errorResponse(res, err.message, 400, err);
    }
    console.error('[chatbot] escalation failed:', err?.message || err);
    return errorResponse(res, 'Could not reach the support team right now', 502, err);
  }
};
