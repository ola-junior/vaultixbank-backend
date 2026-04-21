const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { isAdmin } = require('../middleware/admin'); // ✅ ADD THIS
const {
  submitTicket,
  getUserTickets,
  getTicketDetails,
  replyToTicket,
  closeTicket,
  getTicketStats,
  getAllTickets,        // ✅ Admin only
  updateTicketStatus,    // ✅ Admin only
  adminReply            // ✅ Admin only
} = require('../controllers/supportController');

// =============================================
// USER ROUTES (All authenticated users)
// =============================================
router.use(protect);

router.post('/contact', submitTicket);
router.get('/tickets', getUserTickets);
router.get('/stats', getTicketStats);
router.get('/tickets/:ticketId', getTicketDetails);
router.post('/tickets/:ticketId/reply', replyToTicket);
router.put('/tickets/:ticketId/close', closeTicket);

// =============================================
// ADMIN ROUTES (Admin only)
// =============================================
router.use('/admin', isAdmin); // ✅ Protect all admin routes

router.get('/admin/tickets', getAllTickets);
router.put('/admin/tickets/:ticketId', updateTicketStatus);
router.post('/admin/tickets/:ticketId/reply', adminReply);

module.exports = router;