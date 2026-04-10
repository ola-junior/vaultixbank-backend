const nodemailer = require('nodemailer');

// Create email transporter
const createTransporter = async () => {
  try {
    // Check if email credentials exist
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.log('⚠️ Email credentials not configured. Using development mode.');
      return null;
    }

    // Clean password - remove any spaces
    const cleanPassword = process.env.EMAIL_PASS.replace(/\s+/g, '');

    console.log('📧 Setting up email transporter...');
    console.log('   Host:', process.env.EMAIL_HOST);
    console.log('   Port:', process.env.EMAIL_PORT);
    console.log('   User:', process.env.EMAIL_USER);
    console.log('   Password: ******');

    // Create transporter
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: parseInt(process.env.EMAIL_PORT),
      secure: false,
      requireTLS: true,
      auth: {
        user: process.env.EMAIL_USER,
        pass: cleanPassword,
      },
      tls: {
        rejectUnauthorized: false
      }
    });

    // Verify connection
    await transporter.verify();
    console.log('✅ Email transporter ready');
    
    return transporter;
  } catch (error) {
    console.error('❌ Failed to create email transporter:', error.message);
    return null;
  }
};

// Send email function
const sendEmail = async (options) => {
  try {
    const { email, subject, message, html } = options;

    console.log(`📧 Attempting to send email to: ${email}`);
    console.log(`   Subject: ${subject}`);

    const transporter = await createTransporter();

    if (!transporter) {
      console.log('⚠️ Email service unavailable - skipping email send');
      return { 
        success: false, 
        message: 'Email service not configured',
        skipped: true 
      };
    }

    // Email options
    const mailOptions = {
      from: `"BankApp" <${process.env.EMAIL_FROM || 'noreply@bankapp.com'}>`,
      to: email,
      subject: subject,
      text: message,
      html: html || message,
    };

    // Send email
    const info = await transporter.sendMail(mailOptions);
    
    console.log('✅ Email sent successfully!');
    console.log(`   Message ID: ${info.messageId}`);
    console.log(`   Response: ${info.response}`);
    
    return { 
      success: true, 
      messageId: info.messageId,
      response: info.response 
    };

  } catch (error) {
    console.error('❌ Email sending failed:');
    console.error('   Error:', error.message);
    console.error('   Code:', error.code);
    
    if (error.code === 'EAUTH') {
      console.error('   🔐 Authentication failed. Check your App Password.');
      console.error('   Make sure you are using an App Password, not your regular password.');
      console.error('   Generate one at: https://myaccount.google.com/apppasswords');
    } else if (error.code === 'ESOCKET') {
      console.error('   🌐 Network error. Check your internet connection.');
    } else if (error.code === 'ECONNREFUSED') {
      console.error('   🚫 Connection refused. Check EMAIL_HOST and EMAIL_PORT.');
    }
    
    return { 
      success: false, 
      error: error.message,
      code: error.code 
    };
  }
};

// Send verification email
const sendVerificationEmail = async (user, verificationUrl) => {
  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Verify Your Email</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          line-height: 1.6;
          color: #1f2937;
          margin: 0;
          padding: 0;
          background-color: #f3f4f6;
        }
        .container {
          max-width: 600px;
          margin: 20px auto;
          background: white;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .header {
          background: linear-gradient(135deg, #2563eb, #1e40af);
          color: white;
          padding: 30px;
          text-align: center;
        }
        .header h1 {
          margin: 0;
          font-size: 28px;
          font-weight: 700;
        }
        .header p {
          margin: 10px 0 0;
          opacity: 0.9;
        }
        .content {
          padding: 40px;
        }
        .welcome {
          font-size: 20px;
          font-weight: 600;
          margin-bottom: 20px;
          color: #1f2937;
        }
        .message {
          margin-bottom: 30px;
          color: #4b5563;
        }
        .button-container {
          text-align: center;
          margin: 30px 0;
        }
        .button {
          display: inline-block;
          padding: 14px 32px;
          background: #2563eb;
          color: white !important;
          text-decoration: none;
          border-radius: 8px;
          font-weight: 600;
          font-size: 16px;
          transition: background 0.3s;
        }
        .button:hover {
          background: #1d4ed8;
        }
        .link-box {
          background: #f9fafb;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 15px;
          margin: 20px 0;
          word-break: break-all;
        }
        .link-label {
          font-size: 12px;
          color: #6b7280;
          margin-bottom: 5px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .link {
          color: #2563eb;
          font-size: 14px;
          text-decoration: none;
        }
        .link:hover {
          text-decoration: underline;
        }
        .warning {
          background: #fef3c7;
          border-left: 4px solid #f59e0b;
          padding: 15px;
          margin: 20px 0;
          border-radius: 4px;
          font-size: 14px;
          color: #92400e;
        }
        .features {
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #e5e7eb;
        }
        .features h3 {
          font-size: 16px;
          margin-bottom: 15px;
          color: #374151;
        }
        .features ul {
          list-style: none;
          padding: 0;
          margin: 0;
        }
        .features li {
          padding: 5px 0;
          color: #6b7280;
        }
        .features li:before {
          content: "✓";
          color: #10b981;
          font-weight: bold;
          margin-right: 10px;
        }
        .footer {
          background: #f9fafb;
          padding: 20px;
          text-align: center;
          font-size: 12px;
          color: #9ca3af;
          border-top: 1px solid #e5e7eb;
        }
        .footer a {
          color: #6b7280;
          text-decoration: none;
        }
        .footer a:hover {
          color: #2563eb;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🏦 BankApp</h1>
          <p>Modern Banking for Everyone</p>
        </div>
        
        <div class="content">
          <div class="welcome">
            Welcome, ${user.name}! 👋
          </div>
          
          <div class="message">
            <p>Thank you for choosing BankApp for your banking needs. We're excited to have you on board!</p>
            <p>To ensure the security of your account and get started with banking, please verify your email address by clicking the button below:</p>
          </div>
          
          <div class="button-container">
            <a href="${verificationUrl}" class="button">
              Verify Email Address
            </a>
          </div>
          
          <div class="link-box">
            <div class="link-label">Or copy and paste this link:</div>
            <a href="${verificationUrl}" class="link">${verificationUrl}</a>
          </div>
          
          <div class="warning">
            ⏰ <strong>Important:</strong> This verification link will expire in 24 hours for security reasons.
          </div>
          
          <div class="features">
            <h3>By verifying your email, you'll get access to:</h3>
            <ul>
              <li>Instant money transfers to any bank</li>
              <li>Real-time transaction tracking</li>
              <li>Secure online banking with 256-bit encryption</li>
              <li>24/7 customer support</li>
              <li>Smart spending analytics</li>
            </ul>
          </div>
        </div>
        
        <div class="footer">
          <p>
            © ${new Date().getFullYear()} BankApp. All rights reserved.<br>
            123 Banking Street, Financial District, Lagos, Nigeria<br><br>
            <a href="${process.env.FRONTEND_URL}">Visit our website</a> • 
            <a href="${process.env.FRONTEND_URL}/privacy">Privacy Policy</a> • 
            <a href="${process.env.FRONTEND_URL}/terms">Terms of Service</a>
          </p>
          <p style="margin-top: 10px;">
            This is an automated message. Please do not reply to this email.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
    Welcome to BankApp, ${user.name}!
    
    Please verify your email address by clicking this link:
    ${verificationUrl}
    
    This link will expire in 24 hours.
    
    By verifying your email, you'll get access to:
    - Instant money transfers
    - Real-time transaction tracking
    - Secure online banking
    - 24/7 customer support
    
    If you didn't create an account, please ignore this email.
    
    © ${new Date().getFullYear()} BankApp. All rights reserved.
  `;

  return await sendEmail({
    email: user.email,
    subject: 'Verify Your BankApp Account',
    message: text,
    html: html
  });
};

// Send welcome email after verification
const sendWelcomeEmail = async (user) => {
  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Welcome to BankApp</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          line-height: 1.6;
          color: #1f2937;
          margin: 0;
          padding: 0;
          background-color: #f3f4f6;
        }
        .container {
          max-width: 600px;
          margin: 20px auto;
          background: white;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .header {
          background: linear-gradient(135deg, #059669, #047857);
          color: white;
          padding: 30px;
          text-align: center;
        }
        .header h1 {
          margin: 0;
          font-size: 28px;
          font-weight: 700;
        }
        .content {
          padding: 40px;
        }
        .success-badge {
          text-align: center;
          margin-bottom: 20px;
        }
        .success-icon {
          background: #10b981;
          color: white;
          width: 60px;
          height: 60px;
          line-height: 60px;
          text-align: center;
          border-radius: 50%;
          font-size: 30px;
          margin: 0 auto;
        }
        .welcome {
          font-size: 24px;
          font-weight: 600;
          margin-bottom: 10px;
          color: #1f2937;
          text-align: center;
        }
        .account-box {
          background: #f0fdf4;
          border: 2px solid #22c55e;
          border-radius: 12px;
          padding: 20px;
          margin: 20px 0;
        }
        .account-label {
          font-size: 14px;
          color: #6b7280;
          margin-bottom: 5px;
        }
        .account-number {
          font-size: 28px;
          font-family: 'Courier New', monospace;
          letter-spacing: 3px;
          color: #1f2937;
          font-weight: bold;
          margin-bottom: 15px;
        }
        .balance {
          font-size: 36px;
          color: #059669;
          font-weight: bold;
        }
        .balance-label {
          font-size: 14px;
          color: #6b7280;
        }
        .button {
          display: inline-block;
          padding: 14px 32px;
          background: #059669;
          color: white !important;
          text-decoration: none;
          border-radius: 8px;
          font-weight: 600;
          font-size: 16px;
          margin-top: 20px;
        }
        .button:hover {
          background: #047857;
        }
        .footer {
          background: #f9fafb;
          padding: 20px;
          text-align: center;
          font-size: 12px;
          color: #9ca3af;
          border-top: 1px solid #e5e7eb;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎉 Account Activated!</h1>
          <p>Welcome to BankApp</p>
        </div>
        
        <div class="content">
          <div class="success-badge">
            <div class="success-icon">✓</div>
          </div>
          
          <div class="welcome">
            Thank you, ${user.name}!
          </div>
          
          <p style="text-align: center; color: #6b7280; margin-bottom: 20px;">
            Your email has been verified and your account is now fully activated.
          </p>
          
          <div class="account-box">
            <div class="account-label">Your Account Number</div>
            <div class="account-number">${user.accountNumber}</div>
            <div class="balance-label">Initial Balance</div>
            <div class="balance">₦${user.balance.toLocaleString()}</div>
          </div>
          
          <p style="margin: 20px 0;">
            You can now enjoy all the benefits of BankApp:
          </p>
          
          <ul style="list-style: none; padding: 0;">
            <li style="padding: 8px 0;">✓ Send and receive money instantly</li>
            <li style="padding: 8px 0;">✓ Pay bills and buy airtime</li>
            <li style="padding: 8px 0;">✓ Track all your transactions in real-time</li>
            <li style="padding: 8px 0;">✓ Earn interest on your savings</li>
            <li style="padding: 8px 0;">✓ 24/7 customer support</li>
          </ul>
          
          <div style="text-align: center;">
            <a href="${process.env.FRONTEND_URL}/dashboard" class="button">
              Go to Dashboard
            </a>
          </div>
        </div>
        
        <div class="footer">
          <p>
            © ${new Date().getFullYear()} BankApp. All rights reserved.<br>
            Thank you for choosing BankApp!
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
    Welcome to BankApp, ${user.name}!
    
    Your email has been verified and your account is now fully activated.
    
    Your Account Details:
    Account Number: ${user.accountNumber}
    Initial Balance: ₦${user.balance.toLocaleString()}
    
    You can now:
    - Send and receive money instantly
    - Pay bills and buy airtime
    - Track all your transactions
    - And much more!
    
    Visit your dashboard: ${process.env.FRONTEND_URL}/dashboard
    
    Thank you for choosing BankApp!
  `;

  return await sendEmail({
    email: user.email,
    subject: 'Welcome to BankApp - Your Account is Ready!',
    message: text,
    html: html
  });
};

// Send password reset email
const sendPasswordResetEmail = async (user, resetUrl) => {
  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Reset Your Password</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          line-height: 1.6;
          color: #1f2937;
          margin: 0;
          padding: 0;
          background-color: #f3f4f6;
        }
        .container {
          max-width: 600px;
          margin: 20px auto;
          background: white;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .header {
          background: linear-gradient(135deg, #dc2626, #991b1b);
          color: white;
          padding: 30px;
          text-align: center;
        }
        .header h1 {
          margin: 0;
          font-size: 28px;
          font-weight: 700;
        }
        .content {
          padding: 40px;
        }
        .warning {
          background: #fef3c7;
          border-left: 4px solid #f59e0b;
          padding: 15px;
          margin: 20px 0;
          border-radius: 4px;
          font-size: 14px;
          color: #92400e;
        }
        .button {
          display: inline-block;
          padding: 14px 32px;
          background: #dc2626;
          color: white !important;
          text-decoration: none;
          border-radius: 8px;
          font-weight: 600;
          font-size: 16px;
        }
        .button:hover {
          background: #b91c1c;
        }
        .footer {
          background: #f9fafb;
          padding: 20px;
          text-align: center;
          font-size: 12px;
          color: #9ca3af;
          border-top: 1px solid #e5e7eb;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🔐 Reset Password</h1>
        </div>
        
        <div class="content">
          <p>Hello ${user.name},</p>
          
          <p>We received a request to reset your password. Click the button below to create a new password:</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" class="button">
              Reset Password
            </a>
          </div>
          
          <div class="warning">
            ⚠️ <strong>Security Notice:</strong> This password reset link will expire in 1 hour.
          </div>
          
          <p>If you didn't request a password reset, please ignore this email or contact our support team immediately. Your account security is important to us.</p>
          
          <p>If the button doesn't work, copy and paste this link:</p>
          <p style="word-break: break-all; color: #6b7280; font-size: 14px;">${resetUrl}</p>
        </div>
        
        <div class="footer">
          <p>
            © ${new Date().getFullYear()} BankApp. All rights reserved.<br>
            This is an automated security message.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  return await sendEmail({
    email: user.email,
    subject: 'Reset Your BankApp Password',
    message: `Reset your password by clicking: ${resetUrl}`,
    html: html
  });
};

// Send transaction notification
const sendTransactionEmail = async (user, transaction) => {
  const isCredit = transaction.type === 'credit';
  const amount = transaction.amount.toLocaleString();
  const sign = isCredit ? '+' : '-';
  const color = isCredit ? '#059669' : '#dc2626';
  
  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Transaction Alert</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          line-height: 1.6;
          color: #1f2937;
          margin: 0;
          padding: 0;
          background-color: #f3f4f6;
        }
        .container {
          max-width: 500px;
          margin: 20px auto;
          background: white;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .header {
          background: ${color};
          color: white;
          padding: 20px;
          text-align: center;
        }
        .amount {
          font-size: 36px;
          font-weight: bold;
          margin: 10px 0;
        }
        .content {
          padding: 30px;
        }
        .detail-row {
          display: flex;
          justify-content: space-between;
          padding: 10px 0;
          border-bottom: 1px solid #e5e7eb;
        }
        .detail-label {
          color: #6b7280;
        }
        .detail-value {
          font-weight: 600;
        }
        .footer {
          background: #f9fafb;
          padding: 15px;
          text-align: center;
          font-size: 12px;
          color: #9ca3af;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div>${isCredit ? '💰 Money Received' : '💸 Money Sent'}</div>
          <div class="amount">${sign}₦${amount}</div>
        </div>
        
        <div class="content">
          <div class="detail-row">
            <span class="detail-label">Transaction Type</span>
            <span class="detail-value">${transaction.type}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Description</span>
            <span class="detail-value">${transaction.description || 'N/A'}</span>
          </div>
          ${transaction.recipientName ? `
            <div class="detail-row">
              <span class="detail-label">Recipient</span>
              <span class="detail-value">${transaction.recipientName}</span>
            </div>
          ` : ''}
          ${transaction.senderName ? `
            <div class="detail-row">
              <span class="detail-label">Sender</span>
              <span class="detail-value">${transaction.senderName}</span>
            </div>
          ` : ''}
          <div class="detail-row">
            <span class="detail-label">Date</span>
            <span class="detail-value">${new Date(transaction.createdAt).toLocaleString()}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Reference</span>
            <span class="detail-value">${transaction.reference}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">New Balance</span>
            <span class="detail-value">₦${transaction.balanceAfter.toLocaleString()}</span>
          </div>
        </div>
        
        <div class="footer">
          <p>© ${new Date().getFullYear()} BankApp. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return await sendEmail({
    email: user.email,
    subject: `${isCredit ? 'Credit' : 'Debit'} Alert: ${sign}₦${amount}`,
    message: `${transaction.description || 'Transaction'}: ${sign}₦${amount}. New balance: ₦${transaction.balanceAfter.toLocaleString()}`,
    html: html
  });
};

module.exports = {
  sendEmail,
  sendVerificationEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendTransactionEmail
};