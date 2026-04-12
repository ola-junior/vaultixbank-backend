const nodemailer = require('nodemailer');

// Create transporter
const createTransporter = async () => {
  try {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.log('⚠️ Email credentials not configured');
      return null;
    }

    const cleanPassword = process.env.EMAIL_PASS.replace(/\s+/g, '');

    console.log('📧 Setting up email transporter...');
    console.log('   Host:', process.env.EMAIL_HOST);
    console.log('   Port:', process.env.EMAIL_PORT);
    console.log('   User:', process.env.EMAIL_USER);

    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.EMAIL_PORT) || 587,
      secure: false, // Use TLS
      requireTLS: true,
      auth: {
        user: process.env.EMAIL_USER,
        pass: cleanPassword,
      },
      tls: {
        rejectUnauthorized: false,
        minVersion: 'TLSv1.2'
      }
    });

    await transporter.verify();
    console.log('✅ Email transporter ready');
    return transporter;
  } catch (error) {
    console.error('❌ Email transporter failed:', error.message);
    return null;
  }
};

// Send email
const sendEmail = async (options) => {
  const { email, subject, message, html } = options;

  console.log(`📧 Sending email to: ${email}`);
  console.log(`   Subject: ${subject}`);

  const transporter = await createTransporter();

  if (!transporter) {
    console.log('⚠️ Email service unavailable');
    return { success: false, message: 'Email service unavailable' };
  }

  try {
    const mailOptions = {
      from: `"Vaultix" <${process.env.EMAIL_FROM || 'noreply@vaultix.com'}>`,
      to: email,
      subject: subject,
      text: message,
      html: html || message,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Email sent! Message ID:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Email send failed:', error.message);
    return { success: false, error: error.message };
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
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; padding: 30px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .logo { font-size: 32px; font-weight: bold; color: #4f46e5; text-align: center; margin-bottom: 30px; }
        h2 { color: #1f2937; }
        .button { display: inline-block; padding: 14px 28px; background: #4f46e5; color: white; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; }
        .link-box { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 15px; margin: 20px 0; word-break: break-all; }
        .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px; }
        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #9ca3af; text-align: center; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="logo">🏦 Vaultix</div>
        <h2>Welcome, ${user.name}! 👋</h2>
        <p>Thank you for choosing Vaultix. Please verify your email address to activate your account.</p>
        <div style="text-align: center;">
          <a href="${verificationUrl}" class="button">Verify Email Address</a>
        </div>
        <p>Or copy and paste this link:</p>
        <div class="link-box">${verificationUrl}</div>
        <div class="warning">⏰ This link expires in 24 hours.</div>
        <div class="footer">© ${new Date().getFullYear()} Vaultix. All rights reserved.</div>
      </div>
    </body>
    </html>
  `;

  return await sendEmail({
    email: user.email,
    subject: 'Verify Your Vaultix Account',
    message: `Verify your email: ${verificationUrl}`,
    html: html
  });
};

// Send welcome email
const sendWelcomeEmail = async (user) => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; padding: 30px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .logo { font-size: 32px; font-weight: bold; color: #4f46e5; text-align: center; margin-bottom: 30px; }
        h2 { color: #1f2937; }
        .account-box { background: #f0fdf4; border: 1px solid #22c55e; border-radius: 8px; padding: 20px; margin: 20px 0; }
        .account-number { font-size: 24px; font-family: monospace; letter-spacing: 2px; }
        .balance { font-size: 32px; color: #22c55e; font-weight: bold; }
        .button { display: inline-block; padding: 14px 28px; background: #4f46e5; color: white; text-decoration: none; border-radius: 8px; font-weight: bold; }
        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #9ca3af; text-align: center; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="logo">🏦 Vaultix</div>
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
        <div class="footer">© ${new Date().getFullYear()} Vaultix. All rights reserved.</div>
      </div>
    </body>
    </html>
  `;

  return await sendEmail({
    email: user.email,
    subject: 'Welcome to Vaultix!',
    message: `Welcome ${user.name}! Your account is ready.`,
    html: html
  });
};

module.exports = { sendEmail, sendVerificationEmail, sendWelcomeEmail };