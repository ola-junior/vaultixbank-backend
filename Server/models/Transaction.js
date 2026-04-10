const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['credit', 'debit'],
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  recipientAccount: {
    type: String
  },
  recipientName: {
    type: String
  },
  recipientBank: {
    type: String
  },
  senderAccount: {
    type: String
  },
  senderName: {
    type: String
  },
  status: {
    type: String,
    enum: ['pending', 'successful', 'failed'],
    default: 'successful'
  },
  description: {
    type: String,
    default: ''
  },
  reference: {
    type: String,
    unique: true
  },
  balanceAfter: {
    type: Number
  },
  isExternal: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Generate transaction reference
TransactionSchema.pre('save', function(next) {
  if (!this.reference) {
    this.reference = 'TRX' + Date.now() + Math.floor(Math.random() * 1000);
  }
  next();
});

module.exports = mongoose.model('Transaction', TransactionSchema);