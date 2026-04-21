const Contact = require('../models/Contact');
const User = require('../models/User');

// @desc    Submit contact/support ticket
// @route   POST /api/support/contact
// @access  Private
exports.submitTicket = async (req, res) => {
  try {
    const { subject, message, category } = req.body;
    const userId = req.user._id;
    const user = await User.findById(userId);

    if (!subject || !message) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please provide subject and message' 
      });
    }

    // Create ticket
    const ticket = await Contact.create({
      user: userId,
      name: user.name,
      email: user.email,
      category: category || 'general',
      subject,
      message,
      priority: category === 'security' || category === 'transaction' ? 'high' : 'medium',
      status: 'open'
    });

    console.log(`🎫 New Ticket: ${ticket.ticketId} | ${subject}`);

    res.json({
      success: true,
      message: 'Ticket submitted successfully!',
      data: {
        ticketId: ticket.ticketId,
        subject: ticket.subject,
        status: ticket.status,
        createdAt: ticket.createdAt
      }
    });

  } catch (err) {
    console.error('Submit ticket error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to submit ticket. Please try again.' 
    });
  }
};

// @desc    Get user's tickets
// @route   GET /api/support/tickets
// @access  Private
exports.getUserTickets = async (req, res) => {
  try {
    const tickets = await Contact.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .select('ticketId subject category status priority createdAt updatedAt replies');

    res.json({
      success: true,
      data: tickets,
      total: tickets.length
    });

  } catch (err) {
    console.error('Get tickets error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch tickets' 
    });
  }
};

// @desc    Get single ticket details
// @route   GET /api/support/tickets/:ticketId
// @access  Private
exports.getTicketDetails = async (req, res) => {
  try {
    const { ticketId } = req.params;
    
    const ticket = await Contact.findOne({ 
      ticketId, 
      user: req.user._id 
    });

    if (!ticket) {
      return res.status(404).json({ 
        success: false, 
        message: 'Ticket not found' 
      });
    }

    res.json({
      success: true,
      data: ticket
    });

  } catch (err) {
    console.error('Get ticket details error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch ticket details' 
    });
  }
};

// @desc    Reply to ticket
// @route   POST /api/support/tickets/:ticketId/reply
// @access  Private
exports.replyToTicket = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { message } = req.body;
    const user = await User.findById(req.user._id);

    if (!message) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please provide a message' 
      });
    }

    const ticket = await Contact.findOne({ 
      ticketId, 
      user: req.user._id 
    });

    if (!ticket) {
      return res.status(404).json({ 
        success: false, 
        message: 'Ticket not found' 
      });
    }

    if (ticket.status === 'closed') {
      return res.status(400).json({ 
        success: false, 
        message: 'Cannot reply to closed ticket' 
      });
    }

    ticket.replies.push({
      message,
      repliedBy: user.name,
      isAdmin: false
    });

    if (ticket.status === 'resolved') {
      ticket.status = 'in_progress';
    }

    await ticket.save();

    res.json({
      success: true,
      message: 'Reply added successfully',
      data: ticket.replies[ticket.replies.length - 1]
    });

  } catch (err) {
    console.error('Reply error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to add reply' 
    });
  }
};

// @desc    Close ticket
// @route   PUT /api/support/tickets/:ticketId/close
// @access  Private
exports.closeTicket = async (req, res) => {
  try {
    const { ticketId } = req.params;

    const ticket = await Contact.findOne({ 
      ticketId, 
      user: req.user._id 
    });

    if (!ticket) {
      return res.status(404).json({ 
        success: false, 
        message: 'Ticket not found' 
      });
    }

    ticket.status = 'closed';
    ticket.closedAt = new Date();
    await ticket.save();

    res.json({
      success: true,
      message: 'Ticket closed successfully'
    });

  } catch (err) {
    console.error('Close ticket error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to close ticket' 
    });
  }
};

// @desc    Get ticket statistics for user
// @route   GET /api/support/stats
// @access  Private
exports.getTicketStats = async (req, res) => {
  try {
    const stats = await Contact.aggregate([
      { $match: { user: req.user._id } },
      { $group: {
        _id: '$status',
        count: { $sum: 1 }
      }}
    ]);

    const total = await Contact.countDocuments({ user: req.user._id });

    const result = {
      total,
      open: 0,
      in_progress: 0,
      resolved: 0,
      closed: 0
    };

    stats.forEach(stat => {
      if (stat._id === 'open') result.open = stat.count;
      if (stat._id === 'in_progress') result.in_progress = stat.count;
      if (stat._id === 'resolved') result.resolved = stat.count;
      if (stat._id === 'closed') result.closed = stat.count;
    });

    res.json({
      success: true,
      data: result
    });

  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch statistics' 
    });
  }
};

// =============================================
// ADMIN FUNCTIONS
// =============================================

// @desc    Get ALL tickets (Admin only)
// @route   GET /api/support/admin/tickets
// @access  Admin
exports.getAllTickets = async (req, res) => {
  try {
    const tickets = await Contact.find()
      .sort({ createdAt: -1 })
      .populate('user', 'name email');

    // Statistics
    const stats = {
      total: tickets.length,
      open: tickets.filter(t => t.status === 'open').length,
      in_progress: tickets.filter(t => t.status === 'in_progress').length,
      resolved: tickets.filter(t => t.status === 'resolved').length,
      closed: tickets.filter(t => t.status === 'closed').length
    };

    res.json({ 
      success: true, 
      data: tickets,
      stats
    });

  } catch (err) {
    console.error('Admin get tickets error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch tickets: ' + err.message 
    });
  }
};

// @desc    Update ticket status (Admin only)
// @route   PUT /api/support/admin/tickets/:ticketId
// @access  Admin
exports.updateTicketStatus = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { status } = req.body;
    
    const ticket = await Contact.findOne({ ticketId });
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }
    
    ticket.status = status;
    
    if (status === 'resolved') ticket.resolvedAt = new Date();
    if (status === 'closed') ticket.closedAt = new Date();
    
    await ticket.save();
    
    res.json({ success: true, data: ticket });

  } catch (err) {
    console.error('Update ticket error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update ticket: ' + err.message 
    });
  }
};

// @desc    Admin reply to ticket
// @route   POST /api/support/admin/tickets/:ticketId/reply
// @access  Admin
exports.adminReply = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { message } = req.body;
    
    if (!message?.trim()) {
      return res.status(400).json({ success: false, message: 'Reply message required' });
    }
    
    const ticket = await Contact.findOne({ ticketId });
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }
    
    ticket.replies.push({
      message: message.trim(),
      repliedBy: 'Vaultix Support',
      isAdmin: true
    });
    
    if (ticket.status === 'open') {
      ticket.status = 'in_progress';
    }
    
    await ticket.save();
    
    res.json({ 
      success: true, 
      data: ticket.replies[ticket.replies.length - 1],
      ticketStatus: ticket.status
    });

  } catch (err) {
    console.error('Admin reply error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to send reply: ' + err.message 
    });
  }
};