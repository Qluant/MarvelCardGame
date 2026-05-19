const router = require('express').Router();
const auth = require('../middleware/auth');
const ctrl = require('../controllers/cardsController');

router.get('/', auth, ctrl.getAll);

module.exports = router;
