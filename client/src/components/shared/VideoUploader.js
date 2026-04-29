import React, { useState } from 'react';
import API_BASE_URL from '../../config/api';
import './VideoUploader.css';

const VideoUploader = ({ propertyId, uploadedBy, onUploadComplete }) => {
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [videoInfo, setVideoInfo] = useState({
    title: '',
    description: '',
  });

  const MAX_VIDEO_SIZE = 500 * 1024 * 1024; // 500MB
  const MAX_DURATION = 180; // 3 minutes in seconds

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('video/')) {
        alert('Please select a video file');
        return;
      }

      // Validate file size
      if (file.size > MAX_VIDEO_SIZE) {
        alert(`Video is too large! Maximum size is 500MB.\nYour file: ${(file.size / 1024 / 1024).toFixed(2)}MB`);
        return;
      }

      setSelectedFile(file);

      // Create preview URL
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);

      // Check video duration
      const video = document.createElement('video');
      video.onloadedmetadata = () => {
        if (video.duration > MAX_DURATION) {
          alert(`Video is too long! Maximum duration is 3 minutes.\nYour video: ${Math.floor(video.duration / 60)}:${Math.floor(video.duration % 60).toString().padStart(2, '0')}`);
          setSelectedFile(null);
          setPreviewUrl(null);
        }
      };
      video.src = url;
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      const input = document.getElementById('video-upload');
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      input.files = dataTransfer.files;
      handleFileSelect({ target: { files: dataTransfer.files } });
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      alert('Please select a video to upload');
      return;
    }

    if (!videoInfo.title.trim()) {
      alert('Please enter a video title');
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      // Read file as base64
      const reader = new FileReader();
      const videoBase64 = await new Promise((resolve, reject) => {
        reader.onload = () => {
          setUploadProgress(50);
          resolve(reader.result);
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(selectedFile);
      });

      console.log('Uploading video...', {
        property_id: propertyId,
        title: videoInfo.title,
        size: `${(selectedFile.size / 1024 / 1024).toFixed(2)} MB`,
      });

      const response = await fetch(`${API_BASE_URL}/api/property-videos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          property_id: propertyId,
          video_url: videoBase64,
          title: videoInfo.title,
          description: videoInfo.description,
          uploaded_by: uploadedBy,
        }),
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('Video uploaded successfully:', data);
      setUploadProgress(100);

      alert('✅ Video uploaded successfully!');

      setSelectedFile(null);
      setPreviewUrl(null);
      setUploadProgress(0);
      setVideoInfo({ title: '', description: '' });

      if (onUploadComplete) {
        onUploadComplete();
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('❌ Failed to upload video. Please try again.');
      setUploadProgress(0);
    } finally {
      setUploading(false);
    }
  };

  const removeVideo = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setUploadProgress(0);
    setVideoInfo({ title: '', description: '' });
  };

  return (
    <div className="video-uploader">
      <div className="upload-section">
        <h3>📹 Virtual Tour Video</h3>
        <p className="hint">Upload a short video tour (max 3 minutes, 500MB)</p>

        <div
          className="video-upload-area"
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <input
            type="file"
            id="video-upload"
            accept="video/*"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
            disabled={uploading}
          />
          <label htmlFor="video-upload" className="video-upload-label">
            <div className="upload-icon">🎬</div>
            <p>Click to select video or drag & drop</p>
            <span>Supported: MP4, WebM, MOV, AVI</span>
          </label>
        </div>

        {previewUrl && (
          <div className="video-preview-section">
            <h4>Video Preview</h4>
            <video
              src={previewUrl}
              controls
              className="video-preview"
              style={{ maxWidth: '100%', maxHeight: '300px', borderRadius: '8px' }}
            />

            <div className="video-info-form">
              <div className="form-group">
                <label>Video Title *</label>
                <input
                  type="text"
                  value={videoInfo.title}
                  onChange={(e) => setVideoInfo({ ...videoInfo, title: e.target.value })}
                  placeholder="e.g., Property Tour - Living Room & Kitchen"
                  maxLength="100"
                />
              </div>

              <div className="form-group">
                <label>Description (optional)</label>
                <textarea
                  value={videoInfo.description}
                  onChange={(e) => setVideoInfo({ ...videoInfo, description: e.target.value })}
                  placeholder="Describe what's in the video..."
                  rows="3"
                  maxLength="500"
                />
              </div>

              {uploadProgress > 0 && uploadProgress < 100 && (
                <div className="upload-progress">
                  <div className="progress-bar" style={{ width: `${uploadProgress}%` }} />
                  <span>{uploadProgress}%</span>
                </div>
              )}

              <div className="video-actions">
                <button
                  className="btn-upload"
                  onClick={handleUpload}
                  disabled={uploading || !videoInfo.title.trim()}
                  type="button"
                >
                  {uploading ? '⏳ Uploading...' : '📤 Upload Video'}
                </button>
                <button
                  className="btn-remove"
                  onClick={removeVideo}
                  disabled={uploading}
                  type="button"
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        )}

        {!previewUrl && (
          <div className="video-tips">
            <h4>📝 Tips for Best Results</h4>
            <ul>
              <li>Keep video under 3 minutes</li>
              <li>Show key areas: living room, bedrooms, kitchen, bathrooms</li>
              <li>Use good lighting and steady camera</li>
              <li>Include property exterior and surroundings</li>
              <li>Speak clearly if narrating</li>
              <li>File size should be under 500MB</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoUploader;
