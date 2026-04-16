const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { createSavings, getSavings } = require('../controllers/savingsController');

router.use(protect);
router.post('/create', createSavings);
router.get('/', getSavings);

module.exports = router;