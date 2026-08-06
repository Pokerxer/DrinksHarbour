// utils/mailCrypto.js
//
// Encryption for stored mail passwords. IMAP/SMTP need the plaintext back to
// log in, so hashing is impossible — this is reversible encryption, and the
// key lives only in the environment. AES-256-GCM so a tampered ciphertext
// fails authentication instead of decrypting to garbage that gets sent to a
// mail server as a login attempt.

const crypto = require('crypto');

const VERSION = 'v1';

/**
 * MAIL_CRED_KEY is the intended key. JWT_SECRET is the fallback so the feature
 * works without new env — but note the consequence: rotating JWT_SECRET then
 * also invalidates every stored mail password unless MAIL_CRED_KEY was set.
 */
function key() {
  const secret = process.env.MAIL_CRED_KEY || process.env.JWT_SECRET;
  if (!secret) {
    throw new Error(
      'Set MAIL_CRED_KEY (or JWT_SECRET) before storing mail account passwords'
    );
  }
  return crypto.createHash('sha256').update(String(secret)).digest();
}

function encrypt(plaintext) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(String(plaintext), 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    VERSION,
    iv.toString('base64'),
    tag.toString('base64'),
    ciphertext.toString('base64'),
  ].join(':');
}

function decrypt(blob) {
  const [version, iv, tag, ciphertext] = String(blob || '').split(':');
  if (version !== VERSION || !iv || !tag || !ciphertext) {
    throw new Error('Stored mail password is not in a recognised format');
  }
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    key(),
    Buffer.from(iv, 'base64')
  );
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

module.exports = { encrypt, decrypt };
