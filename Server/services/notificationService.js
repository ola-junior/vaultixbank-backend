const Notification = require('../models/Notification');

const createNotification = async (userId, data) => {
  try {
    const notification = await Notification.create({
      userId,
      type: data.type,
      title: data.title,
      message: data.message,
      amount: data.amount,
      transactionId: data.transactionId,
      icon: data.icon || getIconForType(data.type),
      actionUrl: data.actionUrl,
      metadata: data.metadata
    });
    
    console.log(`📧 Notification created for user ${userId}: ${data.title}`);
    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
    return null;
  }
};

const getIconForType = (type) => {
  const icons = {
    transaction: '💸',
    deposit: '💰',
    withdrawal: '💳',
    security: '🔒',
    login: '🔑',
    profile: '👤',
    system: '📢',
    promotion: '🎁'
  };
  return icons[type] || '🔔';
};

// Create transaction notification
const notifyTransaction = async (userId, type, amount, recipientName, transactionId) => {
  const isCredit = type === 'credit';
  const title = isCredit ? 'Money Received' : 'Money Sent';
  const message = isCredit 
    ? `You received ₦${amount.toLocaleString()} from ${recipientName}`
    : `You sent ₦${amount.toLocaleString()} to ${recipientName}`;
  
  return createNotification(userId, {
    type: 'transaction',
    title,
    message,
    amount,
    transactionId,
    icon: isCredit ? '💰' : '💸',
    actionUrl: `/transactions`
  });
};

// Create deposit notification
const notifyDeposit = async (userId, amount) => {
  return createNotification(userId, {
    type: 'deposit',
    title: 'Deposit Successful',
    message: `Your deposit of ₦${amount.toLocaleString()} was successful`,
    amount,
    icon: '💰',
    actionUrl: '/transactions'
  });
};

// Create withdrawal notification
const notifyWithdrawal = async (userId, amount) => {
  return createNotification(userId, {
    type: 'withdrawal',
    title: 'Withdrawal Successful',
    message: `Your withdrawal of ₦${amount.toLocaleString()} was successful`,
    amount,
    icon: '💳',
    actionUrl: '/transactions'
  });
};

// Create login notification
const notifyLogin = async (userId, device, location) => {
  return createNotification(userId, {
    type: 'login',
    title: 'New Login',
    message: `New login from ${device} in ${location}`,
    icon: '🔑',
    actionUrl: '/security',
    metadata: { device, location }
  });
};

// Create security alert
const notifySecurityAlert = async (userId, alert) => {
  return createNotification(userId, {
    type: 'security',
    title: 'Security Alert',
    message: alert,
    icon: '🔒',
    actionUrl: '/security'
  });
};

// Create PIN setup reminder
const notifyPinSetupReminder = async (userId) => {
  return createNotification(userId, {
    type: 'security',
    title: 'Secure Your Account',
    message: 'Set up a transaction PIN to protect your transfers',
    icon: '🔒',
    actionUrl: '/security'
  });
};

module.exports = {
  createNotification,
  notifyTransaction,
  notifyDeposit,
  notifyWithdrawal,
  notifyLogin,
  notifySecurityAlert,
  notifyPinSetupReminder
};