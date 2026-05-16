/**
 * routes/players.js
 * Registers player profile and settings endpoints.
 * No logic here — delegates to playersController.
 *
 * Fix: previously module.exports was placed before the last route (PUT /settings),
 * which caused that route to be silently unreachable. Now module.exports is LAST.
 */

const router = require('express').Router();
const auth = require('../middleware/auth');
const ctrl = require('../controllers/playersController');

router.get('/top', ctrl.getTop);
router.get('/:nickname', ctrl.getProfile);
router.put('/:nickname/hero', auth, ctrl.updateHero);
router.put('/:nickname/settings', auth, ctrl.updateSettings);

module.exports = router;
