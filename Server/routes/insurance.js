const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { getQuote } = require('../controllers/insuranceController');

router.use(protect);
router.post('/quote', getQuote);

module.exports = router;