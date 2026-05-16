/**
 * routes/info.js
 * Registers the heroes info endpoint.
 * No logic here — delegates to infoController.
 */

const router = require('express').Router();
const auth = require('../middleware/auth');
const ctrl = require('../controllers/infoController');

router.get('/heroes', auth, ctrl.getHeroes);

module.exports = router;
