const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { createSavings, getSavings, withdrawSavings } = require('../controllers/savingsController');

router.use(protect);
router.post('/create', createSavings);
router.get('/', getSavings);
router.post('/withdraw/:savingsId', withdrawSavings); // ✅ ADD THIS

module.exports = router;