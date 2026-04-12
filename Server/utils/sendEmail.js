const nodemailer = require('nodemailer');

// Create email transporter with production fix
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

    // ✅ PRODUCTION FIX: Force IPv4 and use correct settings for Render
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || 'smtp.gmail.com',
      port: 465, // ✅ Use port 465 with SSL (more reliable on Render)
      secure: true, // ✅ Use SSL
      auth: {
        user: process.env.EMAIL_USER,
        pass: cleanPassword,
      },
      tls: {
        rejectUnauthorized: false,
        minVersion: 'TLSv1.2'
      },
      family: 4, // ✅ FORCE IPv4 - Fixes ENETUNREACH error on Render!
      connectionTimeout: 30000,
      greetingTimeout: 30000,
      socketTimeout: 30000
    });

    // Verify connection
    await transporter.verify();
    console.log('✅ Email transporter ready');
    
    return transporter;
  } catch (error) {
    console.error('❌ Failed to create email transporter:', error.message);
    
    // ✅ FALLBACK: Try port 587 if 465 fails
    try {
      console.log('🔄 Trying fallback port 587...');
      const cleanPassword = process.env.EMAIL_PASS.replace(/\s+/g, '');
      
      const fallbackTransporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST || 'smtp.gmail.com',
        port: 587,
        secure: false,
        requireTLS: true,
        auth: {
          user: process.env.EMAIL_USER,
          pass: cleanPassword,
        },
        tls: {
          rejectUnauthorized: false,
          minVersion: 'TLSv1.2'
        },
        family: 4, // Force IPv4
        connectionTimeout: 30000,
        greetingTimeout: 30000,
        socketTimeout: 30000
      });
      
      await fallbackTransporter.verify();
      console.log('✅ Fallback transporter ready');
      return fallbackTransporter;
    } catch (fallbackError) {
      console.error('❌ Fallback also failed:', fallbackError.message);
      return null;
    }
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
      from: `"Vaultix" <${process.env.EMAIL_FROM || 'noreply@vaultix.com'}>`,
      to: email,
      subject: subject,
      text: message,
      html: html || message,
    };

    // Send email
    const info = await transporter.sendMail(mailOptions);
    
    console.log('✅ Email sent successfully!');
    console.log(`   Message ID: ${info.messageId}`);
    
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
      console.error('   Generate one at: https://myaccount.google.com/apppasswords');
    } else if (error.code === 'ESOCKET' || error.code === 'ENETUNREACH') {
      console.error('   🌐 Network error on Render. This is a known issue.');
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
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background: #f5f5f5; }
        .container { background: white; border-radius: 12px; padding: 30px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; }
        .logo { font-size: 32px; font-weight: bold; color: #4f46e5; }
        .button { display: inline-block; padding: 14px 28px; background: #4f46e5; color: white; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; }
        .link-box { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 15px; margin: 20px 0; word-break: break-all; }
        .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px; font-size: 14px; }
        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #9ca3af; text-align: center; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">🏦 Vaultix</div>
        </div>
        <h2>Welcome, ${user.name}! 👋</h2>
        <p>Thank you for choosing Vaultix. Please verify your email address to activate your account.</p>
        <div style="text-align: center;">
          <a href="${verificationUrl}" class="button">Verify Email Address</a>
        </div>
        <p>Or copy and paste this link:</p>
        <div class="link-box">${verificationUrl}</div>
        <div class="warning">
          ⏰ <strong>Important:</strong> This link expires in 24 hours.
        </div>
        <div class="footer">
          © ${new Date().getFullYear()} Vaultix. All rights reserved.
        </div>
      </div>
    </body>
    </html>
  `;

  return await sendEmail({
    email: user.email,
    subject: 'Verify Your Vaultix Account',
    message: `Please verify your email: ${verificationUrl}`,
    html: html
  });
};

// Send welcome email after verification
const sendWelcomeEmail = async (user) => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background: #f5f5f5; }
        .container { background: white; border-radius: 12px; padding: 30px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; }
        .logo { font-size: 32px; font-weight: bold; color: #4f46e5; }
        .account-box { background: #f0fdf4; border: 1px solid #22c55e; border-radius: 8px; padding: 20px; margin: 20px 0; }
        .account-number { font-size: 24px; font-family: monospace; letter-spacing: 2px; }
        .balance { font-size: 32px; color: #22c55e; font-weight: bold; }
        .button { display: inline-block; padding: 14px 28px; background: #4f46e5; color: white; text-decoration: none; border-radius: 8px; font-weight: bold; }
        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #9ca3af; text-align: center; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">🏦 Vaultix</div>
        </div>
        <h2>Welcome, ${user.name}! 🎉</h2>
        <p>Your email has been verified and your account is now active!</p>
        <div class="account-box">
          <p><strong>Account Number:</strong></p>
          <div class="account-number">${user.accountNumber}</div>
          <p><strong>Initial Balance:</strong></p>
          <div class="balance">₦${user.balance.toLocaleString()}</div>
        </div>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.FRONTEND_URL}/dashboard" class="button">Go to Dashboard</a>
        </div>
        <div class="footer">
          © ${new Date().getFullYear()} Vaultix. All rights reserved.
        </div>
      </div>
    </body>
    </html>
  `;

  return await sendEmail({
    email: user.email,
    subject: 'Welcome to Vaultix!',
    message: `Welcome ${user.name}! Your Vaultix account is ready.`,
    html: html
  });
};

module.exports = {
  sendEmail,
  sendVerificationEmail,
  sendWelcomeEmail
};