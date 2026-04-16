const User = require('../models/User');
const Transaction = require('../models/Transaction');

// @desc    Make donation
// @route   POST /api/donations/play4achild
// @access  Private
exports.makeDonation = async (req, res) => {
  try {
    const { amount, cause } = req.body;
    const userId = req.user._id;

    const numAmount = Number(amount);
    if (!numAmount || numAmount < 1000) {
      return res.status(400).json({ 
        success: false, 
        message: 'Minimum donation is ₦1,000' 
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.balance < numAmount) {
      return res.status(400).json({ success: false, message: 'Insufficient balance' });
    }

    // Deduct from balance
    const balanceBefore = user.balance;
    user.balance = parseFloat((user.balance - numAmount).toFixed(2));
    await user.save();

    // Create transaction record
    await Transaction.create({
      userId: userId,
      type: 'debit',
      amount: numAmount,
      description: `Donation - Play4AChild (${cause || 'General Support'})`,
      status: 'successful',
      balanceBefore,
      balanceAfter: user.balance,
      reference: `DON-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      metadata: { cause, program: 'Play4AChild' }
    });

    res.json({
      success: true,
      message: 'Thank you for your generous donation! ❤️',
      data: {
        amount: numAmount,
        cause: cause || 'General Support',
        newBalance: user.balance
      }
    });
  } catch (err) {
    console.error('Donation error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};