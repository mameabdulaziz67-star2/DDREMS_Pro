import React, { useState, useEffect } from 'react';
import axios from 'axios';
import API_BASE_URL from '../config/api';
import './PropertyVideoViewer.css';

const PropertyVideoViewer = ({ property, onClose }) => {
  const [video, setVideo] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchVideo = async () => {
      try {
        console.log('Fetching property video...');
        const response = await axios.get(
          `${API_BASE_URL}/api/property-videos/property/${property.id}`
        );
        
        if (response.data && response.data.length > 0) {
          setVideo(response.data[0]); // Get first/main video
          console.log('Video loaded:', response.data[0]);
        } else {
          setError('No video available for this property');
        }
      } catch (err) {
        console.error('Error fetching video:', err);
        setError('Failed to load video');
      } finally {
        setIsLoading(false);
      }
    };

    fetchVideo();
  }, [property.id]);

  if (isLoading) {
    return (
      <div className="video-viewer-overlay" onClick={onClose}>
        <div className="video-viewer-container" onClick={(e) => e.stopPropagation()}>
          <div className="viewer-header">
            <h2>🎬 Virtual Tour</h2>
            <button className="close-btn" onClick={onClose}>✕</button>
          </div>
          <div className="viewer-content" style={{ alignItems: 'center', justifyContent: 'center' }}>
            <div className="loading-spinner">Loading video...</div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !video) {
    return (
      <div className="video-viewer-overlay" onClick={onClose}>
        <div className="video-viewer-container" onClick={(e) => e.stopPropagation()}>
          <div className="viewer-header">
            <h2>🎬 Virtual Tour</h2>
            <button className="close-btn" onClick={onClose}>✕</button>
          </div>
          <div className="viewer-content" style={{ alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ color: '#666', fontSize: '16px', textAlign: 'center' }}>
              <p>{error || 'No video available'}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="video-viewer-overlay" onClick={onClose}>
      <div className="video-viewer-container" onClick={(e) => e.stopPropagation()}>
        <div className="viewer-header">
          <h2>🎬 Virtual Tour - {property.title || 'Property'}</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="viewer-content">
          <div className="video-main">
            <video
              src={video.video_url}
              controls
              autoPlay
              className="main-video"
              controlsList="nodownload"
            />
          </div>

          <div className="video-info">
            <div className="info-section">
              <h3>📹 Video Details</h3>
              <p><strong>Title:</strong> {video.title}</p>
              {video.description && (
                <p><strong>Description:</strong> {video.description}</p>
              )}
              <p><strong>Uploaded:</strong> {new Date(video.created_at).toLocaleDateString()}</p>
            </div>

            <div className="info-section">
              <h3>🏠 Property Details</h3>
              <p><strong>Type:</strong> {property.property_type || 'Residential'}</p>
              <p><strong>Bedrooms:</strong> {property.bedrooms || 'N/A'}</p>
              <p><strong>Bathrooms:</strong> {property.bathrooms || 'N/A'}</p>
              <p><strong>Area:</strong> {property.area || 'N/A'} m²</p>
              <p><strong>Price:</strong> ${property.price?.toLocaleString() || 'N/A'}</p>
              <p><strong>Location:</strong> {property.location || 'N/A'}</p>
            </div>

            <div className="info-section">
              <h3>💡 Tips</h3>
              <ul>
                <li>Watch in fullscreen for best experience</li>
                <li>Use HD quality if available</li>
                <li>Mute sound if needed</li>
                <li>Share with friends and family</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PropertyVideoViewer;
