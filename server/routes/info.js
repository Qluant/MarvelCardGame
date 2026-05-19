const router = require('express').Router();
const auth = require('../middleware/auth');
const ctrl = require('../controllers/infoController');

router.get('/heroes', ctrl.getHeroes);

module.exports = router;
