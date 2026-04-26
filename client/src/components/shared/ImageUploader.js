import React, { useState } from 'react';
import API_BASE_URL from '../../config/api';
import './ImageUploader.css';

const ImageUploader = ({ propertyId, uploadedBy, onUploadComplete }) => {
  const [uploading, setUploading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [previewUrls, setPreviewUrls] = useState([]);
  const [dragActive, setDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    addFiles(files);
  };

  const addFiles = (files) => {
    // Filter only image files
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    
    if (imageFiles.length === 0) {
      alert('Please select image files only');
      return;
    }

    setSelectedFiles(prev => [...prev, ...imageFiles]);

    // Create preview URLs
    const urls = imageFiles.map(file => URL.createObjectURL(file));
    setPreviewUrls(prev => [...prev, ...urls]);
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const files = Array.from(e.dataTransfer.files);
    addFiles(files);
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      alert('Please select at least one image to upload');
      return;
    }

    setUploading(true);

    try {
      let successCount = 0;
      let failCount = 0;

      // Upload each image
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        
        try {
          setUploadProgress(prev => ({ ...prev, [i]: 0 }));

          // Create a data URL for the image
          const reader = new FileReader();
          const imageDataUrl = await new Promise((resolve, reject) => {
            reader.onloadend = () => {
              setUploadProgress(prev => ({ ...prev, [i]: 50 }));
              resolve(reader.result);
            };
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsDataURL(file);
          });
          
          const response = await fetch(`${API_BASE_URL}/api/property-images`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              property_id: propertyId,
              image_url: imageDataUrl,
              image_type: i === 0 ? 'main' : 'gallery',
              uploaded_by: uploadedBy
            })
          });

          if (!response.ok) {
            throw new Error(`Upload failed: ${response.statusText}`);
          }

          const data = await response.json();
          console.log(`Image ${i + 1} uploaded:`, data);
          setUploadProgress(prev => ({ ...prev, [i]: 100 }));
          successCount++;
        } catch (error) {
          console.error(`Failed to upload image ${i + 1}:`, error);
          setUploadProgress(prev => ({ ...prev, [i]: -1 }));
          failCount++;
        }
      }

      if (successCount > 0) {
        alert(`✅ ${successCount} image(s) uploaded successfully!${failCount > 0 ? ` (${failCount} failed)` : ''}`);
        setSelectedFiles([]);
        setPreviewUrls([]);
        setUploadProgress({});
        
        if (onUploadComplete) {
          onUploadComplete();
        }
      } else {
        alert('❌ All uploads failed. Please check your connection and try again.');
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('❌ Failed to upload images. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const removePreview = (index) => {
    const newFiles = selectedFiles.filter((_, i) => i !== index);
    const newUrls = previewUrls.filter((_, i) => i !== index);
    setSelectedFiles(newFiles);
    setPreviewUrls(newUrls);
    setUploadProgress(prev => {
      const updated = { ...prev };
      delete updated[index];
      return updated;
    });
  };

  const setMainImage = (index) => {
    const file = selectedFiles[index];
    const url = previewUrls[index];
    
    const newFiles = selectedFiles.filter((_, i) => i !== index);
    const newUrls = previewUrls.filter((_, i) => i !== index);
    
    setSelectedFiles([file, ...newFiles]);
    setPreviewUrls([url, ...newUrls]);
  };

  return (
    <div className="image-uploader">
      <div 
        className={`upload-area ${dragActive ? 'drag-active' : ''}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          type="file"
          id="image-upload"
          multiple
          accept="image/*"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
          disabled={uploading}
        />
        <label htmlFor="image-upload" className="upload-label">
          <div className="upload-icon">📷</div>
          <p>Click to select images or drag & drop</p>
          <span>Recommended: 5-10 high-quality images</span>
        </label>
      </div>

      {previewUrls.length > 0 && (
        <div className="preview-section">
          <h3>Selected Images ({previewUrls.length})</h3>
          <div className="preview-grid">
            {previewUrls.map((url, index) => (
              <div key={index} className="preview-item">
                <img src={url} alt={`Preview ${index + 1}`} />
                <div className="preview-actions">
                  <button
                    className="remove-preview"
                    onClick={() => removePreview(index)}
                    type="button"
                    title="Remove image"
                  >
                    ✕
                  </button>
                  {index !== 0 && (
                    <button
                      className="set-main"
                      onClick={() => setMainImage(index)}
                      type="button"
                      title="Set as main image"
                    >
                      ⭐
                    </button>
                  )}
                </div>
                {index === 0 && <span className="main-badge">Main Image</span>}
                {uploadProgress[index] !== undefined && (
                  <div className="upload-progress">
                    <div 
                      className={`progress-bar ${uploadProgress[index] === 100 ? 'complete' : uploadProgress[index] === -1 ? 'error' : ''}`}
                      style={{ width: `${Math.max(0, uploadProgress[index])}%` }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedFiles.length > 0 && (
        <div className="upload-actions">
          <button
            className="btn-upload"
            onClick={handleUpload}
            disabled={uploading}
            type="button"
          >
            {uploading ? '⏳ Uploading...' : `📤 Upload ${selectedFiles.length} Image(s)`}
          </button>
          {!uploading && (
            <button
              className="btn-clear"
              onClick={() => {
                setSelectedFiles([]);
                setPreviewUrls([]);
                setUploadProgress({});
              }}
              type="button"
            >
              Clear All
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default ImageUploader;
