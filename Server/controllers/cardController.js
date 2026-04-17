const User = require('../models/User');
const Transaction = require('../models/Transaction');
const crypto = require('crypto');

// Generate card number
const generateCardNumber = () => {
  const prefix = '5399'; // Mastercard prefix
  return prefix + Array.from({ length: 12 }, () => Math.floor(Math.random() * 10)).join('');
};

// Generate CVV
const generateCVV = () => {
  return Array.from({ length: 3 }, () => Math.floor(Math.random() * 10)).join('');
};

// Generate expiry (3 years from now)
const generateExpiry = () => {
  const date = new Date();
  date.setFullYear(date.getFullYear() + 3);
  return `${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear().toString().slice(-2)}`;
};

// @desc    Get all user cards
// @route   GET /api/cards
// @access  Private
exports.getCards = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    res.json({
      success: true,
      data: user.cards || []
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Create new card
// @route   POST /api/cards/create
// @access  Private
exports.createCard = async (req, res) => {
  try {
    const { type, name, dailyLimit, pin } = req.body;
    const user = await User.findById(req.user._id).select('+transactionPin');

    // Verify user PIN
    const pinMatch = await user.matchTransactionPin(pin);
    if (!pinMatch) {
      return res.status(401).json({ success: false, message: 'Invalid transaction PIN' });
    }

    // Check card limit (max 3 cards)
    if (user.cards && user.cards.length >= 3) {
      return res.status(400).json({ success: false, message: 'Maximum 3 cards allowed' });
    }

    const newCard = {
      type,
      name,
      cardNumber: generateCardNumber(),
      cvv: generateCVV(),
      expiry: generateExpiry(),
      dailyLimit,
      balance: 0,
      spentToday: 0,
      status: 'active',
      frozen: false,
      brand: 'mastercard',
      color: type === 'virtual' 
        ? 'from-purple-600 via-pink-600 to-rose-600'
        : 'from-indigo-600 via-blue-600 to-cyan-600',
      createdAt: new Date()
    };

    if (!user.cards) user.cards = [];
    user.cards.push(newCard);
    await user.save();

    res.json({
      success: true,
      message: 'Card created successfully',
      data: newCard
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Fund card
// @route   POST /api/cards/:cardId/fund
// @access  Private
exports.fundCard = async (req, res) => {
  try {
    const { cardId } = req.params;
    const { amount } = req.body;
    const user = await User.findById(req.user._id);

    const card = user.cards.id(cardId);
    if (!card) {
      return res.status(404).json({ success: false, message: 'Card not found' });
    }

    if (card.frozen) {
      return res.status(400).json({ success: false, message: 'Card is frozen' });
    }

    const numAmount = Number(amount);
    if (user.balance < numAmount) {
      return res.status(400).json({ success: false, message: 'Insufficient balance' });
    }

    // Deduct from main balance
    user.balance -= numAmount;
    card.balance = (card.balance || 0) + numAmount;
    await user.save();

    // Create transaction
    await Transaction.create({
      userId: user._id,
      type: 'debit',
      amount: numAmount,
      description: `Fund Card - ${card.name}`,
      status: 'successful',
      balanceBefore: user.balance + numAmount,
      balanceAfter: user.balance,
      reference: `CARD-FUND-${Date.now()}`
    });

    res.json({
      success: true,
      message: 'Card funded successfully',
      data: { newBalance: user.balance, cardBalance: card.balance }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Withdraw from card to main balance
// @route   POST /api/cards/:cardId/withdraw
// @access  Private
exports.withdrawFromCard = async (req, res) => {
  try {
    const { cardId } = req.params;
    const { amount } = req.body;
    const user = await User.findById(req.user._id);

    const card = user.cards.id(cardId);
    if (!card) {
      return res.status(404).json({ success: false, message: 'Card not found' });
    }

    if (card.frozen) {
      return res.status(400).json({ success: false, message: 'Card is frozen' });
    }

    const numAmount = Number(amount);
    if (card.balance < numAmount) {
      return res.status(400).json({ success: false, message: 'Insufficient card balance' });
    }

    // Add to main balance
    card.balance -= numAmount;
    user.balance += numAmount;
    await user.save();

    res.json({
      success: true,
      message: 'Withdrawal successful',
      data: { newBalance: user.balance, cardBalance: card.balance }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Toggle card freeze
// @route   POST /api/cards/:cardId/toggle-freeze
// @access  Private
exports.toggleFreeze = async (req, res) => {
  try {
    const { cardId } = req.params;
    const user = await User.findById(req.user._id);

    const card = user.cards.id(cardId);
    if (!card) {
      return res.status(404).json({ success: false, message: 'Card not found' });
    }

    card.frozen = !card.frozen;
    await user.save();

    res.json({
      success: true,
      message: `Card ${card.frozen ? 'frozen' : 'unfrozen'} successfully`,
      data: { frozen: card.frozen }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Delete card
// @route   DELETE /api/cards/:cardId
// @access  Private
exports.deleteCard = async (req, res) => {
  try {
    const { cardId } = req.params;
    const user = await User.findById(req.user._id);

    const card = user.cards.id(cardId);
    if (!card) {
      return res.status(404).json({ success: false, message: 'Card not found' });
    }

    if (card.balance > 0) {
      return res.status(400).json({ success: false, message: 'Withdraw balance before deleting card' });
    }

    user.cards = user.cards.filter(c => c._id.toString() !== cardId);
    await user.save();

    res.json({ success: true, message: 'Card deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Get card transactions
// @route   GET /api/cards/transactions
// @access  Private
exports.getCardTransactions = async (req, res) => {
  try {
    const transactions = await Transaction.find({
      userId: req.user._id,
      description: { $regex: 'Card', $options: 'i' }
    }).sort({ createdAt: -1 }).limit(20);

    res.json({ success: true, data: transactions });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};