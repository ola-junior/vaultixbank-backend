const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: [
      'transaction',      // Money sent/received
      'deposit',          // Deposit completed
      'withdrawal',       // Withdrawal completed
      'security',         // Security alerts
      'login',           // Login attempts
      'profile',         // Profile updates
      'system',          // System announcements
      'promotion'        // Promotional offers
    ],
    required: true
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  amount: {
    type: Number
  },
  transactionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transaction'
  },
  isRead: {
    type: Boolean,
    default: false
  },
  icon: {
    type: String,
    default: '🔔'
  },
  actionUrl: {
    type: String
  },
  metadata: {
    type: Object
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for faster queries
NotificationSchema.index({ userId: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, isRead: 1 });

module.exports = mongoose.model('Notification', NotificationSchema);