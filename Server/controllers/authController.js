const User = require('../models/User');
const crypto = require('crypto');
const { sendVerificationEmail, sendWelcomeEmail } = require('../utils/sendEmail');

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res) => {
  try {
    const { name, email, password, phoneNumber } = req.body;

    console.log('📝 Registration attempt:', { name, email, phoneNumber });

    // Validate input
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide name, email and password'
      });
    }

    // Check if user exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email'
      });
    }

    // Generate account number
    const accountNumber = await User.generateAccountNumber();

    // Create user with 0 balance
    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password,
      phoneNumber: phoneNumber || '',
      accountNumber,
      balance: 0, // Start with 0 balance
      isEmailVerified: false
    });

    // Generate verification token
    const verificationToken = user.getEmailVerificationToken();
    await user.save({ validateBeforeSave: false });

    // Create verification URL
    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email/${verificationToken}`;

    // Send verification email
    try {
      if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
        await sendVerificationEmail(user, verificationUrl);
        console.log('📧 Verification email sent to:', user.email);
      }
    } catch (emailError) {
      console.error('❌ Failed to send verification email:', emailError);
    }

    console.log('✅ User created successfully:', { 
      id: user._id, 
      email: user.email, 
      accountNumber: user.accountNumber,
      balance: user.balance
    });

    res.status(201).json({
      success: true,
      message: 'Registration successful! Please check your email to verify your account.',
      verificationUrl: process.env.NODE_ENV === 'development' ? verificationUrl : undefined
    });
  } catch (err) {
    console.error('❌ Registration error:', err);
    
    if (err.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Email already exists'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error during registration'
    });
  }
};
// @desc    Verify email
// @route   GET /api/auth/verify-email/:token
// @access  Public
exports.verifyEmail = async (req, res) => {
  try {
    // Get hashed token
    const emailVerificationToken = crypto
      .createHash('sha256')
      .update(req.params.token)
      .digest('hex');

    const user = await User.findOne({
      emailVerificationToken,
      emailVerificationExpire: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired verification token'
      });
    }

    // Set email as verified
    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpire = undefined;
    await user.save();

    // Send welcome email
    try {
      await sendWelcomeEmail(user);
      console.log('📧 Welcome email sent to:', user.email);
    } catch (emailError) {
      console.error('❌ Failed to send welcome email:', emailError);
    }

    // Create token for auto-login
    const token = user.getSignedJwtToken();

    console.log('✅ Email verified for user:', user.email);

    res.status(200).json({
      success: true,
      message: 'Email verified successfully!',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        accountNumber: user.accountNumber,
        balance: user.balance,
        profilePicture: user.profilePicture,
        isEmailVerified: user.isEmailVerified
      }
    });
  } catch (err) {
    console.error('❌ Email verification error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error during email verification'
    });
  }
};

// @desc    Resend verification email
// @route   POST /api/auth/resend-verification
// @access  Public
exports.resendVerification = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (user.isEmailVerified) {
      return res.status(400).json({
        success: false,
        message: 'Email is already verified'
      });
    }

    // Generate new verification token
    const verificationToken = user.getEmailVerificationToken();
    await user.save({ validateBeforeSave: false });

    // Create verification URL
    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email/${verificationToken}`;

    // Send verification email
    try {
      await sendVerificationEmail(user, verificationUrl);
      console.log('📧 Verification email resent to:', user.email);
    } catch (emailError) {
      console.error('❌ Failed to resend verification email:', emailError);
    }

    res.status(200).json({
      success: true,
      message: 'Verification email resent successfully!',
      verificationUrl: process.env.NODE_ENV === 'development' ? verificationUrl : undefined
    });
  } catch (err) {
    console.error('❌ Resend verification error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    console.log('🔐 Login attempt:', { email });

    // Validate email & password
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide an email and password'
      });
    }

    // Check for user
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if email is verified
    if (!user.isEmailVerified) {
      return res.status(401).json({
        success: false,
        message: 'Please verify your email before logging in',
        needsVerification: true,
        email: user.email
      });
    }

    // Check if password matches
    const isMatch = await user.matchPassword(password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Update last login
    user.lastLogin = Date.now();
    await user.save({ validateBeforeSave: false });

    // Create token
    const token = user.getSignedJwtToken();

    console.log('✅ Login successful:', { email: user.email });

    res.status(200).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        accountNumber: user.accountNumber,
        balance: user.balance,
        profilePicture: user.profilePicture,
        phoneNumber: user.phoneNumber,
        isEmailVerified: user.isEmailVerified
      }
    });
  } catch (err) {
    console.error('❌ Login error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error during login'
    });
  }
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        accountNumber: user.accountNumber,
        balance: user.balance,
        profilePicture: user.profilePicture,
        phoneNumber: user.phoneNumber,
        address: user.address,
        isEmailVerified: user.isEmailVerified,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin
      }
    });
  } catch (err) {
    console.error('❌ Get me error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    OAuth login (Google, Facebook, Twitter via Firebase)
// @route   POST /api/auth/oauth-login
// @access  Public
exports.oauthLogin = async (req, res) => {
  try {
    const { email, name, profilePicture, provider, providerId } = req.body;
    
    console.log(`🔐 OAuth login attempt via ${provider}:`, { email, name });
    
    if (!email || !name || !provider || !providerId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required OAuth data'
      });
    }
    
    // Find or create user
    let user = await User.findOne({ email: email.toLowerCase() });
    
    if (!user) {
      // Create new user
      const accountNumber = await User.generateAccountNumber();
      
      user = await User.create({
        name,
        email: email.toLowerCase(),
        accountNumber,
        profilePicture: profilePicture || 'default-avatar.png',
        isEmailVerified: true, // OAuth emails are pre-verified
        authProvider: provider,
        balance: 0
      });
      
      // Set the appropriate provider ID
      if (provider === 'google') {
        user.googleId = providerId;
      } else if (provider === 'facebook') {
        user.facebookId = providerId;
      } else if (provider === 'twitter') {
        user.twitterId = providerId;
      }
      await user.save();
      
      console.log('✅ New user created via OAuth:', user.email);
    } else {
      // Update existing user with OAuth info if needed
      let updated = false;
      
      if (provider === 'google' && !user.googleId) {
        user.googleId = providerId;
        updated = true;
      } else if (provider === 'facebook' && !user.facebookId) {
        user.facebookId = providerId;
        updated = true;
      } else if (provider === 'twitter' && !user.twitterId) {
        user.twitterId = providerId;
        updated = true;
      }
      
      if (updated) {
        user.authProvider = provider;
        user.isEmailVerified = true;
        await user.save();
      }
      
      console.log('✅ Existing user logged in via OAuth:', user.email);
    }
    
    // Create token
    const token = user.getSignedJwtToken();
    
    res.status(200).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        accountNumber: user.accountNumber,
        balance: user.balance,
        profilePicture: user.profilePicture,
        phoneNumber: user.phoneNumber,
        isEmailVerified: user.isEmailVerified,
        authProvider: user.authProvider,
        hasSetTransactionPin: user.hasSetTransactionPin
      }
    });
  } catch (err) {
    console.error('❌ OAuth login error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error during OAuth login: ' + err.message
    });
  }
};

// @desc    Google OAuth callback
// @route   GET /api/auth/google/callback
// @access  Public
exports.googleCallback = (req, res) => {
  try {
    const token = req.user.getSignedJwtToken();
    
    // Redirect to frontend with token
    res.redirect(`${process.env.FRONTEND_URL}/oauth-success?token=${token}`);
  } catch (err) {
    console.error('Google callback error:', err);
    res.redirect(`${process.env.FRONTEND_URL}/login?error=oauth_failed`);
  }
};

// @desc    Facebook OAuth callback
// @route   GET /api/auth/facebook/callback
// @access  Public
exports.facebookCallback = (req, res) => {
  try {
    const token = req.user.getSignedJwtToken();
    res.redirect(`${process.env.FRONTEND_URL}/oauth-success?token=${token}`);
  } catch (err) {
    console.error('Facebook callback error:', err);
    res.redirect(`${process.env.FRONTEND_URL}/login?error=oauth_failed`);
  }
};

// @desc    Twitter OAuth callback
// @route   GET /api/auth/twitter/callback
// @access  Public
exports.twitterCallback = (req, res) => {
  try {
    const token = req.user.getSignedJwtToken();
    res.redirect(`${process.env.FRONTEND_URL}/oauth-success?token=${token}`);
  } catch (err) {
    console.error('Twitter callback error:', err);
    res.redirect(`${process.env.FRONTEND_URL}/login?error=oauth_failed`);
  }
};