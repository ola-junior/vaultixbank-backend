const Bill = require('../models/Bill');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const bcrypt = require('bcryptjs');

// ─── Professional Provider Catalogues ──────────────────────────────────────────
const PROVIDERS = {
  airtime: [
    { code: 'MTN', name: 'MTN Nigeria', logo: '🟡', color: '#FFCC00' },
    { code: 'AIRTEL', name: 'Airtel Nigeria', logo: '🔴', color: '#E40000' },
    { code: 'GLO', name: 'Glo', logo: '🟢', color: '#00A859' },
    { code: '9MOBILE', name: '9Mobile', logo: '🟢', color: '#00A859' },
  ],
  data: [
    { code: 'MTN', name: 'MTN Nigeria', logo: '🟡', color: '#FFCC00' },
    { code: 'AIRTEL', name: 'Airtel Nigeria', logo: '🔴', color: '#E40000' },
    { code: 'GLO', name: 'Glo', logo: '🟢', color: '#00A859' },
    { code: '9MOBILE', name: '9Mobile', logo: '🟢', color: '#00A859' },
  ],
  tv: [
    { code: 'DSTV', name: 'DStv', logo: '📡', color: '#1A73E8' },
    { code: 'GOTV', name: 'GOtv', logo: '📡', color: '#E65100' },
    { code: 'STARTIMES', name: 'StarTimes', logo: '⭐', color: '#FF6F00' },
    { code: 'SHOWMAX', name: 'Showmax', logo: '🎬', color: '#E50914' },
  ],
  electricity: [
    { code: 'EKEDC', name: 'Eko Electric', logo: '⚡', color: '#FF9800' },
    { code: 'IKEDC', name: 'Ikeja Electric', logo: '⚡', color: '#2196F3' },
    { code: 'AEDC', name: 'Abuja Electric', logo: '⚡', color: '#4CAF50' },
    { code: 'PHEDC', name: 'Port Harcourt Electric', logo: '⚡', color: '#9C27B0' },
    { code: 'KEDCO', name: 'Kano Electric', logo: '⚡', color: '#F44336' },
    { code: 'IBEDC', name: 'Ibadan Electric', logo: '⚡', color: '#00BCD4' },
  ],
  water: [
    { code: 'LSWC', name: 'Lagos Water', logo: '💧', color: '#0288D1' },
    { code: 'ASWC', name: 'Abuja Water', logo: '💧', color: '#00796B' },
    { code: 'PSWC', name: 'PH Water', logo: '💧', color: '#5C6BC0' },
  ],
  education: [
    { code: 'WAEC', name: 'WAEC', logo: '📚', color: '#1B5E20' },
    { code: 'NECO', name: 'NECO', logo: '📖', color: '#B71C1C' },
    { code: 'JAMB', name: 'JAMB/UTME', logo: '🎯', color: '#E65100' },
    { code: 'NABTEB', name: 'NABTEB', logo: '📝', color: '#4A148C' },
  ],
  betting: [
    { code: 'SPORTYBET', name: 'SportyBet', logo: '⚽', color: '#E10600' },
    { code: 'BET9JA', name: 'Bet9ja', logo: '🎲', color: '#1A237E' },
    { code: 'BETKING', name: 'BetKing', logo: '👑', color: '#FF6F00' },
    { code: '1XBET', name: '1xBet', logo: '🎰', color: '#0D47A1' },
    { code: 'NAIRABET', name: 'NairaBet', logo: '💚', color: '#2E7D32' },
  ],
  internet: [
    { code: 'SPECTRANET', name: 'Spectranet', logo: '🌐', color: '#E65100' },
    { code: 'SMILE', name: 'Smile', logo: '😊', color: '#FF9800' },
    { code: 'SWIFT', name: 'Swift', logo: '⚡', color: '#1565C0' },
    { code: 'IPNX', name: 'ipNX', logo: '🔷', color: '#0277BD' },
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
    { code: 'dstv_compact+', name: 'Compact Plus', amount: 16600 },
    { code: 'dstv_premium', name: 'Premium', amount: 29500 },
    { code: 'dstv_premium_asia', name: 'Premium + Asia', amount: 34800 },
  ],
  GOTV: [
    { code: 'gotv_supa+', name: 'Supa+', amount: 6400 },
    { code: 'gotv_supa', name: 'Supa', amount: 4850 },
    { code: 'gotv_max', name: 'Max', amount: 4150 },
    { code: 'gotv_jolli', name: 'Jolli', amount: 2800 },
    { code: 'gotv_jinja', name: 'Jinja', amount: 1900 },
    { code: 'gotv_lite', name: 'Lite', amount: 900 },
  ],
  STARTIMES: [
    { code: 'st_nova', name: 'Nova', amount: 1200 },
    { code: 'st_basic', name: 'Basic', amount: 2100 },
    { code: 'st_smart', name: 'Smart', amount: 2800 },
    { code: 'st_classic', name: 'Classic', amount: 3300 },
    { code: 'st_super', name: 'Super', amount: 5300 },
  ],
  SHOWMAX: [
    { code: 'showmax_mobile', name: 'Mobile', amount: 1200 },
    { code: 'showmax_standard', name: 'Standard', amount: 2500 },
  ],
};

// ─── Helper Functions ──────────────────────────────────────────────────────────
const generateToken = () => {
  return Array.from({ length: 20 }, () => Math.floor(Math.random() * 10))
    .join('')
    .replace(/(.{4})/g, '$1-')
    .slice(0, -1);
};

const getProviderLogo = (category, providerCode) => {
  const provider = PROVIDERS[category]?.find(p => p.code === providerCode);
  return provider?.logo || '📦';
};

const getProviderColor = (category, providerCode) => {
  const provider = PROVIDERS[category]?.find(p => p.code === providerCode);
  return provider?.color || '#6366F1';
};

// ─── Controller Functions ──────────────────────────────────────────────────────

// GET /api/bills/providers/:category
exports.getProviders = (req, res) => {
  const { category } = req.params;
  const list = PROVIDERS[category];
  if (!list) {
    return res.status(400).json({ success: false, message: 'Unknown category' });
  }
  res.json({ success: true, data: list });
};

// GET /api/bills/plans/:category/:providerCode
exports.getPlans = (req, res) => {
  const { category, providerCode } = req.params;
  let plans = null;
  
  if (category === 'data') {
    plans = DATA_PLANS[providerCode?.toUpperCase()] || [];
  } else if (category === 'tv') {
    plans = TV_PLANS[providerCode?.toUpperCase()] || [];
  }
  
  res.json({ success: true, data: plans || [] });
};

// POST /api/bills/verify-recipient
exports.verifyRecipient = async (req, res) => {
  try {
    const { category, provider, recipient } = req.body;

    if (!recipient || recipient.length < 6) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid recipient identifier' 
      });
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
    } else if (category === 'airtime' || category === 'data') {
      recipientName = 'MOBILE SUBSCRIBER';
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
    console.error('Verify recipient error:', err);
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

    // Get user with PIN field
    const user = await User.findById(userId).select('+transactionPin').session(session);
    if (!user) {
      throw new Error('User not found');
    }
    
    // Check if PIN is set
    if (!user.hasSetTransactionPin || !user.transactionPin) {
      await session.abortTransaction();
      return res.status(400).json({ 
        success: false, 
        message: 'Transaction PIN not set', 
        needsPinSetup: true 
      });
    }

    // Verify PIN
    const pinMatch = await bcrypt.compare(pin, user.transactionPin);
    if (!pinMatch) {
      await session.abortTransaction();
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid transaction PIN' 
      });
    }

    // Validate amount
    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) {
      throw new Error('Invalid amount');
    }

    const fee = 0;
    const totalDeducted = numAmount + fee;

    if (user.balance < totalDeducted) {
      await session.abortTransaction();
      return res.status(400).json({ 
        success: false, 
        message: 'Insufficient balance' 
      });
    }

    // Deduct balance
    const balanceBefore = user.balance;
    user.balance = parseFloat((user.balance - totalDeducted).toFixed(2));
    await user.save({ session });

    // Generate token for electricity
    const token = category === 'electricity' ? generateToken() : undefined;

    // Get provider details
    const providerInfo = PROVIDERS[category]?.find(p => p.code === provider);
    const providerName = providerInfo?.name || provider;
    const providerLogo = providerInfo?.logo || '📦';

    // Get plan details if applicable
    let planName = null;
    if (plan) {
      if (category === 'data') {
        planName = DATA_PLANS[provider]?.find(p => p.code === plan)?.name;
      } else if (category === 'tv') {
        planName = TV_PLANS[provider]?.find(p => p.code === plan)?.name;
      }
    }

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
        description: description || `${category.charAt(0).toUpperCase() + category.slice(1)} — ${providerName}`,
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
        providerName,
        providerLogo,
        plan: bill.plan,
        planName,
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
    res.status(500).json({ 
      success: false, 
      message: err.message || 'Payment failed. Please try again.' 
    });
  } finally {
    session.endSession();
  }
};

// GET /api/bills/history
exports.getBillHistory = async (req, res) => {
  try {
    const { page = 1, limit = 20, category } = req.query;
    const filter = { user: req.user._id };
    if (category && category !== 'all') {
      filter.category = category;
    }

    const [bills, total] = await Promise.all([
      Bill.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit))
        .lean(),
      Bill.countDocuments(filter),
    ]);

    // Enrich bills with provider info
    const enrichedBills = bills.map(bill => {
      const providerInfo = PROVIDERS[bill.category]?.find(p => p.code === bill.provider);
      return {
        ...bill,
        providerName: providerInfo?.name || bill.provider,
        providerLogo: providerInfo?.logo || '📦',
        providerColor: providerInfo?.color || '#6366F1',
      };
    });

    res.json({
      success: true,
      data: enrichedBills,
      total,
      page: Number(page),
      pages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error('Get bill history error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};