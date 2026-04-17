const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  getCards,
  createCard,
  fundCard,
  withdrawFromCard,
  toggleFreeze,
  deleteCard,
  getCardTransactions
} = require('../controllers/cardController');

router.use(protect);

router.get('/', getCards);
router.post('/create', createCard);
router.post('/:cardId/fund', fundCard);
router.post('/:cardId/withdraw', withdrawFromCard);
router.post('/:cardId/toggle-freeze', toggleFreeze);
router.delete('/:cardId', deleteCard);
router.get('/transactions', getCardTransactions);

module.exports = router;