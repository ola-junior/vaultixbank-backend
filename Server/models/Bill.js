const mongoose = require('mongoose');

const billSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // ── Service category ──────────────────────────────────────────────────
    category: {
      type: String,
      required: true,
      enum: ['airtime', 'data', 'tv', 'electricity', 'water', 'education', 'betting', 'internet'],
    },

    // ── Provider / plan info ──────────────────────────────────────────────
    provider: { type: String, required: true },   // e.g. "MTN", "DSTV", "EKEDC"
    plan:     { type: String },                    // e.g. "1GB/7days", "Compact", "Prepaid"

    // ── Beneficiary info ──────────────────────────────────────────────────
    recipient: { type: String, required: true },  // phone / meter / smartcard / user ID
    recipientName: { type: String },              // resolved name (meter owner, etc.)

    // ── Transaction amounts ───────────────────────────────────────────────
    amount:    { type: Number, required: true, min: 0 },
    fee:       { type: Number, default: 0 },
    totalDeducted: { type: Number, required: true },

    // ── Status ────────────────────────────────────────────────────────────
    status: {
      type: String,
      enum: ['pending', 'successful', 'failed'],
      default: 'pending',
    },

    // ── Balance snapshot ──────────────────────────────────────────────────
    balanceBefore: { type: Number },
    balanceAfter:  { type: Number },

    // ── Reference numbers ────────────────────────────────────────────────
    reference:     { type: String, unique: true, sparse: true },
    providerRef:   { type: String },     // reference returned by aggregator

    // ── Token/PIN for electricity ─────────────────────────────────────────
    token: { type: String },

    // ── Optional note ─────────────────────────────────────────────────────
    description: { type: String, maxlength: 200 },
  },
  { timestamps: true }
);

// Auto-generate reference before save
billSchema.pre('save', function (next) {
  if (!this.reference) {
    const ts = Date.now().toString(36).toUpperCase();
    const rnd = Math.random().toString(36).slice(2, 7).toUpperCase();
    this.reference = `VTX-BILL-${ts}-${rnd}`;
  }
  next();
});

module.exports = mongoose.model('Bill', billSchema);