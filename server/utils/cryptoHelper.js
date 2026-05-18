/**
 * utils/cryptoHelper.js
 * Native replacements for bcrypt and jsonwebtoken.
 * Uses only Node.js built-in 'crypto' module — no external dependencies.
 *
 * Password hashing: PBKDF2-SHA512 with random salt.
 *   Stored format: "<hex_salt>:<hex_derived_key>"
 *
 * JWT: HS256 (HMAC-SHA256) — fully spec-compliant token format.
 *   Compatible with any standard JWT decoder on the client.
 */

const crypto = require('crypto');

// ── Password helpers (replaces bcrypt) ────────────────────────────────────────

const PBKDF2_ITERATIONS = 1000;
const PBKDF2_KEY_LEN    = 64;
const PBKDF2_DIGEST     = 'sha512';

/**
 * Hash a plain-text password using PBKDF2-SHA512.
 * @param {string} password
 * @returns {Promise<string>} "<salt>:<hash>" to store in the DB
 */
function hashPassword(password) {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString('hex');
    crypto.pbkdf2(password, salt, PBKDF2_ITERATIONS, PBKDF2_KEY_LEN, PBKDF2_DIGEST, (err, key) => {
      if (err) return reject(err);
      resolve(`${salt}:${key.toString('hex')}`);
    });
  });
}

/**
 * Verify a plain-text password against a stored PBKDF2 hash.
 * @param {string} password
 * @param {string} stored  "<salt>:<hash>"
 * @returns {Promise<boolean>}
 */
function verifyPassword(password, stored) {
  return new Promise((resolve, reject) => {
    const parts = stored.split(':');
    if (parts.length !== 2) return resolve(false);
    const [salt, storedKey] = parts;
    crypto.pbkdf2(password, salt, PBKDF2_ITERATIONS, PBKDF2_KEY_LEN, PBKDF2_DIGEST, (err, key) => {
      if (err) return reject(err);
      resolve(key.toString('hex') === storedKey);
    });
  });
}

// ── JWT helpers (replaces jsonwebtoken) ───────────────────────────────────────

/**
 * Encode a Buffer or string to Base64Url (no padding, URL-safe characters).
 * @param {Buffer|string} data
 * @returns {string}
 */
function base64urlEncode(data) {
  const str = Buffer.isBuffer(data) ? data : Buffer.from(typeof data === 'string' ? data : JSON.stringify(data));
  return str.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

/**
 * Decode a Base64Url string back to a UTF-8 string.
 * @param {string} str
 * @returns {string}
 */
function base64urlDecode(str) {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/');
  const padding = (4 - padded.length % 4) % 4;
  return Buffer.from(padded + '='.repeat(padding), 'base64').toString('utf8');
}

/**
 * Sign a JWT token with HS256 algorithm.
 * @param {Object} payload
 * @param {string} secret
 * @param {number} [expiresInSeconds=86400]  Default: 24 hours
 * @returns {string}  header.payload.signature
 */
function signJwt(payload, secret, expiresInSeconds = 86400) {
  const header = base64urlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const now    = Math.floor(Date.now() / 1000);
  const body   = base64urlEncode(JSON.stringify({ ...payload, iat: now, exp: now + expiresInSeconds }));

  const sigInput  = `${header}.${body}`;
  const signature = base64urlEncode(crypto.createHmac('sha256', secret).update(sigInput).digest());

  return `${sigInput}.${signature}`;
}

/**
 * Verify a JWT token and return its payload.
 * Throws if the signature is invalid or the token has expired.
 * @param {string} token
 * @param {string} secret
 * @returns {Object} decoded payload
 */
function verifyJwt(token, secret) {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid token structure');

  const [header, body, signature] = parts;
  const sigInput  = `${header}.${body}`;
  const expected  = base64urlEncode(crypto.createHmac('sha256', secret).update(sigInput).digest());

  if (signature !== expected) throw new Error('Invalid token signature');

  const payload = JSON.parse(base64urlDecode(body));

  if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) {
    throw new Error('Token expired');
  }

  return payload;
}

module.exports = { hashPassword, verifyPassword, signJwt, verifyJwt };
