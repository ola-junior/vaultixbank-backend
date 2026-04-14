const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');

// Import user controllers
const { 
  getProfile, 
  updateProfile, 
  uploadProfilePicture,
  deleteProfilePicture,
  setTransactionPin,
  changeTransactionPin,
  verifyTransactionPin,
  hasTransactionPin,
  changePassword
} = require('../controllers/userController');

// Import security controllers
const {
  enable2FA,
  verify2FA,
  disable2FA,
  getSecurityInfo,
  getSessions,
  logoutSession,
  logoutAllDevices,
  generateBackupCodes
} = require('../controllers/securityController');

// All routes require authentication
router.use(protect);

// =============================================
// PROFILE ROUTES
// =============================================
router.route('/profile')
  .get(getProfile)
  .put(updateProfile);

router.post('/profile-picture', uploadProfilePicture);
router.delete('/profile-picture', deleteProfilePicture);

// =============================================
// TRANSACTION PIN ROUTES
// =============================================
router.post('/set-pin', setTransactionPin);
router.put('/change-pin', changeTransactionPin);
router.post('/verify-pin', verifyTransactionPin);
router.get('/has-pin', hasTransactionPin);

// =============================================
// PASSWORD MANAGEMENT
// =============================================
router.put('/change-password', changePassword);

// =============================================
// TWO-FACTOR AUTHENTICATION (2FA)
// =============================================
router.post('/2fa/enable', enable2FA);
router.post('/2fa/verify', verify2FA);
router.post('/2fa/disable', disable2FA);
router.post('/2fa/backup-codes', generateBackupCodes);

// =============================================
// SECURITY INFO
// =============================================
router.get('/security-info', getSecurityInfo);

// =============================================
// SESSION MANAGEMENT
// =============================================
router.get('/sessions', getSessions);
router.delete('/sessions/:sessionId', logoutSession);
router.post('/logout-all', logoutAllDevices);

module.exports = router;