const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { isAdmin } = require('../middleware/admin');
const {
  submitTicket,
  getUserTickets,
  getTicketDetails,
  replyToTicket,
  closeTicket,
  getTicketStats,
  getAllTickets,
  updateTicketStatus,
  adminReply
} = require('../controllers/supportController');

// All routes require authentication
router.use(protect);

// User routes
router.post('/contact', submitTicket);
router.get('/tickets', getUserTickets);
router.get('/stats', getTicketStats);
router.get('/tickets/:ticketId', getTicketDetails);
router.post('/tickets/:ticketId/reply', replyToTicket);
router.put('/tickets/:ticketId/close', closeTicket);

// Admin routes
router.get('/admin/tickets', isAdmin, getAllTickets);
router.put('/admin/tickets/:ticketId', isAdmin, updateTicketStatus);
router.post('/admin/tickets/:ticketId/reply', isAdmin, adminReply);

module.exports = router;