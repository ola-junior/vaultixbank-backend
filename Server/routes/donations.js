const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { makeDonation } = require('../controllers/donationController');

router.use(protect);
router.post('/play4achild', makeDonation);

module.exports = router;