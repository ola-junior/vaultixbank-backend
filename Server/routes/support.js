const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  submitTicket,
  getUserTickets,
  getTicketDetails,
  replyToTicket,
  closeTicket,
  getTicketStats
} = require('../controllers/supportController');

// All routes require authentication
router.use(protect);

// Ticket management
router.post('/contact', submitTicket);
router.get('/tickets', getUserTickets);
router.get('/stats', getTicketStats);
router.get('/tickets/:ticketId', getTicketDetails);
router.post('/tickets/:ticketId/reply', replyToTicket);
router.put('/tickets/:ticketId/close', closeTicket);

module.exports = router;