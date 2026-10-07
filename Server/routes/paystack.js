const express = require('express');
const { paystackWebhook } = require('../controllers/transactionController');

const router = express.Router();

router.post('/', express.raw({ type: 'application/json' }), paystackWebhook);

module.exports = router;