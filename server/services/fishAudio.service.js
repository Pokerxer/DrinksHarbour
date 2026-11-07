// services/fishAudio.service.js
//
// Fish Audio TTS proxy with disk caching.
//
// Wraps https://api.fish.audio/v1/tts to generate speech from text.
// Audio is cached locally (server/uploads/tts/) keyed by content hash
// so the same text is never billed twice.
//
// Required env: FISH_AUDIO_API_KEY
// Optional env: FISH_AUDIO_MODEL (default: s2.1-pro-free)
//               FISH_AUDIO_VOICE_ID (overrides the fixed Energetic Male reference voice)

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ── Config ──────────────────────────────────────────────────────────────────

const API_KEY    = process.env.FISH_AUDIO_API_KEY || '';
const MODEL      = process.env.FISH_AUDIO_MODEL   || 's2.1-pro-free';
// Pin a speaker even without an override: independent chunks must not choose voices.
// https://fish.audio/m/802e3bc2b27e49c2995d23ef70e6ac89/
const VOICE_ID   = process.env.FISH_AUDIO_VOICE_ID?.trim() || '802e3bc2b27e49c2995d23ef70e6ac89';
const TTS_URL    = 'https://api.fish.audio/v1/tts';
const MAX_TEXT_LENGTH = 5000;
// Include synthesis settings in cache identity; bypass old disconnected clips.
const SYNTHESIS_PROFILE = 'continuous-v1';

// ── Cache directory ─────────────────────────────────────────────────────────

const CACHE_DIR = path.join(__dirname, '..', 'uploads', 'tts');

try {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
} catch {
  // Directory may already exist — ignore.
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Synthesize text to speech via Fish Audio.
 *
 * @param {string} text  — up to 5,000 chars of prose to speak
 * @returns {Promise<{ buffer: Buffer, format: string }>}
 * @throws {Error} with status 503 if API key is missing, upstream errors otherwise
 */
async function synthesize(text) {
  if (!API_KEY) {
    const err = new Error('FISH_AUDIO_API_KEY is not configured — set it in server/.env to enable audio features.');
    err.status = 503;
    throw err;
  }

  if (text.trim().length > MAX_TEXT_LENGTH) {
    const err = new Error('Text exceeds the 5,000-character narration limit.');
    err.status = 400;
    throw err;
  }
  const sanitised = text.replace(/[^\x20-\x7E\u00A0-\u024F\u1E00-\u1EFF]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!sanitised) {
    const err = new Error('No text to synthesize.');
    err.status = 400;
    throw err;
  }

  // Keep recordings isolated by text, model, resolved voice and synthesis profile.
  const hash = crypto
    .createHash('sha1')
    .update(sanitised + '|' + MODEL + '|' + VOICE_ID + '|' + SYNTHESIS_PROFILE)
    .digest('hex');

  const cacheFile = path.join(CACHE_DIR, `${hash}.mp3`);

  // Fast path: return cached audio
  try {
    const buffer = fs.readFileSync(cacheFile);
    return { buffer, format: 'mp3', cached: true };
  } catch {
    // Cache miss — proceed to API call.
  }

  // Call Fish Audio TTS
  const body = {
    text: sanitised,
    format: 'mp3',
    normalize: true,
    reference_id: VOICE_ID,
    condition_on_previous_chunks: true,
    temperature: 0.3,
  };

  const res = await fetch(TTS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
      model: MODEL,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => 'unknown');
    const err = new Error(`Fish Audio TTS error ${res.status}: ${detail}`);
    err.status = res.status >= 400 && res.status < 500 ? res.status : 502;
    throw err;
  }

  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Write to cache (fire-and-forget — errors are non-fatal)
  try {
    fs.writeFileSync(cacheFile, buffer);
  } catch {
    // Disk issue — skip caching, audio is still served.
  }

  return { buffer, format: 'mp3', cached: false };
}

/**
 * Check whether the service is configured (API key present).
 */
function isConfigured() {
  return Boolean(API_KEY);
}

module.exports = { synthesize, isConfigured };
