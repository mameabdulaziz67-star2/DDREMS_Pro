import React, { useState, useEffect } from 'react';
import './BrokerProfile.css';
import axios from 'axios';
import API_BASE_URL from '../../config/api';


const BrokerProfile = ({ user, onComplete }) => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    full_name: user.name || '',
    phone_number: '',
    address: '',
    profile_photo: '',
    id_document: '',
    broker_license: '',
    license_number: ''
  });
  const [photoPreview, setPhotoPreview] = useState(null);
  const [docPreview, setDocPreview] = useState(null);
  const [licensePreview, setLicensePreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [updatingPassword, setUpdatingPassword] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, [user.id]);

  const fetchProfile = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/profiles/broker/${user.id}`);
      setProfile(response.data);
      setFormData({
        full_name: response.data.full_name,
        phone_number: response.data.phone_number || '',
        address: response.data.address || '',
        profile_photo: response.data.profile_photo || '',
        id_document: response.data.id_document || '',
        broker_license: response.data.broker_license || '',
        license_number: response.data.license_number || ''
      });
      if (response.data.profile_photo) setPhotoPreview(response.data.profile_photo);
      if (response.data.id_document) setDocPreview(response.data.id_document);
      if (response.data.broker_license) setLicensePreview(response.data.broker_license);
    } catch (error) {
      if (error.response?.status !== 404) {
        console.error('Error fetching profile:', error);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handlePasswordChange = (e) => {
    setPasswordData({
      ...passwordData,
      [e.target.name]: e.target.value
    });
    setPasswordError('');
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
      setPasswordError('Please fill in all password fields');
      return;
    }

    if (passwordData.newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters long');
      return;
    }

    if (!/[A-Z]/.test(passwordData.newPassword) || !/[0-9]/.test(passwordData.newPassword) || !/[^A-Za-z0-9]/.test(passwordData.newPassword)) {
      setPasswordError('Password must contain uppercase, number, and special character');
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }

    setUpdatingPassword(true);
    try {
      await axios.post(`${API_BASE_URL}/api/auth/update-password`, {
        email: user.email,
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword
      });
      setPasswordSuccess('✅ Password updated successfully!');
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
      setTimeout(() => {
        setShowPasswordModal(false);
        setPasswordSuccess('');
      }, 2000);
    } catch (error) {
      setPasswordError(error.response?.data?.message || 'Failed to update password. Please try again.');
    } finally {
      setUpdatingPassword(false);
    }
  };

  const handleFileUpload = (e, field, setPreview) => {
    const file = e.target.files[0];
    if (file) {
      const maxSize = field === 'profile_photo' ? 5 : 10;
      if (file.size > maxSize * 1024 * 1024) {
        alert(`File size must be less than ${maxSize}MB`);
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, [field]: reader.result });
        setPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.full_name || !formData.phone_number || !formData.license_number) {
      alert('Please fill in all required fields');
      return;
    }

    if (!formData.profile_photo || !formData.id_document || !formData.broker_license) {
      alert('Please upload all required documents');
      return;
    }

    setSubmitting(true);

    try {
      if (profile) {
        await axios.put(`${API_BASE_URL}/api/profiles/broker/${profile.id}`, formData);
        alert('✅ Profile updated successfully!');
      } else {
        await axios.post(`${API_BASE_URL}/api/profiles/broker`, {
          ...formData,
          user_id: user.id
        });
        alert('✅ Profile created successfully! Waiting for admin approval.');
      }
      
      if (onComplete) onComplete();
    } catch (error) {
      console.error('Error saving profile:', error);
      alert('❌ Failed to save profile. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="profile-loading">Loading profile...</div>;
  }

  return (
    <div className="broker-profile">
      <div className="profile-header">
        <h2>🤝 Broker Profile</h2>
        <p>Complete your profile to start managing properties</p>
        <button 
          className="btn-change-password"
          onClick={() => setShowPasswordModal(true)}
        >
          🔐 Change Password
        </button>
      </div>

      {profile && (
        <div className={"profile-status-banner " + (profile.profile_status)}>
          {profile.profile_status === 'pending' && (
            <>
              <span className="status-icon">⏳</span>
              <div>
                <strong>Profile Pending Approval</strong>
                <p>Your broker profile is being reviewed by our admin team</p>
              </div>
            </>
          )}
          {profile.profile_status === 'approved' && (
            <>
              <span className="status-icon">✅</span>
              <div>
                <strong>Profile Approved</strong>
                <p>You can now manage properties and agreements</p>
              </div>
            </>
          )}
          {profile.profile_status === 'rejected' && (
            <>
              <span className="status-icon">❌</span>
              <div>
                <strong>Profile Rejected</strong>
                <p>Reason: {profile.rejection_reason || 'Please contact support'}</p>
              </div>
            </>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="profile-form">
        <div className="form-section">
          <h3>Personal Information</h3>
          
          <div className="form-group">
            <label>Full Name *</label>
            <input
              type="text"
              name="full_name"
              value={formData.full_name}
              onChange={handleChange}
              required
              placeholder="Enter your full name"
            />
          </div>

          <div className="form-group">
            <label>Phone Number *</label>
            <input
              type="tel"
              name="phone_number"
              value={formData.phone_number}
              onChange={handleChange}
              required
              placeholder="e.g., +251912345678"
            />
          </div>

          <div className="form-group">
            <label>Address</label>
            <textarea
              name="address"
              value={formData.address}
              onChange={handleChange}
              rows="3"
              placeholder="Enter your address"
            />
          </div>
        </div>

        <div className="form-section">
          <h3>Broker License Information</h3>
          
          <div className="form-group">
            <label>License Number *</label>
            <input
              type="text"
              name="license_number"
              value={formData.license_number}
              onChange={handleChange}
              required
              placeholder="Enter your broker license number"
            />
          </div>
        </div>

        <div className="form-section">
          <h3>Profile Photo *</h3>
          <div className="upload-area">
            {photoPreview ? (
              <div className="preview-container">
                <img src={photoPreview} alt="Profile" className="photo-preview" />
                <button
                  type="button"
                  className="btn-change"
                  onClick={() => document.getElementById('photo-input').click()}
                >
                  Change Photo
                </button>
              </div>
            ) : (
              <div className="upload-placeholder" onClick={() => document.getElementById('photo-input').click()}>
                <span className="upload-icon">📷</span>
                <p>Click to upload profile photo</p>
                <small>JPG, PNG (Max 5MB)</small>
              </div>
            )}
            <input
              id="photo-input"
              type="file"
              accept="image/*"
              onChange={(e) => handleFileUpload(e, 'profile_photo', setPhotoPreview)}
              style={{ display: 'none' }}
            />
          </div>
        </div>

        <div className="form-section">
          <h3>ID Document *</h3>
          <p className="section-hint">Upload a clear photo of your ID card, passport, or driver's license</p>
          <div className="upload-area">
            {docPreview ? (
              <div className="preview-container">
                <img src={docPreview} alt="ID Document" className="doc-preview" />
                <button
                  type="button"
                  className="btn-change"
                  onClick={() => document.getElementById('doc-input').click()}
                >
                  Change Document
                </button>
              </div>
            ) : (
              <div className="upload-placeholder" onClick={() => document.getElementById('doc-input').click()}>
                <span className="upload-icon">📄</span>
                <p>Click to upload ID document</p>
                <small>JPG, PNG, PDF (Max 10MB)</small>
              </div>
            )}
            <input
              id="doc-input"
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => handleFileUpload(e, 'id_document', setDocPreview)}
              style={{ display: 'none' }}
            />
          </div>
        </div>

        <div className="form-section">
          <h3>Broker License Document *</h3>
          <p className="section-hint">Upload your official broker license certificate</p>
          <div className="upload-area">
            {licensePreview ? (
              <div className="preview-container">
                <img src={licensePreview} alt="Broker License" className="doc-preview" />
                <button
                  type="button"
                  className="btn-change"
                  onClick={() => document.getElementById('license-input').click()}
                >
                  Change License
                </button>
              </div>
            ) : (
              <div className="upload-placeholder" onClick={() => document.getElementById('license-input').click()}>
                <span className="upload-icon">📜</span>
                <p>Click to upload broker license</p>
                <small>JPG, PNG, PDF (Max 10MB)</small>
              </div>
            )}
            <input
              id="license-input"
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => handleFileUpload(e, 'broker_license', setLicensePreview)}
              style={{ display: 'none' }}
            />
          </div>
        </div>

        <div className="form-actions">
          <button
            type="submit"
            className="btn-submit"
            disabled={submitting}
          >
            {submitting ? '⏳ Submitting...' : profile ? '💾 Update Profile' : '✅ Submit for Approval'}
          </button>
        </div>

        {!profile && (
          <div className="info-box">
            <h4>📋 What happens next?</h4>
            <ol>
              <li>Your broker profile and license will be verified by our admin team</li>
              <li>You'll receive a notification once approved</li>
              <li>After approval, you can manage properties and create agreements</li>
            </ol>
          </div>
        )}
      </form>

      {/* Change Password Modal */}
      {showPasswordModal && (
        <div className="modal-overlay" onClick={() => setShowPasswordModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>🔐 Change Password</h3>
              <button 
                className="modal-close"
                onClick={() => setShowPasswordModal(false)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleUpdatePassword} className="modal-body">
              {passwordError && <div className="error-message"><span>⚠️</span> {passwordError}</div>}
              {passwordSuccess && <div className="success-message"><span>✅</span> {passwordSuccess}</div>}

              <div className="form-group">
                <label>Current Password *</label>
                <input
                  type="password"
                  name="currentPassword"
                  value={passwordData.currentPassword}
                  onChange={handlePasswordChange}
                  placeholder="Enter your current password"
                  required
                />
              </div>

              <div className="form-group">
                <label>New Password *</label>
                <input
                  type="password"
                  name="newPassword"
                  value={passwordData.newPassword}
                  onChange={handlePasswordChange}
                  placeholder="Min 8 chars, uppercase, number, symbol"
                  required
                />
              </div>

              <div className="form-group">
                <label>Confirm New Password *</label>
                <input
                  type="password"
                  name="confirmPassword"
                  value={passwordData.confirmPassword}
                  onChange={handlePasswordChange}
                  placeholder="Re-enter your new password"
                  required
                />
              </div>

              <div className="modal-actions">
                <button type="submit" className="btn-submit" disabled={updatingPassword}>
                  {updatingPassword ? '⏳ Updating...' : '✅ Update Password'}
                </button>
                <button 
                  type="button" 
                  className="btn-cancel"
                  onClick={() => setShowPasswordModal(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default BrokerProfile;
