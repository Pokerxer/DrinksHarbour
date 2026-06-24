'use strict';

const chatbotService = require('../services/chatbot.service');
const { successResponse, errorResponse } = require('../utils/response');

/**
 * POST /api/chatbot/greeting
 * Public — initial greeting shown when the widget opens.
 */
exports.greeting = async (req, res) => {
  try {
    const result = await chatbotService.handleChatbotQuery({ query: '' });
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
    const fileContent = docFile ? docFile.buffer.toString('utf-8') : undefined;
    const fileName = docFile?.originalname;

    const result = await chatbotService.handleChatbotQuery({
      query,
      imageUrls,
      tenantId,
      conversationHistory,
      fileContent,
      fileName,
    });

    return successResponse(res, result, 'Chatbot response');
  } catch (err) {
    return errorResponse(res, 'Chatbot request failed', 500, err);
  }
};
