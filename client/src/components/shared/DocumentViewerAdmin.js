import React, { useState, useEffect } from "react";
import "./DocumentViewer.css";
import axios from "axios";

const DocumentViewerAdmin = ({
  propertyId,
  property,
  userId,
  onVerificationAction,
}) => {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [viewedDocument, setViewedDocument] = useState(null);
  const [showDocumentModal, setShowDocumentModal] = useState(false);

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const response = await axios.get(
        `${API_BASE_URL}/api/property-documents/property/${propertyId}`,
      );
      setDocuments(response.data);
    } catch (error) {
      console.error("Error fetching documents:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (propertyId) fetchDocuments();
  }, [propertyId]);

  // Admin views document directly — no key needed
  const viewDocument = (doc) => {
    setViewedDocument(doc);
    setShowDocumentModal(true);
  };

  const handleRegenerateKey = async (doc) => {
    if (
      !window.confirm(
        "Regenerate access key? The old key will no longer work for buyers.",
      )
    )
      return;
    try {
      const response = await axios.put(
        `${API_BASE_URL}/api/property-documents/${doc.id}/regenerate-key`,
      );
      alert(
        `✅ New access key: ${response.data.access_key}\n\nShare this key with the buyer when they request access.`,
      );
      fetchDocuments();
    } catch (error) {
      alert("Failed to regenerate access key");
    }
  };

  const handleToggleLock = async (doc) => {
    const action = doc.is_locked ? "unlock" : "lock";
    if (
      !window.confirm(
        `${action.charAt(0).toUpperCase() + action.slice(1)} this document?`,
      )
    )
      return;
    try {
      await axios.put(
        `${API_BASE_URL}/api/property-documents/${doc.id}/lock`,
        { is_locked: !doc.is_locked },
      );
      fetchDocuments();
    } catch (error) {
      alert(`Failed to ${action} document`);
    }
  };

  const handleDeleteDocument = async (doc) => {
    if (
      !window.confirm(
        "Permanently delete this document? This cannot be undone.",
      )
    )
      return;
    try {
      await axios.delete(
        `${API_BASE_URL}/api/property-documents/${doc.id}`,
      );
      fetchDocuments();
    } catch (error) {
      alert("Failed to delete document");
    }
  };

  const handleVerificationAction = async (action) => {
    const msgs = {
      approved:
        "Approve this property? It will become active and visible to buyers.",
      suspended: "Suspend this property? It will be hidden from buyers.",
      rejected: "Reject this property? It will be deactivated.",
    };
    if (!window.confirm(msgs[action])) return;
    try {
      await axios.put(
        `${API_BASE_URL}/api/properties/${propertyId}/verify`,
        {
          status: action,
          verified_by: userId,
          notes: `${action} after document review by admin`,
        },
      );
      alert(`Property ${action} successfully!`);
      setShowDocumentModal(false);
      if (onVerificationAction) onVerificationAction();
    } catch (error) {
      alert(`Failed to ${action} property`);
    }
  };

  const handleDeleteProperty = async () => {
    if (
      !window.confirm(
        "Permanently delete this property? This cannot be undone.",
      )
    )
      return;
    try {
      await axios.delete(`${API_BASE_URL}/api/properties/${propertyId}`);
      alert("Property deleted.");
      setShowDocumentModal(false);
      if (onVerificationAction) onVerificationAction();
    } catch (error) {
      alert("Failed to delete property");
    }
  };

  const getDocumentIcon = (type) => {
    const icons = {
      title_deed: "📜",
      survey_plan: "🗺️",
      tax_clearance: "💳",
      building_permit: "🏗️",
      ownership_certificate: "📋",
      other: "📄",
    };
    return icons[type] || "📄";
  };

  if (loading)
    return <div className="doc-viewer-loading">Loading documents...</div>;

  return (
    <div className="document-viewer">
      <div className="doc-viewer-header">
        <h3>📄 Property Documents ({documents.length})</h3>
      </div>

      {documents.length === 0 ? (
        <div className="doc-viewer-empty">
          <div className="empty-icon">📄</div>
          <p>No documents uploaded for this property</p>
          <span>Owner needs to upload documents for verification</span>
        </div>
      ) : (
        <div className="documents-list">
          {documents.map((doc) => (
            <div key={doc.id} className="document-card">
              <div className="doc-icon">
                {getDocumentIcon(doc.document_type)}
              </div>
              <div className="doc-info">
                <h4>{doc.document_name}</h4>
                <p>{doc.document_type.replace(/_/g, " ").toUpperCase()}</p>
                <span>
                  Uploaded:{" "}
                  {new Date(
                    doc.uploaded_at || doc.created_at,
                  ).toLocaleDateString()}
                </span>
                {doc.is_locked && (
                  <span className="doc-locked-badge"> 🔒 Locked</span>
                )}
              </div>
              <div className="doc-actions">
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  {/* Admin views directly — no key required */}
                  <button
                    className="btn-view-doc"
                    onClick={() => viewDocument(doc)}
                  >
                    👁️ View
                  </button>
                  {/* Regenerate key to send to buyer */}
                  <button
                    className="btn-send-key"
                    onClick={() => handleRegenerateKey(doc)}
                    title="Regenerate key to send to buyer"
                  >
                    🔑 Regen Key
                  </button>
                  {/* Show current key */}
                  <button
                    className="btn-icon-small"
                    onClick={() =>
                      alert(
                        `🔑 Access Key for "${doc.document_name}":\n\n${doc.access_key}\n\nShare this with the buyer after their key request is approved.`,
                      )
                    }
                    title="Show current access key"
                  >
                    📋 Show Key
                  </button>
                  <button
                    className="btn-icon-small"
                    onClick={() => handleToggleLock(doc)}
                    title={doc.is_locked ? "Unlock" : "Lock"}
                  >
                    {doc.is_locked ? "🔓" : "🔒"}
                  </button>
                  <button
                    className="btn-icon-small danger"
                    onClick={() => handleDeleteDocument(doc)}
                    title="Delete document"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Document Viewer Modal — no key needed for admin */}
      {showDocumentModal && viewedDocument && (
        <div
          className="modal-overlay"
          onClick={() => setShowDocumentModal(false)}
        >
          <div
            className="modal-content extra-large"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "1200px", maxHeight: "90vh" }}
          >
            <div className="modal-header">
              <div>
                <h2>📄 {viewedDocument.document_name}</h2>
                <p
                  style={{
                    margin: "5px 0",
                    color: "#64748b",
                    fontSize: "14px",
                  }}
                >
                  {viewedDocument.document_type
                    .replace(/_/g, " ")
                    .toUpperCase()}{" "}
                  &bull; Key:{" "}
                  <strong style={{ fontFamily: "monospace" }}>
                    {viewedDocument.access_key}
                  </strong>
                </p>
              </div>
              <button
                className="close-btn"
                onClick={() => setShowDocumentModal(false)}
              >
                ✕
              </button>
            </div>

            <div
              className="modal-body"
              style={{
                padding: 0,
                maxHeight: "calc(90vh - 200px)",
                overflow: "auto",
              }}
            >
              {/* Property info bar */}
              <div
                style={{
                  padding: "12px 20px",
                  background: "#f8fafc",
                  borderBottom: "1px solid #e2e8f0",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <strong>{property?.title}</strong>
                  <p style={{ margin: 0, color: "#64748b", fontSize: "13px" }}>
                    📍 {property?.location}
                  </p>
                </div>
                <span
                  style={{
                    background:
                      property?.status === "active"
                        ? "#10b981"
                        : property?.status === "pending"
                          ? "#f59e0b"
                          : "#6b7280",
                    color: "#fff",
                    padding: "4px 10px",
                    borderRadius: "12px",
                    fontSize: "12px",
                  }}
                >
                  {property?.status}
                </span>
              </div>

              {/* Document content */}
              <div style={{ padding: "20px" }}>
                {viewedDocument.document_url?.startsWith(
                  "data:application/pdf",
                ) ||
                viewedDocument.document_path?.startsWith(
                  "data:application/pdf",
                ) ? (
                  <iframe
                    src={
                      viewedDocument.document_url ||
                      viewedDocument.document_path
                    }
                    style={{
                      width: "100%",
                      height: "600px",
                      border: "1px solid #e2e8f0",
                      borderRadius: "8px",
                    }}
                    title={viewedDocument.document_name}
                  />
                ) : viewedDocument.document_url?.startsWith("data:image") ||
                  viewedDocument.document_path?.startsWith("data:image") ? (
                  <div style={{ textAlign: "center" }}>
                    <img
                      src={
                        viewedDocument.document_url ||
                        viewedDocument.document_path
                      }
                      alt={viewedDocument.document_name}
                      style={{
                        maxWidth: "100%",
                        maxHeight: "600px",
                        borderRadius: "8px",
                      }}
                    />
                  </div>
                ) : (
                  <div
                    style={{
                      textAlign: "center",
                      padding: "40px",
                      color: "#64748b",
                    }}
                  >
                    <div style={{ fontSize: "3rem", marginBottom: "16px" }}>
                      📄
                    </div>
                    <p>Cannot preview this file type inline.</p>
                    <button
                      className="btn-primary"
                      onClick={() => {
                        const a = document.createElement("a");
                        a.href =
                          viewedDocument.document_url ||
                          viewedDocument.document_path;
                        a.download = viewedDocument.document_name;
                        a.click();
                      }}
                    >
                      📥 Download Document
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Verification actions */}
            <div
              className="modal-actions"
              style={{
                padding: "16px 20px",
                borderTop: "2px solid #e2e8f0",
                display: "flex",
                gap: "10px",
                justifyContent: "space-between",
                flexWrap: "wrap",
              }}
            >
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <button
                  className="btn-success"
                  onClick={() => handleVerificationAction("approved")}
                >
                  ✅ Approve Property
                </button>
                <button
                  className="btn-warning"
                  onClick={() => handleVerificationAction("suspended")}
                >
                  ⏸️ Suspend
                </button>
                <button
                  className="btn-danger"
                  onClick={() => handleVerificationAction("rejected")}
                >
                  ❌ Reject
                </button>
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  className="btn-danger"
                  onClick={handleDeleteProperty}
                  style={{ background: "#dc2626" }}
                >
                  🗑️ Delete Property
                </button>
                <button
                  className="btn-secondary"
                  onClick={() => setShowDocumentModal(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentViewerAdmin;
