import { useEffect, useRef, useState } from 'react';
import './Property3DViewer.css';

const Property3DViewer = ({ property, onClose }) => {
  const containerRef = useRef(null);
  const [images, setImages] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [rotationX, setRotationX] = useState(0);
  const [rotationY, setRotationY] = useState(0);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const fetchImages = async () => {
      try {
        console.log('Fetching property images...');
        const response = await fetch(`/api/property-images/property/${property.id}`);
        if (response.ok) {
          const imageData = await response.json();
          setImages(imageData);
          console.log('Loaded', imageData.length, 'property images');
        } else {
          setError('No images found for this property');
        }
      } catch (err) {
        console.error('Error fetching images:', err);
        setError('Failed to load property images');
      } finally {
        setIsLoading(false);
      }
    };

    fetchImages();
  }, [property.id]);

  const handleMouseMove = (e) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    
    setRotationY((x - 0.5) * 30);
    setRotationX((0.5 - y) * 30);
  };

  const handleMouseLeave = () => {
    setRotationX(0);
    setRotationY(0);
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setScale(prev => Math.max(0.5, Math.min(2, prev + delta)));
  };

  const nextImage = () => {
    setCurrentIndex((prev) => (prev + 1) % images.length);
  };

  const prevImage = () => {
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  if (error && images.length === 0) {
    return (
      <div className="property-3d-viewer-overlay">
        <div className="property-3d-viewer-container">
          <div className="viewer-header">
            <h2>🏢 Property Gallery</h2>
            <button className="close-btn" onClick={onClose}>✕</button>
          </div>
          <div className="viewer-content" style={{ alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ color: '#666', fontSize: '18px', textAlign: 'center' }}>
              <p>{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="property-3d-viewer-overlay">
        <div className="property-3d-viewer-container">
          <div className="viewer-header">
            <h2>🏢 Property Gallery</h2>
            <button className="close-btn" onClick={onClose}>✕</button>
          </div>
          <div className="viewer-content" style={{ alignItems: 'center', justifyContent: 'center' }}>
            <div className="loading-spinner">Loading images...</div>
          </div>
        </div>
      </div>
    );
  }

  if (images.length === 0) {
    return (
      <div className="property-3d-viewer-overlay">
        <div className="property-3d-viewer-container">
          <div className="viewer-header">
            <h2>🏢 Property Gallery</h2>
            <button className="close-btn" onClick={onClose}>✕</button>
          </div>
          <div className="viewer-content" style={{ alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ color: '#999', fontSize: '16px' }}>No images available</div>
          </div>
        </div>
      </div>
    );
  }

  const currentImage = images[currentIndex];

  return (
    <div className="property-3d-viewer-overlay">
      <div className="property-3d-viewer-container">
        <div className="viewer-header">
          <h2>🏢 Property Gallery - {property.title || 'Property'}</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="viewer-content">
          <div 
            ref={containerRef}
            className="viewer-canvas"
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            onWheel={handleWheel}
          >
            <div className="image-container">
              <img
                src={currentImage.image_url}
                alt={`Property view ${currentIndex + 1}`}
                className="property-image"
                style={{
                  transform: `perspective(1000px) rotateX(${rotationX}deg) rotateY(${rotationY}deg) scale(${scale})`,
                }}
              />
            </div>

            <div className="image-nav">
              <button className="nav-btn prev-btn" onClick={prevImage}>❮</button>
              <div className="image-counter">
                {currentIndex + 1} / {images.length}
              </div>
              <button className="nav-btn next-btn" onClick={nextImage}>❯</button>
            </div>
          </div>

          <div className="viewer-controls">
            <div className="control-group">
              <label>Zoom</label>
              <input
                type="range"
                min="0.5"
                max="2"
                step="0.1"
                value={scale}
                onChange={(e) => setScale(parseFloat(e.target.value))}
                className="slider"
              />
              <span className="value">{(scale * 100).toFixed(0)}%</span>
            </div>

            <div className="control-group">
              <label>Rotation X</label>
              <span className="value">{rotationX.toFixed(1)}°</span>
            </div>

            <div className="control-group">
              <label>Rotation Y</label>
              <span className="value">{rotationY.toFixed(1)}°</span>
            </div>

            <div className="property-info">
              <h3>Property Details</h3>
              <p><strong>Type:</strong> {property.property_type || 'Residential'}</p>
              <p><strong>Bedrooms:</strong> {property.bedrooms || 'N/A'}</p>
              <p><strong>Bathrooms:</strong> {property.bathrooms || 'N/A'}</p>
              <p><strong>Area:</strong> {property.area || 'N/A'} m²</p>
              <p><strong>Price:</strong> ${property.price?.toLocaleString() || 'N/A'}</p>
              <p><strong>Location:</strong> {property.location || 'N/A'}</p>
            </div>

            <div className="image-thumbnails">
              <h3>Images</h3>
              <div className="thumbnails-grid">
                {images.map((img, idx) => (
                  <img
                    key={idx}
                    src={img.image_url}
                    alt={`Thumbnail ${idx + 1}`}
                    className={`thumbnail ${idx === currentIndex ? 'active' : ''}`}
                    onClick={() => setCurrentIndex(idx)}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Property3DViewer;
