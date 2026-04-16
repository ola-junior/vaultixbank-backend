const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { applyLoan, getEligibility } = require('../controllers/loanController');

router.use(protect);
router.post('/apply', applyLoan);
router.get('/eligibility', getEligibility);

module.exports = router;