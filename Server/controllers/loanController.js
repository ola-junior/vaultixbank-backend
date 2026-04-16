const User = require('../models/User');
const Transaction = require('../models/Transaction');

// @desc    Apply for loan
// @route   POST /api/loans/apply
// @access  Private
exports.applyLoan = async (req, res) => {
  try {
    const { planId, amount } = req.body;
    const userId = req.user._id;

    const numAmount = Number(amount);
    if (!numAmount || numAmount < 5000) {
      return res.status(400).json({ 
        success: false, 
        message: 'Minimum loan amount is ₦5,000' 
      });
    }

    // Loan plans configuration
    const plans = {
      quick: { maxAmount: 100000, rate: 5, name: 'Quick Loan' },
      personal: { maxAmount: 500000, rate: 3, name: 'Personal Loan' },
      business: { maxAmount: 2000000, rate: 2.5, name: 'Business Loan' },
    };

    const plan = plans[planId];
    if (!plan) {
      return res.status(400).json({ success: false, message: 'Invalid loan plan' });
    }

    if (numAmount > plan.maxAmount) {
      return res.status(400).json({ 
        success: false, 
        message: `Maximum loan amount for ${plan.name} is ₦${plan.maxAmount.toLocaleString()}` 
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Add loan amount to balance
    const balanceBefore = user.balance;
    user.balance = parseFloat((user.balance + numAmount).toFixed(2));
    await user.save();

    // Create transaction record
    await Transaction.create({
      userId: userId,
      type: 'credit',
      amount: numAmount,
      description: `Loan Disbursement - ${plan.name}`,
      status: 'successful',
      balanceBefore,
      balanceAfter: user.balance,
      reference: `LOAN-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      metadata: { planId, planName: plan.name }
    });

    res.json({
      success: true,
      message: 'Loan approved and disbursed successfully!',
      data: {
        amount: numAmount,
        plan: plan.name,
        newBalance: user.balance
      }
    });
  } catch (err) {
    console.error('Loan application error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Get loan eligibility
// @route   GET /api/loans/eligibility
// @access  Private
exports.getEligibility = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    // Calculate eligibility based on account age and balance
    const accountAge = Date.now() - new Date(user.createdAt).getTime();
    const accountAgeDays = Math.floor(accountAge / (1000 * 60 * 60 * 24));
    
    let maxEligible = 50000;
    if (accountAgeDays > 30) maxEligible = 100000;
    if (accountAgeDays > 90) maxEligible = 500000;
    if (accountAgeDays > 180) maxEligible = 2000000;
    
    res.json({
      success: true,
      data: {
        maxEligible,
        accountAgeDays,
        balance: user.balance
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};