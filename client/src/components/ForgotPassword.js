import React, { useState } from 'react';
import './ForgotPassword.css';
import axios from 'axios';
import API_BASE_URL from '../config/api';

const ForgotPassword = ({ onBackToLogin }) => {
  const [step, setStep] = useState('email'); // email, otp, success
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleRequestReset = async (e) => {
    e.preventDefault();
    setError('');

    if (!email) {
      setError('Please enter your email address');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);
    try {
      await axios.post(`${API_BASE_URL}/api/auth/forgot-password`, { email });
      setStep('otp');
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send reset email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError('');

    if (!otp || otp.length !== 6) {
      setError('Please enter a valid 6-digit OTP');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(`${API_BASE_URL}/api/auth/verify-otp`, {
        email,
        otp
      });
      setGeneratedPassword(response.data.password);
      setStep('success');
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="forgot-password-container">
      <div className="forgot-password-card">
        <div className="forgot-password-header">
          <button className="btn-back" onClick={onBackToLogin}>← Back to Login</button>
          <h2>Reset Your Password</h2>
        </div>

        {step === 'email' && (
          <form onSubmit={handleRequestReset} className="forgot-password-form">
            <div className="step-indicator">
              <div className="step active">1</div>
              <div className="step-line"></div>
              <div className="step">2</div>
              <div className="step-line"></div>
              <div className="step">3</div>
            </div>

            <div className="form-content">
              <h3>Enter Your Email</h3>
              <p className="step-description">We'll send you an OTP to verify your identity</p>

              {error && <div className="error-message"><span>⚠️</span> {error}</div>}

              <div className="form-group">
                <label>Email Address *</label>
                <div className="input-wrapper">
                  <span className="input-icon">✉️</span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your registered email"
                    required
                  />
                </div>
              </div>

              <button type="submit" className="btn-submit" disabled={loading}>
                {loading ? 'Sending OTP...' : 'Send Reset Link'}
              </button>
            </div>
          </form>
        )}

        {step === 'otp' && (
          <form onSubmit={handleVerifyOtp} className="forgot-password-form">
            <div className="step-indicator">
              <div className="step completed">✓</div>
              <div className="step-line"></div>
              <div className="step active">2</div>
              <div className="step-line"></div>
              <div className="step">3</div>
            </div>

            <div className="form-content">
              <h3>Verify OTP</h3>
              <p className="step-description">Enter the 6-digit code sent to {email}</p>

              {error && <div className="error-message"><span>⚠️</span> {error}</div>}

              <div className="form-group">
                <label>One-Time Password (OTP) *</label>
                <div className="input-wrapper">
                  <span className="input-icon">🔐</span>
                  <input
                    type="text"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    maxLength="6"
                    required
                  />
                </div>
                <p className="otp-hint">Check your email for the OTP code</p>
              </div>

              <button type="submit" className="btn-submit" disabled={loading}>
                {loading ? 'Verifying...' : 'Verify OTP'}
              </button>

              <button
                type="button"
                className="btn-resend"
                onClick={handleRequestReset}
                disabled={loading}
              >
                Didn't receive the code? Resend
              </button>
            </div>
          </form>
        )}

        {step === 'success' && (
          <div className="success-content">
            <div className="step-indicator">
              <div className="step completed">✓</div>
              <div className="step-line"></div>
              <div className="step completed">✓</div>
              <div className="step-line"></div>
              <div className="step active">3</div>
            </div>

            <div className="success-message">
              <div className="success-icon">✓</div>
              <h3>Password Reset Successful!</h3>
              <p>Your temporary password has been generated and sent to your email.</p>
            </div>

            <div className="password-display">
              <label>Your Temporary Password:</label>
              <div className="password-box">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={generatedPassword}
                  readOnly
                  className="password-input"
                />
                <button
                  type="button"
                  className="toggle-eye"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
              <p className="password-note">
                ℹ️ Save this password. You can update it in your profile settings after login.
              </p>
            </div>

            <button
              type="button"
              className="btn-back-to-login"
              onClick={onBackToLogin}
            >
              Back to Login
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ForgotPassword;
