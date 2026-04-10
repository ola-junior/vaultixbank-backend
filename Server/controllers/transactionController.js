const Transaction = require('../models/Transaction');
const User = require('../models/User');
const mongoose = require('mongoose');
const { verifyBankAccount, getBankName } = require('../services/bankVerification');
const { 
  notifyTransaction, 
  notifyDeposit, 
  notifyWithdrawal 
} = require('../services/notificationService');

// @desc    Verify recipient account (Internal & External)
// @route   POST /api/transactions/verify-account
// @access  Private
exports.verifyAccount = async (req, res) => {
  try {
    const { accountNumber, bankCode, bankName } = req.body;
    
    console.log('🔍 Verifying account:', { accountNumber, bankCode });
    
    // Validate account number
    if (!accountNumber || accountNumber.length !== 10 || !/^\d+$/.test(accountNumber)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid account number. Must be 10 digits.'
      });
    }
    
    // Check if it's a Vaultix internal transfer
    const isVaultixBank = bankCode === 'VAULTIX' || bankCode === '000';
    
    if (isVaultixBank) {
      // INTERNAL TRANSFER - Search Vaultix database
      const recipient = await User.findOne({ accountNumber }).select('name accountNumber email');
      
      if (!recipient) {
        return res.status(404).json({
          success: false,
          message: 'Vaultix account not found. Please check the account number.'
        });
      }
      
      // Return recipient details
      return res.status(200).json({
        success: true,
        data: {
          accountName: recipient.name,
          accountNumber: recipient.accountNumber,
          bankName: 'Vaultix',
          isInternal: true
        }
      });
    }
    
    // EXTERNAL TRANSFER - Verify with Paystack
    const verificationResult = await verifyBankAccount(accountNumber, bankCode);
    
    if (!verificationResult.success) {
      return res.status(400).json({
        success: false,
        message: 'Could not verify account. Please check the details.'
      });
    }
    
    const accountData = verificationResult.data;
    
    return res.status(200).json({
      success: true,
      data: {
        accountName: accountData.accountName,
        accountNumber: accountData.accountNumber,
        bankName: accountData.bankName,
        isInternal: false,
        isFallback: verificationResult.isFallback || false
      }
    });
    
  } catch (err) {
    console.error('❌ Account verification error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error during account verification'
    });
  }
};

// @desc    Transfer money to another user
// @route   POST /api/transactions/transfer
// @access  Private
exports.transfer = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { recipientAccount, amount, description, pin, recipientBank, recipientName } = req.body;
    const senderId = req.user.id;

    console.log('💸 Transfer attempt:', { senderId, recipientAccount, amount, recipientBank });

    // Validate PIN
    if (!pin) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Transaction PIN is required'
      });
    }

    // Validate amount
    if (!amount || amount <= 0) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid amount'
      });
    }

    // Get sender details with PIN
    const sender = await User.findById(senderId).select('+transactionPin').session(session);
    if (!sender) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Sender account not found'
      });
    }

    // Check if sender has set transaction PIN
    if (!sender.hasSetTransactionPin) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Please set your transaction PIN first',
        needsPinSetup: true
      });
    }

    // Verify PIN
    const isPinValid = await sender.matchTransactionPin(pin);
    if (!isPinValid) {
      await session.abortTransaction();
      return res.status(401).json({
        success: false,
        message: 'Invalid transaction PIN'
      });
    }

    // Check if sender has sufficient balance
    if (sender.balance < amount) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Insufficient balance'
      });
    }

    // Check if it's an internal transfer (to Vaultix user)
    const isVaultixBank = recipientBank === 'VAULTIX' || recipientBank === '000';
    
    let recipient = null;
    let externalBankName = recipientBank;
    
    if (isVaultixBank) {
      // INTERNAL TRANSFER - Find recipient in database
      recipient = await User.findOne({ accountNumber: recipientAccount }).session(session);
      
      if (!recipient) {
        await session.abortTransaction();
        return res.status(404).json({
          success: false,
          message: 'Recipient Vaultix account not found'
        });
      }

      // Prevent self-transfer
      if (sender.accountNumber === recipient.accountNumber) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: 'Cannot transfer to your own account'
        });
      }
    } else {
      // EXTERNAL TRANSFER - Get bank display name using imported function
      externalBankName = getBankName(recipientBank);
    }

    // Deduct from sender
    sender.balance -= Number(amount);
    await sender.save({ session });

    let senderTransaction = null;
    let recipientTransaction = null;

    if (isVaultixBank && recipient) {
      // INTERNAL: Add to recipient balance
      recipient.balance += Number(amount);
      await recipient.save({ session });

      // Create transaction record for recipient (credit)
      recipientTransaction = await Transaction.create([{
        userId: recipient._id,
        type: 'credit',
        amount: amount,
        senderAccount: sender.accountNumber,
        senderName: sender.name,
        status: 'successful',
        description: description || `Transfer from ${sender.name}`,
        balanceAfter: recipient.balance
      }], { session });
    }

    // Create transaction record for sender (debit)
    const transactionDescription = isVaultixBank && recipient 
      ? (description || `Transfer to ${recipient.name}`)
      : (description || `Transfer to ${recipientName || externalBankName} - ${recipientAccount}`);

    senderTransaction = await Transaction.create([{
      userId: sender._id,
      type: 'debit',
      amount: amount,
      recipientAccount: recipientAccount,
      recipientName: isVaultixBank && recipient ? recipient.name : (recipientName || `${externalBankName} Account`),
      recipientBank: externalBankName,
      status: 'successful',
      description: transactionDescription,
      balanceAfter: sender.balance,
      isExternal: !isVaultixBank
    }], { session });

    await session.commitTransaction();
    
    // =============================================
    // CREATE NOTIFICATIONS
    // =============================================
    
    // Notify sender of debit
    const senderRecipientName = isVaultixBank && recipient ? recipient.name : (recipientName || `${externalBankName} Account`);
    await notifyTransaction(
      sender._id, 
      'debit', 
      amount, 
      senderRecipientName, 
      senderTransaction[0]._id
    );
    
    // Notify recipient of credit (only for internal transfers)
    if (isVaultixBank && recipient && recipientTransaction) {
      await notifyTransaction(
        recipient._id, 
        'credit', 
        amount, 
        sender.name, 
        recipientTransaction[0]._id
      );
    }
    
    console.log('✅ Transfer successful:', { 
      from: sender.accountNumber, 
      to: recipientAccount,
      bank: externalBankName,
      amount,
      isInternal: isVaultixBank
    });

    res.status(200).json({
      success: true,
      message: isVaultixBank 
        ? `Transfer to ${recipient.name} completed successfully!`
        : `Transfer to ${externalBankName} completed successfully!`,
      data: {
        transaction: senderTransaction[0],
        newBalance: sender.balance
      }
    });

  } catch (err) {
    await session.abortTransaction();
    console.error('❌ Transfer error:', err);
    res.status(500).json({
      success: false,
      message: err.message || 'Transfer failed'
    });
  } finally {
    session.endSession();
  }
};

// @desc    Deposit money (Simulated for demo)
// @route   POST /api/transactions/deposit
// @access  Private
exports.deposit = async (req, res) => {
  try {
    const { amount, description, pin, paymentMethod = 'simulated' } = req.body;
    const userId = req.user.id;

    console.log('💰 Simulated deposit:', { userId, amount, paymentMethod });

    // Validate PIN
    if (!pin) {
      return res.status(400).json({
        success: false,
        message: 'Transaction PIN is required'
      });
    }

    // Validate amount
    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid amount'
      });
    }

    // Limit simulated deposits to reasonable amounts
    if (amount > 1000000) {
      return res.status(400).json({
        success: false,
        message: 'Maximum deposit amount is ₦1,000,000'
      });
    }

    // Get user with PIN
    const user = await User.findById(userId).select('+transactionPin');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if user has set PIN
    if (!user.hasSetTransactionPin) {
      return res.status(400).json({
        success: false,
        message: 'Please set your transaction PIN first',
        needsPinSetup: true
      });
    }

    // Verify PIN
    const isPinValid = await user.matchTransactionPin(pin);
    if (!isPinValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid transaction PIN'
      });
    }

    // Add to balance (simulated)
    user.balance += Number(amount);
    await user.save();

    // Create transaction record
    const transaction = await Transaction.create({
      userId: user._id,
      type: 'credit',
      amount: amount,
      status: 'successful',
      description: description || `Deposit (${paymentMethod})`,
      balanceAfter: user.balance,
      reference: `SIM-${Date.now()}-${Math.random().toString(36).substring(7)}`
    });

    // Create notification
    await notifyDeposit(userId, amount);

    console.log('✅ Simulated deposit successful:', { userId, amount, newBalance: user.balance });

    res.status(200).json({
      success: true,
      message: 'Deposit successful (Demo Mode)',
      data: {
        transaction,
        newBalance: user.balance
      }
    });

  } catch (err) {
    console.error('❌ Deposit error:', err);
    res.status(500).json({
      success: false,
      message: err.message || 'Deposit failed'
    });
  }
};

// @desc    Withdraw money
// @route   POST /api/transactions/withdraw
// @access  Private
exports.withdraw = async (req, res) => {
  try {
    const { amount, description, pin } = req.body;
    const userId = req.user.id;

    console.log('💳 Withdraw attempt:', { userId, amount });

    // Validate PIN
    if (!pin) {
      return res.status(400).json({
        success: false,
        message: 'Transaction PIN is required'
      });
    }

    // Validate amount
    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid amount'
      });
    }

    // Get user with PIN
    const user = await User.findById(userId).select('+transactionPin');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if user has set PIN
    if (!user.hasSetTransactionPin) {
      return res.status(400).json({
        success: false,
        message: 'Please set your transaction PIN first',
        needsPinSetup: true
      });
    }

    // Verify PIN
    const isPinValid = await user.matchTransactionPin(pin);
    if (!isPinValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid transaction PIN'
      });
    }

    // Check if sufficient balance
    if (user.balance < amount) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient balance'
      });
    }

    // Deduct from balance
    user.balance -= Number(amount);
    await user.save();

    // Create transaction record
    const transaction = await Transaction.create({
      userId: user._id,
      type: 'debit',
      amount: amount,
      status: 'successful',
      description: description || 'Withdrawal',
      balanceAfter: user.balance
    });

    // =============================================
    // CREATE WITHDRAWAL NOTIFICATION
    // =============================================
    await notifyWithdrawal(userId, amount);

    console.log('✅ Withdrawal successful:', { userId, amount, newBalance: user.balance });

    res.status(200).json({
      success: true,
      message: 'Withdrawal successful',
      data: {
        transaction,
        newBalance: user.balance
      }
    });

  } catch (err) {
    console.error('❌ Withdrawal error:', err);
    res.status(500).json({
      success: false,
      message: err.message || 'Withdrawal failed'
    });
  }
};

// @desc    Get all transactions for user
// @route   GET /api/transactions
// @access  Private
exports.getTransactions = async (req, res) => {
  try {
    const userId = req.user.id;
    const { type, status, limit = 50, page = 1 } = req.query;

    // Build query
    const query = { userId: new mongoose.Types.ObjectId(userId) };

    if (type) {
      query.type = type;
    }
    
    if (status) {
      query.status = status;
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const transactions = await Transaction.find(query)
      .sort('-createdAt')
      .limit(parseInt(limit))
      .skip(skip);

    const total = await Transaction.countDocuments(query);

    res.status(200).json({
      success: true,
      count: transactions.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      data: transactions
    });

  } catch (err) {
    console.error('❌ Get transactions error:', err);
    res.status(500).json({
      success: false,
      message: err.message || 'Server Error'
    });
  }
};

// @desc    Get single transaction
// @route   GET /api/transactions/:id
// @access  Private
exports.getTransaction = async (req, res) => {
  try {
    const transaction = await Transaction.findOne({
      _id: req.params.id,
      userId: req.user.id
    });

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    res.status(200).json({
      success: true,
      data: transaction
    });

  } catch (err) {
    console.error('❌ Get transaction error:', err);
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};

// @desc    Get transaction summary
// @route   GET /api/transactions/summary
// @access  Private
exports.getTransactionSummary = async (req, res) => {
  try {
    const userId = req.user.id;
    
    console.log('📊 Getting transaction summary for user:', userId);
    
    // Get all successful transactions for this user
    const transactions = await Transaction.find({ 
      userId: new mongoose.Types.ObjectId(userId),
      status: 'successful'
    });
    
    console.log(`📈 Found ${transactions.length} successful transactions`);
    
    // Calculate totals
    let totalCredits = 0;
    let totalDebits = 0;
    let creditCount = 0;
    let debitCount = 0;
    
    transactions.forEach(t => {
      if (t.type === 'credit') {
        totalCredits += t.amount;
        creditCount++;
      } else if (t.type === 'debit') {
        totalDebits += t.amount;
        debitCount++;
      }
    });
    
    const summary = {
      credits: totalCredits,
      debits: totalDebits,
      creditCount: creditCount,
      debitCount: debitCount,
      totalTransactions: creditCount + debitCount
    };
    
    console.log('✅ Summary calculated:', summary);
    
    res.status(200).json({
      success: true,
      data: summary
    });
  } catch (err) {
    console.error('❌ Summary error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error: ' + err.message
    });
  }
};