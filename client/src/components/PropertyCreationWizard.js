import React, { useState } from 'react';
import axios from 'axios';
import API_BASE_URL from '../config/api';
import ImageUploader from './shared/ImageUploader';
import DocumentUploader from './shared/DocumentUploader';
import VideoUploader from './shared/VideoUploader';
import './PropertyCreationWizard.css';

const PropertyCreationWizard = ({ user, onComplete, onCancel }) => {
  const [step, setStep] = useState('form'); // form, images, video, documents, preview
  const [newPropertyId, setNewPropertyId] = useState(null);
  const [previewProperty, setPreviewProperty] = useState(null);
  const [previewImages, setPreviewImages] = useState([]);
  const [previewVideo, setPreviewVideo] = useState(null);
  const [previewDocs, setPreviewDocs] = useState([]);
  const [imageCount, setImageCount] = useState(0);
  const [videoCount, setVideoCount] = useState(0);
  const [docCount, setDocCount] = useState(0);

  const [propertyForm, setPropertyForm] = useState({
    title: '',
    type: 'apartment',
    listing_type: 'sale',
    price: '',
    location: '',
    latitude: '',
    longitude: '',
    bedrooms: '',
    bathrooms: '',
    area: '',
    description: '',
    matterport_model_id: '',
    distance_to_center_km: '3',
    near_school: false,
    near_hospital: false,
    near_market: false,
    parking: false,
    security_rating: '3',
    condition: 'Good',
  });

  const handlePropertySubmit = async (e) => {
    e.preventDefault();
    
    if (!propertyForm.title.trim()) {
      alert('Please enter a property title');
      return;
    }
    if (!propertyForm.price) {
      alert('Please enter a price');
      return;
    }

    try {
      const lat = propertyForm.latitude;
      const lng = propertyForm.longitude;

      if (lat && (isNaN(parseFloat(lat)) || parseFloat(lat) < -90 || parseFloat(lat) > 90)) {
        alert('Latitude must be between -90 and 90');
        return;
      }
      if (lng && (isNaN(parseFloat(lng)) || parseFloat(lng) < -180 || parseFloat(lng) > 180)) {
        alert('Longitude must be between -180 and 180');
        return;
      }

      const response = await axios.post(`${API_BASE_URL}/api/properties`, {
        ...propertyForm,
        latitude: lat ? parseFloat(lat) : null,
        longitude: lng ? parseFloat(lng) : null,
        owner_id: user.id,
        status: 'pending',
        size_m2: propertyForm.area,
        property_type: propertyForm.type,
        location_name: propertyForm.location,
      });

      setNewPropertyId(response.data.id);
      setStep('images');
    } catch (error) {
      console.error('Error creating property:', error);
      const msg = error.response?.data?.error || error.response?.data?.message || error.message;
      alert(`Failed to create property: ${msg}`);
    }
  };

  const handleImagesComplete = async () => {
    setImageCount(imageCount + 1);
    setStep('documents');
  };

  const handleDocumentsComplete = async () => {
    setDocCount(docCount + 1);
    setStep('preview');
    await fetchPreviewData();
  };

  const fetchPreviewData = async () => {
    try {
      const [propertyRes, imagesRes, docsRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/properties/${newPropertyId}`),
        axios.get(`${API_BASE_URL}/api/property-images/property/${newPropertyId}`),
        axios.get(`${API_BASE_URL}/api/property-documents/property/${newPropertyId}`).catch(() => ({ data: [] })),
      ]);
      setPreviewProperty(propertyRes.data);
      setPreviewImages(imagesRes.data);
      setPreviewDocs(docsRes.data);
    } catch (error) {
      console.error('Error fetching preview data:', error);
    }
  };

  const handleFinalSubmit = () => {
    onComplete();
  };

  const handleCancel = () => {
    if (newPropertyId && step !== 'preview') {
      if (!window.confirm('Are you sure? Property details have been saved. You can continue later.')) {
        return;
      }
    }
    onCancel();
  };

  const steps = ['form', 'images', 'documents', 'preview'];
  const stepTitles = {
    form: '➕ Step 1: Property Details',
    images: '📷 Step 2: Upload Images',
    documents: '📄 Step 3: Upload Documents',
    preview: '👁️ Step 4: Preview & Submit',
  };

  return (
    <div className="modal-overlay" onClick={handleCancel}>
      <div className="modal-content extra-large" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{stepTitles[step]}</h2>
          <button className="close-btn" onClick={handleCancel}>✕</button>
        </div>

        {/* Progress Bar */}
        <div className="progress-bar-container">
          {steps.map((s, index) => (
            <div
              key={s}
              className={`progress-step ${steps.indexOf(step) >= index ? 'active' : ''}`}
              style={{
                flex: 1,
                height: '4px',
                borderRadius: '2px',
                background: steps.indexOf(step) >= index ? '#667eea' : '#e2e8f0',
                marginRight: index < steps.length - 1 ? '4px' : '0',
              }}
            />
          ))}
        </div>

        <div className="modal-body">
          {/* STEP 1: Property Form */}
          {step === 'form' && (
            <form onSubmit={handlePropertySubmit}>
              <div className="form-grid">
                <div className="form-group">
                  <label>Property Title *</label>
                  <input
                    type="text"
                    value={propertyForm.title}
                    onChange={(e) => setPropertyForm({ ...propertyForm, title: e.target.value })}
                    required
                    placeholder="e.g., Modern Villa in Kezira"
                  />
                </div>

                <div className="form-group">
                  <label>Property Type *</label>
                  <select
                    value={propertyForm.type}
                    onChange={(e) => setPropertyForm({ ...propertyForm, type: e.target.value })}
                  >
                    <option value="apartment">Apartment</option>
                    <option value="house">House</option>
                    <option value="villa">Villa</option>
                    <option value="land">Land</option>
                    <option value="commercial">Commercial</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Listing Type *</label>
                  <select
                    value={propertyForm.listing_type}
                    onChange={(e) => setPropertyForm({ ...propertyForm, listing_type: e.target.value })}
                  >
                    <option value="sale">For Sale</option>
                    <option value="rent">For Rent</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Price (ETB) *</label>
                  <input
                    type="number"
                    value={propertyForm.price}
                    onChange={(e) => setPropertyForm({ ...propertyForm, price: e.target.value })}
                    required
                    placeholder="e.g., 5000000"
                  />
                </div>

                <div className="form-group">
                  <label>Location *</label>
                  <input
                    type="text"
                    value={propertyForm.location}
                    onChange={(e) => setPropertyForm({ ...propertyForm, location: e.target.value })}
                    required
                    placeholder="e.g., Kezira, Addis Ababa"
                  />
                </div>

                <div className="form-group">
                  <label>Bedrooms</label>
                  <input
                    type="number"
                    value={propertyForm.bedrooms}
                    onChange={(e) => setPropertyForm({ ...propertyForm, bedrooms: e.target.value })}
                    placeholder="e.g., 3"
                  />
                </div>

                <div className="form-group">
                  <label>Bathrooms</label>
                  <input
                    type="number"
                    value={propertyForm.bathrooms}
                    onChange={(e) => setPropertyForm({ ...propertyForm, bathrooms: e.target.value })}
                    placeholder="e.g., 2"
                  />
                </div>

                <div className="form-group">
                  <label>Area (m²)</label>
                  <input
                    type="number"
                    value={propertyForm.area}
                    onChange={(e) => setPropertyForm({ ...propertyForm, area: e.target.value })}
                    placeholder="e.g., 250"
                  />
                </div>

                <div className="form-group full-width">
                  <label>Description</label>
                  <textarea
                    value={propertyForm.description}
                    onChange={(e) => setPropertyForm({ ...propertyForm, description: e.target.value })}
                    placeholder="Describe your property..."
                    rows="4"
                  />
                </div>

                <div className="form-group">
                  <label>Latitude</label>
                  <input
                    type="text"
                    value={propertyForm.latitude}
                    onChange={(e) => setPropertyForm({ ...propertyForm, latitude: e.target.value })}
                    placeholder="e.g., 9.0320"
                  />
                </div>

                <div className="form-group">
                  <label>Longitude</label>
                  <input
                    type="text"
                    value={propertyForm.longitude}
                    onChange={(e) => setPropertyForm({ ...propertyForm, longitude: e.target.value })}
                    placeholder="e.g., 38.7469"
                  />
                </div>

                <div className="form-group">
                  <label>Matterport 3D Tour ID</label>
                  <input
                    type="text"
                    value={propertyForm.matterport_model_id}
                    onChange={(e) => setPropertyForm({ ...propertyForm, matterport_model_id: e.target.value })}
                    placeholder="e.g., SxQL3iGyoDo (from Matterport share URL)"
                  />
                </div>

                <div className="form-group">
                  <label>Condition</label>
                  <select
                    value={propertyForm.condition}
                    onChange={(e) => setPropertyForm({ ...propertyForm, condition: e.target.value })}
                  >
                    <option value="Excellent">Excellent</option>
                    <option value="Good">Good</option>
                    <option value="Fair">Fair</option>
                    <option value="Needs Repair">Needs Repair</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Security Rating</label>
                  <select
                    value={propertyForm.security_rating}
                    onChange={(e) => setPropertyForm({ ...propertyForm, security_rating: e.target.value })}
                  >
                    <option value="1">Low</option>
                    <option value="2">Medium</option>
                    <option value="3">High</option>
                    <option value="4">Very High</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Distance to Center (km)</label>
                  <input
                    type="number"
                    value={propertyForm.distance_to_center_km}
                    onChange={(e) => setPropertyForm({ ...propertyForm, distance_to_center_km: e.target.value })}
                    placeholder="e.g., 3"
                  />
                </div>

                <div className="checkbox-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={propertyForm.near_school}
                      onChange={(e) => setPropertyForm({ ...propertyForm, near_school: e.target.checked })}
                    />
                    Near School
                  </label>
                </div>

                <div className="checkbox-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={propertyForm.near_hospital}
                      onChange={(e) => setPropertyForm({ ...propertyForm, near_hospital: e.target.checked })}
                    />
                    Near Hospital
                  </label>
                </div>

                <div className="checkbox-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={propertyForm.near_market}
                      onChange={(e) => setPropertyForm({ ...propertyForm, near_market: e.target.checked })}
                    />
                    Near Market
                  </label>
                </div>

                <div className="checkbox-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={propertyForm.parking}
                      onChange={(e) => setPropertyForm({ ...propertyForm, parking: e.target.checked })}
                    />
                    Parking Available
                  </label>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={handleCancel}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Next: Upload Images →
                </button>
              </div>
            </form>
          )}

          {/* STEP 2: Images */}
          {step === 'images' && newPropertyId && (
            <div>
              <div className="step-info">
                <p>📸 Upload 5-10 high-quality images of your property</p>
                <p className="hint">First image will be used as the main/cover image</p>
              </div>
              <ImageUploader
                propertyId={newPropertyId}
                uploadedBy={user.id}
                onUploadComplete={handleImagesComplete}
              />
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setStep('form')}>
                  ← Back
                </button>
                <button type="button" className="btn-primary" onClick={() => setStep('documents')}>
                  Next: Documents →
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Documents */}
          {step === 'documents' && newPropertyId && (
            <div>
              <div className="step-info">
                <p>📄 Upload property documents (optional)</p>
                <p className="hint">Title deed, ownership certificate, etc.</p>
              </div>
              <DocumentUploader
                propertyId={newPropertyId}
                uploadedBy={user.id}
                onUploadComplete={handleDocumentsComplete}
              />
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setStep('images')}>
                  ← Back
                </button>
                <button type="button" className="btn-primary" onClick={() => setStep('preview')}>
                  Next: Preview →
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: Preview */}
          {step === 'preview' && previewProperty && (
            <div className="preview-section">
              <div className="preview-grid">
                <div className="preview-main">
                  <h3>Property Details</h3>
                  <div className="preview-details">
                    <p><strong>Title:</strong> {previewProperty.title}</p>
                    <p><strong>Type:</strong> {previewProperty.type}</p>
                    <p><strong>Listing:</strong> {previewProperty.listing_type}</p>
                    <p><strong>Price:</strong> {(previewProperty.price / 1000000).toFixed(2)}M ETB</p>
                    <p><strong>Location:</strong> {previewProperty.location}</p>
                    <p><strong>Bedrooms:</strong> {previewProperty.bedrooms || 'N/A'}</p>
                    <p><strong>Bathrooms:</strong> {previewProperty.bathrooms || 'N/A'}</p>
                    <p><strong>Area:</strong> {previewProperty.area || 'N/A'} m²</p>
                    <p><strong>Condition:</strong> {previewProperty.condition}</p>
                    <p><strong>Description:</strong> {previewProperty.description}</p>
                  </div>
                </div>

                <div className="preview-side">
                  <h3>Images ({previewImages.length})</h3>
                  <div className="preview-images">
                    {previewImages.length > 0 ? (
                      previewImages.map((img, idx) => (
                        <div key={idx} className="preview-image-item">
                          <img src={img.image_url} alt={`Preview ${idx + 1}`} />
                          {img.image_type === 'main' && <span className="main-badge">Main</span>}
                        </div>
                      ))
                    ) : (
                      <p className="no-data">No images uploaded</p>
                    )}
                  </div>

                  <h3>Documents ({previewDocs.length})</h3>
                  <div className="preview-docs">
                    {previewDocs.length > 0 ? (
                      previewDocs.map((doc, idx) => (
                        <div key={idx} className="preview-doc-item">
                          <span>📄 {doc.document_name}</span>
                          <span className="doc-type">{doc.document_type}</span>
                        </div>
                      ))
                    ) : (
                      <p className="no-data">No documents uploaded</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setStep('documents')}>
                  ← Back
                </button>
                <button type="button" className="btn-primary" onClick={handleFinalSubmit}>
                  ✅ Submit Property
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PropertyCreationWizard;
