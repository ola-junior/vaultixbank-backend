const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const UserSchema = new mongoose.Schema({
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
  transactionPin: {
    type: String,
    select: false,
    default: null
  },
  hasSetTransactionPin: {
    type: Boolean,
    default: false
  },
  balance: {
    type: Number,
    default: 0,
    min: 0
  },
  accountNumber: {
    type: String,
    unique: true,
    required: true
  },
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
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  firebaseUid: {
    type: String,
    unique: true,
    sparse: true
  },
  emailVerificationToken: String,
  emailVerificationExpire: Date,
  googleId: String,
  facebookId: String,
  twitterId: String,
  authProvider: {
    type: String,
    enum: ['local', 'google', 'facebook', 'twitter'],
    default: 'local'
  },
  lastLogin: Date,
  createdAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

// Hash password before save
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password') || !this.password) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Hash transaction PIN before save
UserSchema.pre('save', async function(next) {
  if (!this.isModified('transactionPin') || !this.transactionPin) return next();
  const salt = await bcrypt.genSalt(10);
  this.transactionPin = await bcrypt.hash(this.transactionPin, salt);
  next();
});

// Sign JWT
UserSchema.methods.getSignedJwtToken = function() {
  return jwt.sign({ id: this._id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || '30d' });
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

// Generate account number
UserSchema.statics.generateAccountNumber = async function() {
  const accountNumber = Math.floor(1000000000 + Math.random() * 9000000000).toString();
  const existingUser = await this.findOne({ accountNumber });
  if (existingUser) return this.generateAccountNumber();
  return accountNumber;
};

module.exports = mongoose.model('User', UserSchema);