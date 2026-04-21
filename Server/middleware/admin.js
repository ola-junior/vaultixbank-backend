const ADMIN_EMAILS = [
  'yxngalhaji02@gmail.com',  // Your email
  // Add more admin emails here if needed
];

exports.isAdmin = (req, res, next) => {
  const userEmail = req.user?.email;
  
  if (!userEmail) {
    return res.status(401).json({ 
      success: false, 
      message: 'Not authorized' 
    });
  }
  
  if (!ADMIN_EMAILS.includes(userEmail.toLowerCase())) {
    return res.status(403).json({ 
      success: false, 
      message: 'Admin access required' 
    });
  }
  
  next();
};