const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const SessionSchema = new mongoose.Schema({
  device: {
    type: String,
    required: true
  },
  browser: String,
  os: String,
  location: {
    type: String,
    default: 'Unknown'
  },
  ip: String,
  userAgent: String,
  token: String,
  lastActive: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const SavingsSchema = new mongoose.Schema({
  planId: {
    type: String,
    required: true
  },
  planName: {
    type: String,
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  interestRate: {
    type: Number,
    required: true
  },
  lockPeriod: {
    type: Number,
    default: 0
  },
  startDate: {
    type: Date,
    default: Date.now
  },
  maturityDate: {
    type: Date
  },
  status: {
    type: String,
    enum: ['active', 'matured', 'withdrawn'],
    default: 'active'
  },
  withdrawalDate: Date,
  interestEarned: {
    type: Number,
    default: 0
  }
});

const LoanSchema = new mongoose.Schema({
  planId: {
    type: String,
    required: true
  },
  planName: {
    type: String,
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  interestRate: {
    type: Number,
    required: true
  },
  tenure: {
    type: Number,
    required: true
  },
  startDate: {
    type: Date,
    default: Date.now
  },
  dueDate: {
    type: Date
  },
  status: {
    type: String,
    enum: ['active', 'paid', 'overdue', 'defaulted'],
    default: 'active'
  },
  amountRepaid: {
    type: Number,
    default: 0
  },
  totalRepayable: {
    type: Number
  },
  repaymentDate: Date
});

const DonationSchema = new mongoose.Schema({
  cause: {
    type: String,
    default: 'General Support'
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  program: {
    type: String,
    default: 'Play4AChild'
  },
  date: {
    type: Date,
    default: Date.now
  },
  reference: String
});

const InsuranceSchema = new mongoose.Schema({
  planId: {
    type: String,
    required: true
  },
  planName: {
    type: String,
    required: true
  },
  premium: {
    type: Number,
    required: true
  },
  coverage: String,
  startDate: {
    type: Date,
    default: Date.now
  },
  expiryDate: Date,
  status: {
    type: String,
    enum: ['active', 'expired', 'cancelled'],
    default: 'active'
  },
  policyNumber: String,
  quoteRef: String
});

const UserSchema = new mongoose.Schema({
  // Basic Info
  name: {
    type: String,
    required: [true, 'Please add a name'],
    trim: true,
    maxlength: [50, 'Name cannot be more than 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Please add an email'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please add a valid email']
  },
  password: {
    type: String,
    minlength: 6,
    select: false
  },
  
  // Profile Info
  phoneNumber: {
    type: String,
    default: ''
  },
  address: {
    type: String,
    default: ''
  },
  profilePicture: {
    type: String,
    default: null
  },
  bannerImage: {
    type: String,
    default: null
  },
  
  // Account Info
  accountNumber: {
    type: String,
    unique: true,
    required: true
  },
  balance: {
    type: Number,
    default: 0,
    min: 0
  },
  accountType: {
    type: String,
    enum: ['Savings', 'Current', 'Premium Savings'],
    default: 'Premium Savings'
  },
  accountStatus: {
    type: String,
    enum: ['Active', 'Inactive', 'Suspended', 'Closed'],
    default: 'Active'
  },
  
  // Security Features
  transactionPin: {
    type: String,
    select: false,
    default: null
  },
  hasSetTransactionPin: {
    type: Boolean,
    default: false
  },
  twoFactorEnabled: {
    type: Boolean,
    default: false
  },
  twoFactorSecret: {
    type: String,
    select: false,
    default: null
  },
  twoFactorBackupCodes: [{
    code: String,
    used: {
      type: Boolean,
      default: false
    }
  }],
  
  // Email Verification
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  emailVerificationToken: String,
  emailVerificationExpire: Date,
  
  // Password Management
  passwordUpdatedAt: Date,
  passwordResetToken: String,
  passwordResetExpire: Date,
  
  // Session Management
  sessions: [SessionSchema],
  lastLogin: Date,
  loginAttempts: {
    type: Number,
    default: 0
  },
  lockUntil: Date,
  
  // Financial Features
  savings: [SavingsSchema],
  loans: [LoanSchema],
  donations: [DonationSchema],
  insurance: [InsuranceSchema],
  
  // OAuth
  firebaseUid: {
    type: String,
    unique: true,
    sparse: true
  },
  googleId: String,
  facebookId: String,
  twitterId: String,
  authProvider: {
    type: String,
    enum: ['local', 'google', 'facebook', 'twitter'],
    default: 'local'
  },
  
  // Device Info
  registeredDevices: [{
    deviceId: String,
    deviceName: String,
    trusted: {
      type: Boolean,
      default: false
    },
    lastUsed: Date
  }],
  
  // Notifications
  notificationPreferences: {
    email: {
      type: Boolean,
      default: true
    },
    push: {
      type: Boolean,
      default: true
    },
    sms: {
      type: Boolean,
      default: false
    },
    transactionAlerts: {
      type: Boolean,
      default: true
    },
    securityAlerts: {
      type: Boolean,
      default: true
    },
    marketingEmails: {
      type: Boolean,
      default: false
    }
  },
  
  createdAt: {
    type: Date,
    default: Date.now
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// =============================================
// VIRTUALS
// =============================================

// Virtual for full profile
UserSchema.virtual('profile').get(function() {
  return {
    name: this.name,
    email: this.email,
    phoneNumber: this.phoneNumber,
    address: this.address,
    profilePicture: this.profilePicture,
    bannerImage: this.bannerImage,
    accountNumber: this.accountNumber,
    accountType: this.accountType,
    accountStatus: this.accountStatus,
    isEmailVerified: this.isEmailVerified,
    twoFactorEnabled: this.twoFactorEnabled,
    hasPin: this.hasSetTransactionPin,
    createdAt: this.createdAt
  };
});

// Virtual for total savings
UserSchema.virtual('totalSavings').get(function() {
  return this.savings
    .filter(s => s.status === 'active')
    .reduce((total, s) => total + s.amount, 0);
});

// Virtual for total loans
UserSchema.virtual('totalLoans').get(function() {
  return this.loans
    .filter(l => l.status === 'active')
    .reduce((total, l) => total + l.amount, 0);
});

// Virtual for total donations
UserSchema.virtual('totalDonations').get(function() {
  return this.donations.reduce((total, d) => total + d.amount, 0);
});

// =============================================
// MIDDLEWARE
// =============================================

// Hash password before save
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password') || !this.password) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  this.passwordUpdatedAt = Date.now() - 1000;
  next();
});

// Hash transaction PIN before save
UserSchema.pre('save', async function(next) {
  if (!this.isModified('transactionPin') || !this.transactionPin) return next();
  const salt = await bcrypt.genSalt(10);
  this.transactionPin = await bcrypt.hash(this.transactionPin, salt);
  next();
});

// Calculate loan due dates and total repayable
UserSchema.pre('save', function(next) {
  if (this.isModified('loans')) {
    this.loans.forEach(loan => {
      if (!loan.dueDate) {
        loan.dueDate = new Date(Date.now() + loan.tenure * 24 * 60 * 60 * 1000);
      }
      if (!loan.totalRepayable) {
        const interest = (loan.amount * loan.interestRate) / 100;
        loan.totalRepayable = loan.amount + interest;
      }
    });
  }
  next();
});

// Calculate savings maturity dates
UserSchema.pre('save', function(next) {
  if (this.isModified('savings')) {
    this.savings.forEach(saving => {
      if (!saving.maturityDate && saving.lockPeriod > 0) {
        saving.maturityDate = new Date(Date.now() + saving.lockPeriod * 24 * 60 * 60 * 1000);
      }
    });
  }
  next();
});

// =============================================
// METHODS
// =============================================

// Sign JWT
UserSchema.methods.getSignedJwtToken = function() {
  return jwt.sign(
    { id: this._id }, 
    process.env.JWT_SECRET, 
    { expiresIn: process.env.JWT_EXPIRE || '30d' }
  );
};

// Match password
UserSchema.methods.matchPassword = async function(enteredPassword) {
  if (!this.password) return false;
  return await bcrypt.compare(enteredPassword, this.password);
};

// Match transaction PIN
UserSchema.methods.matchTransactionPin = async function(enteredPin) {
  if (!this.transactionPin) return false;
  return await bcrypt.compare(enteredPin, this.transactionPin);
};

// Generate email verification token
UserSchema.methods.getEmailVerificationToken = function() {
  const verificationToken = crypto.randomBytes(32).toString('hex');
  this.emailVerificationToken = crypto.createHash('sha256').update(verificationToken).digest('hex');
  this.emailVerificationExpire = Date.now() + 24 * 60 * 60 * 1000;
  return verificationToken;
};

// Generate password reset token
UserSchema.methods.getPasswordResetToken = function() {
  const resetToken = crypto.randomBytes(32).toString('hex');
  this.passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
  this.passwordResetExpire = Date.now() + 10 * 60 * 1000;
  return resetToken;
};

// Check if account is locked
UserSchema.methods.isLocked = function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
};

// Increment login attempts
UserSchema.methods.incrementLoginAttempts = async function() {
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $set: { loginAttempts: 1 },
      $unset: { lockUntil: 1 }
    });
  }
  
  const updates = { $inc: { loginAttempts: 1 } };
  
  if (this.loginAttempts + 1 >= 5 && !this.isLocked()) {
    updates.$set = { lockUntil: Date.now() + 30 * 60 * 1000 };
  }
  
  return this.updateOne(updates);
};

// Reset login attempts
UserSchema.methods.resetLoginAttempts = function() {
  return this.updateOne({
    $set: { loginAttempts: 0 },
    $unset: { lockUntil: 1 }
  });
};

// Add session
UserSchema.methods.addSession = async function(sessionData) {
  this.sessions.push(sessionData);
  
  if (this.sessions.length > 10) {
    this.sessions = this.sessions.slice(-10);
  }
  
  return this.save();
};

// Remove session
UserSchema.methods.removeSession = async function(sessionId) {
  this.sessions = this.sessions.filter(s => s._id.toString() !== sessionId);
  return this.save();
};

// Add savings
UserSchema.methods.addSavings = async function(savingsData) {
  this.savings.push(savingsData);
  return this.save();
};

// Add loan
UserSchema.methods.addLoan = async function(loanData) {
  this.loans.push(loanData);
  return this.save();
};

// Add donation
UserSchema.methods.addDonation = async function(donationData) {
  this.donations.push(donationData);
  return this.save();
};

// Add insurance
UserSchema.methods.addInsurance = async function(insuranceData) {
  this.insurance.push(insuranceData);
  return this.save();
};

// Get loan eligibility
UserSchema.methods.getLoanEligibility = function() {
  const accountAge = Date.now() - new Date(this.createdAt).getTime();
  const accountAgeDays = Math.floor(accountAge / (1000 * 60 * 60 * 24));
  
  // Check active loans
  const activeLoans = this.loans.filter(l => l.status === 'active');
  const hasDefaulted = this.loans.some(l => l.status === 'defaulted');
  
  if (hasDefaulted) {
    return { eligible: false, maxAmount: 0, reason: 'You have a defaulted loan' };
  }
  
  if (activeLoans.length >= 2) {
    return { eligible: false, maxAmount: 0, reason: 'Maximum active loans reached' };
  }
  
  let maxAmount = 50000;
  if (accountAgeDays > 30) maxAmount = 100000;
  if (accountAgeDays > 90) maxAmount = 500000;
  if (accountAgeDays > 180) maxAmount = 2000000;
  
  return { eligible: true, maxAmount, accountAgeDays };
};

// =============================================
// STATICS
// =============================================

// Generate account number
UserSchema.statics.generateAccountNumber = async function() {
  const prefix = '60';
  const accountNumber = prefix + Math.floor(10000000 + Math.random() * 90000000).toString();
  const existingUser = await this.findOne({ accountNumber });
  if (existingUser) return this.generateAccountNumber();
  return accountNumber;
};

// Generate backup codes for 2FA
UserSchema.methods.generateBackupCodes = function(count = 8) {
  const codes = [];
  for (let i = 0; i < count; i++) {
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();
    codes.push({ code, used: false });
  }
  this.twoFactorBackupCodes = codes;
  return codes.map(c => c.code);
};

module.exports = mongoose.model('User', UserSchema);