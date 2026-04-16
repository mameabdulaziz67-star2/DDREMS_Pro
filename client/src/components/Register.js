import React, { useState } from 'react';
import './Register.css';
import axios from 'axios';
import API_BASE_URL from '../config/api';

const Register = ({ onBackToLogin }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    role: 'user'
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.name || !formData.email || !formData.password) {
      setError('Please fill in all required fields');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);

    try {
      await axios.post(`${API_BASE_URL}/api/auth/register`, {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        password: formData.password,
        role: formData.role
      });

      alert('✅ Registration successful! Please login with your credentials.');
      onBackToLogin();
    } catch (error) {
      console.error('Registration error:', error);
      if (error.response?.data?.message) {
        setError(error.response.data.message);
      } else {
        setError('Registration failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="register-container">
      <div className="register-content">
        {/* Logo Section */}
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

        {/* Join Title */}
        <div className="join-title">
          <h2>Join DDREMS <span className="subtitle">- Dire Dawa Real Estate Management System</span></h2>
        </div>

        {/* Form Card */}
        <div className="register-form-card">
          <h3>Create Account</h3>

          {error && (
            <div className="error-message">
              <span>⚠️</span> {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="register-form">
            <div className="form-group">
              <label>Full Name *</label>
              <div className="input-wrapper">
                <span className="input-icon">👤</span>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Enter your full name"
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label>Phone Number *</label>
              <div className="input-wrapper">
                <span className="input-icon">📱</span>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="e.g., +251912345678"
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label>Email Address *</label>
              <div className="input-wrapper">
                <span className="input-icon">✉️</span>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="Enter your email"
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label>Register As</label>
              <div className="register-as-row">
                <span className="radio-indicator">●</span>
                <span className="role-text">Customer - Browse and buy properties</span>
              </div>
              <div className="admin-info">
                <span className="info-icon">ℹ️</span>
                <span>Admin accounts are created by the system only</span>
              </div>
            </div>

            <div className="form-group">
              <label>Password *</label>
              <div className="input-wrapper">
                <span className="input-icon">🔒</span>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Create a password (min 6 characters)"
                  required
                  minLength="6"
                />
              </div>
            </div>

            <div className="form-group">
              <label>Confirm Password *</label>
              <div className="input-wrapper">
                <span className="input-icon">🔒</span>
                <input
                  type="password"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="Re-enter your password"
                  required
                />
              </div>
            </div>

            <button type="submit" className="btn-create-account" disabled={loading}>
              <span className="btn-icon">✓</span>
              {loading ? 'Creating Account...' : 'Create Account'}
            </button>

            <div className="already-have-account">
              <p>Already have an account?</p>
              <button type="button" className="link-back" onClick={onBackToLogin}>
                ← Back to Login
              </button>
            </div>
          </form>
        </div>

        {/* What Happens Section */}
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

        {/* Bottom Link */}
        <div className="bottom-link">
          <p>Already have an account?</p>
          <button type="button" className="link-back" onClick={onBackToLogin}>
            ← Back to Login
          </button>
        </div>
      </div>
    </div>
  );
};

export default Register;
