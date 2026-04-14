const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const securityController = require('../controllers/securityController');

// PIN routes
router.get('/has-pin', auth, securityController.hasPin);
router.post('/set-pin', auth, securityController.setPin);
router.post('/change-pin', auth, securityController.changePin);

// Password routes
router.put('/change-password', auth, securityController.changePassword);

// 2FA routes
router.post('/2fa/enable', auth, securityController.enable2FA);
router.post('/2fa/verify', auth, securityController.verify2FA);
router.post('/2fa/disable', auth, securityController.disable2FA);

// Security info
router.get('/security-info', auth, securityController.getSecurityInfo);

// Session management
router.get('/sessions', auth, securityController.getSessions);
router.delete('/sessions/:sessionId', auth, securityController.logoutSession);
router.post('/logout-all', auth, securityController.logoutAllDevices);

module.exports = router;