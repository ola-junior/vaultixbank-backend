const User = require('../models/User');
const Transaction = require('../models/Transaction');

// @desc    Create savings
// @route   POST /api/savings/create
// @access  Private
exports.createSavings = async (req, res) => {
  try {
    const { planId, amount } = req.body;
    const userId = req.user._id;

    const numAmount = Number(amount);
    
    // Savings plans configuration
    const plans = {
      flex: { minAmount: 1000, rate: 8, name: 'Flex Save', lockPeriod: 0 },
      fixed: { minAmount: 10000, rate: 12, name: 'Fixed Save', lockPeriod: 90 },
      goal: { minAmount: 50000, rate: 15, name: 'Goal Save', lockPeriod: 180 },
    };

    const plan = plans[planId];
    if (!plan) {
      return res.status(400).json({ success: false, message: 'Invalid savings plan' });
    }

    if (!numAmount || numAmount < plan.minAmount) {
      return res.status(400).json({ 
        success: false, 
        message: `Minimum amount for ${plan.name} is ₦${plan.minAmount.toLocaleString()}` 
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
    
    // Initialize savings array if it doesn't exist
    if (!user.savings) {
      user.savings = [];
    }
    
    // Add savings record
    user.savings.push({
      planId,
      planName: plan.name,
      amount: numAmount,
      interestRate: plan.rate,
      lockPeriod: plan.lockPeriod,
      startDate: new Date(),
      maturityDate: new Date(Date.now() + plan.lockPeriod * 24 * 60 * 60 * 1000),
      status: 'active'
    });
    
    await user.save();

    // Create transaction record
    await Transaction.create({
      userId: userId,
      type: 'debit',
      amount: numAmount,
      description: `Savings - ${plan.name}`,
      status: 'successful',
      balanceBefore,
      balanceAfter: user.balance,
      reference: `SAV-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      metadata: { planId, planName: plan.name }
    });

    res.json({
      success: true,
      message: `✅ ₦${numAmount.toLocaleString()} added to ${plan.name}!`,
      data: {
        amount: numAmount,
        plan: plan.name,
        newBalance: user.balance,
        interestRate: plan.rate,
        expectedInterest: (numAmount * plan.rate) / 100
      }
    });
  } catch (err) {
    console.error('Create savings error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Get user savings
// @route   GET /api/savings
// @access  Private
exports.getSavings = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    res.json({
      success: true,
      data: user.savings || []
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Withdraw from savings
// @route   POST /api/savings/withdraw/:savingsId
// @access  Private
exports.withdrawSavings = async (req, res) => {
  try {
    const { savingsId } = req.params;
    const userId = req.user._id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const saving = user.savings.id(savingsId);
    if (!saving) {
      return res.status(404).json({ success: false, message: 'Savings not found' });
    }

    if (saving.status !== 'active') {
      return res.status(400).json({ success: false, message: 'Savings already withdrawn' });
    }

    // Check lock period
    if (saving.lockPeriod > 0) {
      const maturityDate = new Date(saving.maturityDate);
      if (maturityDate > new Date()) {
        return res.status(400).json({ 
          success: false, 
          message: 'Cannot withdraw before maturity date' 
        });
      }
    }

    // Calculate interest
    const daysHeld = Math.floor((new Date() - new Date(saving.startDate)) / (1000 * 60 * 60 * 24));
    const interestEarned = (saving.amount * saving.interestRate * daysHeld) / (365 * 100);
    const totalWithdrawn = saving.amount + interestEarned;

    // Update balance
    user.balance = parseFloat((user.balance + totalWithdrawn).toFixed(2));
    
    // Update savings status
    saving.status = 'withdrawn';
    saving.withdrawalDate = new Date();
    saving.interestEarned = parseFloat(interestEarned.toFixed(2));

    await user.save();

    res.json({
      success: true,
      message: 'Savings withdrawn successfully',
      data: {
        amount: saving.amount,
        interestEarned: parseFloat(interestEarned.toFixed(2)),
        totalWithdrawn: parseFloat(totalWithdrawn.toFixed(2)),
        newBalance: user.balance
      }
    });
  } catch (err) {
    console.error('Withdraw savings error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};