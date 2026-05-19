const router = require('express').Router();
const auth = require('../middleware/auth');
const ctrl = require('../controllers/playersController');

router.get('/top', ctrl.getTop);
router.get('/:nickname', ctrl.getProfile);
router.put('/:nickname/hero', auth, ctrl.updateHero);
router.put('/:nickname/settings', auth, ctrl.updateSettings);

module.exports = router;
