// server/controllers/scan.controller.js
//
// Orchestration for the Sales Scan & Match feature: QR pairing sessions,
// desktop direct-match (image or text), and mobile upload-via-pairing-code.
// Real-time progress is pushed to the desktop drawer via Socket.io
// (`io.to('scan:<code>').emit(...)`); a polling fallback is exposed too.
//
// Mobile uploads authorize with the pairing code alone (no admin JWT) so a phone
// that isn't logged in can still capture a photo. Desktop endpoints require the
// admin JWT + tenant context (Protect + attachTenant).

const asyncHandler = require('../utils/asyncHandler');
const scanPairing = require('../services/scanPairing.service');
const scanMatch = require('../services/scanMatch.service');
const subProductService = require('../services/subproduct.service');
const cloudinary = require('../services/cloudinary.service');
const { extractText } = require('../services/documentText.service');

// ── Helpers ──────────────────────────────────────────────────────────────

/** Emit a scan event to the desktop drawer subscribed to this pairing code. */
function emitScanEvent(req, code, event, payload) {
  const io = req.app.get('io');
  if (io) io.to(`scan:${code}`).emit(event, payload);
}

/** Run the AI match for a pairing session and stream progress over the socket. */
async function runMatchForPairing(req, code, input) {
  const session = scanPairing.getSession(code);
  if (!session) return;
  try {
    scanPairing.setStatus(code, 'processing');
    emitScanEvent(req, code, 'scan:status', { status: 'processing' });

    const result = await scanMatch.extractAndMatch(input, {
      tenantId: session.tenantId,
      getSubProducts: (tenantId, params) =>
        subProductService.getMySubProducts(tenantId, params),
    });

    scanPairing.setStatus(code, 'complete', result);
    emitScanEvent(req, code, 'scan:complete', { status: 'complete', result });
  } catch (err) {
    console.error('scan: runMatchForPairing failed:', err.message);
    scanPairing.setStatus(code, 'error', { error: err.message });
    emitScanEvent(req, code, 'scan:status', { status: 'error', message: err.message });
  }
}

// ── Desktop endpoints (admin JWT) ──────────────────────────────────────────

/** POST /api/scan/pair — create a QR pairing session. */
exports.createPairing = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  if (!tenantId)
    return res.status(400).json({ success: false, message: 'Tenant context required' });
  const { pairingCode, expiresAt } = scanPairing.createPairing(tenantId);
  res.status(201).json({ success: true, data: { pairingCode, expiresAt } });
});

/** GET /api/scan/status/:code — polling fallback for the desktop drawer. */
exports.getStatus = asyncHandler(async (req, res) => {
  const session = scanPairing.getSession(req.params.code);
  if (!session)
    return res.status(404).json({ success: false, message: 'Pairing code not found or expired' });
  res.json({
    success: true,
    data: { status: session.status, result: session.result, expiresAt: session.expiresAt },
  });
});

/**
 * POST /api/scan/smart-search — fuzzy live search with no AI.
 * Alias expansion + Brand.tradingAs + Category lookup + token scoring.
 * Used by the product search box as a fallback when exact text search yields nothing.
 */
exports.smartSearch = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  if (!tenantId)
    return res.status(400).json({ success: false, message: 'Tenant context required' });
  const { query } = req.body || {};
  if (!query?.trim())
    return res.status(400).json({ success: false, message: 'query is required' });

  const results = await scanMatch.smartSearch(
    query.trim(),
    {
      tenantId,
      getSubProducts: (t, p) => subProductService.getMySubProducts(t, p),
    },
    12
  );
  res.json({ success: true, data: { items: results } });
});

/** POST /api/scan/match — desktop direct match (image URL or text), synchronous. */
exports.desktopMatch = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  if (!tenantId)
    return res.status(400).json({ success: false, message: 'Tenant context required' });
  const { imageUrl, text } = req.body || {};
  if (!imageUrl && !text)
    return res.status(400).json({ success: false, message: 'Provide imageUrl or text' });

  const result = await scanMatch.extractAndMatch(
    imageUrl ? { imageUrl } : { text },
    {
      tenantId,
      getSubProducts: (t, p) => subProductService.getMySubProducts(t, p),
    }
  );
  res.json({ success: true, data: { items: result } });
});

/**
 * POST /api/scan/upload-document — upload a PDF/Word/Excel/CSV file and run AI match.
 * The file is read into memory, text is extracted, then passed to extractAndMatch as text.
 */
exports.uploadDocument = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  if (!tenantId)
    return res.status(400).json({ success: false, message: 'Tenant context required' });
  if (!req.file)
    return res.status(400).json({ success: false, message: 'No file uploaded (field name must be "file")' });

  let text;
  try {
    text = await extractText(req.file.buffer, req.file.mimetype, req.file.originalname);
  } catch (err) {
    return res.status(422).json({ success: false, message: `Could not read file: ${err.message}` });
  }

  if (!text) {
    return res.status(422).json({ success: false, message: 'File appears to be empty or unreadable' });
  }

  const result = await scanMatch.extractAndMatch(
    { text },
    {
      tenantId,
      getSubProducts: (t, p) => subProductService.getMySubProducts(t, p),
    }
  );
  res.json({ success: true, data: { items: result } });
});

// ── Mobile endpoint (pairing code, no JWT) ─────────────────────────────────

/** POST /api/scan/upload-mobile/:code — phone uploads a photo; kicks off AI. */
exports.mobileUpload = asyncHandler(async (req, res) => {
  const code = req.params.code;
  const session = scanPairing.getSession(code);
  if (!session)
    return res.status(404).json({ success: false, message: 'Pairing code not found or expired' });
  if (session.used)
    return res.status(410).json({ success: false, message: 'This code has already been used' });

  if (!req.file)
    return res.status(400).json({ success: false, message: 'No image uploaded (field name must be "image")' });

  // Upload to Cloudinary, then kick off the async match (non-blocking).
  scanPairing.markUsed(code);
  scanPairing.setStatus(code, 'uploaded');
  emitScanEvent(req, code, 'scan:status', { status: 'uploaded' });

  let imageUrl = null;
  try {
    const uploaded = await cloudinary.uploadImage(req.file.buffer, {
      folder: 'scans',
      tags: ['scan-intake', `pairing-${code}`],
      transformation: { width: 1024, crop: 'limit', quality: 'auto', fetch_format: 'auto' },
    });
    imageUrl = uploaded.url;
  } catch (err) {
    console.error('scan: cloudinary upload failed:', err.message);
    scanPairing.setStatus(code, 'error', { error: 'Image upload failed' });
    emitScanEvent(req, code, 'scan:status', { status: 'error', message: 'Image upload failed' });
    return res.status(500).json({ success: false, message: 'Image upload failed' });
  }

  // Respond to the phone immediately; the AI match runs in the background and
  // streams its result to the desktop drawer via Socket.io.
  res.status(202).json({ success: true, data: { status: 'processing', imageUrl } });
  void runMatchForPairing(req, code, { imageUrl });
});