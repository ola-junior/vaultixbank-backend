const Bill = require('../models/Bill');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const bcrypt = require('bcryptjs'); // ✅ ADDED

// ─── Provider / plan catalogues ───────────────────────────────────────────────
const PROVIDERS = {
  airtime: [
    { code: 'MTN', name: 'MTN Nigeria', logo: '📶' },
    { code: 'AIRTEL', name: 'Airtel Nigeria', logo: '📶' },
    { code: 'GLO', name: 'Glo', logo: '📶' },
    { code: '9MOBILE', name: '9Mobile', logo: '📶' },
  ],
  data: [
    { code: 'MTN', name: 'MTN Nigeria', logo: '📡' },
    { code: 'AIRTEL', name: 'Airtel Nigeria', logo: '📡' },
    { code: 'GLO', name: 'Glo', logo: '📡' },
    { code: '9MOBILE', name: '9Mobile', logo: '📡' },
  ],
  tv: [
    { code: 'DSTV', name: 'DStv', logo: '📺' },
    { code: 'GOTV', name: 'GOtv', logo: '📺' },
    { code: 'STARTIMES', name: 'StarTimes', logo: '📺' },
    { code: 'SHOWMAX', name: 'Showmax', logo: '📺' },
  ],
  electricity: [
    { code: 'EKEDC', name: 'Eko Electric (EKEDC)', logo: '⚡' },
    { code: 'IKEDC', name: 'Ikeja Electric (IKEDC)', logo: '⚡' },
    { code: 'AEDC', name: 'Abuja Electric (AEDC)', logo: '⚡' },
    { code: 'PHEDC', name: 'Port Harcourt Electric', logo: '⚡' },
    { code: 'KEDCO', name: 'Kano Electric (KEDCO)', logo: '⚡' },
    { code: 'IBEDC', name: 'Ibadan Electric (IBEDC)', logo: '⚡' },
  ],
  water: [
    { code: 'LSWC', name: 'Lagos Water Corporation', logo: '💧' },
    { code: 'ASWC', name: 'Abuja Water Board', logo: '💧' },
    { code: 'PSWC', name: 'PH Water Board', logo: '💧' },
  ],
  education: [
    { code: 'WAEC', name: 'WAEC', logo: '🎓' },
    { code: 'NECO', name: 'NECO', logo: '🎓' },
    { code: 'JAMB', name: 'JAMB/UTME', logo: '🎓' },
    { code: 'NABTEB', name: 'NABTEB', logo: '🎓' },
  ],
  betting: [
    { code: 'SPORTYBET', name: 'SportyBet', logo: '⚽' },
    { code: 'BET9JA', name: 'Bet9ja', logo: '⚽' },
    { code: 'BETKING', name: 'BetKing', logo: '⚽' },
    { code: '1XBET', name: '1xBet', logo: '⚽' },
    { code: 'NAIRABET', name: 'NairaBet', logo: '⚽' },
  ],
  internet: [
    { code: 'SPECTRANET', name: 'Spectranet', logo: '🌐' },
    { code: 'SMILE', name: 'Smile', logo: '🌐' },
    { code: 'SWIFT', name: 'Swift', logo: '🌐' },
    { code: 'IPNX', name: 'ipNX', logo: '🌐' },
  ],
};

const DATA_PLANS = {
  MTN: [
    { code: 'mtn_100mb_1d', name: '100MB', validity: '1 day', amount: 100 },
    { code: 'mtn_200mb_3d', name: '200MB', validity: '3 days', amount: 200 },
    { code: 'mtn_500mb_7d', name: '500MB', validity: '7 days', amount: 300 },
    { code: 'mtn_1gb_7d', name: '1GB', validity: '7 days', amount: 500 },
    { code: 'mtn_2gb_30d', name: '2GB', validity: '30 days', amount: 1000 },
    { code: 'mtn_5gb_30d', name: '5GB', validity: '30 days', amount: 2000 },
    { code: 'mtn_10gb_30d', name: '10GB', validity: '30 days', amount: 3500 },
    { code: 'mtn_20gb_30d', name: '20GB', validity: '30 days', amount: 5000 },
  ],
  AIRTEL: [
    { code: 'airtel_200mb', name: '200MB', validity: '3 days', amount: 200 },
    { code: 'airtel_1gb', name: '1GB', validity: '7 days', amount: 500 },
    { code: 'airtel_1.5gb', name: '1.5GB', validity: '30 days', amount: 1000 },
    { code: 'airtel_3gb', name: '3GB', validity: '30 days', amount: 1500 },
    { code: 'airtel_10gb', name: '10GB', validity: '30 days', amount: 3000 },
    { code: 'airtel_25gb', name: '25GB', validity: '30 days', amount: 6000 },
  ],
  GLO: [
    { code: 'glo_200mb', name: '200MB', validity: '3 days', amount: 200 },
    { code: 'glo_1gb', name: '1GB', validity: '14 days', amount: 500 },
    { code: 'glo_2gb', name: '2GB', validity: '30 days', amount: 1000 },
    { code: 'glo_7.7gb', name: '7.7GB', validity: '30 days', amount: 2500 },
    { code: 'glo_15gb', name: '15GB', validity: '30 days', amount: 4000 },
  ],
  '9MOBILE': [
    { code: '9m_200mb', name: '200MB', validity: '3 days', amount: 200 },
    { code: '9m_1gb', name: '1GB', validity: '30 days', amount: 1000 },
    { code: '9m_1.5gb', name: '1.5GB', validity: '30 days', amount: 1200 },
    { code: '9m_4.5gb', name: '4.5GB', validity: '30 days', amount: 2000 },
  ],
};

const TV_PLANS = {
  DSTV: [
    { code: 'dstv_padi', name: 'Padi', amount: 2150 },
    { code: 'dstv_yanga', name: 'Yanga', amount: 2950 },
    { code: 'dstv_confam', name: 'Confam', amount: 6200 },
    { code: 'dstv_compact', name: 'Compact', amount: 10500 },
    { code: 'dstv_compact+', name: 'Compact+', amount: 16600 },
    { code: 'dstv_premium', name: 'Premium', amount: 29500 },
  ],
  GOTV: [
    { code: 'gotv_supa+', name: 'Supa+', amount: 6400 },
    { code: 'gotv_supa', name: 'Supa', amount: 4850 },
    { code: 'gotv_max', name: 'Max', amount: 4150 },
    { code: 'gotv_jolli', name: 'Jolli', amount: 2800 },
    { code: 'gotv_jinja', name: 'Jinja', amount: 1900 },
  ],
  STARTIMES: [
    { code: 'st_nova', name: 'Nova', amount: 1200 },
    { code: 'st_basic', name: 'Basic', amount: 2100 },
    { code: 'st_smart', name: 'Smart', amount: 2800 },
    { code: 'st_classic', name: 'Classic', amount: 3300 },
    { code: 'st_super', name: 'Super', amount: 5300 },
  ],
};

// ─── Helper ───────────────────────────────────────────────────────────────────
const generateToken = () => {
  return Array.from({ length: 20 }, () => Math.floor(Math.random() * 10))
    .join('')
    .replace(/(.{4})/g, '$1-')
    .slice(0, -1);
};

// GET /api/bills/providers/:category
exports.getProviders = (req, res) => {
  const { category } = req.params;
  const list = PROVIDERS[category];
  if (!list) return res.status(400).json({ success: false, message: 'Unknown category' });
  res.json({ success: true, data: list });
};

// GET /api/bills/plans/:category/:providerCode
exports.getPlans = (req, res) => {
  const { category, providerCode } = req.params;
  let plans = null;
  if (category === 'data') plans = DATA_PLANS[providerCode?.toUpperCase()];
  if (category === 'tv') plans = TV_PLANS[providerCode?.toUpperCase()];
  if (!plans) return res.json({ success: true, data: [] });
  res.json({ success: true, data: plans });
};

// POST /api/bills/verify-recipient
exports.verifyRecipient = async (req, res) => {
  try {
    const { category, provider, recipient } = req.body;

    if (!recipient || recipient.length < 6) {
      return res.status(400).json({ success: false, message: 'Invalid recipient identifier' });
    }

    let recipientName = null;
    if (category === 'electricity') {
      const names = ['JOHN DOE', 'MARY JOHNSON', 'EMEKA OKAFOR', 'BLESSING ADEYEMI', 'CHIDI NWOSU'];
      recipientName = names[Math.floor(Math.random() * names.length)];
    } else if (category === 'tv') {
      const names = ['FARUK YUSUF', 'TAIWO ADELEKE', 'NGOZI EZE', 'ABDULLAHI MUSA'];
      recipientName = names[Math.floor(Math.random() * names.length)];
    } else if (category === 'water') {
      recipientName = 'PROPERTY OWNER';
    } else if (category === 'betting') {
      const usernames = ['bettor_001', 'lucky_striker', 'goal_king', 'naijawin'];
      recipientName = usernames[Math.floor(Math.random() * usernames.length)];
    } else if (category === 'education') {
      recipientName = 'CANDIDATE';
    }

    res.json({
      success: true,
      data: {
        recipient,
        recipientName,
        provider,
        category,
        valid: true,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/bills/pay
exports.payBill = async (req, res) => {
  const session = await require('mongoose').startSession();
  session.startTransaction();

  try {
    const {
      category,
      provider,
      plan,
      recipient,
      recipientName,
      amount,
      pin,
      description,
    } = req.body;

    const userId = req.user._id;

    // Validate PIN
    const user = await User.findById(userId).session(session);
    if (!user) throw new Error('User not found');
    
    if (!user.transactionPin) {
      return res.status(400).json({ 
        success: false, 
        message: 'Transaction PIN not set', 
        needsPinSetup: true 
      });
    }

    const pinMatch = await bcrypt.compare(pin, user.transactionPin);
    if (!pinMatch) {
      await session.abortTransaction();
      return res.status(401).json({ success: false, message: 'Invalid transaction PIN' });
    }

    // Validate amount
    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) throw new Error('Invalid amount');

    const fee = 0;
    const totalDeducted = numAmount + fee;

    if (user.balance < totalDeducted) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: 'Insufficient balance' });
    }

    // Deduct balance
    const balanceBefore = user.balance;
    user.balance = parseFloat((user.balance - totalDeducted).toFixed(2));
    await user.save({ session });

    // Generate token for electricity
    const token = category === 'electricity' ? generateToken() : undefined;

    // Create Bill record
    const [bill] = await Bill.create(
      [{
        user: userId,
        category,
        provider,
        plan: plan || null,
        recipient,
        recipientName: recipientName || null,
        amount: numAmount,
        fee,
        totalDeducted,
        status: 'successful',
        balanceBefore,
        balanceAfter: user.balance,
        token,
        description: description || null,
      }],
      { session }
    );

    // Create Transaction record
    await Transaction.create(
      [{
        user: userId,
        type: 'debit',
        amount: totalDeducted,
        description: description || `${category.charAt(0).toUpperCase() + category.slice(1)} — ${provider}`,
        status: 'successful',
        reference: bill.reference,
        balanceBefore,
        balanceAfter: user.balance,
        metadata: {
          billId: bill._id,
          category,
          provider,
          recipient,
        },
      }],
      { session }
    );

    await session.commitTransaction();

    res.json({
      success: true,
      message: `${category.charAt(0).toUpperCase() + category.slice(1)} payment successful!`,
      data: {
        billId: bill._id,
        reference: bill.reference,
        category,
        provider,
        providerName: PROVIDERS[category]?.find(p => p.code === provider)?.name || provider,
        plan: bill.plan,
        planName: plan ? (DATA_PLANS[provider] || TV_PLANS[provider])?.find(p => p.code === plan)?.name : null,
        recipient,
        recipientName: bill.recipientName,
        amount: numAmount,
        fee,
        totalDeducted,
        token,
        status: 'successful',
        createdAt: bill.createdAt,
        newBalance: user.balance,
        balanceAfter: user.balance,
      },
    });
  } catch (err) {
    await session.abortTransaction();
    console.error('Bill payment error:', err);
    res.status(500).json({ success: false, message: err.message || 'Payment failed. Please try again.' });
  } finally {
    session.endSession();
  }
};

// GET /api/bills/history
exports.getBillHistory = async (req, res) => {
  try {
    const { page = 1, limit = 20, category } = req.query;
    const filter = { user: req.user._id };
    if (category && category !== 'all') filter.category = category;

    const [bills, total] = await Promise.all([
      Bill.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit))
        .lean(),
      Bill.countDocuments(filter),
    ]);

    // Add provider names to bills
    const enrichedBills = bills.map(bill => ({
      ...bill,
      providerName: PROVIDERS[bill.category]?.find(p => p.code === bill.provider)?.name || bill.provider,
    }));

    res.json({
      success: true,
      data: enrichedBills,
      total,
      page: Number(page),
      pages: Math.ceil(total / limit),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};