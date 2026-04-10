const express = require('express');
const router = express.Router();
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
const { protect } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

// Profile routes
router.route('/profile')
  .get(getProfile)
  .put(updateProfile);

// Profile picture routes
router.post('/profile-picture', uploadProfilePicture);
router.delete('/profile-picture', deleteProfilePicture);

// Transaction PIN routes
router.post('/set-pin', setTransactionPin);
router.put('/change-pin', changeTransactionPin);
router.post('/verify-pin', verifyTransactionPin);
router.get('/has-pin', hasTransactionPin);

// Password management
router.put('/change-password', changePassword);

module.exports = router;