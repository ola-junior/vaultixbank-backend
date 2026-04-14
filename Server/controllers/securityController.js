const User = require('../models/User');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const crypto = require('crypto');

// @desc    Enable 2FA - Generate secret and QR code
// @route   POST /api/user/2fa/enable
// @access  Private
exports.enable2FA = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('+twoFactorSecret');
    
    if (user.twoFactorEnabled) {
      return res.status(400).json({
        success: false,
        message: '2FA is already enabled'
      });
    }
    
    // Generate secret
    const secret = speakeasy.generateSecret({
      name: `Vaultix:${user.email}`,
      length: 20
    });
    
    user.twoFactorSecret = secret.base32;
    await user.save();
    
    // Generate QR code
    const qrCode = await QRCode.toDataURL(secret.otpauth_url);
    
    res.json({
      success: true,
      qrCode,
      secret: secret.base32
    });
  } catch (error) {
    console.error('❌ Enable 2FA error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Verify and activate 2FA
// @route   POST /api/user/2fa/verify
// @access  Private
exports.verify2FA = async (req, res) => {
  try {
    const { token, secret } = req.body;
    const user = await User.findById(req.user.id).select('+twoFactorSecret');
    
    if (user.twoFactorEnabled) {
      return res.status(400).json({
        success: false,
        message: '2FA is already enabled'
      });
    }
    
    if (!token || token.length !== 6) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid 6-digit code'
      });
    }
    
    // Verify TOTP token
    const verified = speakeasy.totp.verify({
      secret: secret || user.twoFactorSecret,
      encoding: 'base32',
      token,
      window: 1
    });
    
    if (!verified) {
      return res.status(400).json({
        success: false,
        message: 'Invalid verification code'
      });
    }
    
    // Generate backup codes
    const backupCodes = [];
    for (let i = 0; i < 8; i++) {
      backupCodes.push(crypto.randomBytes(4).toString('hex').toUpperCase());
    }
    
    user.twoFactorEnabled = true;
    user.twoFactorBackupCodes = backupCodes.map(code => ({ code, used: false }));
    await user.save();
    
    console.log('✅ 2FA enabled for user:', user.email);
    
    res.json({
      success: true,
      message: 'Two-factor authentication enabled successfully',
      backupCodes
    });
  } catch (error) {
    console.error('❌ Verify 2FA error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Disable 2FA
// @route   POST /api/user/2fa/disable
// @access  Private
exports.disable2FA = async (req, res) => {
  try {
    const { token } = req.body;
    const user = await User.findById(req.user.id).select('+twoFactorSecret');
    
    if (!user.twoFactorEnabled) {
      return res.status(400).json({
        success: false,
        message: '2FA is not enabled'
      });
    }
    
    // Verify token before disabling
    if (token) {
      let verified = false;
      
      // Check if it's a backup code
      const backupCode = user.twoFactorBackupCodes?.find(c => c.code === token && !c.used);
      if (backupCode) {
        verified = true;
        backupCode.used = true;
      } else {
        // Verify TOTP token
        verified = speakeasy.totp.verify({
          secret: user.twoFactorSecret,
          encoding: 'base32',
          token,
          window: 1
        });
      }
      
      if (!verified) {
        return res.status(400).json({
          success: false,
          message: 'Invalid verification code'
        });
      }
    }
    
    user.twoFactorEnabled = false;
    user.twoFactorSecret = null;
    user.twoFactorBackupCodes = [];
    await user.save();
    
    console.log('✅ 2FA disabled for user:', user.email);
    
    res.json({
      success: true,
      message: 'Two-factor authentication disabled'
    });
  } catch (error) {
    console.error('❌ Disable 2FA error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get security info
// @route   GET /api/user/security-info
// @access  Private
exports.getSecurityInfo = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    res.json({
      success: true,
      data: {
        twoFactorEnabled: user.twoFactorEnabled || false,
        hasPin: user.hasSetTransactionPin || false,
        isEmailVerified: user.isEmailVerified || false,
        passwordUpdatedAt: user.passwordUpdatedAt,
        lastLogin: user.lastLogin,
        sessions: user.sessions?.length || 0
      }
    });
  } catch (error) {
    console.error('❌ Get security info error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get active sessions
// @route   GET /api/user/sessions
// @access  Private
exports.getSessions = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    const sessions = (user.sessions || []).map(session => ({
      id: session._id,
      device: session.device || 'Unknown Device',
      browser: session.browser || 'Unknown Browser',
      location: session.location || 'Unknown Location',
      lastActive: session.lastActive,
      current: session.token === req.token
    }));
    
    res.json({
      success: true,
      sessions
    });
  } catch (error) {
    console.error('❌ Get sessions error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Logout from specific session
// @route   DELETE /api/user/sessions/:sessionId
// @access  Private
exports.logoutSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const user = await User.findById(req.user.id);
    
    // Don't allow logging out current session
    const session = user.sessions?.find(s => s._id.toString() === sessionId);
    if (session && session.token === req.token) {
      return res.status(400).json({
        success: false,
        message: 'Cannot logout current session. Use logout instead.'
      });
    }
    
    user.sessions = user.sessions?.filter(s => s._id.toString() !== sessionId) || [];
    await user.save();
    
    res.json({
      success: true,
      message: 'Device logged out successfully'
    });
  } catch (error) {
    console.error('❌ Logout session error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Logout from all devices
// @route   POST /api/user/logout-all
// @access  Private
exports.logoutAllDevices = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    // Keep only current session
    user.sessions = user.sessions?.filter(s => s.token === req.token) || [];
    await user.save();
    
    res.json({
      success: true,
      message: 'Logged out from all other devices'
    });
  } catch (error) {
    console.error('❌ Logout all error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Generate new backup codes
// @route   POST /api/user/2fa/backup-codes
// @access  Private
exports.generateBackupCodes = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (!user.twoFactorEnabled) {
      return res.status(400).json({
        success: false,
        message: '2FA is not enabled'
      });
    }
    
    // Generate new backup codes
    const backupCodes = [];
    for (let i = 0; i < 8; i++) {
      backupCodes.push(crypto.randomBytes(4).toString('hex').toUpperCase());
    }
    
    user.twoFactorBackupCodes = backupCodes.map(code => ({ code, used: false }));
    await user.save();
    
    res.json({
      success: true,
      backupCodes
    });
  } catch (error) {
    console.error('❌ Generate backup codes error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};