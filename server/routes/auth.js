const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const nodemailer = require('nodemailer');

// Configure email transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

// Generate OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Generate temporary password
const generateTempPassword = () => {
  const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lower = 'abcdefghijklmnopqrstuvwxyz';
  const digits = '0123456789';
  const symbols = '!@#$%^&*()_+-=[]{}';
  const all = upper + lower + digits + symbols;
  let pwd = [
    upper[Math.floor(Math.random() * upper.length)],
    lower[Math.floor(Math.random() * lower.length)],
    digits[Math.floor(Math.random() * digits.length)],
    symbols[Math.floor(Math.random() * symbols.length)],
  ];
  for (let i = 4; i < 12; i++) {
    pwd.push(all[Math.floor(Math.random() * all.length)]);
  }
  return pwd.sort(() => Math.random() - 0.5).join('');
};

// Ensure password_resets table exists
const ensurePasswordResetsTable = async () => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS password_resets (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        otp VARCHAR(6) NOT NULL,
        otp_expiry TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
  } catch (error) {
    console.error('Error creating password_resets table:', error);
  }
};

// Register
router.post('/register', async (req, res) => {
  try {
    const { name, email, phone, password, role } = req.body;

    // Validate input
    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    // Validate role (only user, owner, broker can register)
    if (!['user', 'owner', 'broker'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role. Only Customer, Owner, and Broker can register.' });
    }

    // Check if user already exists
    const [existingUsers] = await db.query('SELECT * FROM users WHERE email = ?', [email]);

    if (existingUsers.length > 0) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert new user
    const [result] = await db.query(
      'INSERT INTO users (name, email, phone, password, role, status) VALUES (?, ?, ?, ?, ?, ?)',
      [name, email, phone || null, hashedPassword, role, 'active']
    );

    res.status(201).json({
      message: 'Registration successful! Please login.',
      userId: result.insertId
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check users table (includes brokers with role='broker')
    const [users] = await db.query('SELECT * FROM users WHERE email = ?', [email]);

    if (users.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const user = users[0];
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Get profile image from profiles table if available
    let profileImage = null;
    try {
      const [profiles] = await db.query('SELECT profile_image FROM profiles WHERE user_id = ?', [user.id]);
      if (profiles.length > 0) profileImage = profiles[0].profile_image;
    } catch (_) {}

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        profile_image: profileImage
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Forgot Password - Send OTP
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    // Check if email configuration is set
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
      console.error('Email configuration missing');
      return res.status(500).json({ message: 'Email service not configured. Please contact support.' });
    }

    // Check if user exists
    const [users] = await db.query('SELECT * FROM users WHERE email = ?', [email]);

    if (users.length === 0) {
      return res.status(404).json({ message: 'Email not found in our system' });
    }

    // Ensure password_resets table exists
    await ensurePasswordResetsTable();

    // Generate OTP
    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Store OTP in database - PostgreSQL syntax with UPSERT
    try {
      await db.query(
        `INSERT INTO password_resets (email, otp, otp_expiry, created_at) 
         VALUES (?, ?, ?, NOW())
         ON CONFLICT (email) DO UPDATE SET otp = EXCLUDED.otp, otp_expiry = EXCLUDED.otp_expiry, created_at = NOW()`,
        [email, otp, otpExpiry]
      );
    } catch (dbError) {
      console.error('Database insert error:', dbError);
      throw dbError;
    }

    // Send OTP via email
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'DDREMS - Password Reset OTP',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #1565c0, #1e88e5); padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0;">DDREMS</h1>
            <p style="color: rgba(255,255,255,0.9); margin: 5px 0 0;">Dire Dawa Real Estate Management System</p>
          </div>
          <div style="background: #f5f5f5; padding: 30px; border-radius: 0 0 8px 8px;">
            <h2 style="color: #333; margin-top: 0;">Password Reset Request</h2>
            <p style="color: #666; line-height: 1.6;">
              We received a request to reset your password. Use the OTP below to proceed with your password reset.
            </p>
            <div style="background: white; border: 2px solid #1565c0; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
              <p style="color: #999; margin: 0 0 10px; font-size: 12px;">Your One-Time Password (OTP)</p>
              <h1 style="color: #1565c0; margin: 0; font-size: 36px; letter-spacing: 5px;">${otp}</h1>
              <p style="color: #999; margin: 10px 0 0; font-size: 12px;">Valid for 10 minutes</p>
            </div>
            <p style="color: #666; line-height: 1.6;">
              If you didn't request this password reset, please ignore this email or contact our support team.
            </p>
            <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
            <p style="color: #999; font-size: 12px; margin: 0;">
              © 2024 DDREMS. All rights reserved.
            </p>
          </div>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);

    res.json({ message: 'OTP sent to your email. Please check your inbox.' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Verify OTP and Generate New Password
router.post('/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ message: 'Email and OTP are required' });
    }

    // Check if email configuration is set
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
      console.error('Email configuration missing');
      return res.status(500).json({ message: 'Email service not configured. Please contact support.' });
    }

    // Check if OTP is valid
    const [resets] = await db.query(
      'SELECT * FROM password_resets WHERE email = ? AND otp = ? AND otp_expiry > NOW()',
      [email, otp]
    );

    if (resets.length === 0) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    // Generate new temporary password
    const tempPassword = generateTempPassword();
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    // Update user password
    await db.query('UPDATE users SET password = ? WHERE email = ?', [hashedPassword, email]);

    // Delete used OTP
    await db.query('DELETE FROM password_resets WHERE email = ?', [email]);

    // Send new password via email
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'DDREMS - Your New Password',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #1565c0, #1e88e5); padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0;">DDREMS</h1>
            <p style="color: rgba(255,255,255,0.9); margin: 5px 0 0;">Dire Dawa Real Estate Management System</p>
          </div>
          <div style="background: #f5f5f5; padding: 30px; border-radius: 0 0 8px 8px;">
            <h2 style="color: #333; margin-top: 0;">Your Password Has Been Reset</h2>
            <p style="color: #666; line-height: 1.6;">
              Your password has been successfully reset. Use the temporary password below to login to your account.
            </p>
            <div style="background: white; border: 2px solid #10b981; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <p style="color: #999; margin: 0 0 10px; font-size: 12px;">Your Temporary Password</p>
              <p style="color: #333; margin: 0; font-size: 16px; font-family: 'Courier New', monospace; letter-spacing: 1px; word-break: break-all;">${tempPassword}</p>
            </div>
            <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; border-radius: 4px; margin: 20px 0;">
              <p style="color: #856404; margin: 0; font-size: 13px;">
                <strong>⚠️ Important:</strong> Please change this password immediately after logging in. You can update your password in your profile settings.
              </p>
            </div>
            <p style="color: #666; line-height: 1.6;">
              <strong>Next Steps:</strong>
            </p>
            <ol style="color: #666; line-height: 1.8;">
              <li>Login with your email and the temporary password above</li>
              <li>Go to your profile settings</li>
              <li>Update your password to something secure</li>
            </ol>
            <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
            <p style="color: #999; font-size: 12px; margin: 0;">
              © 2024 DDREMS. All rights reserved.
            </p>
          </div>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);

    res.json({
      message: 'Password reset successful. Check your email for the new password.',
      password: tempPassword
    });
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
