import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import API_BASE_URL from '../config/api';
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import "./AgreementWorkflow.css";
import PageHeader from "./PageHeader";

const API = `${API_BASE_URL}/api/agreement-workflow`;

// Helper: detect rental agreement reliably
const isRental = (agr) => agr?.agreement_type === 'rent' || agr?.property_listing_type === 'rent';
const buyerOrTenant = (agr) => isRental(agr) ? 'Tenant' : 'Buyer';
const ownerOrLandlord = (agr) => isRental(agr) ? 'Landlord' : 'Owner';
const priceOrRent = (agr) => isRental(agr) ? 'Rent' : 'Price';

const getSteps = (agr) => [
  { num: 1, label: "Request", icon: "📝" },
  { num: 2, label: "Admin Review", icon: "🔍" },
  { num: 3, label: `${ownerOrLandlord(agr)} Decision`, icon: "👤" },
  { num: 4, label: "PDF Generated", icon: "📄" },
  { num: 5, label: `${buyerOrTenant(agr)} Signs`, icon: "✍️" },
  { num: 6, label: `${ownerOrLandlord(agr)} Signs`, icon: "✍️" },
  { num: 7, label: "Contract Locked", icon: "🔒" },
  { num: 9, label: "Payment", icon: "💰" },
  { num: 10, label: "Funds Verified", icon: "✅" },
  { num: 11, label: "Completed", icon: "🎉" },
];

const STEPS = getSteps(null);

const STATUS_MAP = {
  pending_admin_review: {
    emoji: "⏳",
    label: "Pending Admin Review",
    color: "#f59e0b",
    step: 1,
  },
  waiting_owner_response: {
    emoji: "👤",
    label: "Waiting for Owner",
    color: "#8b5cf6",
    step: 2,
  },
  counter_offer: {
    emoji: "🔄",
    label: "Counter Offer (Owner)",
    color: "#f59e0b",
    step: 3,
  },
  counter_offer_forwarded: {
    emoji: "🔄",
    label: "Counter Offer — Awaiting Response",
    color: "#f97316",
    step: 3,
  },
  buyer_counter_offer: {
    emoji: "🔄",
    label: "Counter Offer — Pending Admin",
    color: "#8b5cf6",
    step: 3,
  },
  buyer_counter_offer_forwarded: {
    emoji: "🔄",
    label: "Counter Offer — Awaiting Owner",
    color: "#6366f1",
    step: 3,
  },
  buyer_rejected: {
    emoji: "❌",
    label: "Rejected",
    color: "#ef4444",
    step: 3,
  },
  owner_rejected: {
    emoji: "❌",
    label: "Owner Rejected",
    color: "#ef4444",
    step: 3,
  },
  owner_accepted: {
    emoji: "✅",
    label: "Owner Accepted",
    color: "#22c55e",
    step: 3,
  },
  agreement_generated: {
    emoji: "📄",
    label: "Agreement Ready",
    color: "#3b82f6",
    step: 4,
  },
  buyer_signed: {
    emoji: "✍️",
    label: "Signed",
    color: "#06b6d4",
    step: 5,
  },
  fully_signed: {
    emoji: "🔒",
    label: "Contract Locked",
    color: "#6366f1",
    step: 7,
  },
  payment_submitted: {
    emoji: "💰",
    label: "Payment Submitted",
    color: "#f97316",
    step: 9,
  },
  payment_verified: {
    emoji: "✅",
    label: "Payment Verified",
    color: "#14b8a6",
    step: 10,
  },
  handover_confirmed: {
    emoji: "🔑",
    label: "Handover Confirmed",
    color: "#22c55e",
    step: 11,
  },
  completed: { emoji: "🎉", label: "Completed", color: "#059669", step: 11 },
};

const AgreementWorkflow = ({ user, onLogout }) => {
  const [agreements, setAgreements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAgreement, setSelectedAgreement] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState("");
  const [formData, setFormData] = useState({});
  const [actionLoading, setActionLoading] = useState(false);
  const [activeProperties, setActiveProperties] = useState([]);
  const [viewedAgreements, setViewedAgreements] = useState({});
  const [contractHTML, setContractHTML] = useState(null);
  const [contractError, setContractError] = useState(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const contractRef = useRef(null);

  const handleViewContract = async (id) => {
    setContractHTML(null);
    setContractError(null);
    try {
      const res = await axios.get(`${API}/${id}/view-agreement`);
      if (res.data.success) {
        setContractHTML(res.data.document.document_content);
        setViewedAgreements((prev) => ({ ...prev, [id]: true }));
      } else {
        setContractError(res.data.message || "Failed to load document");
      }
    } catch (err) {
      console.error("Error viewing contract:", err);
      setContractError(err.response?.data?.message || err.message || "Failed to load the contract document.");
    }
  };

  const handleDownloadPDF = async () => {
    if (!contractRef.current) return;
    setDownloadingPdf(true);
    try {
      const canvas = await html2canvas(contractRef.current, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL("image/jpeg", 0.95);
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      let heightLeft = pdfHeight;
      let position = 0;
      pdf.addImage(imgData, "JPEG", 0, position, pdfWidth, pdfHeight);
      heightLeft -= pdf.internal.pageSize.getHeight();
      while (heightLeft > 0) {
        position = heightLeft - pdfHeight;
        pdf.addPage();
        pdf.addImage(imgData, "JPEG", 0, position, pdfWidth, pdfHeight);
        heightLeft -= pdf.internal.pageSize.getHeight();
      }
      pdf.save(`Agreement_AGR_${selectedAgreement?.id}.pdf`);
    } catch (error) {
      console.error("PDF generation failed:", error);
      alert("Could not generate PDF. Please try again.");
    } finally {
      setDownloadingPdf(false);
    }
  };

  useEffect(() => {
    fetchAgreements();
    if (user.role === "user" || user.role === "customer") {
      fetchActiveProperties();
    }
  }, []); // eslint-disable-line

  const fetchActiveProperties = async () => {
    try {
      const res = await axios.get(
        `${API_BASE_URL}/api/properties/active`,
      );
      setActiveProperties(res.data || []);
    } catch (err) {
      console.error("Error fetching properties:", err);
    }
  };

  const fetchAgreements = async () => {
    try {
      setLoading(true);
      let endpoint = "";
      if (user.role === "property_admin" || user.role === "system_admin") {
        endpoint = `${API}/admin/all`;
      } else if (user.role === "owner") {
        endpoint = `${API}/owner/${user.id}`;
      } else {
        endpoint = `${API}/buyer/${user.id}`;
      }
      const res = await axios.get(endpoint);
      setAgreements(res.data.agreements || []);
    } catch (err) {
      console.error("Error fetching agreements:", err);
    } finally {
      setLoading(false);
    }
  };

  const openModal = (agreement, type) => {
    setSelectedAgreement(agreement);
    setModalType(type);
    setFormData({});
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedAgreement(null);
  };

  const submitAction = async () => {
    if (!selectedAgreement && modalType !== "request") return;
    setActionLoading(true);

    try {
      let url,
        method = "post",
        data = {};
      const id = selectedAgreement?.id;

      switch (modalType) {
        case "request":
          url = `${API}/request`;
          data = {
            customer_id: user.id,
            property_id: formData.property_id,
            proposed_price: formData.proposed_price,
            move_in_date: formData.move_in_date,
            customer_notes: formData.notes,
            agreement_type: formData.agreement_type || 'sale',
            rental_duration_months: formData.rental_duration_months,
            payment_schedule: formData.payment_schedule,
            security_deposit: formData.security_deposit,
          };
          break;
        case "forward":
          url = `${API}/${id}/forward-to-owner`;
          method = "put";
          data = { admin_id: user.id, admin_notes: formData.notes };
          break;
        case "forward_counter":
          url = `${API}/${id}/forward-counter-offer`;
          method = "put";
          data = { admin_id: user.id, admin_notes: formData.notes };
          break;
        case "forward_buyer_counter":
          url = `${API}/${id}/forward-buyer-counter`;
          method = "put";
          data = { admin_id: user.id, admin_notes: formData.notes };
          break;
        case "buyer_counter_response":
          url = `${API}/${id}/buyer-counter-response`;
          method = "put";
          data = {
            buyer_id: user.id,
            response: formData.decision,
            counter_price: formData.counter_price,
            buyer_notes: formData.notes,
          };
          break;
        case "decision":
          url = `${API}/${id}/owner-decision`;
          method = "put";
          data = {
            owner_id: user.id,
            decision: formData.decision,
            owner_notes:
              formData.decision === "counter_offer"
                ? `Counter Offer${formData.counter_price ? ` — Price: ${Number(formData.counter_price).toLocaleString()} ETB` : ""}: ${formData.notes || ""}`
                : formData.notes,
          };
          break;
        case "generate":
          url = `${API}/${id}/generate-agreement`;
          data = { admin_id: user.id, template_id: 1 };
          break;
        case "buyer_sign":
          url = `${API}/${id}/buyer-sign`;
          method = "put";
          data = { buyer_id: user.id };
          break;
        case "owner_sign":
          url = `${API}/${id}/owner-sign`;
          method = "put";
          data = { owner_id: user.id };
          break;
        case "submit_payment":
          url = `${API}/${id}/submit-payment`;
          data = {
            buyer_id: user.id,
            payment_method: formData.payment_method,
            payment_amount: formData.payment_amount,
            payment_reference: formData.payment_reference,
            receipt_document: formData.receipt_document,
          };
          break;
        case "verify_payment":
          url = `${API}/${id}/verify-payment`;
          method = "put";
          data = { admin_id: user.id, admin_notes: formData.notes };
          break;
        case "confirm_handover":
          url = `${API}/${id}/confirm-handover`;
          method = "put";
          data = { buyer_id: user.id };
          break;
        case "release_funds":
          url = `${API}/${id}/release-funds`;
          method = "put";
          data = {
            admin_id: user.id,
            commission_percentage: formData.commission_percentage || 5,
            admin_notes: formData.notes,
          };
          break;
        default:
          return;
      }

      const res = await axios({ method, url, data });
      alert(`✅ ${res.data.message}`);
      closeModal();
      fetchAgreements();
    } catch (err) {
      alert(`❌ ${err.response?.data?.message || err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const getBadge = (status) =>
    STATUS_MAP[status] || {
      emoji: "❓",
      label: status,
      color: "#6b7280",
      step: 0,
    };
  const getProgress = (step) => Math.min((step / 11) * 100, 100);

  // ── Render each agreement card ──
  const renderCard = (agr) => {
    const badge = getBadge(agr.status);
    return (
      <div key={agr.id} className="agreement-card">
        {/* ── Header ── */}
        <div className="card-top">
          <div className="card-top-left">
            <h3>Agreement #{agr.id}</h3>
            <span
              className="status-pill"
              style={{
                background: badge.color + "18",
                color: badge.color,
                borderColor: badge.color + "40",
              }}
            >
              {badge.emoji} {badge.label}
            </span>
          </div>
          <span className="step-chip" style={{ color: badge.color }}>
            Step {agr.current_step}/11
          </span>
        </div>

        {/* ── Step Progress ── */}
        <div className="step-dots">
          {getSteps(agr).map((s) => (
            <div
              key={s.num}
              className={`dot ${agr.current_step >= s.num ? "active" : ""} ${agr.current_step === s.num ? "current" : ""}`}
              title={s.label}
              style={
                agr.current_step >= s.num ? { background: badge.color } : {}
              }
            >
              <span>{s.icon}</span>
            </div>
          ))}
        </div>
        <div className="progress-track">
          <div
            className="progress-fill"
            style={{
              width: `${getProgress(agr.current_step)}%`,
              background: badge.color,
            }}
          />
        </div>

        {/* ── Info ── */}
        <div className="card-info">
          <div className="info-row">
            <span className="lbl">🏠 Property</span>
            <span className="val">{agr.property_title || "N/A"}</span>
          </div>
          {isRental(agr) && (
            <div className="info-row">
              <span className="lbl">🏷️ Type</span>
              <span className="val" style={{color: '#065f46', fontWeight: 700}}>🔑 Rental</span>
            </div>
          )}
          <div className="info-row">
            <span className="lbl">👤 {buyerOrTenant(agr)}</span>
            <span className="val">{agr.customer_name || "N/A"}</span>
          </div>
          <div className="info-row">
            <span className="lbl">🏢 {ownerOrLandlord(agr)}</span>
            <span className="val">{agr.owner_name || "N/A"}</span>
          </div>
          <div className="info-row">
            <span className="lbl">💰 {priceOrRent(agr)}</span>
            <span className="val">
              {Number(
                agr.proposed_price || agr.property_price || 0,
              ).toLocaleString()}{" "}
              ETB{isRental(agr) ? ' / month' : ''}
            </span>
          </div>
          {isRental(agr) && (
            <>
              <div className="info-row">
                <span className="lbl">📅 Duration</span>
                <span className="val">{agr.rental_duration_months || 12} Months</span>
              </div>
              <div className="info-row">
                <span className="lbl">🗓️ Schedule</span>
                <span className="val" style={{textTransform: 'capitalize'}}>{agr.payment_schedule || 'monthly'}</span>
              </div>
            </>
          )}
          {agr.move_in_date && (
            <div className="info-row">
              <span className="lbl">📅 Move-in</span>
              <span className="val">
                {new Date(agr.move_in_date).toLocaleDateString()}
              </span>
            </div>
          )}
          <div className="info-row">
            <span className="lbl">📆 Requested</span>
            <span className="val">
              {new Date(agr.created_at).toLocaleDateString()}
            </span>
          </div>
        </div>

        {/* ── Signature Status ── */}
        {agr.current_step >= 4 && (
          <div className="sig-status">
            <span className={agr.buyer_signed ? "signed" : "unsigned"}>
              {agr.buyer_signed ? "✅" : "⬜"} {buyerOrTenant(agr)}{" "}
              {agr.buyer_signed ? "Signed" : "Not Signed"}
            </span>
            <span className={agr.owner_signed ? "signed" : "unsigned"}>
              {agr.owner_signed ? "✅" : "⬜"} {ownerOrLandlord(agr)}{" "}
              {agr.owner_signed ? "Signed" : "Not Signed"}
            </span>
          </div>
        )}

        {/* ── Actions ── */}
        <div className="card-actions">
          {renderActions(agr)}
          <button
            className="btn-outline"
            onClick={() => openModal(agr, "details")}
          >
            👁️ Details
          </button>
        </div>
      </div>
    );
  };

  // ── Role-based action buttons ──
  const renderActions = (agr) => {
    const isAdmin =
      user.role === "property_admin" || user.role === "system_admin";
    const isOwner = user.role === "owner";
    const isBuyer = user.role === "user" || user.role === "customer";

    return (
      <>
        {/* ── Admin Actions ── */}
        {isAdmin && agr.status === "pending_admin_review" && (
          <button
            className="btn-primary"
            onClick={() => openModal(agr, "forward")}
          >
            ➡️ Forward to Owner
          </button>
        )}
        {isAdmin && (agr.status === "pending_admin_review" || agr.status === "owner_rejected" || agr.status === "buyer_rejected") && (
          <button
            className="btn-danger"
            style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}
            onClick={async () => {
              if (!window.confirm('Delete this agreement request? This cannot be undone.')) return;
              try {
                await (await import('axios')).default.delete(`${API}/${agr.id}`);
                alert('✅ Agreement deleted');
                fetchAgreements();
              } catch (err) {
                alert('❌ Failed to delete: ' + (err.response?.data?.message || err.message));
              }
            }}
          >
            🗑️ Delete
          </button>
        )}
        {isAdmin && agr.status === "counter_offer" && (
          <button
            className="btn-warning"
            onClick={() => openModal(agr, "forward_counter")}
          >
            🔄 Forward Counter Offer to {buyerOrTenant(agr)}
          </button>
        )}
        {isAdmin && agr.status === "buyer_counter_offer" && (
          <button
            className="btn-warning"
            onClick={() => openModal(agr, "forward_buyer_counter")}
          >
            🔄 Forward {buyerOrTenant(agr)} Counter to {ownerOrLandlord(agr)}
          </button>
        )}
        {isAdmin && agr.status === "owner_accepted" && (
          <button
            className="btn-success"
            onClick={() => openModal(agr, "generate")}
          >
            📄 Generate Agreement
          </button>
        )}
        {isAdmin && agr.status === "payment_submitted" && (
          <button
            className="btn-warning"
            onClick={() => openModal(agr, "verify_payment")}
          >
            ✅ Verify Payment
          </button>
        )}
        {isAdmin && agr.status === "handover_confirmed" && (
          <button
            className="btn-success"
            onClick={() => openModal(agr, "release_funds")}
          >
            💸 Release Funds
          </button>
        )}

        {/* ── Owner Actions ── */}
        {isOwner && agr.status === "waiting_owner_response" && (
          <button
            className="btn-primary"
            onClick={() => openModal(agr, "decision")}
          >
            📋 Review & Decide
          </button>
        )}
        {isOwner && agr.status === "buyer_counter_offer_forwarded" && (
          <button
            className="btn-warning"
            onClick={() => openModal(agr, "decision")}
          >
            🔄 Respond to {buyerOrTenant(agr)} Counter Offer
          </button>
        )}
        {isOwner && agr.status === "buyer_signed" && (
          <button
            className="btn-success"
            onClick={() => openModal(agr, "owner_sign")}
          >
            ✍️ Sign Agreement
          </button>
        )}

        {/* ── Tenant/Buyer Actions ── */}
        {isBuyer &&
          (agr.status === "counter_offer" ||
            agr.status === "counter_offer_forwarded") && (
            <button
              className="btn-warning"
              onClick={() => openModal(agr, "buyer_counter_response")}
            >
              🔄 Respond to Counter Offer
            </button>
          )}
        {isBuyer && agr.status === "agreement_generated" && (
          <button
            className="btn-success"
            onClick={() => openModal(agr, "buyer_sign")}
          >
            ✍️ Sign Agreement
          </button>
        )}
        {isBuyer && agr.status === "fully_signed" && (
          <button
            className="btn-primary"
            onClick={() => openModal(agr, "submit_payment")}
          >
            💰 Pay Now
          </button>
        )}
        {isBuyer && agr.status === "payment_verified" && (
          <button
            className="btn-success"
            onClick={() => openModal(agr, "confirm_handover")}
          >
            🔑 Confirm Handover
          </button>
        )}
        {["agreement_generated", "buyer_signed", "fully_signed", "payment_submitted", "payment_verified", "handover_confirmed"].includes(agr.status) && (
          <button
            className="btn-outline"
            onClick={() => {
              handleViewContract(agr.id);
              openModal(agr, "view_agreement");
            }}
          >
            📄 View Agreement
          </button>
        )}
      </>
    );
  };

  // ── Modal Content ──
  const renderModalContent = () => {
    if (modalType === "details" && selectedAgreement) {
      const a = selectedAgreement;
      const badge = getBadge(a.status);
      return (
        <div className="details-view">
          <div className="detail-header">
            <span
              className="status-pill large"
              style={{ background: badge.color + "18", color: badge.color }}
            >
              {badge.emoji} {badge.label}
            </span>
            <span>Step {a.current_step} / 11</span>
          </div>
          <div className="detail-grid">
            <div>
              <strong>Agreement ID</strong>
              <span>#{a.id}</span>
            </div>
            <div>
              <strong>Property</strong>
              <span>{a.property_title}</span>
            </div>
            <div>
              <strong>Location</strong>
              <span>{a.property_location || "N/A"}</span>
            </div>
            <div>
              <strong>{buyerOrTenant(a)}</strong>
              <span>{a.customer_name}</span>
            </div>
            <div>
              <strong>{ownerOrLandlord(a)}</strong>
              <span>{a.owner_name}</span>
            </div>
            <div>
              <strong>Listed {priceOrRent(a)}</strong>
              <span>{Number(a.listed_price || 0).toLocaleString()} ETB{isRental(a) ? ' / month' : ''}</span>
            </div>
            <div>
              <strong>Proposed Price</strong>
              <span>
                {Number(
                  a.proposed_price || a.property_price || 0,
                ).toLocaleString()}{" "}
                ETB {isRental(a) ? '/ month' : ''}
              </span>
            </div>
            {isRental(a) && (
              <>
                <div>
                  <strong>Lease Duration</strong>
                  <span>{a.rental_duration_months || 12} Months</span>
                </div>
                <div>
                  <strong>Payment Schedule</strong>
                  <span style={{textTransform: 'capitalize'}}>{a.payment_schedule || 'monthly'}</span>
                </div>
                {a.security_deposit > 0 && (
                  <div>
                    <strong>Security Deposit</strong>
                    <span>{Number(a.security_deposit).toLocaleString()} ETB</span>
                  </div>
                )}
              </>
            )}
            {a.move_in_date && (
              <div>
                <strong>Move-in Date</strong>
                <span>{new Date(a.move_in_date).toLocaleDateString()}</span>
              </div>
            )}
            <div>
              <strong>{buyerOrTenant(a)} Signed</strong>
              <span>{a.buyer_signed ? "✅ Yes" : "❌ No"}</span>
            </div>
            <div>
              <strong>{ownerOrLandlord(a)} Signed</strong>
              <span>{a.owner_signed ? "✅ Yes" : "❌ No"}</span>
            </div>
            <div>
              <strong>Payment</strong>
              <span>
                {a.payment_submitted
                  ? a.payment_verified
                    ? "✅ Verified"
                    : "⏳ Pending Verification"
                  : "❌ Not Paid"}
              </span>
            </div>
            <div>
              <strong>Handover</strong>
              <span>
                {a.handover_confirmed ? "✅ Confirmed" : "❌ Not Yet"}
              </span>
            </div>
            {a.total_commission && (
              <div>
                <strong>Commission</strong>
                <span>
                  {Number(a.total_commission).toLocaleString()} ETB (
                  {a.commission_percentage}%)
                </span>
              </div>
            )}
            <div>
              <strong>Created</strong>
              <span>{new Date(a.created_at).toLocaleString()}</span>
            </div>
          </div>
          {a.customer_notes && (
            <div className="note-box">
              <strong>{buyerOrTenant(a)} Notes:</strong> {a.customer_notes}
            </div>
          )}
          {a.owner_notes && (
            <div className="note-box">
              <strong>Owner Notes:</strong> {a.owner_notes}
            </div>
          )}
          {a.admin_notes && (
            <div className="note-box">
              <strong>Admin Notes:</strong> {a.admin_notes}
            </div>
          )}

          {/* ── Inline Actions inside Details ── */}
          {(() => {
            const isAdmin =
              user.role === "property_admin" || user.role === "system_admin";
            const isOwner = user.role === "owner";
            const isBuyer = user.role === "user" || user.role === "customer";

            // Buyer/Tenant responding to a forwarded counter offer
            if (
              isBuyer &&
              (a.status === "counter_offer" ||
                a.status === "counter_offer_forwarded")
            ) {
              return (
                <div
                  style={{
                    marginTop: "20px",
                    padding: "16px",
                    background: "#fff7ed",
                    borderRadius: "10px",
                    border: "1px solid #fed7aa",
                  }}
                >
                  <h4 style={{ margin: "0 0 12px", color: "#c2410c" }}>
                    🔄 {ownerOrLandlord(a)}'s Counter Offer — Your Response
                  </h4>
                  <div className="form-group" style={{ marginBottom: "12px" }}>
                    <label
                      style={{
                        display: "block",
                        fontWeight: 600,
                        marginBottom: "6px",
                        fontSize: "13px",
                      }}
                    >
                      Your Response *
                    </label>
                    <select
                      value={formData.decision || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, decision: e.target.value })
                      }
                      style={{
                        width: "100%",
                        padding: "9px 12px",
                        border: "1px solid #e2e8f0",
                        borderRadius: "8px",
                        fontSize: "14px",
                      }}
                    >
                      <option value="">Select your response</option>
                      <option value="accepted">
                        ✅ Accept — Agree to owner's terms
                      </option>
                      <option value="counter_offer">
                        🔄 Counter Offer — Propose different terms
                      </option>
                      <option value="rejected">
                        ❌ Reject — Decline this offer
                      </option>
                    </select>
                  </div>
                  {formData.decision === "counter_offer" && (
                    <div
                      className="form-group"
                      style={{ marginBottom: "12px" }}
                    >
                      <label
                        style={{
                          display: "block",
                          fontWeight: 600,
                          marginBottom: "6px",
                          fontSize: "13px",
                        }}
                      >
                        Your Counter Price (ETB) — optional
                      </label>
                      <input
                        type="number"
                        value={formData.counter_price || ""}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            counter_price: e.target.value,
                          })
                        }
                        placeholder="e.g. 4200000"
                        style={{
                          width: "100%",
                          padding: "9px 12px",
                          border: "1px solid #e2e8f0",
                          borderRadius: "8px",
                          fontSize: "14px",
                          boxSizing: "border-box",
                        }}
                      />
                    </div>
                  )}
                  <div className="form-group" style={{ marginBottom: "12px" }}>
                    <label
                      style={{
                        display: "block",
                        fontWeight: 600,
                        marginBottom: "6px",
                        fontSize: "13px",
                      }}
                    >
                      {formData.decision === "counter_offer"
                        ? "Counter Offer Message *"
                        : "Message (optional)"}
                    </label>
                    <textarea
                      value={formData.notes || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, notes: e.target.value })
                      }
                      rows="3"
                      placeholder={
                        formData.decision === "counter_offer"
                          ? "Explain your counter offer terms..."
                          : "Any message to the owner..."
                      }
                      style={{
                        width: "100%",
                        padding: "9px 12px",
                        border: "1px solid #e2e8f0",
                        borderRadius: "8px",
                        fontSize: "14px",
                        resize: "vertical",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>
                  <button
                    disabled={!formData.decision || actionLoading}
                    onClick={async () => {
                      if (!formData.decision) {
                        alert("Please select a response.");
                        return;
                      }
                      setActionLoading(true);
                      try {
                        const res = await (
                          await import("axios")
                        ).default.put(`${API}/${a.id}/buyer-counter-response`, {
                          buyer_id: user.id,
                          response: formData.decision,
                          counter_price: formData.counter_price,
                          buyer_notes: formData.notes,
                        });
                        alert(`✅ ${res.data.message}`);
                        closeModal();
                        fetchAgreements();
                      } catch (err) {
                        alert(
                          `❌ ${err.response?.data?.message || err.message}`,
                        );
                      } finally {
                        setActionLoading(false);
                      }
                    }}
                    style={{
                      padding: "9px 20px",
                      background: "linear-gradient(135deg,#f59e0b,#d97706)",
                      color: "#fff",
                      border: "none",
                      borderRadius: "8px",
                      cursor: "pointer",
                      fontWeight: 600,
                      fontSize: "13px",
                    }}
                  >
                    {actionLoading ? "⏳ Submitting..." : "📤 Submit Response"}
                  </button>
                </div>
              );
            }

            // Admin forwarding owner counter offer to buyer
            if (isAdmin && a.status === "counter_offer") {
              return (
                <div
                  style={{
                    marginTop: "20px",
                    padding: "16px",
                    background: "#fffbeb",
                    borderRadius: "10px",
                    border: "1px solid #fde68a",
                  }}
                >
                  <h4 style={{ margin: "0 0 8px", color: "#92400e" }}>
                    🔄 Forward {ownerOrLandlord(a)} Counter Offer to {buyerOrTenant(a)}
                  </h4>
                  <p
                    style={{
                      fontSize: "13px",
                      color: "#6b7280",
                      marginBottom: "12px",
                    }}
                  >
                    <strong>Owner's Terms:</strong>{" "}
                    {a.owner_notes || "No additional notes"}
                  </p>
                  <div className="form-group" style={{ marginBottom: "12px" }}>
                    <label
                      style={{
                        display: "block",
                        fontWeight: 600,
                        marginBottom: "6px",
                        fontSize: "13px",
                      }}
                    >
                      Admin Notes to {buyerOrTenant(a)} (optional)
                    </label>
                    <textarea
                      value={formData.notes || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, notes: e.target.value })
                      }
                      rows="2"
                      placeholder={`Add context for the ${buyerOrTenant(a).toLowerCase()}...`}
                      style={{
                        width: "100%",
                        padding: "9px 12px",
                        border: "1px solid #e2e8f0",
                        borderRadius: "8px",
                        fontSize: "14px",
                        resize: "vertical",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>
                  <button
                    disabled={actionLoading}
                    onClick={async () => {
                      setActionLoading(true);
                      try {
                        const res = await (
                          await import("axios")
                        ).default.put(`${API}/${a.id}/forward-counter-offer`, {
                          admin_id: user.id,
                          admin_notes: formData.notes,
                        });
                        alert(`✅ ${res.data.message}`);
                        closeModal();
                        fetchAgreements();
                      } catch (err) {
                        alert(
                          `❌ ${err.response?.data?.message || err.message}`,
                        );
                      } finally {
                        setActionLoading(false);
                      }
                    }}
                    style={{
                      padding: "9px 20px",
                      background: "linear-gradient(135deg,#f59e0b,#d97706)",
                      color: "#fff",
                      border: "none",
                      borderRadius: "8px",
                      cursor: "pointer",
                      fontWeight: 600,
                      fontSize: "13px",
                    }}
                  >
                    {actionLoading ? "⏳ Forwarding..." : `🔄 Forward to ${buyerOrTenant(a)}`}
                  </button>
                </div>
              );
            }

            // Admin forwarding buyer counter offer to owner
            if (isAdmin && a.status === "buyer_counter_offer") {
              return (
                <div
                  style={{
                    marginTop: "20px",
                    padding: "16px",
                    background: "#f5f3ff",
                    borderRadius: "10px",
                    border: "1px solid #ddd6fe",
                  }}
                >
                  <h4 style={{ margin: "0 0 8px", color: "#5b21b6" }}>
                    🔄 Forward {buyerOrTenant(a)} Counter Offer to {ownerOrLandlord(a)}
                  </h4>
                  <p
                    style={{
                      fontSize: "13px",
                      color: "#6b7280",
                      marginBottom: "12px",
                    }}
                  >
                    <strong>{buyerOrTenant(a)}'s Terms:</strong>{" "}
                    {a.customer_notes || "No additional notes"}
                  </p>
                  <div className="form-group" style={{ marginBottom: "12px" }}>
                    <label
                      style={{
                        display: "block",
                        fontWeight: 600,
                        marginBottom: "6px",
                        fontSize: "13px",
                      }}
                    >
                      Admin Notes to Owner (optional)
                    </label>
                    <textarea
                      value={formData.notes || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, notes: e.target.value })
                      }
                      rows="2"
                      placeholder="Add context for the owner..."
                      style={{
                        width: "100%",
                        padding: "9px 12px",
                        border: "1px solid #e2e8f0",
                        borderRadius: "8px",
                        fontSize: "14px",
                        resize: "vertical",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>
                  <button
                    disabled={actionLoading}
                    onClick={async () => {
                      setActionLoading(true);
                      try {
                        const res = await (
                          await import("axios")
                        ).default.put(`${API}/${a.id}/forward-buyer-counter`, {
                          admin_id: user.id,
                          admin_notes: formData.notes,
                        });
                        alert(`✅ ${res.data.message}`);
                        closeModal();
                        fetchAgreements();
                      } catch (err) {
                        alert(
                          `❌ ${err.response?.data?.message || err.message}`,
                        );
                      } finally {
                        setActionLoading(false);
                      }
                    }}
                    style={{
                      padding: "9px 20px",
                      background: "linear-gradient(135deg,#8b5cf6,#6d28d9)",
                      color: "#fff",
                      border: "none",
                      borderRadius: "8px",
                      cursor: "pointer",
                      fontWeight: 600,
                      fontSize: "13px",
                    }}
                  >
                    {actionLoading ? "⏳ Forwarding..." : "🔄 Forward to Owner"}
                  </button>
                </div>
              );
            }

            // Owner — Review & Decide (also accessible from Details)
            if (
              isOwner &&
              (a.status === "waiting_owner_response" ||
                a.status === "buyer_counter_offer_forwarded")
            ) {
              return (
                <div
                  style={{
                    marginTop: "20px",
                    padding: "16px",
                    background: "#f0fdf4",
                    borderRadius: "10px",
                    border: "1px solid #bbf7d0",
                  }}
                >
                  <h4 style={{ margin: "0 0 12px", color: "#166534" }}>
                    👤 Your Decision
                  </h4>
                  <div className="form-group" style={{ marginBottom: "12px" }}>
                    <label
                      style={{
                        display: "block",
                        fontWeight: 600,
                        marginBottom: "6px",
                        fontSize: "13px",
                      }}
                    >
                      Decision *
                    </label>
                    <select
                      value={formData.decision || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, decision: e.target.value })
                      }
                      style={{
                        width: "100%",
                        padding: "9px 12px",
                        border: "1px solid #e2e8f0",
                        borderRadius: "8px",
                        fontSize: "14px",
                      }}
                    >
                      <option value="">Select decision</option>
                      <option value="accepted">✅ Accept</option>
                      <option value="counter_offer">🔄 Counter Offer</option>
                      <option value="rejected">❌ Reject</option>
                    </select>
                  </div>
                  {formData.decision === "counter_offer" && (
                    <div
                      className="form-group"
                      style={{ marginBottom: "12px" }}
                    >
                      <label
                        style={{
                          display: "block",
                          fontWeight: 600,
                          marginBottom: "6px",
                          fontSize: "13px",
                        }}
                      >
                        Counter Price (ETB) — optional
                      </label>
                      <input
                        type="number"
                        value={formData.counter_price || ""}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            counter_price: e.target.value,
                          })
                        }
                        placeholder="e.g. 4500000"
                        style={{
                          width: "100%",
                          padding: "9px 12px",
                          border: "1px solid #e2e8f0",
                          borderRadius: "8px",
                          fontSize: "14px",
                          boxSizing: "border-box",
                        }}
                      />
                    </div>
                  )}
                  <div className="form-group" style={{ marginBottom: "12px" }}>
                    <label
                      style={{
                        display: "block",
                        fontWeight: 600,
                        marginBottom: "6px",
                        fontSize: "13px",
                      }}
                    >
                      {formData.decision === "counter_offer"
                        ? "Counter Offer Message *"
                        : "Notes"}
                    </label>
                    <textarea
                      value={formData.notes || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, notes: e.target.value })
                      }
                      rows="3"
                      placeholder={
                        formData.decision === "counter_offer"
                          ? "Explain your counter offer terms..."
                          : ""
                      }
                      style={{
                        width: "100%",
                        padding: "9px 12px",
                        border: "1px solid #e2e8f0",
                        borderRadius: "8px",
                        fontSize: "14px",
                        resize: "vertical",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>
                  <button
                    disabled={!formData.decision || actionLoading}
                    onClick={async () => {
                      if (!formData.decision) {
                        alert("Please select a decision.");
                        return;
                      }
                      setActionLoading(true);
                      try {
                        const res = await (
                          await import("axios")
                        ).default.put(`${API}/${a.id}/owner-decision`, {
                          owner_id: user.id,
                          decision: formData.decision,
                          owner_notes:
                            formData.decision === "counter_offer"
                              ? `Counter Offer${formData.counter_price ? ` — Price: ${Number(formData.counter_price).toLocaleString()} ETB` : ""}: ${formData.notes || ""}`
                              : formData.notes,
                        });
                        alert(`✅ ${res.data.message}`);
                        closeModal();
                        fetchAgreements();
                      } catch (err) {
                        alert(
                          `❌ ${err.response?.data?.message || err.message}`,
                        );
                      } finally {
                        setActionLoading(false);
                      }
                    }}
                    style={{
                      padding: "9px 20px",
                      background: "linear-gradient(135deg,#3b82f6,#2563eb)",
                      color: "#fff",
                      border: "none",
                      borderRadius: "8px",
                      cursor: "pointer",
                      fontWeight: 600,
                      fontSize: "13px",
                    }}
                  >
                    {actionLoading ? "⏳ Submitting..." : "📤 Submit Decision"}
                  </button>
                </div>
              );
            }

            return null;
          })()}
        </div>
      );
    }

    if (modalType === "request") {
      return (
        <div className="modal-form">
          <p className="form-desc">
            Submit a request to begin the agreement process for a property.
          </p>
          <div className="form-group">
            <label>Property *</label>
            <select
              value={formData.property_id || ""}
              onChange={(e) => {
                const prop = activeProperties.find(p => p.id === Number(e.target.value));
                setFormData({ ...formData, property_id: e.target.value, agreement_type: prop?.listing_type || 'sale' });
              }}
              required
            >
              <option value="">— Select a property —</option>
              {activeProperties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title} — 📍 {p.location} — {(p.price / 1000000).toFixed(2)}
                  M ETB {p.listing_type === 'rent' ? '🔑 Rent' : '🏷️ Sale'}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Proposed Price (ETB)</label>
            <input
              type="number"
              value={formData.proposed_price || ""}
              onChange={(e) =>
                setFormData({ ...formData, proposed_price: e.target.value })
              }
              placeholder="Leave blank for listed price"
            />
          </div>
          <div className="form-group">
            <label>Preferred Move-in Date</label>
            <input
              type="date"
              value={formData.move_in_date || ""}
              onChange={(e) =>
                setFormData({ ...formData, move_in_date: e.target.value })
              }
            />
          </div>
          {(() => {
            const selectedProp = activeProperties.find(p => p.id === Number(formData.property_id));
            const isRent = selectedProp?.listing_type === 'rent' || formData.agreement_type === 'rent';
            if (!isRent) return null;
            return (
              <>
                <div className="form-group">
                  <label>Lease Duration (Months) *</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.rental_duration_months || 12}
                    onChange={(e) =>
                      setFormData({ ...formData, rental_duration_months: e.target.value, agreement_type: 'rent' })
                    }
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Payment Schedule</label>
                  <select
                    value={formData.payment_schedule || 'monthly'}
                    onChange={(e) =>
                      setFormData({ ...formData, payment_schedule: e.target.value, agreement_type: 'rent' })
                    }
                  >
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="semi_annual">Semi-Annually</option>
                    <option value="annual">Annually</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Security Deposit (ETB)</label>
                  <input
                    type="number"
                    value={formData.security_deposit || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, security_deposit: e.target.value, agreement_type: 'rent' })
                    }
                    placeholder="e.g. 50000"
                  />
                </div>
              </>
            );
          })()}
          <div className="form-group">
            <label>Notes</label>
            <textarea
              value={formData.notes || ""}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              rows="3"
              placeholder="Any additional information..."
            />
          </div>
        </div>
      );
    }

    if (modalType === "forward") {
      return (
        <div className="modal-form">
          <div className="info-banner">
            <p>
              📋 <strong>Property:</strong> {selectedAgreement?.property_title}
            </p>
            <p>
              👤 <strong>{buyerOrTenant(selectedAgreement)}:</strong> {selectedAgreement?.customer_name}
            </p>
            <p>
              💰 <strong>{isRental(selectedAgreement) ? "Proposed Rent" : "Price"}:</strong>{" "}
              {Number(
                selectedAgreement?.proposed_price ||
                  selectedAgreement?.property_price ||
                  0,
              ).toLocaleString()}{" "}
              ETB{isRental(selectedAgreement) ? " / month" : ""}
            </p>
            {isRental(selectedAgreement) && (
              <p style={{ marginTop: "8px", borderTop: "1px solid #e5e7eb", paddingTop: "8px" }}>
                ⏳ <strong>Duration:</strong> {selectedAgreement.rental_duration_months || 12} Months | 🗓️ <strong>Schedule:</strong> <span style={{textTransform:'capitalize'}}>{selectedAgreement.payment_schedule || 'monthly'}</span>
              </p>
            )}
          </div>
          <div className="form-group">
            <label>Admin Notes (optional)</label>
            <textarea
              value={formData.notes || ""}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              rows="3"
              placeholder="Notes for the property owner..."
            />
          </div>
        </div>
      );
    }

    if (modalType === "forward_counter") {
      return (
        <div className="modal-form">
          <div
            className="info-banner"
            style={{ borderLeft: "4px solid #f59e0b", background: "#fffbeb" }}
          >
            <p>
              🔄 <strong>Counter Offer from Owner</strong>
            </p>
            <p>
              📋 <strong>Property:</strong> {selectedAgreement?.property_title}
            </p>
            <p>
              👤 <strong>Buyer:</strong> {selectedAgreement?.customer_name}
            </p>
            <p style={{ marginTop: "8px", color: "#92400e" }}>
              <strong>Owner's Terms:</strong>{" "}
              {selectedAgreement?.owner_notes || "See owner notes"}
            </p>
          </div>
          <div className="form-group">
            <label>Admin Notes to Buyer (optional)</label>
            <textarea
              value={formData.notes || ""}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              rows="3"
              placeholder="Add context for the buyer..."
            />
          </div>
        </div>
      );
    }

    if (modalType === "forward_buyer_counter") {
      const buyerNotes = selectedAgreement?.customer_notes || "";
      // Parse price from notes if present e.g. "Buyer Counter Offer — Price: 4,200,000 ETB: message"
      const priceMatch = buyerNotes.match(/Price:\s*([\d,]+)\s*ETB/);
      const parsedPrice = priceMatch ? priceMatch[1] : null;
      const message = buyerNotes
        .replace(/Buyer Counter Offer.*?ETB:\s*/i, "")
        .replace(/Buyer Counter Offer:\s*/i, "");
      return (
        <div className="modal-form">
          <div
            className="info-banner"
            style={{ borderLeft: "4px solid #8b5cf6", background: "#f5f3ff" }}
          >
            <p>
              🔄 <strong>Counter Offer from Buyer</strong>
            </p>
            <p>
              📋 <strong>Property:</strong> {selectedAgreement?.property_title}
            </p>
            <p>
              👤 <strong>Buyer:</strong> {selectedAgreement?.customer_name}
            </p>
            {parsedPrice && (
              <p
                style={{
                  marginTop: "8px",
                  fontWeight: 700,
                  color: "#5b21b6",
                  fontSize: "15px",
                }}
              >
                💰 Buyer's Counter Price: {parsedPrice} ETB
              </p>
            )}
            {message && (
              <p style={{ marginTop: "6px", color: "#4c1d95" }}>
                <strong>Buyer's Message:</strong> {message}
              </p>
            )}
            {!parsedPrice && !message && (
              <p style={{ marginTop: "8px", color: "#6b7280" }}>
                <strong>Buyer's Notes:</strong>{" "}
                {buyerNotes || "No additional notes"}
              </p>
            )}
          </div>
          <div className="form-group">
            <label>Admin Notes to Owner (optional)</label>
            <textarea
              value={formData.notes || ""}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              rows="3"
              placeholder="Add context for the owner..."
            />
          </div>
        </div>
      );
    }

    if (modalType === "buyer_counter_response") {
      return (
        <div className="modal-form">
          <div
            className="info-banner"
            style={{ borderLeft: "4px solid #f97316", background: "#fff7ed" }}
          >
            <p>
              🔄 <strong>Counter Offer from Owner</strong>
            </p>
            <p>
              📋 <strong>Property:</strong> {selectedAgreement?.property_title}
            </p>
            <p>
              💰 <strong>Original Price:</strong>{" "}
              {Number(selectedAgreement?.property_price || 0).toLocaleString()}{" "}
              ETB
            </p>
            <p style={{ marginTop: "8px", fontWeight: 600, color: "#c2410c" }}>
              Owner's Terms:{" "}
              {selectedAgreement?.owner_notes || "No additional notes"}
            </p>
          </div>
          <div className="form-group">
            <label>Your Response *</label>
            <select
              value={formData.decision || ""}
              onChange={(e) =>
                setFormData({ ...formData, decision: e.target.value })
              }
              required
            >
              <option value="">Select your response</option>
              <option value="accepted">
                ✅ Accept — Agree to owner's terms
              </option>
              <option value="counter_offer">
                🔄 Counter Offer — Propose different terms
              </option>
              <option value="rejected">❌ Reject — Decline this offer</option>
            </select>
          </div>
          {formData.decision === "counter_offer" && (
            <div className="form-group">
              <label>Your Counter Price (ETB) — optional</label>
              <input
                type="number"
                value={formData.counter_price || ""}
                onChange={(e) =>
                  setFormData({ ...formData, counter_price: e.target.value })
                }
                placeholder="e.g. 4200000"
              />
            </div>
          )}
          <div className="form-group">
            <label>
              {formData.decision === "counter_offer"
                ? "Counter Offer Message *"
                : "Message (optional)"}
            </label>
            <textarea
              value={formData.notes || ""}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              rows="3"
              placeholder={
                formData.decision === "counter_offer"
                  ? "Explain your counter offer terms..."
                  : "Any message to the owner..."
              }
            />
          </div>
        </div>
      );
    }

    if (modalType === "decision") {
      const isBuyerCounter =
        selectedAgreement?.status === "buyer_counter_offer_forwarded";
      const buyerNotes = selectedAgreement?.customer_notes || "";
      const priceMatch = buyerNotes.match(/Price:\s*([\d,]+)\s*ETB/);
      const buyerCounterPrice = priceMatch ? priceMatch[1] : null;
      const buyerMessage = buyerNotes
        .replace(/Buyer Counter Offer.*?ETB:\s*/i, "")
        .replace(/Buyer Counter Offer:\s*/i, "")
        .trim();

      return (
        <div className="modal-form">
          <div
            className="info-banner"
            style={
              isBuyerCounter
                ? { borderLeft: "4px solid #8b5cf6", background: "#f5f3ff" }
                : {}
            }
          >
            <p>
              📋 <strong>Property:</strong> {selectedAgreement?.property_title}
            </p>
            <p>
              👤 <strong>{buyerOrTenant(selectedAgreement)}:</strong> {selectedAgreement?.customer_name}
            </p>
            <p>
              💰{" "}
              <strong>
                {isBuyerCounter ? "Original Price" : `Proposed ${priceOrRent(selectedAgreement)}`}:
              </strong>{" "}
              {Number(
                selectedAgreement?.proposed_price ||
                  selectedAgreement?.property_price ||
                  0,
              ).toLocaleString()}{" "}
              ETB{isRental(selectedAgreement) ? ' / month' : ''}
            </p>
            {isBuyerCounter && buyerCounterPrice && (
              <p
                style={{
                  marginTop: "8px",
                  fontWeight: 700,
                  color: "#5b21b6",
                  fontSize: "15px",
                }}
              >
                🔄 {buyerOrTenant(selectedAgreement)}'s Counter Price: {buyerCounterPrice} ETB
              </p>
            )}
            {isBuyerCounter && buyerMessage && (
              <p style={{ marginTop: "6px", color: "#4c1d95" }}>
                <strong>{buyerOrTenant(selectedAgreement)}'s Message:</strong> {buyerMessage}
              </p>
            )}
            {isBuyerCounter &&
              !buyerCounterPrice &&
              !buyerMessage &&
              buyerNotes && (
                <p style={{ marginTop: "6px", color: "#4c1d95" }}>
                  <strong>{buyerOrTenant(selectedAgreement)}'s Terms:</strong> {buyerNotes}
                </p>
              )}
            {selectedAgreement?.move_in_date && (
              <p>
                📅 <strong>Move-in:</strong>{" "}
                {new Date(selectedAgreement.move_in_date).toLocaleDateString()}
              </p>
            )}
            {isRental(selectedAgreement) && (
              <>
                <p>
                  ⏳ <strong>Duration:</strong> {selectedAgreement.rental_duration_months} Months
                </p>
                <p style={{ textTransform: 'capitalize' }}>
                  🗓️ <strong>Schedule:</strong> {selectedAgreement.payment_schedule || "Monthly"}
                </p>
              </>
            )}
          </div>
          <div className="form-group">
            <label>Your Decision *</label>
            <select
              value={formData.decision || ""}
              onChange={(e) =>
                setFormData({ ...formData, decision: e.target.value })
              }
              required
            >
              <option value="">Select decision</option>
              <option value="accepted">
                ✅ Accept — Proceed with Agreement
              </option>
              <option value="counter_offer">
                🔄 Counter Offer — Propose New Terms
              </option>
              <option value="rejected">❌ Reject — Decline Request</option>
            </select>
          </div>
          {formData.decision === "counter_offer" && (
            <div className="form-group">
              <label>Counter Price (ETB) — optional</label>
              <input
                type="number"
                value={formData.counter_price || ""}
                onChange={(e) =>
                  setFormData({ ...formData, counter_price: e.target.value })
                }
                placeholder="e.g. 4500000"
              />
            </div>
          )}
          <div className="form-group">
            <label>
              {formData.decision === "counter_offer"
                ? "Counter Offer Message *"
                : "Notes"}
            </label>
            <textarea
              value={formData.notes || ""}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              rows="3"
              placeholder={
                formData.decision === "counter_offer"
                  ? "Explain your counter offer terms to the buyer..."
                  : ""
              }
            />
          </div>
        </div>
      );
    }

    if (modalType === "generate") {
      return (
        <div className="modal-form">
          <div className="confirm-box">
            <div className="confirm-icon">📄</div>
            <h3>Generate Agreement PDF</h3>
            <p>
              This will create a binding agreement document with all property
              details, buyer and owner information.
            </p>
            <div className="info-banner">
              <p>
                📋 <strong>Property:</strong>{" "}
                {selectedAgreement?.property_title}
              </p>
              <p>
                💰 <strong>Price:</strong>{" "}
                {Number(
                  selectedAgreement?.proposed_price ||
                    selectedAgreement?.property_price ||
                    0,
                ).toLocaleString()}{" "}
                ETB
              </p>
            </div>
          </div>
        </div>
      );
    }

    if (modalType === "buyer_sign") {
      return (
        <div className="modal-form">
          <div className="confirm-box">
            <div className="confirm-icon">✍️</div>
            <h3>Digitally Sign Agreement</h3>
            <p>
              By clicking confirm, you digitally sign this agreement. After you
              sign, the owner will be notified to add their signature.
            </p>
            <div className="info-banner">
              <p>
                📋 <strong>Property:</strong>{" "}
                {selectedAgreement?.property_title}
              </p>
              <p>
                💰 <strong>Price:</strong>{" "}
                {Number(
                  selectedAgreement?.proposed_price ||
                    selectedAgreement?.property_price ||
                    0,
                ).toLocaleString()}{" "}
                ETB
              </p>
            </div>
            {!viewedAgreements[selectedAgreement?.id] && (
              <div className="warning-text" style={{color: '#dc2626'}}>
                ⚠️ You must view the PDF agreement before you can sign.
              </div>
            )}
            <div className="warning-text">⚠️ This action cannot be undone.</div>
          </div>
        </div>
      );
    }

    if (modalType === "owner_sign") {
      return (
        <div className="modal-form">
          <div className="confirm-box">
            <div className="confirm-icon">✍️</div>
            <h3>Sign as Owner</h3>
            <p>
              The buyer has already signed. By signing, the contract becomes
              legally binding and the buyer can proceed to make payment.
            </p>
            <div className="info-banner">
              <p>
                ✅ <strong>Buyer Signed:</strong>{" "}
                {selectedAgreement?.buyer_signed_date
                  ? new Date(
                      selectedAgreement.buyer_signed_date,
                    ).toLocaleDateString()
                  : "Yes"}
              </p>
              <p>
                💰 <strong>Price:</strong>{" "}
                {Number(
                  selectedAgreement?.proposed_price ||
                    selectedAgreement?.property_price ||
                    0,
                ).toLocaleString()}{" "}
                ETB
              </p>
            </div>
            <div className="warning-text">
              ⚠️ After both signatures, the contract is locked.
            </div>
            {!viewedAgreements[selectedAgreement?.id] && (
              <div className="warning-text" style={{color: '#dc2626', marginTop: 8}}>
                ⚠️ You must view the PDF agreement before you can sign.
              </div>
            )}
          </div>
        </div>
      );
    }

    if (modalType === "submit_payment") {
      return (
        <div className="modal-form">
          <p className="form-desc">
            💰 The contract is signed. Submit your payment details below.
          </p>
          <div className="form-group">
            <label>Payment Method *</label>
            <select
              value={formData.payment_method || ""}
              onChange={(e) =>
                setFormData({ ...formData, payment_method: e.target.value })
              }
              required
            >
              <option value="">Select method</option>
              <option value="bank_transfer">🏦 Bank Transfer</option>
              <option value="chapa">📱 Chapa</option>
              <option value="cash">💵 Cash Deposit</option>
              <option value="check">📝 Check</option>
            </select>
          </div>
          <div className="form-group">
            <label>Payment Amount (ETB) *</label>
            <input
              type="number"
              value={
                formData.payment_amount ||
                selectedAgreement?.proposed_price ||
                selectedAgreement?.property_price ||
                ""
              }
              onChange={(e) =>
                setFormData({ ...formData, payment_amount: e.target.value })
              }
              required
            />
          </div>
          <div className="form-group">
            <label>Transaction Reference / Receipt Number *</label>
            <input
              type="text"
              value={formData.payment_reference || ""}
              onChange={(e) =>
                setFormData({ ...formData, payment_reference: e.target.value })
              }
              required
              placeholder="e.g. TXN-2026-001234"
            />
          </div>
          <div className="form-group">
            <label>Receipt Document / Proof of Payment (Image or PDF)</label>
            <input
              type="file"
              accept="image/*, application/pdf"
              onChange={(e) => {
                const file = e.target.files[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onloadend = () => {
                    setFormData({ ...formData, receipt_document: reader.result });
                  };
                  reader.readAsDataURL(file);
                }
              }}
            />
          </div>
        </div>
      );
    }

    if (modalType === "verify_payment") {
      return (
        <div className="modal-form">
          <div className="confirm-box">
            <div className="confirm-icon">✅</div>
            <h3>Verify Payment</h3>
            <p>
              Confirm that the buyer's payment has been received in the DDREMS
              bank account.
            </p>
            <div className="info-banner">
              <p>
                👤 <strong>Buyer:</strong> {selectedAgreement?.customer_name}
              </p>
              <p>
                💰 <strong>Expected Amount:</strong>{" "}
                {Number(
                  selectedAgreement?.proposed_price ||
                    selectedAgreement?.property_price ||
                    0,
                ).toLocaleString()}{" "}
                ETB
              </p>
            </div>
            {selectedAgreement?.receipt_document && (
              <div className="form-group" style={{ marginTop: '16px' }}>
                <label>Uploaded Payment Proof</label>
                {selectedAgreement.receipt_document.startsWith('data:image') ? (
                  <img src={selectedAgreement.receipt_document} alt="Payment Proof" style={{ maxWidth: '100%', borderRadius: '8px', border: '1px solid #e2e8f0' }} />
                ) : selectedAgreement.receipt_document.startsWith('data:application/pdf') ? (
                  <iframe src={selectedAgreement.receipt_document} style={{ width: '100%', height: '400px', border: '1px solid #e2e8f0', borderRadius: '8px' }} title="Payment Proof PDF" />
                ) : (
                  <a href={selectedAgreement.receipt_document} target="_blank" rel="noopener noreferrer" className="btn-outline">
                    📎 View Document
                  </a>
                )}
              </div>
            )}
          </div>
          <div className="form-group">
            <label>Verification Notes</label>
            <textarea
              value={formData.notes || ""}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              rows="3"
              placeholder="e.g. Payment received via CBE, ref #1234"
            />
          </div>
        </div>
      );
    }

    if (modalType === "confirm_handover") {
      return (
        <div className="modal-form">
          <div className="confirm-box">
            <div className="confirm-icon">🔑</div>
            <h3>Confirm Key Handover</h3>
            <p>
              By confirming, you acknowledge that the owner has handed over the
              property keys and you have received access to the property.
            </p>
            <div className="warning-text">
              ⚠️ After confirmation, the admin will release funds to the owner.
            </div>
          </div>
        </div>
      );
    }

    if (modalType === "release_funds") {
      const price = Number(
        selectedAgreement?.proposed_price ||
          selectedAgreement?.property_price ||
          0,
      );
      const commPct = formData.commission_percentage || 5;
      const commission = (price * commPct) / 100;
      return (
        <div className="modal-form">
          <div className="confirm-box">
            <div className="confirm-icon">💸</div>
            <h3>Release Funds & Complete Transaction</h3>
            <p>
              The buyer has confirmed receiving the keys. Release the funds to
              complete the transaction.
            </p>
          </div>
          <div className="form-group">
            <label>Commission Percentage (%)</label>
            <input
              type="number"
              step="0.5"
              min="0"
              max="20"
              value={commPct}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  commission_percentage: parseFloat(e.target.value),
                })
              }
            />
          </div>
          <div className="info-banner">
            <p>
              💰 <strong>Total Amount:</strong> {price.toLocaleString()} ETB
            </p>
            <p>
              📊 <strong>Commission ({commPct}%):</strong>{" "}
              {commission.toLocaleString()} ETB
            </p>
            <p>
              🏠 <strong>Net to Owner:</strong>{" "}
              {(price - commission).toLocaleString()} ETB
            </p>
          </div>
          <div className="form-group">
            <label>Notes</label>
            <textarea
              value={formData.notes || ""}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              rows="2"
              placeholder="Payout reference or notes..."
            />
          </div>
        </div>
      );
    }

    if (modalType === "view_agreement") {
      return (
        <div className="modal-form" style={{ maxWidth: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
            <p className="form-desc" style={{ margin: 0 }}>Review the details of the agreement below.</p>
            <button 
              className="btn-outline" 
              onClick={handleDownloadPDF}
              disabled={downloadingPdf || !contractHTML}
              style={{ padding: '6px 12px', fontSize: 13 }}
            >
              {downloadingPdf ? "⏳ Generating PDF..." : "📥 Download PDF"}
            </button>
          </div>
          
          <div 
            style={{ 
              background: '#f1f5f9', padding: '16px', borderRadius: 8,
              maxHeight: '600px', overflowY: 'auto', border: '1px solid #cbd5e1'
            }}
          >
            {contractHTML ? (
              <div 
                ref={contractRef}
                style={{ 
                  background: '#fff', padding: '30px', margin: '0 auto',
                  maxWidth: '800px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
                }}
                dangerouslySetInnerHTML={{ __html: contractHTML }}
              />
            ) : contractError ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#ef4444' }}>❌ {contractError}</div>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px' }}>⏳ Loading document...</div>
            )}
          </div>
        </div>
      );
    }

    return null;
  };

  const getModalTitle = () => {
    const titles = {
      details: "📋 Agreement Details",
      request: "📝 New Agreement Request",
      forward: `➡️ Forward to ${selectedAgreement ? ownerOrLandlord(selectedAgreement) : "Owner"}`,
      forward_counter: `🔄 Forward Counter Offer to ${selectedAgreement ? buyerOrTenant(selectedAgreement) : "Buyer"}`,
      forward_buyer_counter: `🔄 Forward ${selectedAgreement ? buyerOrTenant(selectedAgreement) : "Buyer"} Counter Offer to ${selectedAgreement ? ownerOrLandlord(selectedAgreement) : "Owner"}`,
      buyer_counter_response: "🔄 Respond to Counter Offer",
      decision: `👤 ${selectedAgreement ? ownerOrLandlord(selectedAgreement) : "Owner"} Decision`,
      generate: "📄 Generate Agreement",
      buyer_sign: "✍️ Sign Agreement",
      owner_sign: `✍️ Sign as ${selectedAgreement ? ownerOrLandlord(selectedAgreement) : "Owner"}`,
      submit_payment: "💰 Submit Payment",
      verify_payment: "✅ Verify Payment",
      confirm_handover: "🔑 Confirm Handover",
      release_funds: "💸 Release Funds",
      view_agreement: "📄 View Agreement Document",
    };
    return titles[modalType] || "Agreement";
  };

  // ── Main Render ──
  return (
    <div className="agreement-workflow-page">
      <PageHeader
        title="Agreement Workflow"
        subtitle="Manage property agreements — 11-step safe workflow"
        user={user}
        onLogout={onLogout}
        actions={
          (user.role === "user" || user.role === "customer") && (
            <button
              className="btn-primary"
              onClick={() => openModal({}, "request")}
            >
              ➕ New Agreement Request
            </button>
          )
        }
      />

      <div className="workflow-container">
        {loading ? (
          <div className="loading-state">⏳ Loading agreements...</div>
        ) : agreements.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🤝</div>
            <h3>No agreements yet</h3>
            <p>
              {user.role === "user" || user.role === "customer"
                ? 'Click "New Agreement Request" to get started'
                : "Agreements will appear here when buyers submit requests"}
            </p>
          </div>
        ) : (
          <div className="agreements-grid">{agreements.map(renderCard)}</div>
        )}
      </div>

      {/* ── Modal ── */}
      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{getModalTitle()}</h2>
              <button className="close-btn" onClick={closeModal}>
                ✕
              </button>
            </div>
            <div className="modal-body">{renderModalContent()}</div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={closeModal}>
                Cancel
              </button>
              {modalType !== "details" && modalType !== "view_agreement" && (
                <button
                  className="btn-primary"
                  onClick={submitAction}
                  disabled={
                    actionLoading || 
                    ((modalType === "buyer_sign" || modalType === "owner_sign") && !viewedAgreements[selectedAgreement?.id])
                  }
                >
                  {actionLoading ? "⏳ Processing..." : "✅ Confirm"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AgreementWorkflow;
