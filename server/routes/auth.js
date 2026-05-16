/**
 * routes/auth.js
 * Registers authentication endpoints.
 * No logic here — delegates to authController.
 */

const router = require('express').Router();
const ctrl = require('../controllers/authController');

router.post('/register', ctrl.register);
router.post('/login', ctrl.login);

module.exports = router;
