import { useState } from 'react';
import './Property3DViewer.css';

const MATTERPORT_TOKEN = process.env.REACT_APP_MATTERPORT_TOKEN;

const Property3DViewer = ({ property, onClose }) => {
  const [iframeLoaded, setIframeLoaded] = useState(false);

  const modelId = property.matterport_model_id;

  const matterportUrl = modelId
    ? `https://my.matterport.com/show/?m=${modelId}&token=${MATTERPORT_TOKEN}&play=1&qs=1&hr=1&brand=0`
    : null;

  return (
    <div className="property-3d-viewer-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="property-3d-viewer-container">
        <div className="viewer-header">
          <h2>🏢 3D Tour — {property.title || 'Property'}</h2>
          <button className="close-btn" onClick={onClose} aria-label="Close viewer">✕</button>
        </div>

        <div className="viewer-content">
          {modelId ? (
            <>
              {!iframeLoaded && (
                <div className="viewer-loading">
                  <div className="spinner" />
                  <p>Loading 3D Tour...</p>
                </div>
              )}
              <iframe
                title={`3D Tour - ${property.title}`}
                src={matterportUrl}
                className={`matterport-iframe ${iframeLoaded ? 'loaded' : ''}`}
                allowFullScreen
                allow="xr-spatial-tracking"
                onLoad={() => setIframeLoaded(true)}
              />
            </>
          ) : (
            <div className="viewer-no-tour">
              <span className="no-tour-icon">🏠</span>
              <p>No 3D tour available for this property.</p>
            </div>
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
