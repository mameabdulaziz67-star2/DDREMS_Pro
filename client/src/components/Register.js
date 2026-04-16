import React, { useState } from 'react';
import './Register.css';
import axios from 'axios';
import API_BASE_URL from '../config/api';

const generateStrongPassword = () => {
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

const getPasswordStrength = (pwd) => {
  if (!pwd) return { label: '', color: '', width: '0%' };
  let score = 0;
  if (pwd.length >= 8) score++;
  if (pwd.length >= 12) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[a-z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  if (score <= 2) return { label: 'Weak', color: '#ef4444', width: '25%' };
  if (score <= 4) return { label: 'Fair', color: '#f59e0b', width: '55%' };
  if (score === 5) return { label: 'Strong', color: '#3b82f6', width: '80%' };
  return { label: 'Very Strong', color: '#10b981', width: '100%' };
};

const Register = ({ onBackToLogin }) => {
  const [formData, setFormData] = useState({
    name: '', email: '', phone: '', password: '', confirmPassword: '', role: 'user'
  });
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const strength = getPasswordStrength(formData.password);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  };

  const handleGenerate = () => {
    const pwd = generateStrongPassword();
    setFormData({ ...formData, password: pwd, confirmPassword: pwd });
    setShowPassword(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.name || !formData.email || !formData.password) {
      setError('Please fill in all required fields');
      return;
    }
    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }
    if (!/[A-Z]/.test(formData.password) || !/[0-9]/.test(formData.password) || !/[^A-Za-z0-9]/.test(formData.password)) {
      setError('Password must contain uppercase, number, and special character');
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setError('Please enter a valid email address');
      return;
    }
    if (!agreedToTerms) {
      setError('You must agree to the Terms & Conditions to register');
      return;
    }

    setLoading(true);
    try {
      await axios.post(`${API_BASE_URL}/api/auth/register`, {
        name: formData.name, email: formData.email,
        phone: formData.phone, password: formData.password, role: formData.role
      });
      alert('✅ Registration successful! Please login with your credentials.');
      onBackToLogin();
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="register-container">
      <div className="register-content">

        {/* Logo */}
        <div className="register-logo-section">
          <div className="logo-icon">
            <div className="buildings">
              <div className="building"></div>
              <div className="building"></div>
              <div className="building"></div>
            </div>
            <div className="wave"></div>
          </div>
          <div className="logo-text">
            <h1>DD<span className="highlight">REMS</span></h1>
            <p>Dire Dawa Real Estate Management System</p>
          </div>
        </div>

        {/* Title */}
        <div className="join-title">
          <h2>Join DDREMS <span className="subtitle">- Dire Dawa Real Estate Management System</span></h2>
        </div>

        {/* Form Card */}
        <div className="register-form-card">
          <h3>Create Account</h3>

          {error && <div className="error-message"><span>⚠️</span> {error}</div>}

          <form onSubmit={handleSubmit} className="register-form">

            <div className="form-group">
              <label>Full Name *</label>
              <div className="input-wrapper">
                <span className="input-icon">👤</span>
                <input type="text" name="name" value={formData.name} onChange={handleChange} placeholder="Enter your full name" required />
              </div>
            </div>

            <div className="form-group">
              <label>Phone Number *</label>
              <div className="input-wrapper">
                <span className="input-icon">📱</span>
                <input type="tel" name="phone" value={formData.phone} onChange={handleChange} placeholder="e.g., +251912345678" required />
              </div>
            </div>

            <div className="form-group">
              <label>Email Address *</label>
              <div className="input-wrapper">
                <span className="input-icon">✉️</span>
                <input type="email" name="email" value={formData.email} onChange={handleChange} placeholder="Enter your email" required />
              </div>
            </div>

            <div className="form-group">
              <label>Register As</label>
              <div className="register-as-row">
                <span className="radio-indicator">●</span>
                <span className="role-text">Customer - Browse and buy properties</span>
              </div>
            </div>

            <div className="form-group">
              <div className="password-label-row">
                <label>Password *</label>
                <button type="button" className="btn-generate" onClick={handleGenerate}>⚡ Generate Password</button>
              </div>
              <div className="input-wrapper">
                <span className="input-icon">🔒</span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Min 8 chars, uppercase, number, symbol"
                  required
                  minLength="8"
                />
                <button type="button" className="toggle-eye" onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
              {formData.password && (
                <div className="strength-bar-wrap">
                  <div className="strength-bar">
                    <div className="strength-fill" style={{ width: strength.width, background: strength.color }}></div>
                  </div>
                  <span className="strength-label" style={{ color: strength.color }}>{strength.label}</span>
                </div>
              )}
            </div>

            <div className="form-group">
              <label>Confirm Password *</label>
              <div className="input-wrapper">
                <span className="input-icon">🔒</span>
                <input
                  type={showConfirm ? 'text' : 'password'}
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="Re-enter your password"
                  required
                />
                <button type="button" className="toggle-eye" onClick={() => setShowConfirm(!showConfirm)}>
                  {showConfirm ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            {/* Terms & Conditions */}
            <div className="terms-section">
              <label className="terms-checkbox-label">
                <input type="checkbox" checked={agreedToTerms} onChange={(e) => setAgreedToTerms(e.target.checked)} />
                <span className="terms-checkbox-custom"></span>
                <span className="terms-text">
                  I agree to the{' '}
                  <button type="button" className="terms-link" onClick={() => setShowTerms(true)}>
                    Terms & Conditions
                  </button>
                </span>
              </label>
            </div>

            <button type="submit" className="btn-create-account" disabled={loading || !agreedToTerms}>
              <span className="btn-icon">✓</span>
              {loading ? 'Creating Account...' : 'Create Account'}
            </button>

            <div className="already-have-account">
              <p>Already have an account?</p>
              <button type="button" className="link-back" onClick={onBackToLogin}>← Back to Login</button>
            </div>
          </form>
        </div>

        {/* Steps */}
        <div className="what-happens-section">
          <h3>What happens after registration?</h3>
          <div className="steps-grid">
            <div className="step-card">
              <div className="step-number">1</div>
              <div className="step-info">
                <h4>Complete Your Profile</h4>
                <p>After login, complete your profile with required documents</p>
              </div>
            </div>
            <div className="step-card">
              <div className="step-number">2</div>
              <div className="step-info">
                <h4>Admin Approval</h4>
                <p>Your profile will be reviewed and approved by our admin team</p>
              </div>
            </div>
            <div className="step-card">
              <div className="step-number">3</div>
              <div className="step-info">
                <h4>Full Access</h4>
                <p>Once approved, you'll have full access to all features</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bottom-link">
          <p>Already have an account?</p>
          <button type="button" className="link-back" onClick={onBackToLogin}>← Back to Login</button>
        </div>
      </div>

      {/* Terms Modal */}
      {showTerms && (
        <div className="terms-modal-overlay" onClick={() => setShowTerms(false)}>
          <div className="terms-modal" onClick={(e) => e.stopPropagation()}>
            <div className="terms-modal-header">
              <h3>Terms & Conditions</h3>
              <button className="terms-close" onClick={() => setShowTerms(false)}>✕</button>
            </div>
            <div className="terms-modal-body">
              <h4>1. Acceptance of Terms</h4>
              <p>By registering on DDREMS, you agree to these terms and conditions in full.</p>
              <h4>2. User Responsibilities</h4>
              <p>You are responsible for maintaining the confidentiality of your account credentials and for all activities under your account.</p>
              <h4>3. Property Listings</h4>
              <p>All property listings must be accurate and truthful. Fraudulent listings will result in immediate account termination.</p>
              <h4>4. Privacy Policy</h4>
              <p>Your personal data is collected and processed in accordance with our Privacy Policy. We do not share your data with third parties without consent.</p>
              <h4>5. Account Approval</h4>
              <p>All accounts are subject to admin approval before full access is granted. DDREMS reserves the right to reject any registration.</p>
              <h4>6. Prohibited Activities</h4>
              <p>Users may not use the platform for illegal activities, spam, or any activity that violates Ethiopian law.</p>
              <h4>7. Termination</h4>
              <p>DDREMS reserves the right to terminate accounts that violate these terms without prior notice.</p>
            </div>
            <div className="terms-modal-footer">
              <button className="btn-accept-terms" onClick={() => { setAgreedToTerms(true); setShowTerms(false); }}>
                ✓ Accept Terms & Conditions
              </button>
              <button className="btn-decline-terms" onClick={() => setShowTerms(false)}>
                Decline
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Register;
