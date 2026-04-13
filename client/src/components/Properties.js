import React, { useState, useEffect } from "react"; // Re-compilation trigger
import "./Properties.css";
import axios from "axios";
import API_BASE_URL from '../config/api';
import PageHeader from "./PageHeader";
import ImageGallery from "./shared/ImageGallery";
import ImageUploader from "./shared/ImageUploader";
import DocumentUploader from "./shared/DocumentUploader";
import DocumentViewer from "./shared/DocumentViewer";
import DocumentViewerAdmin from "./shared/DocumentViewerAdmin";
import { AIPriceComparison } from "./shared/AIAdvisorWidget";
import PropertyMap from "./shared/PropertyMap";

const Properties = ({ user, onLogout, viewMode = "all" }) => {
  const [properties, setProperties] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [propertyDetail, setPropertyDetail] = useState(null);
  const [keyRequests, setKeyRequests] = useState([]);
  const [agreementRequests, setAgreementRequests] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [showDocumentViewer, setShowDocumentViewer] = useState(false);
  const [documentProperty, setDocumentProperty] = useState(null);

  // Property Creation State
  const [showAddProperty, setShowAddProperty] = useState(false);
  const [showImageUpload, setShowImageUpload] = useState(false);
  const [showDocUpload, setShowDocUpload] = useState(false);
  const [newPropertyId, setNewPropertyId] = useState(null);
  const [propertyForm, setPropertyForm] = useState({
    title: "",
    type: "apartment",
    listing_type: "sale",
    price: "",
    location: "",
    latitude: "",
    longitude: "",
    bedrooms: "",
    bathrooms: "",
    area: "",
    description: "",
  });
  const [showPreview, setShowPreview] = useState(false);
  const [previewImages, setPreviewImages] = useState([]);

  useEffect(() => {
    fetchProperties();
  }, []);

  useEffect(() => {
    if (
      user?.role === "user" ||
      user?.role === "owner" ||
      user?.role === "broker"
    ) {
      fetchUserRequests();
    }
    if (user?.role === "user") {
      fetchFavorites();
    }
  }, [user]);

  const fetchFavorites = async () => {
    try {
      const res = await axios.get(
        `${API_BASE_URL}/api/favorites/${user.id}`,
      );
      setFavorites(res.data);
    } catch (e) {
      console.error("Error fetching favorites:", e);
    }
  };

  const isFavorite = (propertyId) =>
    favorites.some((f) => f.property_id === propertyId);

  const toggleFavorite = async (propertyId) => {
    if (isFavorite(propertyId)) {
      try {
        await axios.delete(
          `${API_BASE_URL}/api/favorites/${user.id}/${propertyId}`,
        );
        setFavorites((prev) =>
          prev.filter((f) => f.property_id !== propertyId),
        );
      } catch (e) {
        alert("Failed to remove from favorites");
      }
    } else {
      try {
        await axios.post(`${API_BASE_URL}/api/favorites`, {
          user_id: user.id,
          property_id: propertyId,
        });
        setFavorites((prev) => [...prev, { property_id: propertyId }]);
      } catch (e) {
        alert("Failed to add to favorites");
      }
    }
  };

  const fetchUserRequests = async () => {
    try {
      if (user?.role === "user") {
        const [keyRes, agreementRes] = await Promise.all([
          axios.get(
            `${API_BASE_URL}/api/key-requests/customer/${user.id}`,
          ),
          axios.get(
            `${API_BASE_URL}/api/agreement-requests/customer/${user.id}`,
          ),
        ]);
        setKeyRequests(keyRes.data);
        setAgreementRequests(agreementRes.data);
      } else if (user?.role === "owner") {
        const [keyRes, agreementRes] = await Promise.all([
          axios.get(
            `${API_BASE_URL}/api/key-requests/customer/${user.id}`,
          ),
          axios.get(`${API_BASE_URL}/api/agreements/owner/${user.id}`),
        ]);
        setKeyRequests(keyRes.data);
        setAgreementRequests(agreementRes.data);
      } else if (user?.role === "broker") {
        const [keyRes, agreementRes] = await Promise.all([
          axios.get(`${API_BASE_URL}/api/key-requests/broker/${user.id}`),
          axios.get(`${API_BASE_URL}/api/agreements/broker/${user.id}`),
        ]);
        setKeyRequests(keyRes.data);
        setAgreementRequests(agreementRes.data);
      }
    } catch (error) {
      console.error("Error fetching user requests:", error);
    }
  };

  const fetchProperties = async () => {
    try {
      let endpoint = `${API_BASE_URL}/api/properties`;

      if (
        user?.role === "system_admin" ||
        user?.role === "admin" ||
        user?.role === "property_admin"
      ) {
        endpoint = `${API_BASE_URL}/api/properties/all-with-status`;
      } else if (viewMode === "my" && user?.role === "owner") {
        endpoint = `${API_BASE_URL}/api/properties/owner/${user.id}`;
      } else if (user?.role === "user" || viewMode === "all") {
        // Customers or anyone browsing the public market should ONLY see active properties!
        endpoint = `${API_BASE_URL}/api/properties/active`;
      }

      const response = await axios.get(endpoint);
      let fetchedProperties = response.data;

      if (viewMode === "my" && user?.role === "broker") {
        // Fallback filter for brokers if no specific route exists
        fetchedProperties = fetchedProperties.filter(
          (p) => p.broker_id === user.id,
        );
      }

      setProperties(fetchedProperties);
    } catch (error) {
      console.error("Error fetching properties:", error);
    }
  };

  const viewProperty = async (property) => {
    setSelectedProperty(property);
    setShowViewModal(true);
    try {
      const response = await axios.get(
        `${API_BASE_URL}/api/properties/${property.id}`,
      );
      setPropertyDetail(response.data);
    } catch (error) {
      console.error("Error fetching property details:", error);
      setPropertyDetail(property);
    }
  };

  const deleteProperty = async (propertyId) => {
    if (!window.confirm("Are you sure you want to delete this property?"))
      return;
    try {
      await axios.delete(`${API_BASE_URL}/api/properties/${propertyId}`);
      alert("Property deleted successfully");
      fetchProperties();
    } catch (error) {
      console.error("Error deleting property:", error);
      alert("Failed to delete property");
    }
  };

  const hasKey = (propertyId) => {
    return keyRequests.find(
      (req) => req.property_id === propertyId && req.status === "accepted",
    );
  };

  const hasPendingKey = (propertyId) => {
    return keyRequests.some(
      (req) => req.property_id === propertyId && req.status === "pending",
    );
  };

  const hasAgreement = (propertyId) => {
    return agreementRequests.some(
      (req) =>
        req.property_id === propertyId &&
        ["pending", "active"].includes(req.status),
    );
  };

  const requestKey = async (propertyId) => {
    try {
      await axios.post(`${API_BASE_URL}/api/key-requests`, {
        property_id: propertyId,
        customer_id: user.id,
        request_message:
          "Requesting access key to view property documents and agreement.",
      });
      alert("🔑 Key request sent successfully!");
      fetchUserRequests();
    } catch (error) {
      console.error("Error requesting key:", error);
      alert(error.response?.data?.message || "Failed to send key request");
    }
  };

  const requestAgreement = async (propertyId) => {
    try {
      await axios.post(`${API_BASE_URL}/api/agreement-requests`, {
        property_id: propertyId,
        customer_id: user.id,
        request_message:
          "I have reviewed the documents and would like to request an agreement.",
      });
      alert("🤝 Agreement request sent successfully!");
      fetchUserRequests();
    } catch (error) {
      console.error("Error requesting agreement:", error);
      alert(
        error.response?.data?.message || "Failed to send agreement request",
      );
    }
  };

  const openDocumentViewer = (property) => {
    setDocumentProperty(property);
    setShowDocumentViewer(true);
  };

  const filteredProperties = properties.filter((property) => {
    const matchesSearch =
      property.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      property.location.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter =
      filterStatus === "all" || property.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const getStatusColor = (status) => {
    const colors = {
      active: "#10b981",
      pending: "#f59e0b",
      sold: "#3b82f6",
      rented: "#8b5cf6",
      inactive: "#6b7280",
      suspended: "#ef4444",
    };
    return colors[status] || "#6b7280";
  };

  const getPropertyTypeIcon = (type) => {
    const icons = {
      house: "🏠",
      apartment: "🏢",
      villa: "🏡",
      land: "🌍",
      commercial: "🏪",
    };
    return icons[type] || "🏠";
  };

  const renderPropertyImage = (property) => {
    if (property.main_image) {
      return (
        <img
          src={property.main_image}
          alt={property.title}
          onError={(e) => {
            e.target.onerror = null;
            e.target.style.display = "none";
            e.target.parentElement.innerHTML = `<div class="no-image-placeholder"><span class="placeholder-icon">${getPropertyTypeIcon(property.type)}</span><span class="placeholder-text">${property.type}</span></div>`;
          }}
        />
      );
    }
    return (
      <div className="no-image-placeholder">
        <span className="placeholder-icon">
          {getPropertyTypeIcon(property.type)}
        </span>
        <span className="placeholder-text">{property.type}</span>
      </div>
    );
  };

  const handleAddProperty = async (e) => {
    e.preventDefault();

    // Validate lat/lng if provided
    const lat = propertyForm.latitude;
    const lng = propertyForm.longitude;
    if (
      lat !== "" &&
      (isNaN(parseFloat(lat)) || parseFloat(lat) < -90 || parseFloat(lat) > 90)
    ) {
      alert("Latitude must be a number between -90 and 90.");
      return;
    }
    if (
      lng !== "" &&
      (isNaN(parseFloat(lng)) ||
        parseFloat(lng) < -180 ||
        parseFloat(lng) > 180)
    ) {
      alert("Longitude must be a number between -180 and 180.");
      return;
    }

    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/properties`,
        {
          ...propertyForm,
          latitude: lat !== "" ? parseFloat(lat) : null,
          longitude: lng !== "" ? parseFloat(lng) : null,
          broker_id: user.role === "broker" ? user.id : 1,
          status: "pending",
        },
      );

      setNewPropertyId(response.data.id);
      setShowImageUpload(true);
      alert("Property details saved! Now upload images.");
    } catch (error) {
      console.error("Error adding property:", error);
      alert("Failed to add property");
    }
  };

  const handleImageUploadComplete = () => {
    setShowImageUpload(false);
    setShowDocUpload(true);
  };

  const handleDocUploadComplete = () => {
    setShowDocUpload(false);
    setShowPreview(true);
    fetchPreviewData();
  };

  const fetchPreviewData = async () => {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/api/property-images/property/${newPropertyId}`,
      );
      setPreviewImages(response.data);
    } catch (error) {
      console.error("Error fetching preview:", error);
    }
  };

  const handleFinalSubmit = () => {
    setShowPreview(false);
    setShowAddProperty(false);
    setNewPropertyId(null);
    setPropertyForm({
      title: "",
      type: "apartment",
      listing_type: "sale",
      price: "",
      location: "",
      latitude: "",
      longitude: "",
      bedrooms: "",
      bathrooms: "",
      area: "",
      description: "",
    });
    fetchProperties();
    alert("Property added successfully and submitted for verification!");
  };

  return (
    <div className="properties">
      <PageHeader
        title="Properties Management"
        subtitle="Manage all real estate listings and property details"
        user={user}
        onLogout={onLogout}
        actions={
          // Only show Add Property button for authorized roles (not customers)
          user?.role !== "user" && (
            <button
              className="btn-primary"
              onClick={() => setShowAddProperty(true)}
            >
              <span>➕</span> Add New Property
            </button>
          )
        }
      />

      <div className="filters-bar">
        <div className="search-box">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Search properties by title or location..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <select
          className="filter-select"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="pending">Pending</option>
          <option value="sold">Sold</option>
          <option value="rented">Rented</option>
          <option value="inactive">Inactive</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>

      <div className="properties-grid">
        {filteredProperties.map((property) => (
          <div key={property.id} className="property-card">
            <div className="property-image">
              {renderPropertyImage(property)}
              <span
                className="property-status"
                style={{ background: getStatusColor(property.status) }}
              >
                {property.status}
              </span>
              {property.image_count > 0 && (
                <span className="image-count-badge">
                  📷 {property.image_count}
                </span>
              )}
            </div>
            <div className="property-content">
              <h3>{property.title}</h3>
              <p className="property-location">📍 {property.location}</p>
              {property.listing_type && (
                <span className={"listing-type-badge " + (property.listing_type)}>
                  {property.listing_type === "sale"
                    ? "🏷️ For Sale"
                    : "🔑 For Rent"}
                </span>
              )}
              <div className="property-details">
                <span>
                  {getPropertyTypeIcon(property.type)} {property.type}
                </span>
                {property.bedrooms > 0 && (
                  <span>🛏️ {property.bedrooms} Beds</span>
                )}
                {property.bathrooms > 0 && (
                  <span>🚿 {property.bathrooms} Baths</span>
                )}
                {property.area && <span>📐 {property.area} m²</span>}
              </div>
              <div className="property-footer">
                <div className="property-price">
                  {(property.price / 1000000).toFixed(2)}M ETB
                </div>
                <div className="property-actions">
                  <button
                    className="btn-icon"
                    title="View"
                    onClick={() => viewProperty(property)}
                  >
                    👁️
                  </button>
                  <button
                    className="btn-icon"
                    title="Docs"
                    onClick={() => openDocumentViewer(property)}
                  >
                    📄
                  </button>
                  {user?.role === "user" && (
                    <button
                      className="btn-icon"
                      title={
                        isFavorite(property.id)
                          ? "Remove from favorites"
                          : "Add to favorites"
                      }
                      onClick={() => toggleFavorite(property.id)}
                      style={{
                        color: isFavorite(property.id) ? "#ef4444" : "#94a3b8",
                      }}
                    >
                      {isFavorite(property.id) ? "❤️" : "🤍"}
                    </button>
                  )}
                  {(user?.role === "admin" ||
                    user?.role === "system_admin" ||
                    user?.role === "property_admin" ||
                    user?.role === "owner") && (
                    <button
                      className="btn-icon danger"
                      title="Delete"
                      onClick={() => deleteProperty(property.id)}
                    >
                      🗑️
                    </button>
                  )}
                </div>
              </div>

              {(user?.role === "user" || user?.role === "property_admin") && (
                <div
                  style={{
                    marginTop: "10px",
                    display: "flex",
                    gap: "8px",
                    flexWrap: "wrap",
                  }}
                >
                  {!hasKey(property.id) && !hasPendingKey(property.id) && (
                    <button
                      className="btn-secondary"
                      onClick={() => requestKey(property.id)}
                    >
                      🔑 Request Key
                    </button>
                  )}
                  {hasPendingKey(property.id) && (
                    <button className="btn-secondary" disabled>
                      ⏳ Key Request Pending
                    </button>
                  )}
                  {hasKey(property.id) && (
                    <button
                      className="btn-success"
                      onClick={() => openDocumentViewer(property)}
                    >
                      ✅ Key Approved: View Docs
                    </button>
                  )}
                  {hasKey(property.id) && !hasAgreement(property.id) && (
                    <button
                      className="btn-primary"
                      onClick={() => requestAgreement(property.id)}
                    >
                      🤝 Request Agreement
                    </button>
                  )}
                  {hasAgreement(property.id) && (
                    <button className="btn-secondary" disabled>
                      📄 Agreement Requested
                    </button>
                  )}
                </div>
              )}

              {(property.broker_name || property.owner_name) && (
                <div className="property-broker">
                  <span>
                    👤{" "}
                    {property.owner_name
                      ? `Owner: ${property.owner_name}`
                      : `Broker: ${property.broker_name}`}
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {filteredProperties.length === 0 && (
        <div className="no-results">
          <p>No properties found</p>
        </div>
      )}

      {/* Add Property Modal */}
      {showAddProperty && !showImageUpload && !showDocUpload && (
        <div
          className="modal-overlay"
          onClick={() => setShowAddProperty(false)}
        >
          <div
            className="modal-content large"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2>➕ Add New Property</h2>
              <button
                className="close-btn"
                onClick={() => setShowAddProperty(false)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleAddProperty} className="modal-body">
              <div className="form-grid">
                <div className="form-group">
                  <label>Property Title *</label>
                  <input
                    type="text"
                    value={propertyForm.title}
                    onChange={(e) =>
                      setPropertyForm({
                        ...propertyForm,
                        title: e.target.value,
                      })
                    }
                    required
                    placeholder="e.g., Modern Villa in Kezira"
                  />
                </div>
                <div className="form-group">
                  <label>Property Type *</label>
                  <select
                    value={propertyForm.type}
                    onChange={(e) =>
                      setPropertyForm({ ...propertyForm, type: e.target.value })
                    }
                    required
                  >
                    <option value="apartment">Apartment</option>
                    <option value="villa">Villa</option>
                    <option value="house">House</option>
                    <option value="land">Land</option>
                    <option value="commercial">Commercial</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Listing Type *</label>
                  <select
                    value={propertyForm.listing_type}
                    onChange={(e) =>
                      setPropertyForm({
                        ...propertyForm,
                        listing_type: e.target.value,
                      })
                    }
                    required
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
                    onChange={(e) =>
                      setPropertyForm({
                        ...propertyForm,
                        price: e.target.value,
                      })
                    }
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Location *</label>
                  <input
                    type="text"
                    value={propertyForm.location}
                    onChange={(e) =>
                      setPropertyForm({
                        ...propertyForm,
                        location: e.target.value,
                      })
                    }
                    required
                  />
                </div>
                <div className="form-group">
                  <label>
                    Latitude{" "}
                    <span style={{ fontSize: "0.8em", color: "#6b7280" }}>
                      (optional, e.g. 9.5931)
                    </span>
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="-90"
                    max="90"
                    value={propertyForm.latitude}
                    onChange={(e) =>
                      setPropertyForm({
                        ...propertyForm,
                        latitude: e.target.value,
                      })
                    }
                    placeholder="e.g. 9.5931"
                  />
                </div>
                <div className="form-group">
                  <label>
                    Longitude{" "}
                    <span style={{ fontSize: "0.8em", color: "#6b7280" }}>
                      (optional, e.g. 41.8661)
                    </span>
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="-180"
                    max="180"
                    value={propertyForm.longitude}
                    onChange={(e) =>
                      setPropertyForm({
                        ...propertyForm,
                        longitude: e.target.value,
                      })
                    }
                    placeholder="e.g. 41.8661"
                  />
                </div>
                <div className="form-group">
                  <label>Bedrooms</label>
                  <input
                    type="number"
                    value={propertyForm.bedrooms}
                    onChange={(e) =>
                      setPropertyForm({
                        ...propertyForm,
                        bedrooms: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="form-group">
                  <label>Bathrooms</label>
                  <input
                    type="number"
                    value={propertyForm.bathrooms}
                    onChange={(e) =>
                      setPropertyForm({
                        ...propertyForm,
                        bathrooms: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="form-group">
                  <label>Area (m²)</label>
                  <input
                    type="number"
                    value={propertyForm.area}
                    onChange={(e) =>
                      setPropertyForm({ ...propertyForm, area: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={propertyForm.description}
                  onChange={(e) =>
                    setPropertyForm({
                      ...propertyForm,
                      description: e.target.value,
                    })
                  }
                  rows="4"
                />
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowAddProperty(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Next: Upload Images →
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Image Upload Modal */}
      {showImageUpload && newPropertyId && (
        <div className="modal-overlay">
          <div
            className="modal-content large"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2>📷 Upload Property Images</h2>
            </div>
            <div className="modal-body">
              <ImageUploader
                propertyId={newPropertyId}
                uploadedBy={user.id}
                onUploadComplete={handleImageUploadComplete}
              />
            </div>
          </div>
        </div>
      )}

      {/* Document Upload Modal */}
      {showDocUpload && newPropertyId && (
        <div className="modal-overlay">
          <div
            className="modal-content large"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2>📄 Upload Property Documents</h2>
            </div>
            <div className="modal-body">
              <DocumentUploader
                propertyId={newPropertyId}
                uploadedBy={user.id}
                onUploadComplete={handleDocUploadComplete}
              />
            </div>
            <div className="modal-actions">
              <button className="btn-primary" onClick={handleDocUploadComplete}>
                Next: Preview & Submit →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview & Submit Modal */}
      {showPreview && newPropertyId && (
        <div className="modal-overlay">
          <div
            className="modal-content extra-large"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2>👁️ Preview Your Property Listing</h2>
            </div>
            <div className="modal-body">
              <div className="preview-grid">
                <div className="preview-section full-width">
                  <h3>📷 Property Images ({previewImages.length})</h3>
                  {previewImages.length > 0 ? (
                    <div className="preview-images">
                      {previewImages.map((img) => (
                        <img key={img.id} src={img.image_url} alt="Property" />
                      ))}
                    </div>
                  ) : (
                    <p className="no-data">No images uploaded</p>
                  )}
                </div>
                <div className="preview-section">
                  <h3>ℹ️ Property Details</h3>
                  <div className="preview-details">
                    <p>
                      <strong>Title:</strong> {propertyForm.title}
                    </p>
                    <p>
                      <strong>Type:</strong> {propertyForm.type}
                    </p>
                    <p>
                      <strong>Listing:</strong> {propertyForm.listing_type}
                    </p>
                    <p>
                      <strong>Price:</strong>{" "}
                      {(propertyForm.price / 1000000).toFixed(2)}M ETB
                    </p>
                    <p>
                      <strong>Location:</strong> {propertyForm.location}
                    </p>
                    <p>
                      <strong>Bedrooms:</strong>{" "}
                      {propertyForm.bedrooms || "N/A"}
                    </p>
                    <p>
                      <strong>Bathrooms:</strong>{" "}
                      {propertyForm.bathrooms || "N/A"}
                    </p>
                    <p>
                      <strong>Area:</strong> {propertyForm.area || "N/A"} m²
                    </p>
                  </div>
                  {propertyForm.description && (
                    <div className="preview-description">
                      <strong>Description:</strong>
                      <p>{propertyForm.description}</p>
                    </div>
                  )}

                  <div style={{ marginTop: "20px" }}>
                    <AIPriceComparison propertyData={propertyForm} />
                  </div>
                </div>
                <div className="preview-section">
                  <h3>📋 Status</h3>
                  <div className="preview-status">
                    <p>✅ Property details saved</p>
                    <p>✅ Images uploaded ({previewImages.length})</p>
                    <p>✅ Documents uploaded</p>
                    <p>⏳ Pending admin approval</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-actions">
              <button
                className="btn-secondary"
                onClick={() => setShowPreview(false)}
              >
                Cancel
              </button>
              <button className="btn-primary" onClick={handleFinalSubmit}>
                ✅ Submit Property for Approval
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Property Modal */}
      {showViewModal && selectedProperty && (
        <div
          className="modal-overlay"
          onClick={() => {
            setShowViewModal(false);
            setPropertyDetail(null);
          }}
        >
          <div
            className="modal-content extra-large"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2>🏠 {selectedProperty.title}</h2>
              <button
                className="close-btn"
                onClick={() => {
                  setShowViewModal(false);
                  setPropertyDetail(null);
                }}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div className="property-view-grid">
                <div className="property-view-section full-width">
                  <h3>📷 Property Images</h3>
                  <ImageGallery
                    propertyId={selectedProperty.id}
                    canDelete={false}
                  />
                </div>
                <div className="property-view-section">
                  <h3>ℹ️ Property Information</h3>
                  <div className="info-grid">
                    <div>
                      <strong>Title:</strong> {selectedProperty.title}
                    </div>
                    <div>
                      <strong>Type:</strong> {selectedProperty.type}
                    </div>
                    <div>
                      <strong>Listing:</strong>{" "}
                      {selectedProperty.listing_type || "sale"}
                    </div>
                    <div>
                      <strong>Price:</strong>{" "}
                      {(selectedProperty.price / 1000000).toFixed(2)}M ETB
                    </div>
                    <div>
                      <strong>Location:</strong> {selectedProperty.location}
                    </div>
                    <div>
                      <strong>Bedrooms:</strong>{" "}
                      {selectedProperty.bedrooms || "N/A"}
                    </div>
                    <div>
                      <strong>Bathrooms:</strong>{" "}
                      {selectedProperty.bathrooms || "N/A"}
                    </div>
                    <div>
                      <strong>Area:</strong> {selectedProperty.area || "N/A"} m²
                    </div>
                    <div>
                      <strong>Status:</strong>{" "}
                      <span
                        className={"status-badge " + (selectedProperty.status)}
                      >
                        {selectedProperty.status}
                      </span>
                    </div>
                    <div>
                      <strong>Verified:</strong>{" "}
                      {selectedProperty.verified ? "✅ Yes" : "❌ No"}
                    </div>
                  </div>
                  {selectedProperty.description && (
                    <div className="description-box">
                      <strong>Description:</strong>
                      <p>{selectedProperty.description}</p>
                    </div>
                  )}
                  {selectedProperty.latitude && selectedProperty.longitude && (
                    <div style={{ marginTop: "16px" }}>
                      <strong>📍 Map Location</strong>
                      <PropertyMap
                        latitude={selectedProperty.latitude}
                        longitude={selectedProperty.longitude}
                        title={selectedProperty.title}
                      />
                    </div>
                  )}
                </div>
                <div className="property-view-section">
                  <h3>👤 Owner / Broker</h3>
                  <div className="submitter-info">
                    <p>
                      <strong>Owner:</strong>{" "}
                      {selectedProperty.owner_name || "N/A"}
                    </p>
                    <p>
                      <strong>Broker:</strong>{" "}
                      {selectedProperty.broker_name || "N/A"}
                    </p>
                    <p>
                      <strong>Listed:</strong>{" "}
                      {new Date(
                        selectedProperty.created_at,
                      ).toLocaleDateString()}
                    </p>
                  </div>
                  {propertyDetail && propertyDetail.verification && (
                    <div style={{ marginTop: "15px" }}>
                      <h4>📋 Verification</h4>
                      <p>
                        <strong>Status:</strong>{" "}
                        <span
                          className={"status-badge " + (propertyDetail.verification.verification_status)}
                        >
                          {propertyDetail.verification.verification_status}
                        </span>
                      </p>
                      {propertyDetail.verification.verification_notes && (
                        <p>
                          <strong>Notes:</strong>{" "}
                          {propertyDetail.verification.verification_notes}
                        </p>
                      )}
                      {propertyDetail.verification.verified_at && (
                        <p>
                          <strong>Date:</strong>{" "}
                          {new Date(
                            propertyDetail.verification.verified_at,
                          ).toLocaleString()}
                        </p>
                      )}
                    </div>
                  )}

                  {user?.role === "user" && (
                    <div style={{ marginTop: "16px" }}>
                      <button
                        onClick={() => toggleFavorite(selectedProperty.id)}
                        style={{
                          background: isFavorite(selectedProperty.id)
                            ? "#fee2e2"
                            : "#f1f5f9",
                          color: isFavorite(selectedProperty.id)
                            ? "#ef4444"
                            : "#64748b",
                          border: "none",
                          borderRadius: "8px",
                          padding: "8px 16px",
                          cursor: "pointer",
                          fontWeight: "600",
                          fontSize: "14px",
                        }}
                      >
                        {isFavorite(selectedProperty.id)
                          ? "❤️ Remove from Favorites"
                          : "🤍 Add to Favorites"}
                      </button>
                    </div>
                  )}

                  {(user?.role === "user" ||
                    user?.role === "property_admin") && (
                    <div
                      style={{
                        marginTop: "20px",
                        borderTop: "1px solid #e2e8f0",
                        paddingTop: "12px",
                      }}
                    >
                      <h4>🔐 Access & Agreement</h4>
                      <div
                        style={{
                          display: "flex",
                          gap: "8px",
                          flexWrap: "wrap",
                        }}
                      >
                        {!hasKey(selectedProperty.id) &&
                          !hasPendingKey(selectedProperty.id) && (
                            <button
                              className="btn-secondary"
                              onClick={() => requestKey(selectedProperty.id)}
                            >
                              🔑 Request Key
                            </button>
                          )}
                        {hasPendingKey(selectedProperty.id) && (
                          <button className="btn-secondary" disabled>
                            ⏳ Key Request Pending
                          </button>
                        )}
                        {hasKey(selectedProperty.id) && (
                          <button
                            className="btn-success"
                            onClick={() => openDocumentViewer(selectedProperty)}
                          >
                            ✅ Key Approved: View Documents
                          </button>
                        )}
                        {hasKey(selectedProperty.id) &&
                          !hasAgreement(selectedProperty.id) && (
                            <button
                              className="btn-primary"
                              onClick={() =>
                                requestAgreement(selectedProperty.id)
                              }
                            >
                              🤝 Request Agreement
                            </button>
                          )}
                        {hasAgreement(selectedProperty.id) && (
                          <button className="btn-secondary" disabled>
                            📄 Agreement Requested
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showDocumentViewer && (
        <div
          className="modal-overlay"
          onClick={() => setShowDocumentViewer(false)}
        >
          <div
            className="modal-content document-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2>📄 Property Documents</h2>
              <button
                className="close-btn"
                onClick={() => setShowDocumentViewer(false)}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              {user?.role === "property_admin" ? (
                <DocumentViewerAdmin
                  propertyId={documentProperty?.id}
                  property={documentProperty}
                  userId={user.id}
                />
              ) : (
                <DocumentViewer
                  propertyId={documentProperty?.id}
                  userId={user.id}
                  approvedKey={
                    keyRequests.find(
                      (r) =>
                        r.property_id === documentProperty?.id &&
                        r.status === "accepted",
                    )?.key_code
                  }
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Properties;
