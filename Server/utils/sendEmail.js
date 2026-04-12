// Send via Brevo HTTP API (WORKS on Railway/Render free tiers!)
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
          email: 'noreply@vaultix.com',
          name: 'Vaultix'
        },
        to: [{ email: email }],
        subject: subject,
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
    console.error('❌ Brevo request failed:', error.message);
    return { success: false, error: error.message, provider: 'brevo' };
  }
};

// Check if Brevo is configured
const isBrevoConfigured = () => {
  return process.env.BREVO_API_KEY && process.env.BREVO_API_KEY.length > 10;
};

// Main send email function
const sendEmail = async (options) => {
  const { email, subject } = options;

  console.log(`📧 Sending email to: ${email}`);
  console.log(`   Subject: ${subject}`);

  if (isBrevoConfigured()) {
    console.log('📧 Using Brevo HTTP API...');
    return await sendViaBrevo(options);
  }

  console.log('⚠️ Brevo not configured - email skipped');
  return { success: false, message: 'Email service not configured' };
};

// Send verification email
const sendVerificationEmail = async (user, verificationUrl) => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"></head>
    <body style="font-family: Arial, sans-serif; padding: 20px; background: #f5f5f5;">
      <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; padding: 30px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        <div style="font-size: 32px; font-weight: bold; color: #4f46e5; text-align: center; margin-bottom: 30px;">🏦 Vaultix</div>
        <h2 style="color: #1f2937;">Welcome, ${user.name}! 👋</h2>
        <p style="color: #4b5563;">Thank you for choosing Vaultix. Please verify your email address to activate your account.</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verificationUrl}" style="display: inline-block; padding: 14px 28px; background: #4f46e5; color: white; text-decoration: none; border-radius: 8px; font-weight: bold;">Verify Email Address</a>
        </div>
        <p style="color: #4b5563;">Or copy and paste this link:</p>
        <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 15px; word-break: break-all; margin: 20px 0;">
          <a href="${verificationUrl}" style="color: #4f46e5;">${verificationUrl}</a>
        </div>
        <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; border-radius: 4px; margin: 20px 0;">
          ⏰ <strong>Important:</strong> This link expires in 24 hours.
        </div>
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #9ca3af; text-align: center;">
          © 2026 Vaultix. All rights reserved.
        </div>
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
    <head><meta charset="UTF-8"></head>
    <body style="font-family: Arial, sans-serif; padding: 20px; background: #f5f5f5;">
      <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; padding: 30px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        <div style="font-size: 32px; font-weight: bold; color: #4f46e5; text-align: center; margin-bottom: 30px;">🏦 Vaultix</div>
        <h2 style="color: #1f2937;">Welcome, ${user.name}! 🎉</h2>
        <p style="color: #4b5563;">Your email has been verified and your account is now active!</p>
        <div style="background: #f0fdf4; border: 1px solid #22c55e; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <p style="margin: 0 0 5px 0;"><strong>Account Number:</strong></p>
          <div style="font-size: 24px; font-family: monospace; letter-spacing: 2px; margin-bottom: 15px;">${user.accountNumber}</div>
          <p style="margin: 0 0 5px 0;"><strong>Initial Balance:</strong></p>
          <div style="font-size: 32px; color: #22c55e; font-weight: bold;">₦${user.balance.toLocaleString()}</div>
        </div>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.FRONTEND_URL}/dashboard" style="display: inline-block; padding: 14px 28px; background: #4f46e5; color: white; text-decoration: none; border-radius: 8px; font-weight: bold;">Go to Dashboard</a>
        </div>
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #9ca3af; text-align: center;">
          © 2026 Vaultix. All rights reserved.
        </div>
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