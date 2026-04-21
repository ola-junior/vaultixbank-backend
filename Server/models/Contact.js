const mongoose = require('mongoose');

const ContactSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true
  },
  category: {
    type: String,
    enum: ['general', 'account', 'transaction', 'card', 'loan', 'security', 'feedback'],
    default: 'general'
  },
  subject: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'resolved', 'closed'],
    default: 'pending'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  assignedTo: {
    type: String,
    default: null
  },
  replies: [{
    message: String,
    repliedBy: String,
    repliedAt: {
      type: Date,
      default: Date.now
    },
    isAdmin: {
      type: Boolean,
      default: false
    }
  }],
  resolvedAt: Date,
  closedAt: Date,
  ticketId: {
    type: String,
    unique: true
  }
}, { timestamps: true });

// Generate ticket ID before save
ContactSchema.pre('save', async function(next) {
  if (!this.ticketId) {
    const count = await mongoose.model('Contact').countDocuments();
    this.ticketId = `TKT-${String(count + 1).padStart(6, '0')}`;
  }
  next();
});

module.exports = mongoose.model('Contact', ContactSchema);