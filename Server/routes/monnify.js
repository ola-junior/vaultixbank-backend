const express = require('express');
const { monnifyWebhook } = require('../controllers/transactionController');

const router = express.Router();

router.post('/', express.raw({ type: 'application/json' }), monnifyWebhook);

module.exports = router;