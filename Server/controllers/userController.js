const User = require('../models/User');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '..', 'uploads');
const profilesDir = path.join(uploadsDir, 'profiles');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
if (!fs.existsSync(profilesDir)) {
  fs.mkdirSync(profilesDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, profilesDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, 'profile-' + uniqueSuffix + ext);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);
  
  if (mimetype && extname) {
    cb(null, true);
  } else {
    cb(new Error('Only image files (jpeg, jpg, png, gif, webp) are allowed'));
  }
};

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: fileFilter
}).single('profilePicture');

// =============================================
// PROFILE CONTROLLERS
// =============================================

// @desc    Get user profile
// @route   GET /api/user/profile
// @access  Private
exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select('-__v -password -transactionPin -emailVerificationToken -emailVerificationExpire -passwordResetToken -passwordResetExpire');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: user
    });
  } catch (err) {
    console.error('❌ Get profile error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching profile'
    });
  }
};

// @desc    Update user profile
// @route   PUT /api/user/profile
// @access  Private
exports.updateProfile = async (req, res) => {
  try {
    const { name, phoneNumber, address, profilePicture, bannerImage } = req.body;
    
    // Validate name
    if (name !== undefined && (name.trim().length < 3 || name.trim().length > 50)) {
      return res.status(400).json({
        success: false,
        message: 'Name must be between 3 and 50 characters'
      });
    }
    
    // Validate phone number (if provided)
    if (phoneNumber && !/^[0-9]{10,15}$/.test(phoneNumber.replace(/\s/g, ''))) {
      return res.status(400).json({
        success: false,
        message: 'Invalid phone number format'
      });
    }
    
    const fieldsToUpdate = {};
    if (name !== undefined) fieldsToUpdate.name = name.trim();
    if (phoneNumber !== undefined) fieldsToUpdate.phoneNumber = phoneNumber.replace(/\s/g, '');
    if (address !== undefined) fieldsToUpdate.address = address.trim();
    if (profilePicture !== undefined) fieldsToUpdate.profilePicture = profilePicture;
    if (bannerImage !== undefined) fieldsToUpdate.bannerImage = bannerImage;
    
    // Check if there's anything to update
    if (Object.keys(fieldsToUpdate).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      fieldsToUpdate,
      {
        new: true,
        runValidators: true
      }
    ).select('-__v -password -transactionPin');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    console.log('✅ Profile updated for user:', user.email);

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: user
    });
  } catch (err) {
    console.error('❌ Update profile error:', err);
    
    // Handle duplicate key error
    if (err.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'This phone number is already in use'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error while updating profile'
    });
  }
};

// @desc    Upload profile picture
// @route   POST /api/user/profile-picture
// @access  Private
exports.uploadProfilePicture = (req, res) => {
  upload(req, res, async (err) => {
    if (err) {
      console.error('❌ Upload middleware error:', err.message);
      
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            success: false,
            message: 'File size exceeds 5MB limit'
          });
        }
      }
      
      return res.status(400).json({
        success: false,
        message: err.message
      });
    }
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Please select a file to upload'
      });
    }

    try {
      const user = await User.findById(req.user.id);
      
      if (!user) {
        // Clean up uploaded file
        try {
          fs.unlinkSync(req.file.path);
        } catch (cleanupErr) {
          console.warn('⚠️ Could not clean up file:', cleanupErr.message);
        }
        
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }
      
      // Delete old profile picture if not default
      if (user.profilePicture && user.profilePicture !== 'default-avatar.png') {
        const oldPath = path.join(profilesDir, user.profilePicture);
        if (fs.existsSync(oldPath)) {
          try {
            fs.unlinkSync(oldPath);
            console.log('🗑️ Deleted old profile picture:', user.profilePicture);
          } catch (unlinkErr) {
            console.warn('⚠️ Could not delete old profile picture:', unlinkErr.message);
          }
        }
      }

      // Update user with new profile picture
      user.profilePicture = req.file.filename;
      await user.save();

      console.log('✅ Profile picture uploaded for user:', user.email, '→', req.file.filename);

      res.status(200).json({
        success: true,
        message: 'Profile picture updated successfully',
        data: {
          profilePicture: user.profilePicture,
          url: `/uploads/profiles/${user.profilePicture}`
        }
      });
    } catch (error) {
      console.error('❌ Database error during upload:', error);
      
      // Clean up uploaded file on error
      try {
        if (req.file && fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
      } catch (cleanupErr) {
        console.warn('⚠️ Could not clean up file:', cleanupErr.message);
      }
      
      res.status(500).json({
        success: false,
        message: 'Server error while saving profile picture'
      });
    }
  });
};

// @desc    Delete profile picture (reset to default)
// @route   DELETE /api/user/profile-picture
// @access  Private
exports.deleteProfilePicture = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Delete current profile picture if not default
    if (user.profilePicture && user.profilePicture !== 'default-avatar.png') {
      const oldPath = path.join(profilesDir, user.profilePicture);
      if (fs.existsSync(oldPath)) {
        try {
          fs.unlinkSync(oldPath);
          console.log('🗑️ Deleted profile picture:', user.profilePicture);
        } catch (unlinkErr) {
          console.warn('⚠️ Could not delete profile picture:', unlinkErr.message);
        }
      }
    }
    
    // Reset to default
    user.profilePicture = 'default-avatar.png';
    await user.save();
    
    res.status(200).json({
      success: true,
      message: 'Profile picture removed successfully',
      data: {
        profilePicture: user.profilePicture
      }
    });
  } catch (err) {
    console.error('❌ Delete profile picture error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error while removing profile picture'
    });
  }
};

// =============================================
// TRANSACTION PIN CONTROLLERS
// =============================================

// @desc    Set or create transaction PIN
// @route   POST /api/user/set-pin
// @access  Private
exports.setTransactionPin = async (req, res) => {
  try {
    const { pin, confirmPin } = req.body;
    const userId = req.user.id;

    console.log('🔐 Set PIN attempt for user:', userId);

    // Validate PIN
    if (!pin || !confirmPin) {
      return res.status(400).json({
        success: false,
        message: 'Please provide PIN and confirmation'
      });
    }

    if (pin !== confirmPin) {
      return res.status(400).json({
        success: false,
        message: 'PINs do not match'
      });
    }

    if (pin.length !== 4 || !/^\d+$/.test(pin)) {
      return res.status(400).json({
        success: false,
        message: 'PIN must be exactly 4 digits'
      });
    }

    // Prevent common weak PINs
    const weakPins = ['0000', '1111', '2222', '3333', '4444', '5555', '6666', '7777', '8888', '9999', '1234'];
    if (weakPins.includes(pin)) {
      return res.status(400).json({
        success: false,
        message: 'Please choose a more secure PIN'
      });
    }

    // Get user
    const user = await User.findById(userId).select('+transactionPin');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if user already has a PIN
    if (user.hasSetTransactionPin) {
      return res.status(400).json({
        success: false,
        message: 'Transaction PIN already set. Use change PIN instead.'
      });
    }

    // Set the PIN
    user.transactionPin = pin;
    user.hasSetTransactionPin = true;
    await user.save({ validateBeforeSave: true });

    console.log('✅ PIN set successfully for user:', userId);

    res.status(200).json({
      success: true,
      message: 'Transaction PIN set successfully'
    });
  } catch (err) {
    console.error('❌ Set PIN error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error while setting PIN'
    });
  }
};

// @desc    Change transaction PIN
// @route   PUT /api/user/change-pin
// @access  Private
exports.changeTransactionPin = async (req, res) => {
  try {
    const { currentPin, newPin, confirmNewPin } = req.body;
    const userId = req.user.id;

    console.log('🔄 Change PIN attempt for user:', userId);

    // Validate input
    if (!currentPin || !newPin || !confirmNewPin) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields'
      });
    }

    if (newPin !== confirmNewPin) {
      return res.status(400).json({
        success: false,
        message: 'New PINs do not match'
      });
    }

    if (newPin.length !== 4 || !/^\d+$/.test(newPin)) {
      return res.status(400).json({
        success: false,
        message: 'PIN must be exactly 4 digits'
      });
    }

    // Prevent common weak PINs
    const weakPins = ['0000', '1111', '2222', '3333', '4444', '5555', '6666', '7777', '8888', '9999', '1234'];
    if (weakPins.includes(newPin)) {
      return res.status(400).json({
        success: false,
        message: 'Please choose a more secure PIN'
      });
    }

    // Cannot use same PIN
    if (currentPin === newPin) {
      return res.status(400).json({
        success: false,
        message: 'New PIN cannot be the same as current PIN'
      });
    }

    // Get user with PIN field
    const user = await User.findById(userId).select('+transactionPin');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (!user.hasSetTransactionPin) {
      return res.status(400).json({
        success: false,
        message: 'No transaction PIN set. Please set a PIN first.',
        needsSetup: true
      });
    }

    // Verify current PIN
    const isMatch = await user.matchTransactionPin(currentPin);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Current PIN is incorrect'
      });
    }

    // Update PIN
    user.transactionPin = newPin;
    await user.save({ validateBeforeSave: true });

    console.log('✅ PIN changed successfully for user:', userId);

    res.status(200).json({
      success: true,
      message: 'Transaction PIN changed successfully'
    });
  } catch (err) {
    console.error('❌ Change PIN error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error while changing PIN'
    });
  }
};

// @desc    Verify transaction PIN
// @route   POST /api/user/verify-pin
// @access  Private
exports.verifyTransactionPin = async (req, res) => {
  try {
    const { pin } = req.body;
    const userId = req.user.id;

    if (!pin) {
      return res.status(400).json({
        success: false,
        message: 'Please provide PIN'
      });
    }

    // Get user with PIN field
    const user = await User.findById(userId).select('+transactionPin');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (!user.hasSetTransactionPin) {
      return res.status(400).json({
        success: false,
        message: 'Transaction PIN not set',
        needsSetup: true
      });
    }

    // Verify PIN
    const isMatch = await user.matchTransactionPin(pin);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid PIN'
      });
    }

    res.status(200).json({
      success: true,
      message: 'PIN verified successfully'
    });
  } catch (err) {
    console.error('❌ Verify PIN error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error while verifying PIN'
    });
  }
};

// @desc    Check if user has set transaction PIN
// @route   GET /api/user/has-pin
// @access  Private
exports.hasTransactionPin = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('hasSetTransactionPin');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      hasPin: user.hasSetTransactionPin || false
    });
  } catch (err) {
    console.error('❌ Check PIN error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error while checking PIN status'
    });
  }
};

// =============================================
// PASSWORD MANAGEMENT
// =============================================

// @desc    Change password
// @route   PUT /api/user/change-password
// @access  Private
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmNewPassword } = req.body;
    const userId = req.user.id;

    // Validate input
    if (!currentPassword || !newPassword || !confirmNewPassword) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields'
      });
    }

    if (newPassword !== confirmNewPassword) {
      return res.status(400).json({
        success: false,
        message: 'New passwords do not match'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters'
      });
    }

    // Get user with password field
    const user = await User.findById(userId).select('+password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Verify current password
    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    console.log('✅ Password changed for user:', userId);

    res.status(200).json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (err) {
    console.error('❌ Change password error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error while changing password'
    });
  }
};