const express = require('express');
const router = express.Router();
const {
  transfer,
  deposit,
  withdraw,
  getTransactions,
  getTransaction,
  getTransactionSummary,
  verifyAccount
} = require('../controllers/transactionController');
const { protect } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

// Account verification
router.post('/verify-account', verifyAccount);

// Transaction routes
router.post('/transfer', transfer);
router.post('/deposit', deposit);
router.post('/withdraw', withdraw);

// Get transactions
router.get('/', getTransactions);
router.get('/summary', getTransactionSummary);
router.get('/:id', getTransaction);

module.exports = router;