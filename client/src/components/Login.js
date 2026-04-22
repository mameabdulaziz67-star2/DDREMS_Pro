import React, { useState } from 'react';
import './Login.css';
import axios from 'axios';
import Register from './Register';
import ForgotPassword from './ForgotPassword';
import API_BASE_URL from '../config/api';

const Login = ({ onLogin }) => {
  const [showRegister, setShowRegister] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  if (showRegister) {
    return <Register onBackToLogin={() => setShowRegister(false)} />;
  }

  if (showForgotPassword) {
    return <ForgotPassword onBackToLogin={() => setShowForgotPassword(false)} />;
  }

  return <LoginForm onLogin={onLogin} onShowRegister={() => setShowRegister(true)} onShowForgotPassword={() => setShowForgotPassword(true)} />;
};

const LoginForm = ({ onLogin, onShowRegister, onShowForgotPassword }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await axios.post(`${API_BASE_URL}/api/auth/login`, {
        email,
        password
      });
      
      onLogin(response.data.token, response.data.user);
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-logo">
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

        <form onSubmit={handleSubmit} className="login-form">
          {error && <div className="error-message">{error}</div>}
          
          <div className="form-group">
            <label>Email Address</label>
            <div className="input-wrapper">
              <span className="input-icon">✉️</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@ddrems.com"
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label>Password</label>
            <div className="input-wrapper">
              <span className="input-icon">🔒</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
              />
            </div>
          </div>

          <div className="remember-me">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              <span className="checkbox-custom"></span>
              <span className="checkbox-text">Remember me</span>
            </label>
            <button 
              type="button"
              className="forgot-password-link"
              onClick={onShowForgotPassword}
            >
              Forgot Password?
            </button>
          </div>

          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <div className="register-section">
          <p>Don't have an account?</p>
          <button 
            type="button"
            className="btn-create-account" 
            onClick={onShowRegister}
          >
            Create Account
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;
