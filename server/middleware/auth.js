const jwt = require('jsonwebtoken');
const config = require('../config');

/**
 * HTTP JWT auth middleware.
 * Reads Authorization: Bearer <token>, verifies it, sets req.user = payload.
 * Returns 401 if header is missing or token is invalid/expired.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = authHeader.slice(7); // strip "Bearer "
  try {
    const payload = jwt.verify(token, config.jwt.secret);
    req.user = payload; // { userId, username }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = authMiddleware;
