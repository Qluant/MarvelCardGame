const crypto = require('crypto');
const PBKDF2_ITERATIONS = 1000;
const PBKDF2_KEY_LEN = 64;
const PBKDF2_DIGEST = 'sha512';

function hashPassword(password) {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString('hex');
    crypto.pbkdf2(password, salt, PBKDF2_ITERATIONS, PBKDF2_KEY_LEN, PBKDF2_DIGEST, (err, key) => {
      if (err) return reject(err);
      resolve(`${salt}:${key.toString('hex')}`);
    });
  });
}

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

function base64urlEncode(data) {
  const str = Buffer.isBuffer(data) ? data : Buffer.from(typeof data === 'string' ? data : JSON.stringify(data));
  return str.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function base64urlDecode(str) {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/');
  const padding = (4 - padded.length % 4) % 4;
  return Buffer.from(padded + '='.repeat(padding), 'base64').toString('utf8');
}

function signJwt(payload, secret, expiresInSeconds = 86400) {
  const header = base64urlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const now    = Math.floor(Date.now() / 1000);
  const body   = base64urlEncode(JSON.stringify({ ...payload, iat: now, exp: now + expiresInSeconds }));

  const sigInput  = `${header}.${body}`;
  const signature = base64urlEncode(crypto.createHmac('sha256', secret).update(sigInput).digest());

  return `${sigInput}.${signature}`;
}

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
