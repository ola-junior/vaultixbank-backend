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

    // ✅ Railway-specific fix: Use port 465 with secure: true
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465, // ✅ Use 465 instead of 587 on Railway
      secure: true, // ✅ Use SSL
      auth: {
        user: process.env.EMAIL_USER,
        pass: cleanPassword,
      },
      tls: {
        rejectUnauthorized: false,
        minVersion: 'TLSv1.2'
      },
      connectionTimeout: 30000,
      greetingTimeout: 30000,
      socketTimeout: 30000
    });

    await transporter.verify();
    console.log('✅ Email transporter ready');
    return transporter;
  } catch (error) {
    console.error('❌ Email transporter failed:', error.message);
    
    // ✅ Fallback: Try port 587
    try {
      console.log('🔄 Trying fallback port 587...');
      const cleanPassword = process.env.EMAIL_PASS.replace(/\s+/g, '');
      
      const fallbackTransporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
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
    <head><meta charset="UTF-8"></head>
    <body style="font-family: Arial; padding: 20px;">
      <h2>Welcome to Vaultix, ${user.name}! 👋</h2>
      <p>Please verify your email address to activate your account.</p>
      <p><a href="${verificationUrl}" style="background: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px;">Verify Email</a></p>
      <p>Or copy: ${verificationUrl}</p>
      <p>This link expires in 24 hours.</p>
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
    <head><meta charset="UTF-8"></head>
    <body style="font-family: Arial; padding: 20px;">
      <h2>Welcome, ${user.name}! 🎉</h2>
      <p>Your email has been verified!</p>
      <p><strong>Account Number:</strong> ${user.accountNumber}</p>
      <p><a href="${process.env.FRONTEND_URL}/dashboard" style="background: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px;">Go to Dashboard</a></p>
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