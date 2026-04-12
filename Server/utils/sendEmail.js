const nodemailer = require('nodemailer');

// Send via Brevo using simple fetch (no SDK issues!)
const sendViaBrevo = async (options) => {
  const { email, subject, message, html } = options;
  
  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': process.env.BREVO_API_KEY
      },
      body: JSON.stringify({
        sender: { 
          email: process.env.EMAIL_FROM || 'abdulwarisabdullahi52@gmail.com',
          name: 'Vaultix'
        },
        to: [{ email: email }],
        subject: subject,
        textContent: message,
        htmlContent: html || message
      })
    });

    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ Email sent via Brevo! Message ID:', data.messageId);
      return { success: true, provider: 'brevo', messageId: data.messageId };
    } else {
      console.error('❌ Brevo API error:', data);
      return { success: false, error: data.message, provider: 'brevo' };
    }
  } catch (error) {
    console.error('❌ Brevo failed:', error.message);
    return { success: false, error: error.message, provider: 'brevo' };
  }
};

// Check if Brevo is configured
const isBrevoConfigured = () => {
  return process.env.BREVO_API_KEY && process.env.BREVO_API_KEY.length > 10;
};

// Create local transporter for development
const createLocalTransporter = async () => {
  try {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      return null;
    }

    const cleanPassword = process.env.EMAIL_PASS.replace(/\s+/g, '');

    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: process.env.EMAIL_USER,
        pass: cleanPassword,
      },
      tls: { rejectUnauthorized: false },
      family: 4
    });

    await transporter.verify();
    console.log('✅ Local email transporter ready');
    return transporter;
  } catch (error) {
    console.error('❌ Local email failed:', error.message);
    return null;
  }
};

// Send via local SMTP
const sendViaLocal = async (options) => {
  const { email, subject, message, html } = options;
  
  const transporter = await createLocalTransporter();
  if (!transporter) {
    return { success: false, message: 'Local email not configured' };
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
    console.log('✅ Email sent via local SMTP!');
    return { success: true, messageId: info.messageId, provider: 'smtp' };
  } catch (error) {
    console.error('❌ Local SMTP failed:', error.message);
    return { success: false, error: error.message, provider: 'smtp' };
  }
};

// Main send email function
const sendEmail = async (options) => {
  const { email, subject } = options;

  console.log(`📧 Sending email to: ${email}`);
  console.log(`   Subject: ${subject}`);

  // Try Brevo first (production)
  if (isBrevoConfigured()) {
    console.log('📧 Using Brevo API...');
    return await sendViaBrevo(options);
  }

  // Fallback to local SMTP (development)
  console.log('📧 Using local SMTP...');
  return await sendViaLocal(options);
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
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; padding: 30px; }
        .logo { font-size: 32px; font-weight: bold; color: #4f46e5; text-align: center; margin-bottom: 30px; }
        .button { display: inline-block; padding: 14px 28px; background: #4f46e5; color: white; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; }
        .link-box { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 15px; margin: 20px 0; word-break: break-all; }
        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #9ca3af; text-align: center; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="logo">🏦 Vaultix</div>
        <h2>Welcome, ${user.name}! 👋</h2>
        <p>Please verify your email address to activate your account.</p>
        <div style="text-align: center;">
          <a href="${verificationUrl}" class="button">Verify Email Address</a>
        </div>
        <p>Or copy and paste this link:</p>
        <div class="link-box">${verificationUrl}</div>
        <p style="color: #f59e0b;">⏰ This link expires in 24 hours.</p>
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
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; padding: 30px; }
        .logo { font-size: 32px; font-weight: bold; color: #4f46e5; text-align: center; margin-bottom: 30px; }
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