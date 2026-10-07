const axios = require('axios');
const crypto = require('crypto');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const mongoose = require('mongoose');
const { verifyBankAccount, getBankName } = require('../services/bankVerification');
const { initiateTransfer } = require('../services/paystackTransfer');
const { 
  notifyTransaction, 
  notifyDeposit, 
  notifyWithdrawal 
} = require('../services/notificationService');

const verifyPaystackPayment = async (reference) => {
  const response = await axios.get(
    `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
    {
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 20000
    }
  );

  const payment = response.data;
  if (!payment?.status || !payment?.data) {
    throw new Error(payment?.message || 'Unable to verify payment.');
  }

  const paystackTransaction = payment.data;
  if (paystackTransaction.status !== 'success') {
    throw new Error(`Payment is not successful. Status: ${paystackTransaction.status}`);
  }
  if (paystackTransaction.reference !== reference) {
    throw new Error('Payment reference mismatch.');
  }
  if (paystackTransaction.currency && paystackTransaction.currency !== 'NGN') {
    throw new Error('Unsupported payment currency.');
  }

  const verifiedAmount = Number(paystackTransaction.amount || 0);
  if (!Number.isSafeInteger(verifiedAmount) || verifiedAmount <= 0) {
    throw new Error('Invalid payment amount returned by Paystack.');
  }

  return { paystackTransaction, verifiedAmount };
};

const creditPaystackDeposit = async ({ userId, paystackTransaction, description }) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const existingTransaction = await Transaction.findOne({
      reference: paystackTransaction.reference,
      provider: 'paystack',
      status: 'successful'
    }).session(session);

    if (existingTransaction) {
      const user = await User.findById(userId).session(session);
      await session.commitTransaction();
      return {
        duplicate: true,
        transaction: existingTransaction,
        user,
        amount: existingTransaction.amount
      };
    }

    const user = await User.findById(userId).session(session);
    if (!user) {
      throw new Error('User not found.');
    }

    const amount = paystackTransaction.amount / 100;
    user.balance += amount;
    await user.save({ session });

    const [transaction] = await Transaction.create([{
      userId: user._id,
      type: 'credit',
      amount,
      status: 'successful',
      description: description || 'Deposit via Paystack',
      balanceAfter: user.balance,
      reference: paystackTransaction.reference,
      provider: 'paystack'
    }], { session });

    await session.commitTransaction();
    return { duplicate: false, transaction, user, amount };
  } catch (error) {
    await session.abortTransaction();

    // Two fulfilment paths can race (frontend verification + webhook).
    // A unique Paystack reference means only one can create the credit.
    if (error?.code === 11000) {
      const existingTransaction = await Transaction.findOne({
        reference: paystackTransaction.reference,
        provider: 'paystack',
        status: 'successful'
      });
      if (existingTransaction) {
        const user = await User.findById(userId);
        return {
          duplicate: true,
          transaction: existingTransaction,
          user,
          amount: existingTransaction.amount
        };
      }
    }

    throw error;
  } finally {
    await session.endSession();
  }
};

const getWebhookUserId = async (payment) => {
  const customFields = payment.metadata?.custom_fields || [];
  const userIdField = customFields.find(
    (field) => field.variable_name === 'vaultix_user_id'
  );
  const userId = payment.metadata?.userId || userIdField?.value;

  if (userId) {
    const user = await User.findById(userId).select('_id');
    if (user) return user._id;
  }

  if (payment.customer?.email) {
    const user = await User.findOne({ email: payment.customer.email }).select('_id');
    if (user) return user._id;
  }

  return null;
};

const reconcilePaystackTransfer = async (event) => {
  const reference = event.data?.reference;
  if (!reference) return;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const transaction = await Transaction.findOne({
      reference,
      provider: 'paystack',
      isExternal: true
    }).session(session);

    if (!transaction) {
      await session.commitTransaction();
      return;
    }

    if (event.event === 'transfer.success') {
      if (transaction.status === 'pending') {
        transaction.status = 'successful';
        await transaction.save({ session });
      }
      await session.commitTransaction();
      return;
    }

    if (!['transfer.failed', 'transfer.reversed'].includes(event.event)) {
      await session.commitTransaction();
      return;
    }

    if (transaction.status !== 'pending') {
      await session.commitTransaction();
      return;
    }

    const user = await User.findById(transaction.userId).session(session);
    if (!user) throw new Error('Transfer owner not found while refunding transfer.');

    user.balance += transaction.amount;
    await user.save({ session });

    transaction.status = 'failed';
    await transaction.save({ session });

    await Transaction.create([{
      userId: user._id,
      type: 'credit',
      amount: transaction.amount,
      status: 'successful',
      description: `Refund for failed bank transfer ${reference}`,
      balanceAfter: user.balance,
      provider: 'paystack'
    }], { session });

    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    await session.endSession();
  }
};

const reconcileMonnifyTransfer = async (payload) => {
  const eventData = payload.eventData || payload.data || payload;
  const reference = eventData.transactionReference || eventData.paymentReference || eventData.reference;
  const status = String(eventData.status || payload.eventType || '').toUpperCase();

  if (!reference) return;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const transaction = await Transaction.findOne({
      reference,
      provider: 'monnify',
      isExternal: true
    }).session(session);

    if (!transaction || transaction.status !== 'pending') {
      await session.commitTransaction();
      return;
    }

    if (['SUCCESS', 'SUCCESSFUL', 'COMPLETED'].includes(status)) {
      transaction.status = 'successful';
      await transaction.save({ session });
      await session.commitTransaction();
      return;
    }

    if (!['FAILED', 'REVERSED', 'CANCELLED'].includes(status)) {
      await session.commitTransaction();
      return;
    }

    const user = await User.findById(transaction.userId).session(session);
    if (!user) throw new Error('Transfer owner not found while refunding Monnify transfer.');

    user.balance += transaction.amount;
    await user.save({ session });

    transaction.status = 'failed';
    await transaction.save({ session });

    await Transaction.create([{
      userId: user._id,
      type: 'credit',
      amount: transaction.amount,
      status: 'successful',
      description: `Refund for failed Monnify transfer ${reference}`,
      balanceAfter: user.balance,
      provider: 'monnify'
    }], { session });

    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    await session.endSession();
  }
};

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
        message: verificationResult.message || 'The account is not registered with the selected bank.'
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
    let paystackTransfer = null;
    
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
      if (!process.env.PAYSTACK_SECRET_KEY) {
        await session.abortTransaction();
        return res.status(503).json({
          success: false,
          message: 'Paystack is not configured on this server. Your balance was not debited.'
        });
      }

      externalBankName = getBankName(recipientBank);
      const transferReference = `VAULTIX-TRF-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;

      paystackTransfer = await initiateTransfer({
        accountNumber: recipientAccount,
        bankCode: recipientBank,
        accountName: recipientName,
        amount: Number(amount),
        reason: description || `Vaultix transfer to ${recipientName || externalBankName}`,
        reference: transferReference
      });
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
      status: paystackTransfer ? 'pending' : 'successful',
      description: transactionDescription,
      balanceAfter: sender.balance,
      isExternal: !isVaultixBank,
      provider: paystackTransfer ? 'paystack' : 'internal',
      reference: paystackTransfer?.reference || undefined
    }], { session });

    await session.commitTransaction();
    
    // =============================================
    // CREATE NOTIFICATIONS
    // =============================================
    
    // Notify sender of debit
    const senderRecipientName = isVaultixBank && recipient ? recipient.name : (recipientName || `${externalBankName} Account`);
    if (!paystackTransfer) {
      await notifyTransaction(
        sender._id,
        'debit',
        amount,
        senderRecipientName,
        senderTransaction[0]._id
      );
    }
    
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
        : `Transfer to ${externalBankName} was submitted to Paystack for processing.`,
      data: {
        transaction: senderTransaction[0],
        newBalance: sender.balance
      }
    });

  } catch (err) {
    await session.abortTransaction();
    console.error('❌ Transfer error:', err);
    const statusCode = err.response?.status || (err.message?.includes('not configured') ? 503 : 400);
    res.status(statusCode).json({
      success: false,
      message: err.response?.data?.message || err.message || 'Transfer failed'
    });
  } finally {
    session.endSession();
  }
};

// @desc    Deposit money via Paystack live gateway
// @route   POST /api/transactions/deposit
// @access  Private

exports.deposit = async (req, res) => {
  try {
    const { amount, description, pin, reference } = req.body;
    const userId = req.user.id;
    const requestedAmount = Number(amount);

    if (!process.env.PAYSTACK_SECRET_KEY) {
      return res.status(500).json({
        success: false,
        message: 'Paystack is not configured on the server.'
      });
    }

    if (!reference || typeof reference !== 'string' || reference.length > 200) {
      return res.status(400).json({
        success: false,
        message: 'A valid Paystack payment reference is required.'
      });
    }

    if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid deposit amount.'
      });
    }

    if (!pin) {
      return res.status(400).json({
        success: false,
        message: 'Transaction PIN is required.'
      });
    }

    const user = await User.findById(userId).select('+transactionPin');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    if (!user.hasSetTransactionPin) {
      return res.status(400).json({
        success: false,
        message: 'Please set your transaction PIN first.',
        needsPinSetup: true
      });
    }

    if (!(await user.matchTransactionPin(pin))) {
      return res.status(401).json({
        success: false,
        message: 'Invalid transaction PIN.'
      });
    }

    console.log('💰 Verifying Paystack payment:', {
      userId,
      amount: requestedAmount,
      reference
    });

    const { paystackTransaction, verifiedAmount } = await verifyPaystackPayment(reference);
    const expectedKobo = Math.round(requestedAmount * 100);

    if (verifiedAmount !== expectedKobo) {
      return res.status(400).json({
        success: false,
        message: `Payment amount mismatch. Expected ₦${requestedAmount.toLocaleString()}, received ₦${(verifiedAmount / 100).toLocaleString()}.`
      });
    }

    const result = await creditPaystackDeposit({
      userId,
      paystackTransaction,
      description: description || 'Deposit via Paystack'
    });

    if (!result.duplicate) {
      await notifyDeposit(userId, result.amount);
    }

    console.log(result.duplicate ? 'ℹ️ Paystack deposit was already credited.' : '✅ Paystack deposit successful:', {
      userId,
      amount: result.amount,
      reference: paystackTransaction.reference,
      newBalance: result.user.balance
    });

    return res.status(200).json({
      success: true,
      message: result.duplicate ? 'Deposit already credited.' : 'Deposit successful.',
      data: {
        transaction: result.transaction,
        newBalance: result.user.balance,
        gateway: 'paystack',
        duplicate: result.duplicate
      }
    });
  } catch (err) {
    console.error('❌ Paystack deposit error:', err.response?.data || err.message || err);
    const statusCode = err.response ? 502 : (err.statusCode || 400);
    return res.status(statusCode).json({
      success: false,
      message: err.response?.data?.message || err.message || 'Deposit failed.'
    });
  }
};

exports.paystackWebhook = async (req, res) => {
  try {
    if (!process.env.PAYSTACK_SECRET_KEY) return res.sendStatus(503);

    const signature = req.headers['x-paystack-signature'];
    const rawBody = Buffer.isBuffer(req.body)
      ? req.body
      : Buffer.from(JSON.stringify(req.body || {}));

    const expectedSignature = crypto
      .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
      .update(rawBody)
      .digest('hex');

    if (
      typeof signature !== 'string' ||
      signature.length !== expectedSignature.length ||
      !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))
    ) {
      console.warn('⚠️ Invalid Paystack webhook signature.');
      return res.sendStatus(401);
    }

    let event;
    try {
      event = JSON.parse(rawBody.toString('utf8'));
    } catch {
      return res.sendStatus(400);
    }

    if (event.event.startsWith('transfer.')) {
      await reconcilePaystackTransfer(event);
      return res.sendStatus(200);
    }

    // We only fulfil successful payments. Other events are acknowledged.
    if (event.event !== 'charge.success' || !event.data?.reference) {
      return res.sendStatus(200);
    }

    const { paystackTransaction } = await verifyPaystackPayment(event.data.reference);
    const userId = await getWebhookUserId(paystackTransaction);

    if (!userId) {
      console.error('❌ Paystack webhook user could not be resolved:', paystackTransaction.reference);
      return res.status(400).json({
        success: false,
        message: 'Payment user could not be resolved.'
      });
    }

    const result = await creditPaystackDeposit({
      userId,
      paystackTransaction,
      description: 'Deposit via Paystack'
    });

    if (!result.duplicate) {
      await notifyDeposit(userId, result.amount);
    }

    return res.sendStatus(200);
  } catch (err) {
    console.error('❌ Paystack webhook error:', err.response?.data || err.message || err);
    return res.sendStatus(500);
  }
};

exports.monnifyWebhook = async (req, res) => {
  try {
    const webhookSecret = process.env.MONNIFY_WEBHOOK_SECRET;
    const signature = req.headers['monnify-signature'] || req.headers['x-monnify-signature'];
    const rawBody = Buffer.isBuffer(req.body)
      ? req.body
      : Buffer.from(JSON.stringify(req.body || {}));

    if (!webhookSecret || typeof signature !== 'string') {
      return res.sendStatus(401);
    }

    const expectedSignature = crypto
      .createHmac('sha512', webhookSecret)
      .update(rawBody)
      .digest('hex');

    if (
      signature.length !== expectedSignature.length ||
      !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))
    ) {
      return res.sendStatus(401);
    }

    await reconcileMonnifyTransfer(JSON.parse(rawBody.toString('utf8')));
    return res.sendStatus(200);
  } catch (err) {
    console.error('❌ Monnify webhook error:', err.response?.data || err.message || err);
    return res.sendStatus(500);
  }
};

exports.withdraw = async (req, res) => {
  try {
    const { amount, description, pin } = req.body;
    const userId = req.user.id;
    const requestedAmount = Number(amount);
    if (!pin) return res.status(400).json({ success: false, message: 'Transaction PIN is required' });
    if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) return res.status(400).json({ success: false, message: 'Please enter a valid amount' });

    const user = await User.findById(userId).select('+transactionPin');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (!user.hasSetTransactionPin) return res.status(400).json({ success: false, message: 'Please set your transaction PIN first', needsPinSetup: true });
    if (!(await user.matchTransactionPin(pin))) return res.status(401).json({ success: false, message: 'Invalid transaction PIN' });
    if (user.balance < requestedAmount) return res.status(400).json({ success: false, message: 'Insufficient balance' });

    user.balance -= requestedAmount;
    await user.save();
    const transaction = await Transaction.create({
      userId: user._id,
      type: 'debit',
      amount: requestedAmount,
      status: 'successful',
      description: description || 'Withdrawal',
      balanceAfter: user.balance
    });
    await notifyWithdrawal(userId, requestedAmount);
    return res.status(200).json({ success: true, message: 'Withdrawal successful', data: { transaction, newBalance: user.balance } });
  } catch (err) {
    console.error('❌ Withdrawal error:', err);
    return res.status(500).json({ success: false, message: err.message || 'Withdrawal failed' });
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