const User = require('../models/User');
const crypto = require('crypto');
const { sendVerificationEmail, sendWelcomeEmail } = require('../utils/sendEmail');

// =============================================
// REGISTRATION & EMAIL VERIFICATION
// =============================================

exports.register = async (req, res) => {
  try {
    const { name, email, password, phoneNumber } = req.body;

    console.log('📝 Registration attempt:', { name, email, phoneNumber });

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide name, email and password' });
    }

    const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, message: 'Please provide a valid email address' });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'User already exists with this email' });
    }

    const accountNumber = await User.generateAccountNumber();

    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password,
      phoneNumber: phoneNumber ? phoneNumber.replace(/\s/g, '') : '',
      accountNumber,
      balance: 0,
      isEmailVerified: false
    });

    const verificationToken = user.getEmailVerificationToken();
    await user.save({ validateBeforeSave: false });

    const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify-email/${verificationToken}`;

    // Send email (don't await - let it run in background)
    sendVerificationEmail(user, verificationUrl).then(result => {
      if (result.success) {
        console.log('📧 Verification email sent to:', user.email);
      } else {
        console.log('⚠️ Email sending failed, but user created');
      }
    }).catch(err => {
      console.error('❌ Email error:', err.message);
    });

    console.log('✅ User created successfully:', { 
      id: user._id, 
      email: user.email, 
      accountNumber: user.accountNumber 
    });

    res.status(201).json({
      success: true,
      message: 'Registration successful! Please check your email to verify your account.',
      verificationUrl: process.env.NODE_ENV === 'development' ? verificationUrl : undefined
    });
  } catch (err) {
    console.error('❌ Registration error:', err);
    
    if (err.code === 11000) {
      return res.status(400).json({ success: false, message: 'Email already exists' });
    }
    
    res.status(500).json({ success: false, message: 'Server error during registration' });
  }
};

exports.verifyEmail = async (req, res) => {
  try {
    const { token } = req.params;
    
    if (!token) {
      return res.status(400).json({ success: false, message: 'Verification token is required' });
    }

    const emailVerificationToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      emailVerificationToken,
      emailVerificationExpire: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid or expired verification link. Please register again.' });
    }

    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpire = undefined;
    await user.save();

    // Send welcome email in background
    sendWelcomeEmail(user).catch(err => console.error('❌ Welcome email failed:', err.message));

    const authToken = user.getSignedJwtToken();

    console.log('✅ Email verified for user:', user.email);

    res.status(200).json({
      success: true,
      message: 'Email verified successfully! Redirecting to dashboard...',
      token: authToken,
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
    res.status(500).json({ success: false, message: 'Server error during email verification' });
  }
};

exports.resendVerification = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.status(404).json({ success: false, message: 'No account found with this email' });
    }

    if (user.isEmailVerified) {
      return res.status(400).json({ success: false, message: 'Email is already verified. You can login.' });
    }

    const verificationToken = user.getEmailVerificationToken();
    await user.save({ validateBeforeSave: false });

    const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify-email/${verificationToken}`;

    const emailResult = await sendVerificationEmail(user, verificationUrl);
    
    if (!emailResult.success) {
      return res.status(500).json({ success: false, message: 'Failed to send verification email. Please try again.' });
    }

    console.log('📧 Verification email resent to:', user.email);

    res.status(200).json({
      success: true,
      message: 'Verification email sent! Please check your inbox.',
      verificationUrl: process.env.NODE_ENV === 'development' ? verificationUrl : undefined
    });
  } catch (err) {
    console.error('❌ Resend verification error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// =============================================
// LOGIN & AUTHENTICATION
// =============================================

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    console.log('🔐 Login attempt:', { email });

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide email and password' });
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    if (!user.isEmailVerified) {
      return res.status(401).json({
        success: false,
        message: 'Please verify your email before logging in',
        needsVerification: true,
        email: user.email
      });
    }

    if (!user.password) {
      return res.status(401).json({ success: false, message: 'This account uses social login. Please sign in with Google or Facebook.' });
    }

    const isMatch = await user.matchPassword(password);

    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    user.lastLogin = Date.now();
    await user.save({ validateBeforeSave: false });

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
        isEmailVerified: user.isEmailVerified,
        hasSetTransactionPin: user.hasSetTransactionPin
      }
    });
  } catch (err) {
    console.error('❌ Login error:', err);
    res.status(500).json({ success: false, message: 'Server error during login' });
  }
};

exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
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
        hasSetTransactionPin: user.hasSetTransactionPin,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin
      }
    });
  } catch (err) {
    console.error('❌ Get me error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// =============================================
// OAUTH LOGIN (FIREBASE)
// =============================================

exports.oauthLogin = async (req, res) => {
  try {
    const { email, name, profilePicture, provider, providerId } = req.body;
    
    console.log(`🔐 OAuth login attempt via ${provider}:`, { email, name });
    
    if (!email || !name || !provider || !providerId) {
      return res.status(400).json({ success: false, message: 'Missing required OAuth data' });
    }
    
    let user = await User.findOne({ email: email.toLowerCase() });
    
    if (!user) {
      const accountNumber = await User.generateAccountNumber();
      
      user = await User.create({
        name: name.trim(),
        email: email.toLowerCase().trim(),
        accountNumber,
        profilePicture: profilePicture || 'default-avatar.png',
        isEmailVerified: true,
        authProvider: provider,
        balance: 0
      });
      
      if (provider === 'google') user.googleId = providerId;
      else if (provider === 'facebook') user.facebookId = providerId;
      else if (provider === 'twitter') user.twitterId = providerId;
      
      await user.save();
      console.log('✅ New user created via OAuth:', user.email);
    }
    
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
    res.status(500).json({ success: false, message: 'Server error during OAuth login' });
  }
};

// =============================================
// PASSPORT OAUTH CALLBACKS
// =============================================

exports.googleCallback = (req, res) => {
  try {
    if (!req.user) return res.redirect(`${process.env.FRONTEND_URL}/login?error=oauth_failed`);
    const token = req.user.getSignedJwtToken();
    res.redirect(`${process.env.FRONTEND_URL}/oauth-success?token=${token}`);
  } catch (err) {
    console.error('❌ Google callback error:', err);
    res.redirect(`${process.env.FRONTEND_URL}/login?error=oauth_failed`);
  }
};

exports.facebookCallback = (req, res) => {
  try {
    if (!req.user) return res.redirect(`${process.env.FRONTEND_URL}/login?error=oauth_failed`);
    const token = req.user.getSignedJwtToken();
    res.redirect(`${process.env.FRONTEND_URL}/oauth-success?token=${token}`);
  } catch (err) {
    console.error('❌ Facebook callback error:', err);
    res.redirect(`${process.env.FRONTEND_URL}/login?error=oauth_failed`);
  }
};

exports.twitterCallback = (req, res) => {
  try {
    if (!req.user) return res.redirect(`${process.env.FRONTEND_URL}/login?error=oauth_failed`);
    const token = req.user.getSignedJwtToken();
    res.redirect(`${process.env.FRONTEND_URL}/oauth-success?token=${token}`);
  } catch (err) {
    console.error('❌ Twitter callback error:', err);
    res.redirect(`${process.env.FRONTEND_URL}/login?error=oauth_failed`);
  }
};