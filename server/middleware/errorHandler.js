/**
 * middleware/errorHandler.js
 * Centralized Express error handler. Must be mounted LAST in app.js.
 * Express identifies it as error handler by the 4-argument signature.
 *
 * Controllers and other middleware pass errors via:
 *   next(err)         — explicit
 *   throw err         — Express 5 catches async throws automatically
 *
 * Never returns stack traces or internal details to the client.
 */

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  console.error(err);

  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Internal server error';

  res.status(status).json({ error: message });
}

module.exports = errorHandler;
