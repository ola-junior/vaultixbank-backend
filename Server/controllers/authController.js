const User = require('../models/User');

// =============================================
// REGISTRATION
// =============================================

exports.register = async (req, res) => {
  try {
    const { name, email, password, phoneNumber, firebaseUid } = req.body;

    console.log('📝 Backend registration:', { name, email });

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(200).json({ success: true, message: 'User already exists' });
    }

    const accountNumber = await User.generateAccountNumber();

    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: password || undefined,
      phoneNumber: phoneNumber || '',
      accountNumber,
      balance: 0,
      firebaseUid: firebaseUid || undefined,
      isEmailVerified: false
    });

    console.log('✅ Backend user created:', { id: user._id, email: user.email });

    res.status(201).json({ success: true, message: 'User created successfully' });
  } catch (err) {
    console.error('❌ Registration error:', err);
    if (err.code === 11000) {
      return res.status(200).json({ success: true, message: 'User already exists' });
    }
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// =============================================
// LOGIN
// =============================================

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    console.log('🔐 Backend login:', { email });

    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    if (!user.isEmailVerified) {
      user.isEmailVerified = true;
      await user.save();
    }

    if (user.password) {
      const isMatch = await user.matchPassword(password);
      if (!isMatch) {
        return res.status(401).json({ success: false, message: 'Invalid credentials' });
      }
    }

    user.lastLogin = Date.now();
    await user.save({ validateBeforeSave: false });

    const token = user.getSignedJwtToken();

    console.log('✅ Backend login successful:', user.email);

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
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// =============================================
// GET CURRENT USER
// =============================================

exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    
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
// OAUTH LOGIN (Firebase)
// =============================================

exports.oauthLogin = async (req, res) => {
  try {
    const { email, name, profilePicture, provider, providerId } = req.body;
    
    console.log(`🔐 OAuth login: ${provider}`, { email, name });
    
    if (!email || !name || !provider || !providerId) {
      return res.status(400).json({ success: false, message: 'Missing OAuth data' });
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
      console.log('✅ New OAuth user:', user.email);
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
    console.error('❌ OAuth error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// =============================================
// EMAIL VERIFICATION (Legacy)
// =============================================

exports.verifyEmail = async (req, res) => {
  try {
    const { token } = req.params;
    const crypto = require('crypto');
    const emailVerificationToken = crypto.createHash('sha256').update(token).digest('hex');
    
    const user = await User.findOne({
      emailVerificationToken,
      emailVerificationExpire: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid or expired token' });
    }

    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpire = undefined;
    await user.save();

    const authToken = user.getSignedJwtToken();

    res.status(200).json({
      success: true,
      message: 'Email verified!',
      token: authToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        accountNumber: user.accountNumber,
        balance: user.balance,
        isEmailVerified: true
      }
    });
  } catch (err) {
    console.error('❌ Verification error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.resendVerification = async (req, res) => {
  res.status(200).json({ success: true, message: 'Use Firebase to resend verification' });
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