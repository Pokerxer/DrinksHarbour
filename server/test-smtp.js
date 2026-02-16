// Simple email test with direct SMTP
require('dotenv').config();

const nodemailer = require('nodemailer');

async function testEmail() {
  console.log('🔍 Testing email configuration...');
  console.log('MAIL_PASSWORD:', process.env.MAIL_PASSWORD ? '✓ Set' : '✗ Not set');
  console.log('SENDER_EMAIL:', process.env.SENDER_EMAIL_ADDRESS || '✗ Not set');
  
  if (!process.env.MAIL_PASSWORD || !process.env.SENDER_EMAIL_ADDRESS) {
    console.log('❌ Email credentials not configured');
    return;
  }

  try {
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: process.env.SENDER_EMAIL_ADDRESS,
        pass: process.env.MAIL_PASSWORD,
      },
    });

    console.log('🔄 Verifying connection...');
    await transporter.verify();
    console.log('✅ Email service ready!');

    // Send test email
    console.log('📧 Sending test email to jrwaldehzx@gmail.com...');
    const info = await transporter.sendMail({
      from: `"DrinksHarbour" <${process.env.SENDER_EMAIL_ADDRESS}>`,
      to: 'jrwaldehzx@gmail.com',
      subject: '🧪 Test Email from DrinksHarbour',
      html: `
        <h1>Test Email</h1>
        <p>This is a test email to verify the email service is working correctly.</p>
        <p>If you received this, the email configuration is successful!</p>
      `,
    });
    console.log('✅ Test email sent:', info.messageId);
  } catch (error) {
    console.error('❌ Email error:', error.message);
  }
}

testEmail();
