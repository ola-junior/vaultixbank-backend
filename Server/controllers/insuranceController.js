// @desc    Get insurance quote
// @route   POST /api/insurance/quote
// @access  Private
exports.getQuote = async (req, res) => {
  try {
    const { planId, name, email, phone } = req.body;
    
    // Insurance plans
    const plans = {
      health: { name: 'Health Insurance', basePrice: 15000 },
      auto: { name: 'Auto Insurance', basePrice: 25000 },
      home: { name: 'Home Insurance', basePrice: 20000 },
      travel: { name: 'Travel Insurance', basePrice: 10000 },
    };

    const plan = plans[planId];
    if (!plan) {
      return res.status(400).json({ success: false, message: 'Invalid insurance plan' });
    }

    // Calculate premium (simplified)
    const premium = plan.basePrice;

    res.json({
      success: true,
      data: {
        plan: plan.name,
        premium,
        coverage: `₦${(premium * 100).toLocaleString()}`,
        quoteRef: `INS-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};