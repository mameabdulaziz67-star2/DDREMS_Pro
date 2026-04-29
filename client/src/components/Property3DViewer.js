import { useState, useEffect } from 'react';
import axios from 'axios';
import API_BASE_URL from '../config/api';
import './Property3DViewer.css';

const Property3DViewer = ({ property, onClose }) => {
  const [images, setImages] = useState([]);
  const [hasImages, setHasImages] = useState(false);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [useFallback, setUseFallback] = useState(false);

  // Tour URL served by Express
  const tourUrl = `${API_BASE_URL}/tour/${property.id}`;

  useEffect(() => {
    const checkImages = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/api/property-images/property/${property.id}`);
        const imgs = res.data || [];
        setImages(imgs);
        setHasImages(imgs.length > 0);
      } catch {
        setHasImages(false);
      } finally {
        setLoading(false);
      }
    };
    checkImages();
  }, [property.id]);

  const handleIframeError = () => setUseFallback(true);

  return (
    <div className="property-3d-viewer-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="property-3d-viewer-container">
        <div className="viewer-header">
          <h2>🏠 3D Tour — {property.title || 'Property'}</h2>
          <div className="viewer-header-actions">
            {hasImages && (
              <button
                className={`view-toggle-btn ${useFallback ? 'active' : ''}`}
                onClick={() => setUseFallback(!useFallback)}
                title={useFallback ? 'Switch to 3D Tour' : 'Switch to Gallery'}
              >
                {useFallback ? '🌐 3D Tour' : '🖼️ Gallery'}
              </button>
            )}
            <button className="close-btn" onClick={onClose} aria-label="Close viewer">✕</button>
          </div>
        </div>

        <div className="viewer-content">
          {loading ? (
            <div className="viewer-loading">
              <div className="spinner" />
              <p>Loading...</p>
            </div>
          ) : !hasImages ? (
            <div className="viewer-no-tour">
              <span className="no-tour-icon">🏠</span>
              <p>No images available for this property.</p>
            </div>
          ) : useFallback ? (
            /* Image gallery fallback */
            <div className="viewer-gallery">
              <img
                src={images[currentIndex]?.image_url}
                alt={`Property view ${currentIndex + 1}`}
                className="gallery-image"
              />
              {images.length > 1 && (
                <div className="gallery-nav">
                  <button onClick={() => setCurrentIndex((currentIndex - 1 + images.length) % images.length)}>❮</button>
                  <span>{currentIndex + 1} / {images.length}</span>
                  <button onClick={() => setCurrentIndex((currentIndex + 1) % images.length)}>❯</button>
                </div>
              )}
            </div>
          ) : (
            /* SPHR 3D tour */
            <>
              {!iframeLoaded && (
                <div className="viewer-loading">
                  <div className="spinner" />
                  <p>Loading 3D Tour...</p>
                </div>
              )}
              <iframe
                title={`3D Tour - ${property.title}`}
                src={tourUrl}
                className={`sphr-iframe ${iframeLoaded ? 'loaded' : ''}`}
                allowFullScreen
                allow="xr-spatial-tracking"
                onLoad={() => setIframeLoaded(true)}
                onError={handleIframeError}
              />
            </>
          )}

          <div className="viewer-sidebar">
            <div className="property-info">
              <h3>Property Details</h3>
              <p><span>Type</span><strong>{property.property_type || property.type || 'Residential'}</strong></p>
              <p><span>Bedrooms</span><strong>{property.bedrooms ?? 'N/A'}</strong></p>
              <p><span>Bathrooms</span><strong>{property.bathrooms ?? 'N/A'}</strong></p>
              <p><span>Area</span><strong>{property.area ? `${property.area} m²` : 'N/A'}</strong></p>
              <p><span>Price</span><strong>${property.price?.toLocaleString() ?? 'N/A'}</strong></p>
              <p><span>Location</span><strong>{property.location || 'N/A'}</strong></p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Property3DViewer;
