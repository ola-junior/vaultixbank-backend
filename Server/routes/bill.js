const express = require('express');
const router = express.Router();
const path = require('path');

// Use absolute path
const billController = require(path.join(__dirname, '../controllers/billController'));
const { protect } = require('../middleware/auth');

const {
  getProviders,
  getPlans,
  verifyRecipient,
  payBill,
  getBillHistory,
} = billController;

router.use(protect);

router.get('/providers/:category', getProviders);
router.get('/plans/:category/:providerCode', getPlans);
router.post('/verify-recipient', verifyRecipient);
router.post('/pay', payBill);
router.get('/history', getBillHistory);

module.exports = router;