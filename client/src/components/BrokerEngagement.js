import React, { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import "./BrokerEngagement.css";

const API = "http://localhost:5000/api/broker-engagement";

// Helper: detect rental engagement
const isRentalEng = (eng) => eng?.engagement_type === 'rent';
const bt = (eng) => isRentalEng(eng) ? 'Tenant' : 'Buyer';
const ol = (eng) => isRentalEng(eng) ? 'Landlord' : 'Owner';

const STATUS_MAP = {
  pending_broker_acceptance: { emoji: "⏳", label: "Pending Broker Acceptance", color: "#f59e0b" },
  broker_declined: { emoji: "❌", label: "Broker Declined", color: "#ef4444" },
  broker_negotiating: { emoji: "🤝", label: "Broker Negotiating", color: "#3b82f6" },
  pending_buyer_approval: { emoji: "⏳", label: "Pending Approval", color: "#f59e0b" },
  owner_counter_offered: { emoji: "🔄", label: "Owner Counter-Offered", color: "#f97316" },
  broker_reviewing_counter: { emoji: "🔍", label: "Broker Reviewing Counter", color: "#8b5cf6" },
  awaiting_buyer_authorization: { emoji: "🔔", label: "Awaiting Authorization", color: "#dc2626" },
  broker_finalizing: { emoji: "✅", label: "Broker Finalizing", color: "#22c55e" },
  agreement_generated: { emoji: "📄", label: "Contract Ready", color: "#0891b2" },
  pending_signatures: { emoji: "✍️", label: "Pending Signatures", color: "#6366f1" },
  fully_signed: { emoji: "🔒", label: "Fully Signed", color: "#059669" },
  payment_submitted: { emoji: "💰", label: "Payment Submitted", color: "#f59e0b" },
  payment_rejected: { emoji: "❌", label: "Payment Rejected", color: "#dc2626" },
  payment_verified: { emoji: "✅", label: "Payment Verified", color: "#22c55e" },
  handover_confirmed: { emoji: "🔑", label: "Handover Confirmed", color: "#0891b2" },
  completed: { emoji: "🎉", label: "Completed", color: "#059669" },
  cancelled: { emoji: "🚫", label: "Cancelled", color: "#6b7280" },
};

const BrokerEngagement = ({ user }) => {
  const [engagements, setEngagements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState("");
  const [selectedEngagement, setSelectedEngagement] = useState(null);
  const [formData, setFormData] = useState({});
  const [actionLoading, setActionLoading] = useState(false);
  const [brokers, setBrokers] = useState([]);
  const [properties, setProperties] = useState([]);
  const [messages, setMessages] = useState([]);
  const [history, setHistory] = useState([]);
  const [signatures, setSignatures] = useState([]);
  const [contractHTML, setContractHTML] = useState("");
  const [viewedEngagements, setViewedEngagements] = useState({});
  const [pdfLoading, setPdfLoading] = useState(false);
  const contractRef = useRef(null);

  const isBuyer = user.role === "user" || user.role === "customer";
  const isBroker = user.role === "broker";
  const isOwner = user.role === "owner";
  const isAdmin = user.role === "property_admin" || user.role === "system_admin" || user.role === "admin";

  const fetchEngagements = useCallback(async () => {
    try {
      setLoading(true);
      let endpoint;
      if (isAdmin) endpoint = `${API}/admin/all`;
      else if (isBroker) endpoint = `${API}/broker/${user.id}`;
      else if (isOwner) endpoint = `${API}/owner/${user.id}`;
      else endpoint = `${API}/buyer/${user.id}`;

      const res = await axios.get(endpoint);
      setEngagements(res.data.engagements || []);
    } catch (err) {
      console.error("Error fetching engagements:", err);
    } finally {
      setLoading(false);
    }
  }, [user.id, user.role, isAdmin, isBroker, isOwner]);

  useEffect(() => {
    fetchEngagements();
  }, [fetchEngagements]);

  const fetchBrokers = async () => {
    try {
      const res = await axios.get(`${API}/available-brokers`);
      setBrokers(res.data.brokers || []);
    } catch (err) { console.error(err); }
  };

  const fetchProperties = async () => {
    try {
      const res = await axios.get("http://localhost:5000/api/properties/active");
      setProperties(res.data || []);
    } catch (err) { console.error(err); }
  };

  const fetchMessages = async (engId) => {
    try {
      const res = await axios.get(`${API}/${engId}/messages?role=${user.role}`);
      setMessages(res.data.messages || []);
    } catch (err) { console.error(err); }
  };

  const fetchDetails = async (engId) => {
    try {
      const res = await axios.get(`${API}/${engId}?role=${user.role}`);
      setSignatures(res.data.signatures || []);
      setHistory(res.data.history || []);
    } catch (err) { console.error(err); }
  };

  const openModal = async (type, engagement) => {
    setModalType(type);
    setSelectedEngagement(engagement);
    setFormData({});

    if (type === "hire") {
      await fetchBrokers();
      await fetchProperties();
    }
    if (type === "details" || type === "messages") {
      await fetchMessages(engagement.id);
      await fetchDetails(engagement.id);
    }
    if (type === "view_contract") {
      try {
        const cRes = await axios.get(`${API}/${engagement.id}/view-contract`);
        setContractHTML(cRes.data.html || "");
        setViewedEngagements((prev) => ({ ...prev, [engagement.id]: true }));
      } catch (err) {
        console.error("Error fetching contract:", err);
        setContractHTML("<p>Contract not found or not yet generated.</p>");
      }
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedEngagement(null);
    setFormData({});
    setMessages([]);
    setHistory([]);
    setSignatures([]);
    setContractHTML("");
  };

  // ── Download PDF using jsPDF + html2canvas ──
  const handleDownloadPDF = async () => {
    if (!contractHTML) return;
    setPdfLoading(true);
    try {
      // Create a hidden iframe to render clean HTML for capture
      const iframe = document.createElement("iframe");
      iframe.style.position = "fixed";
      iframe.style.left = "-9999px";
      iframe.style.top = "0";
      iframe.style.width = "900px";
      iframe.style.height = "auto";
      iframe.style.border = "none";
      document.body.appendChild(iframe);

      const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
      iframeDoc.open();
      iframeDoc.write(contractHTML);
      iframeDoc.close();

      // Wait for content to fully render
      await new Promise((resolve) => {
        iframe.onload = resolve;
        setTimeout(resolve, 1500);
      });

      const body = iframeDoc.body;
      // Make sure the iframe height fits the full content
      iframe.style.height = body.scrollHeight + "px";
      // Small delay for repaint
      await new Promise((r) => setTimeout(r, 300));

      const canvas = await html2canvas(body, {
        scale: 2,
        useCORS: true,
        logging: false,
        width: 900,
        windowWidth: 900,
      });

      document.body.removeChild(iframe);

      // Convert canvas to PDF pages (A4)
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pageWidth - 20; // 10mm margin each side
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 10; // top margin

      // First page
      pdf.addImage(imgData, "PNG", 10, position, imgWidth, imgHeight);
      heightLeft -= (pageHeight - 20); // subtract usable page height

      // Additional pages if content overflows
      while (heightLeft > 0) {
        position = -(imgHeight - heightLeft) + 10;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 10, position, imgWidth, imgHeight);
        heightLeft -= (pageHeight - 20);
      }

      const engId = selectedEngagement?.id || "contract";
      pdf.save(`DDREMS_Agreement_BA-${String(engId).padStart(5, "0")}.pdf`);
    } catch (err) {
      console.error("PDF generation error:", err);
      alert("❌ Failed to generate PDF. Falling back to browser print.");
      // Fallback: open in new window for print
      const win = window.open("", "_blank");
      win.document.write(contractHTML);
      win.document.close();
      win.focus();
      setTimeout(() => win.print(), 500);
    } finally {
      setPdfLoading(false);
    }
  };

  const getBadge = (status) => STATUS_MAP[status] || { emoji: "❓", label: status, color: "#6b7280" };

  // ── Submit Actions ──
  const submitAction = async () => {
    setActionLoading(true);
    try {
      let url, method = "post", data = {};
      const id = selectedEngagement?.id;

      switch (modalType) {
        case "hire":
          url = `${API}/hire`;
          data = {
            buyer_id: user.id,
            broker_id: formData.broker_id,
            property_id: formData.property_id,
            starting_offer: formData.starting_offer,
            buyer_message: formData.message,
            engagement_type: formData.engagement_type,
            rental_duration_months: formData.rental_duration_months,
            payment_schedule: formData.payment_schedule,
            security_deposit: formData.security_deposit,
          };
          if (!data.broker_id || !data.property_id) {
            alert("Please select a broker and property.");
            setActionLoading(false);
            return;
          }
          break;

        case "broker_accept":
          url = `${API}/${id}/broker-accept`;
          method = "put";
          data = { broker_id: user.id, decision: "accept" };
          break;

        case "broker_reject":
          url = `${API}/${id}/broker-accept`;
          method = "put";
          data = { broker_id: user.id, decision: "decline", decline_reason: formData.decline_reason };
          break;

        case "broker_negotiate":
          url = `${API}/${id}/broker-negotiate`;
          method = "put";
          data = { broker_id: user.id, offer_price: formData.offer_price, message: formData.message };
          break;

        case "buyer_review_draft":
          url = `${API}/${id}/buyer-approve-draft`;
          method = "put";
          data = { buyer_id: user.id, decision: formData.decision, reject_reason: formData.reject_reason };
          if (!data.decision) { alert("Please select Approve or Reject."); setActionLoading(false); return; }
          break;

        case "owner_respond":
          url = `${API}/${id}/owner-respond`;
          method = "put";
          data = {
            owner_id: user.id,
            decision: formData.decision,
            counter_price: formData.counter_price,
            message: formData.message,
          };
          break;

        case "broker_advise":
          url = `${API}/${id}/broker-advise`;
          method = "put";
          data = { broker_id: user.id, recommendation: formData.recommendation, advice_message: formData.message };
          break;

        case "buyer_authorize":
          url = `${API}/${id}/buyer-authorize`;
          method = "put";
          data = {
            buyer_id: user.id,
            authorization: formData.authorization,
            counter_price: formData.counter_price,
            message: formData.message,
          };
          break;

        case "broker_finalize":
          url = `${API}/${id}/broker-finalize`;
          method = "put";
          data = { broker_id: user.id };
          break;

        case "generate_contract":
          url = `${API}/${id}/generate-contract`;
          data = { admin_id: user.id };
          break;

        case "sign":
          url = `${API}/${id}/sign`;
          method = "put";
          data = {
            signer_id: user.id,
            signer_role: isBuyer ? "buyer" : isBroker ? "broker" : "owner",
            signature_data: "digital_signature_" + user.name + "_" + Date.now(),
          };
          break;

        case "send_message":
          url = `${API}/${id}/messages`;
          data = {
            sender_id: user.id,
            sender_role: isBuyer ? "buyer" : isBroker ? "broker" : isOwner ? "owner" : "admin",
            message: formData.message,
            message_type: "general",
          };
          if (!data.message) { alert("Please enter a message."); setActionLoading(false); return; }
          break;

        case "submit_payment":
          url = `${API}/${id}/submit-payment`;
          method = "put";
          data = {
            buyer_id: user.id,
            payment_method: formData.payment_method,
            payment_reference: formData.payment_reference,
            payment_receipt: formData.payment_receipt,
          };
          if (!data.payment_method || !data.payment_reference) {
            alert("Please fill in Payment Method and Reference.");
            setActionLoading(false);
            return;
          }
          break;

        case "verify_payment":
          url = `${API}/${id}/verify-payment`;
          method = "put";
          data = { admin_id: user.id };
          break;

        case "reject_payment":
          url = `${API}/${id}/reject-payment`;
          method = "put";
          data = { admin_id: user.id, reason: formData.reason };
          if (!data.reason) { alert("Please provide a reason for rejection."); setActionLoading(false); return; }
          break;

        case "confirm_handover":
          url = `${API}/${id}/confirm-handover`;
          method = "put";
          data = { user_id: user.id };
          break;

        case "release_funds":
          url = `${API}/${id}/release-funds`;
          method = "put";
          data = {
            admin_id: user.id,
            system_commission_pct: formData.system_commission_pct || 2,
            broker_commission_pct: formData.broker_commission_pct || 2,
          };
          break;

        default:
          setActionLoading(false);
          return;
      }

      const res = await axios({ method, url, data });
      alert(`✅ ${res.data.message}`);
      closeModal();
      fetchEngagements();
    } catch (err) {
      alert(`❌ ${err.response?.data?.message || err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  // ── Render Action Buttons ──
  const renderActions = (eng) => {
    const btns = [];

    // Broker: accept/decline
    if (isBroker && eng.status === "pending_broker_acceptance") {
      btns.push(
        <button key="accept" className="eng-btn eng-btn-success" onClick={() => openModal("broker_accept", eng)}>
          ✅ Accept
        </button>,
        <button key="decline" className="eng-btn eng-btn-danger" onClick={() => openModal("broker_reject", eng)}>
          ❌ Reject
        </button>
      );
    }

    // Broker: draft offer for buyer/tenant approval
    if (isBroker && eng.status === "broker_negotiating") {
      btns.push(
        <button key="negotiate" className="eng-btn eng-btn-primary" onClick={() => openModal("broker_negotiate", eng)}>
          📝 Draft Offer for {bt(eng)}
        </button>
      );
    }

    // Buyer/Tenant: review broker's draft offer
    if (isBuyer && eng.status === "pending_buyer_approval") {
      btns.push(
        <button key="review_draft" className="eng-btn eng-btn-warning" onClick={() => openModal("buyer_review_draft", eng)}>
          📋 Review Draft Offer
        </button>
      );
    }

    // Broker: advise buyer/tenant
    if (isBroker && eng.status === "broker_reviewing_counter") {
      btns.push(
        <button key="advise" className="eng-btn eng-btn-warning" onClick={() => openModal("broker_advise", eng)}>
          📋 Advise {bt(eng)}
        </button>
      );
    }

    // Broker: finalize
    if (isBroker && eng.status === "broker_finalizing") {
      btns.push(
        <button key="finalize" className="eng-btn eng-btn-success" onClick={() => openModal("broker_finalize", eng)}>
          🎯 Finalize Deal
        </button>
      );
    }

    // Owner: respond to offer
    if (isOwner && eng.status === "broker_negotiating") {
      btns.push(
        <button key="respond" className="eng-btn eng-btn-primary" onClick={() => openModal("owner_respond", eng)}>
          📋 Respond to Offer
        </button>
      );
    }

    // Buyer/Tenant: authorize
    if (isBuyer && eng.status === "awaiting_buyer_authorization") {
      btns.push(
        <button key="authorize" className="eng-btn eng-btn-danger" onClick={() => openModal("buyer_authorize", eng)}>
          🔔 Authorize Action
        </button>
      );
    }

    // Admin: generate contract
    if (isAdmin && eng.status === "agreement_generated") {
      btns.push(
        <button key="gencontract" className="eng-btn eng-btn-primary" onClick={() => openModal("generate_contract", eng)}>
          📄 Generate Contract
        </button>
      );
    }

    // Any party: sign (when pending_signatures)
    if (eng.status === "pending_signatures") {
      const myRole = isBuyer ? "buyer" : isBroker ? "broker" : isOwner ? "owner" : null;
      if (myRole) {
        const hasSigned = eng.signed_roles && eng.signed_roles.includes(myRole);
        if (hasSigned) {
          btns.push(
            <button key="sign" className="eng-btn eng-btn-outline" disabled style={{ cursor: "not-allowed", opacity: 0.7, background: "#f8fafc" }}>
              ✅ Signed
            </button>
          );
        } else {
          btns.push(
            <button key="sign" className="eng-btn eng-btn-success" onClick={() => openModal("sign", eng)}>
              ✍️ Sign Contract
            </button>
          );
        }
      }
    }

    // Buyer/Tenant: pay now (after fully_signed or if payment_rejected)
    if (isBuyer && (eng.status === "fully_signed" || eng.status === "payment_rejected")) {
      btns.push(
        <button key="pay" className="eng-btn eng-btn-success" onClick={() => openModal("submit_payment", eng)}>
          {eng.status === "payment_rejected" ? "🔄 Resubmit Payment" : "💰 Pay Now"}
        </button>
      );
    }

    // Admin: verify or reject payment
    if (isAdmin && eng.status === "payment_submitted") {
      btns.push(
        <button key="verifypay" className="eng-btn eng-btn-success" onClick={() => openModal("verify_payment", eng)}>
          ✅ Verify Payment
        </button>,
        <button key="rejectpay" className="eng-btn eng-btn-danger" onClick={() => openModal("reject_payment", eng)}>
          ❌ Reject Payment
        </button>
      );
    }

    // Buyer/Tenant or Owner/Landlord: confirm handover
    if ((isBuyer || isOwner) && eng.status === "payment_verified") {
      const hasConfirmed = isBuyer ? eng.buyer_handover_confirmed : eng.owner_handover_confirmed;
      
      if (hasConfirmed) {
        btns.push(
          <button key="handover" className="eng-btn eng-btn-outline" disabled style={{ cursor: "not-allowed", opacity: 0.7, background: "#f8fafc" }}>
            ✅ Handover Confirmed
          </button>
        );
      } else {
        btns.push(
          <button key="handover" className="eng-btn eng-btn-primary" onClick={() => openModal("confirm_handover", eng)}>
            🔑 Confirm Handover
          </button>
        );
      }
    }

    // Admin: release funds
    if (isAdmin && eng.status === "handover_confirmed") {
      btns.push(
        <button key="release" className="eng-btn eng-btn-warning" onClick={() => openModal("release_funds", eng)}>
          💸 Release Funds
        </button>
      );
    }

    // View Contract (available after generation)
    if (["pending_signatures", "fully_signed", "payment_submitted", "payment_rejected", "payment_verified", "handover_confirmed", "completed"].includes(eng.status)) {
      btns.push(
        <button key="viewcontract" className="eng-btn eng-btn-outline" onClick={() => openModal("view_contract", eng)}>
          📄 View Agreement
        </button>
      );
    }

    // Messages & Details always available
    btns.push(
      <button key="msgs" className="eng-btn eng-btn-outline" onClick={() => openModal("messages", eng)}>
        💬 Messages
      </button>,
      <button key="details" className="eng-btn eng-btn-outline" onClick={() => openModal("details", eng)}>
        👁️ Details
      </button>
    );

    return btns;
  };

  // ── Render Engagement Card ──
  const renderCard = (eng) => {
    const badge = getBadge(eng.status);
    return (
      <div key={eng.id} className="engagement-card">
        <div className="card-header">
          <div>
            <h3>🤝 Engagement #{eng.id}</h3>
            <span className="eng-status-pill" style={{ background: "#ffffff", color: badge.color, borderColor: "transparent", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}>
              {badge.emoji} {badge.label}
            </span>
          </div>
        </div>

        <div className="eng-info-grid">
          <div className="info-item"><span className="info-label">🏠 Property</span><span className="info-value">{eng.property_title || "N/A"}</span></div>
          <div className="info-item"><span className="info-label">📍 Location</span><span className="info-value">{eng.property_location || "N/A"}</span></div>
          <div className="info-item"><span className="info-label">👤 {eng.engagement_type === 'rent' ? 'Tenant' : 'Buyer'}</span><span className="info-value">{eng.buyer_name || "N/A"}</span></div>
          <div className="info-item"><span className="info-label">🤵 Broker</span><span className="info-value">{eng.broker_name || "N/A"}</span></div>
          <div className="info-item"><span className="info-label">🏢 {eng.engagement_type === 'rent' ? 'Landlord' : 'Owner'}</span><span className="info-value">{eng.owner_name || "N/A"}</span></div>
          <div className="info-item"><span className="info-label">📆 Created</span><span className="info-value">{new Date(eng.created_at).toLocaleDateString()}</span></div>
          {eng.engagement_type === 'rent' && (
            <>
              <div className="info-item"><span className="info-label">🏷️ Type</span><span className="info-value" style={{color: '#065f46', fontWeight: 700}}>Rental</span></div>
              <div className="info-item"><span className="info-label">📅 Duration</span><span className="info-value">{eng.rental_duration_months} Months</span></div>
              <div className="info-item"><span className="info-label">🗓️ Schedule</span><span className="info-value" style={{textTransform:'capitalize'}}>{eng.payment_schedule || 'monthly'}</span></div>
              {eng.security_deposit > 0 && (
                <div className="info-item"><span className="info-label">🔒 Deposit</span><span className="info-value">{Number(eng.security_deposit).toLocaleString()} ETB</span></div>
              )}
            </>
          )}
        </div>

        {/* Offer comparison boxes */}
        <div className="offer-comparison">
          <div className="offer-box" style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}>
            <div className="offer-label">List Price</div>
            <div className="offer-value">{Number(eng.property_price || 0).toLocaleString()} ETB</div>
          </div>
          {!isOwner && (
            <div className="offer-box starting">
              <div className="offer-label">Starting Offer</div>
              <div className="offer-value">{Number(eng.starting_offer || 0).toLocaleString()} ETB</div>
            </div>
          )}
          {(!isOwner || !["pending_broker_acceptance", "broker_declined", "pending_buyer_approval"].includes(eng.status)) && (
            <div className="offer-box current">
              <div className="offer-label">Current Offer</div>
              <div className="offer-value">{Number(eng.current_offer || 0).toLocaleString()} ETB</div>
            </div>
          )}
          {eng.agreed_price && (
            <div className="offer-box agreed">
              <div className="offer-label">Agreed Price</div>
              <div className="offer-value">{Number(eng.agreed_price).toLocaleString()} ETB</div>
            </div>
          )}
        </div>

        {/* Broker advice panel */}
        {eng.broker_recommendation && (
          <div className="advice-panel">
            <div className="advice-header">
              <h4>🧑‍💼 Broker Advice</h4>
              <span className={`rec-badge ${eng.broker_recommendation}`}>
                {eng.broker_recommendation === "accept" ? "✅ Accept" : eng.broker_recommendation === "counter" ? "🔄 Counter" : "🚫 Walk Away"}
              </span>
            </div>
            {eng.broker_advice && <p className="advice-text">{eng.broker_advice}</p>}
            {eng.owner_counter_price && (
              <p className="advice-text" style={{ marginTop: 8, fontWeight: 600 }}>
                Owner's counter: {Number(eng.owner_counter_price).toLocaleString()} ETB
              </p>
            )}
          </div>
        )}

        {/* Signature status */}
        {["pending_signatures", "fully_signed", "completed"].includes(eng.status) && (
          <div className="sig-section">
            <div className={`sig-item ${eng.status === "fully_signed" || eng.status === "completed" ? "signed" : "unsigned"}`}>
              ✍️ {bt(eng)}
            </div>
            <div className={`sig-item ${eng.status === "fully_signed" || eng.status === "completed" ? "signed" : "unsigned"}`}>
              ✍️ Broker
            </div>
            <div className={`sig-item ${eng.status === "fully_signed" || eng.status === "completed" ? "signed" : "unsigned"}`}>
              ✍️ {ol(eng)}
            </div>
          </div>
        )}

        <div className="card-actions">{renderActions(eng)}</div>
      </div>
    );
  };

  // ── Render Modal Content ──
  const renderModalContent = () => {
    if (!showModal) return null;

    switch (modalType) {
      case "hire": {
        const selectedProp = properties.find(p => p.id === Number(formData.property_id));
        const isRentalProp = selectedProp?.listing_type === 'rent' || formData.engagement_type === 'rent';
        return (
          <>
            <div className="eng-form-group">
              <label>Select Property *</label>
              <select value={formData.property_id || ""} onChange={(e) => {
                const prop = properties.find(p => p.id === Number(e.target.value));
                setFormData({ ...formData, property_id: e.target.value, engagement_type: prop?.listing_type || 'sale' });
              }}>
                <option value="">-- Choose a property --</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>{p.title} — {Number(p.price).toLocaleString()} ETB ({p.location}) {p.listing_type === 'rent' ? '🔑 Rent' : '🏷️ Sale'}</option>
                ))}
              </select>
            </div>
            <div className="eng-form-group">
              <label>Select Broker *</label>
              <div className="broker-selection-grid">
                {brokers.map((b) => (
                  <div key={b.id}
                    className={`broker-select-card ${formData.broker_id === b.id ? "selected" : ""}`}
                    onClick={() => setFormData({ ...formData, broker_id: b.id })}
                  >
                    <div className="broker-avatar">{b.name?.charAt(0).toUpperCase()}</div>
                    <div className="broker-card-name">{b.name}</div>
                    <div className="broker-card-info">{b.license_number || b.email}</div>
                  </div>
                ))}
                {brokers.length === 0 && <p style={{ color: "#94a3b8", gridColumn: "1/-1", textAlign: "center" }}>No brokers available</p>}
              </div>
            </div>
            <div className="eng-form-group">
              <label>{isRentalProp ? 'Starting Monthly Rent Offer (ETB)' : 'Starting Offer Price (ETB)'}</label>
              <input type="number" value={formData.starting_offer || ""} onChange={(e) => setFormData({ ...formData, starting_offer: e.target.value })} placeholder={isRentalProp ? 'Enter your proposed monthly rent' : 'Enter your starting offer price'} />
            </div>
            {isRentalProp && (
              <>
                <div className="eng-form-group">
                  <label>Lease Duration (Months) *</label>
                  <input type="number" min="1" value={formData.rental_duration_months || 12} onChange={(e) => setFormData({ ...formData, rental_duration_months: e.target.value })} />
                </div>
                <div className="eng-form-group">
                  <label>Payment Schedule</label>
                  <select value={formData.payment_schedule || 'monthly'} onChange={(e) => setFormData({ ...formData, payment_schedule: e.target.value })}>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="semi_annual">Semi-Annually</option>
                    <option value="annual">Annually</option>
                  </select>
                </div>
                <div className="eng-form-group">
                  <label>Security Deposit (ETB)</label>
                  <input type="number" value={formData.security_deposit || ""} onChange={(e) => setFormData({ ...formData, security_deposit: e.target.value })} placeholder="e.g. 50000" />
                </div>
              </>
            )}
            <div className="eng-form-group">
              <label>Message to Broker</label>
              <textarea value={formData.message || ""} onChange={(e) => setFormData({ ...formData, message: e.target.value })} placeholder="Tell the broker about your requirements, budget, expectations..." rows="3" />
            </div>
          </>
        );
      }

      case "broker_accept":
        return (
          <div style={{ textAlign: "center", padding: 20 }}>
            <p style={{ fontSize: 48, margin: "0 0 12px" }}>🤝</p>
            <h4 style={{ margin: "0 0 8px", color: "#1e293b" }}>Accept Representation?</h4>
            <p style={{ color: "#64748b", fontSize: 14 }}>
              You will represent the {bt(selectedEngagement).toLowerCase()} in negotiations for <strong>{selectedEngagement?.property_title}</strong>.
            </p>
          </div>
        );

      case "broker_reject":
        return (
          <div style={{ textAlign: "center", padding: 20 }}>
            <p style={{ fontSize: 48, margin: "0 0 12px" }}>❌</p>
            <h4 style={{ margin: "0 0 8px", color: "#dc2626" }}>Reject Representation?</h4>
            <p style={{ color: "#64748b", fontSize: 14 }}>
              You are declining to represent the {bt(selectedEngagement).toLowerCase()} for <strong>{selectedEngagement?.property_title}</strong>.
            </p>
            <div className="eng-form-group" style={{ textAlign: "left", marginTop: 16 }}>
              <label>Reason for Rejecting (optional)</label>
              <textarea 
                value={formData.decline_reason || ""} 
                onChange={(e) => setFormData({ ...formData, decline_reason: e.target.value })} 
                placeholder="Why are you declining this engagement request?" 
                rows="3" 
              />
            </div>
          </div>
        );

      case "broker_negotiate":
        return (
          <>
            <p style={{ color: "#64748b", fontSize: 13, marginBottom: 12 }}>
              Current offer: <strong>{Number(selectedEngagement?.current_offer || 0).toLocaleString()} ETB{isRentalEng(selectedEngagement) ? " / month" : ""}</strong>
            </p>
            {isRentalEng(selectedEngagement) && (
              <div style={{ padding: "8px 12px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "8px", marginBottom: "12px", fontSize: "13px", color: "#166534" }}>
                <strong>⏳ Lease Duration:</strong> {selectedEngagement.rental_duration_months} Months<br/>
                <strong>🗓️ Payment Schedule:</strong> <span style={{textTransform: 'capitalize'}}>{selectedEngagement.payment_schedule || 'monthly'}</span>
              </div>
            )}
            <p style={{ color: "#f59e0b", fontSize: 12, marginBottom: 12, fontStyle: "italic" }}>
              ⚠️ This offer will be sent to the {bt(selectedEngagement).toLowerCase()} for approval before going to the {ol(selectedEngagement).toLowerCase()}.
            </p>
            <div className="eng-form-group">
              <label>Proposed Offer Price (ETB) *</label>
              <input type="number" value={formData.offer_price || ""} onChange={(e) => setFormData({ ...formData, offer_price: e.target.value })}
                placeholder={`e.g. ${selectedEngagement?.current_offer || ""}`} />
            </div>
            <div className="eng-form-group">
              <label>Message to Owner</label>
              <textarea value={formData.message || ""} onChange={(e) => setFormData({ ...formData, message: e.target.value })} placeholder="Negotiation message..." rows="3" />
            </div>
          </>
        );

      case "buyer_review_draft":
        return (
          <div style={{ padding: 20 }}>
            <div style={{ textAlign: "center", marginBottom: 16 }}>
              <p style={{ fontSize: 48, margin: "0 0 12px" }}>📋</p>
              <h4 style={{ margin: "0 0 8px", color: "#1e293b" }}>Review Broker's Draft Offer</h4>
              <p style={{ color: "#64748b", fontSize: 14 }}>
                Your broker has proposed the following offer to send to the property owner:
              </p>
            </div>
            <div style={{ background: "#fffbeb", border: "2px solid #f59e0b", borderRadius: 12, padding: 16, textAlign: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: "#92400e", fontWeight: 600, marginBottom: 4 }}>PROPOSED {isRentalEng(selectedEngagement) ? "RENT" : "OFFER"}</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: "#b45309" }}>
                {Number(selectedEngagement?.draft_offer_price || 0).toLocaleString()} ETB{isRentalEng(selectedEngagement) ? " / month" : ""}
              </div>
              {isRentalEng(selectedEngagement) && (
                <div style={{ fontSize: 13, color: "#92400e", marginTop: 8 }}>
                  <strong>Duration:</strong> {selectedEngagement.rental_duration_months} Months &nbsp;|&nbsp; <strong>Schedule:</strong> <span style={{textTransform: 'capitalize'}}>{selectedEngagement.payment_schedule || 'monthly'}</span>
                </div>
              )}
            </div>
            <div className="eng-form-group">
              <label>Your Decision *</label>
              <select value={formData.decision || ""} onChange={(e) => setFormData({ ...formData, decision: e.target.value })}>
                <option value="">-- Select --</option>
                <option value="approve">✅ Approve — Send to {ol(selectedEngagement)}</option>
                <option value="reject">❌ Reject — Ask Broker to Revise</option>
              </select>
            </div>
            {formData.decision === "reject" && (
              <div className="eng-form-group">
                <label>Reason for Rejection</label>
                <textarea 
                  value={formData.reject_reason || ""} 
                  onChange={(e) => setFormData({ ...formData, reject_reason: e.target.value })} 
                  placeholder="e.g. Price too high, I want to offer less..." 
                  rows="3" 
                />
              </div>
            )}
          </div>
        );

      case "owner_respond":
        return (
          <>
            <p style={{ color: "#64748b", fontSize: 13, marginBottom: 12 }}>
              Broker's offer: <strong>{Number(selectedEngagement?.current_offer || 0).toLocaleString()} ETB{isRentalEng(selectedEngagement) ? " / month" : ""}</strong>
            </p>
            {isRentalEng(selectedEngagement) && (
              <div style={{ padding: "10px 14px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "8px", marginBottom: "16px", fontSize: "13px", color: "#166534" }}>
                <p style={{ margin: "0 0 4px" }}><strong>⏳ Lease Duration:</strong> {selectedEngagement.rental_duration_months} Months</p>
                <p style={{ margin: 0 }}><strong>🗓️ Payment Schedule:</strong> <span style={{textTransform: 'capitalize'}}>{selectedEngagement.payment_schedule || 'monthly'}</span></p>
              </div>
            )}
            <div className="eng-form-group">
              <label>Your Decision *</label>
              <select value={formData.decision || ""} onChange={(e) => setFormData({ ...formData, decision: e.target.value })}>
                <option value="">-- Select --</option>
                <option value="accept">✅ Accept Offer</option>
                <option value="counter">🔄 Counter-Offer</option>
                <option value="reject">❌ Reject Offer</option>
              </select>
            </div>
            {formData.decision === "counter" && (
              <div className="eng-form-group">
                <label>Your Counter Price (ETB) *</label>
                <input type="number" value={formData.counter_price || ""} onChange={(e) => setFormData({ ...formData, counter_price: e.target.value })} placeholder="Enter your counter price" />
              </div>
            )}
            <div className="eng-form-group">
              <label>Message</label>
              <textarea value={formData.message || ""} onChange={(e) => setFormData({ ...formData, message: e.target.value })} placeholder="Message to the broker..." rows="3" />
            </div>
          </>
        );

      case "broker_advise":
        return (
          <>
            <div style={{ background: "#fef3c7", padding: 12, borderRadius: 10, marginBottom: 16, border: "1px solid #fcd34d" }}>
              <p style={{ margin: 0, fontSize: 13, color: "#92400e" }}>
                <strong>Owner's Counter-Offer:</strong> {Number(selectedEngagement?.owner_counter_price || 0).toLocaleString()} ETB
              </p>
              {selectedEngagement?.owner_counter_message && (
                <p style={{ margin: "6px 0 0", fontSize: 13, color: "#78350f" }}>"{selectedEngagement.owner_counter_message}"</p>
              )}
            </div>
            <div className="eng-form-group">
              <label>Your Recommendation *</label>
              <select value={formData.recommendation || ""} onChange={(e) => setFormData({ ...formData, recommendation: e.target.value })}>
                <option value="">-- Select Your Recommendation --</option>
                <option value="accept">✅ Recommend Accept — Good deal for the {bt(selectedEngagement).toLowerCase()}</option>
                <option value="counter">🔄 Recommend Counter — Suggest a different price</option>
                <option value="walk_away">🚫 Recommend Walk Away — Not worth it</option>
              </select>
            </div>
            <div className="eng-form-group">
              <label>Advice Message to {bt(selectedEngagement)} *</label>
              <textarea value={formData.message || ""} onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                placeholder={`Explain your recommendation to the ${bt(selectedEngagement).toLowerCase()}...`} rows="4" />
            </div>
          </>
        );

      case "buyer_authorize":
        return (
          <>
            {/* Show counter-offer + broker advice */}
            {selectedEngagement?.owner_counter_price && (
              <div style={{ background: "#fef3c7", padding: 12, borderRadius: 10, marginBottom: 12, border: "1px solid #fcd34d" }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#92400e" }}>
                  🏢 Owner's Counter-Offer: {Number(selectedEngagement.owner_counter_price).toLocaleString()} ETB
                </p>
                {selectedEngagement.owner_counter_message && (
                  <p style={{ margin: "4px 0 0", fontSize: 12, color: "#78350f" }}>"{selectedEngagement.owner_counter_message}"</p>
                )}
              </div>
            )}
            {selectedEngagement?.broker_recommendation && (
              <div className="advice-panel" style={{ marginBottom: 16 }}>
                <div className="advice-header">
                  <h4>🧑‍💼 Broker's Recommendation</h4>
                  <span className={`rec-badge ${selectedEngagement.broker_recommendation}`}>
                    {selectedEngagement.broker_recommendation === "accept" ? "✅ Accept" :
                     selectedEngagement.broker_recommendation === "counter" ? "🔄 Counter" : "🚫 Walk Away"}
                  </span>
                </div>
                {selectedEngagement.broker_advice && <p className="advice-text">{selectedEngagement.broker_advice}</p>}
              </div>
            )}
            <div className="eng-form-group">
              <label>Your Authorization *</label>
              <select value={formData.authorization || ""} onChange={(e) => setFormData({ ...formData, authorization: e.target.value })}>
                <option value="">-- Select --</option>
                <option value="authorize_accept">✅ Authorize Acceptance — Accept the counter-offer</option>
                <option value="authorize_counter">🔄 Authorize Counter — Propose a different price</option>
                <option value="cancel">❌ Cancel Representation — End broker engagement</option>
              </select>
            </div>
            {formData.authorization === "authorize_counter" && (
              <div className="eng-form-group">
                <label>Your Counter Price (ETB) *</label>
                <input type="number" value={formData.counter_price || ""} onChange={(e) => setFormData({ ...formData, counter_price: e.target.value })}
                  placeholder="Enter your counter price" />
              </div>
            )}
            <div className="eng-form-group">
              <label>Message (optional)</label>
              <textarea value={formData.message || ""} onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                placeholder="Any message to your broker..." rows="3" />
            </div>
          </>
        );

      case "broker_finalize":
        return (
          <div style={{ textAlign: "center", padding: 20 }}>
            <p style={{ fontSize: 48, margin: "0 0 12px" }}>🎯</p>
            <h4 style={{ margin: "0 0 8px", color: "#1e293b" }}>Finalize the Deal</h4>
            <p style={{ color: "#64748b", fontSize: 14 }}>
              Agreed price: <strong style={{ color: "#059669" }}>{Number(selectedEngagement?.agreed_price || 0).toLocaleString()} ETB</strong>
            </p>
            <p style={{ color: "#94a3b8", fontSize: 13, marginTop: 8 }}>
              Clicking "Finalize" will notify the admin to generate the contract for all three parties to sign.
            </p>
          </div>
        );

      case "generate_contract":
        return (
          <div style={{ textAlign: "center", padding: 20 }}>
            <p style={{ fontSize: 48, margin: "0 0 12px" }}>📄</p>
            <h4 style={{ margin: "0 0 8px", color: "#1e293b" }}>Generate PDF Contract</h4>
            <p style={{ color: "#64748b", fontSize: 14 }}>
              Agreed price: <strong>{Number(selectedEngagement?.agreed_price || 0).toLocaleString()} ETB</strong>
            </p>
            <p style={{ color: "#94a3b8", fontSize: 13, marginTop: 8 }}>
              This will create the binding contract for: {bt(selectedEngagement)}, Broker, and {ol(selectedEngagement)}.
              All three parties will need to sign in order: {bt(selectedEngagement)} → Broker → {ol(selectedEngagement)}.
            </p>
          </div>
        );

      case "sign":
        const hasViewed = viewedEngagements[selectedEngagement?.id];
        return (
          <div style={{ textAlign: "center", padding: 20 }}>
            <p style={{ fontSize: 48, margin: "0 0 12px" }}>✍️</p>
            <h4 style={{ margin: "0 0 8px", color: "#1e293b" }}>Digital Signature</h4>
            <p style={{ color: "#64748b", fontSize: 14 }}>
              By signing, you agree to the terms of the contract for the agreed price of{" "}
              <strong>{Number(selectedEngagement?.agreed_price || 0).toLocaleString()} ETB</strong>.
            </p>
            <p style={{ color: "#94a3b8", fontSize: 12, marginTop: 8 }}>
              Signing as: <strong>{user.name}</strong> ({isBuyer ? "Buyer" : isBroker ? "Broker" : "Owner"})
              <br />Timestamp will be recorded for legal purposes.
            </p>
            {!hasViewed && (
              <div style={{ color: "#ef4444", fontSize: 13, background: "#fee2e2", padding: 12, borderRadius: 8, marginTop: 16 }}>
                ⚠️ You must view/read the PDF agreement before you can sign.
              </div>
            )}
          </div>
        );

      case "submit_payment":
        return (
          <>
            <div style={{ background: "#d1fae5", padding: 14, borderRadius: 10, marginBottom: 16, border: "1px solid #6ee7b7" }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#065f46" }}>
                💰 Amount Due: {Number(selectedEngagement?.agreed_price || 0).toLocaleString()} ETB
              </p>
            </div>
            <div className="eng-form-group">
              <label>Payment Method *</label>
              <select value={formData.payment_method || ""} onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}>
                <option value="">-- Select Payment Method --</option>
                <option value="bank_transfer">🏦 Bank Transfer</option>
                <option value="chapa">📱 Chapa</option>
                <option value="telebirr">📱 TeleBirr</option>
                <option value="cbe_birr">📱 CBE Birr</option>
                <option value="cash">💵 Cash</option>
                <option value="check">📝 Certified Check</option>
              </select>
            </div>
            <div className="eng-form-group">
              <label>Transaction Reference Number *</label>
              <input type="text" value={formData.payment_reference || ""} onChange={(e) => setFormData({ ...formData, payment_reference: e.target.value })}
                placeholder="e.g., TXN-2026-00412 or receipt number" />
            </div>
            <div className="eng-form-group">
              <label>Transaction Proof (Image/PDF File)</label>
              <input 
                type="file" 
                accept="image/*,application/pdf"
                onChange={(e) => {
                  const file = e.target.files[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                      setFormData({ ...formData, payment_receipt: reader.result });
                    };
                    reader.readAsDataURL(file);
                  }
                }} 
                style={{
                  width: "100%", padding: "10px", border: "1px dashed #cbd5e1", borderRadius: 8, background: "#f8fafc"
                }}
              />
              {formData.payment_receipt && <p style={{fontSize: 12, color: "#059669", marginTop: 4}}>✓ File selected</p>}
            </div>
          </>
        );

      case "verify_payment":
        return (
          <div style={{ textAlign: "center", padding: 20 }}>
            <p style={{ fontSize: 48, margin: "0 0 12px" }}>✅</p>
            <h4 style={{ margin: "0 0 12px", color: "#1e293b" }}>Verify Buyer Payment</h4>
            <div style={{ background: "#f8fafc", padding: 14, borderRadius: 10, marginBottom: 12, textAlign: "left", border: "1px solid #e2e8f0" }}>
              <p style={{ margin: "0 0 6px", fontSize: 13, color: "#64748b" }}>Amount: <strong style={{ color: "#1e293b" }}>{Number(selectedEngagement?.agreed_price || 0).toLocaleString()} ETB</strong></p>
              <p style={{ margin: "0 0 6px", fontSize: 13, color: "#64748b" }}>Method: <strong style={{ color: "#1e293b" }}>{selectedEngagement?.payment_method || "N/A"}</strong></p>
              <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>Reference: <strong style={{ color: "#1e293b" }}>{selectedEngagement?.payment_reference || "N/A"}</strong></p>
            </div>
            {selectedEngagement?.payment_receipt && (
              <div style={{ marginBottom: 16, textAlign: "left" }}>
                <p style={{ margin: "0 0 8px", fontSize: 13, fontWeight: "bold", color: "#1e293b" }}>Uploaded Transaction Proof:</p>
                {selectedEngagement.payment_receipt.startsWith("data:application/pdf") ? (
                  <embed src={selectedEngagement.payment_receipt} type="application/pdf" width="100%" height="300px" style={{border: "1px solid #e2e8f0", borderRadius: 8}} />
                ) : selectedEngagement.payment_receipt.startsWith("data:") || selectedEngagement.payment_receipt.startsWith("http") ? (
                  <img src={selectedEngagement.payment_receipt} alt="Payment Receipt" style={{maxWidth: "100%", maxHeight: "300px", border: "1px solid #e2e8f0", borderRadius: 8}} />
                ) : (
                  <a href={selectedEngagement.payment_receipt} target="_blank" rel="noopener noreferrer" className="eng-btn eng-btn-outline" style={{display: 'inline-block', padding: '6px 12px', fontSize: 12}}>
                    📄 View Uploaded Document
                  </a>
                )}
              </div>
            )}
            <p style={{ color: "#94a3b8", fontSize: 13 }}>
              By confirming, you verify that the funds have been safely received into DDREMS accounts.
            </p>
          </div>
        );

      case "reject_payment":
        return (
          <div style={{ textAlign: "center", padding: 20 }}>
            <p style={{ fontSize: 48, margin: "0 0 12px" }}>❌</p>
            <h4 style={{ margin: "0 0 12px", color: "#dc2626" }}>Reject Payment</h4>
            <p style={{ color: "#64748b", fontSize: 14 }}>
              The payment will be rejected, and the buyer will need to submit payment again.
            </p>
            <div className="eng-form-group" style={{ textAlign: "left", marginTop: 16 }}>
              <label>Reason for Rejection *</label>
              <textarea 
                value={formData.reason || ""} 
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                placeholder="e.g. Funds not received in account, invalid reference number..."
                required
                style={{ width: "100%", minHeight: "80px", padding: "10px", borderColor: "#dc2626" }}
              />
            </div>
          </div>
        );

      case "confirm_handover":
        return (
          <div style={{ textAlign: "center", padding: 20 }}>
            <p style={{ fontSize: 48, margin: "0 0 12px" }}>🔑</p>
            <h4 style={{ margin: "0 0 8px", color: "#1e293b" }}>Confirm Property Handover</h4>
            <p style={{ color: "#64748b", fontSize: 14 }}>
              By confirming handover, you acknowledge that the <strong>property keys</strong> and <strong>physical possession</strong> of the property have been transferred.
            </p>
            <p style={{ color: "#94a3b8", fontSize: 12, marginTop: 8 }}>
              Property: <strong>{selectedEngagement?.property_title}</strong><br />
              This action cannot be undone. The admin will then release funds.
            </p>
          </div>
        );

      case "release_funds": {
        const price = Number(selectedEngagement?.agreed_price || 0);
        const sysPct = Number(formData.system_commission_pct || 2);
        const brkPct = Number(formData.broker_commission_pct || 2);
        const sysAmt = Math.round(price * sysPct / 100 * 100) / 100;
        const brkAmt = Math.round(price * brkPct / 100 * 100) / 100;
        const ownerAmt = Math.round((price - sysAmt - brkAmt) * 100) / 100;
        return (
          <>
            <div style={{ background: "#d1fae5", padding: 14, borderRadius: 10, marginBottom: 16, border: "1px solid #6ee7b7" }}>
              <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#065f46", textAlign: "center" }}>
                💰 Agreed Price: {price.toLocaleString()} ETB
              </p>
            </div>
            <div className="eng-form-group">
              <label>System Commission % (DDREMS Platform Fee)</label>
              <input type="number" step="0.5" min="0" max="20" value={formData.system_commission_pct || 2}
                onChange={(e) => setFormData({ ...formData, system_commission_pct: e.target.value })} />
            </div>
            <div className="eng-form-group">
              <label>Broker Commission %</label>
              <input type="number" step="0.5" min="0" max="20" value={formData.broker_commission_pct || 2}
                onChange={(e) => setFormData({ ...formData, broker_commission_pct: e.target.value })} />
            </div>
            <div style={{ background: "#f8fafc", padding: 14, borderRadius: 10, border: "1px solid #e2e8f0" }}>
              <h4 style={{ margin: "0 0 10px", fontSize: 14, color: "#1e293b" }}>💸 Fund Breakdown</h4>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 13 }}>
                <span style={{ color: "#64748b" }}>System Fee ({sysPct}%)</span>
                <strong style={{ color: "#dc2626" }}>{sysAmt.toLocaleString()} ETB</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 13 }}>
                <span style={{ color: "#64748b" }}>Broker Commission ({brkPct}%)</span>
                <strong style={{ color: "#8b5cf6" }}>{brkAmt.toLocaleString()} ETB</strong>
              </div>
              <hr style={{ border: "none", borderTop: "1px solid #e2e8f0", margin: "8px 0" }} />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15 }}>
                <span style={{ color: "#1e293b", fontWeight: 700 }}>Owner Payout</span>
                <strong style={{ color: "#059669", fontSize: 16 }}>{ownerAmt.toLocaleString()} ETB</strong>
              </div>
            </div>
          </>
        );
      }

      case "messages":
      case "details":
        const eng = selectedEngagement;
        return (
          <div>
            {/* Detail section */}
            <div className="eng-detail-grid">
              <div className="detail-item"><span className="detail-label">Property</span><span className="detail-value">{eng?.property_title}</span></div>
              <div className="detail-item"><span className="detail-label">Location</span><span className="detail-value">{eng?.property_location}</span></div>
              <div className="detail-item"><span className="detail-label">{eng?.engagement_type === 'rent' ? 'Tenant' : 'Buyer'}</span><span className="detail-value">{eng?.buyer_name}</span></div>
              <div className="detail-item"><span className="detail-label">Broker</span><span className="detail-value">{eng?.broker_name}</span></div>
              <div className="detail-item"><span className="detail-label">{eng?.engagement_type === 'rent' ? 'Landlord' : 'Owner'}</span><span className="detail-value">{eng?.owner_name}</span></div>
              {eng?.engagement_type === 'rent' && (
                <div className="detail-item"><span className="detail-label">Transaction Type</span><span className="detail-value" style={{color: '#065f46', fontWeight: 700}}>🔑 Rental</span></div>
              )}
              {!isOwner && (
                <div className="detail-item"><span className="detail-label">Starting Offer</span><span className="detail-value">{Number(eng?.starting_offer || 0).toLocaleString()} ETB{eng?.engagement_type === 'rent' ? ' / month' : ''}</span></div>
              )}
              <div className="detail-item"><span className="detail-label">Current Offer</span><span className="detail-value">{Number(eng?.current_offer || 0).toLocaleString()} ETB{eng?.engagement_type === 'rent' ? ' / month' : ''}</span></div>
              {eng?.agreed_price && <div className="detail-item"><span className="detail-label">Agreed {eng?.engagement_type === 'rent' ? 'Rent' : 'Price'}</span><span className="detail-value" style={{ color: "#059669", fontWeight: 700 }}>{Number(eng.agreed_price).toLocaleString()} ETB{eng?.engagement_type === 'rent' ? ' / month' : ''}</span></div>}
              {eng?.engagement_type === 'rent' && (
                <>
                  <div className="detail-item"><span className="detail-label">Lease Duration</span><span className="detail-value">{eng.rental_duration_months} Months</span></div>
                  <div className="detail-item"><span className="detail-label">Payment Schedule</span><span className="detail-value" style={{textTransform:'capitalize'}}>{eng.payment_schedule || 'monthly'}</span></div>
                  {eng.security_deposit > 0 && (
                    <div className="detail-item"><span className="detail-label">Security Deposit</span><span className="detail-value">{Number(eng.security_deposit).toLocaleString()} ETB</span></div>
                  )}
                </>
              )}
            </div>

            {/* Signatures */}
            {signatures.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8, color: "#1e293b" }}>✍️ Signatures</h4>
                <div className="sig-section">
                  {["buyer", "broker", "owner"].map((role) => {
                    const sig = signatures.find((s) => s.signer_role === role);
                    return (
                      <div key={role} className={`sig-item ${sig ? "signed" : "unsigned"}`}>
                        {sig ? "✅" : "⬜"} {role === 'buyer' ? bt(eng) : role === 'owner' ? ol(eng) : 'Broker'}
                        {sig && <div className="sig-time">{new Date(sig.signed_at).toLocaleString()}</div>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Messages */}
            <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8, color: "#1e293b" }}>💬 Message Thread</h4>
            <div className="eng-message-thread">
              {messages.length === 0 && <p style={{ color: "#94a3b8", textAlign: "center", fontSize: 13 }}>No messages yet</p>}
              {messages.map((msg) => {
                const isMine = msg.sender_id === user.id;
                const isSystem = msg.sender_role === "system";
                return (
                  <div key={msg.id} className={`eng-msg ${isSystem ? "system-msg" : isMine ? "sent" : "received"}`}>
                    <div className="eng-msg-bubble">
                      {msg.message_type && msg.message_type !== "general" && msg.message_type !== "system" && (
                        <span className={`eng-msg-type-badge ${msg.message_type}`}>{msg.message_type}</span>
                      )}
                      {msg.message}
                    </div>
                    <div className="eng-msg-meta">
                      <span className="sender-name">{isSystem ? "System" : msg.sender_name || "Unknown"}</span>
                      <span>{new Date(msg.created_at).toLocaleString()}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Send message */}
            {!["completed", "cancelled", "broker_declined"].includes(eng?.status) && (
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <input type="text" value={formData.newMessage || ""} onChange={(e) => setFormData({ ...formData, newMessage: e.target.value })}
                  placeholder="Type a message..." style={{ flex: 1, padding: "8px 12px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 13 }} />
                <button className="eng-btn eng-btn-primary" disabled={!formData.newMessage || actionLoading}
                  onClick={async () => {
                    if (!formData.newMessage) return;
                    try {
                      await axios.post(`${API}/${eng.id}/messages`, {
                        sender_id: user.id,
                        sender_role: isBuyer ? "buyer" : isBroker ? "broker" : isOwner ? "owner" : "admin",
                        message: formData.newMessage,
                        message_type: "general",
                      });
                      setFormData({ ...formData, newMessage: "" });
                      await fetchMessages(eng.id);
                    } catch (err) {
                      alert(`❌ ${err.response?.data?.message || err.message}`);
                    }
                  }}>
                  Send
                </button>
              </div>
            )}

            {/* History */}
            {history.length > 0 && (
              <div style={{ marginTop: 20 }}>
                <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8, color: "#1e293b" }}>📜 Audit History</h4>
                <div className="eng-history-timeline">
                  {history.map((h) => (
                    <div key={h.id} className="eng-history-item">
                      <div className="history-action">{h.action.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</div>
                      <div className="history-meta">
                        By {h.action_by_name || "System"} • {new Date(h.created_at).toLocaleString()}
                        {h.previous_status && ` • ${h.previous_status} → ${h.new_status}`}
                      </div>
                      {h.notes && <div className="history-notes">{h.notes}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );

      case "view_contract":
        return (
          <div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
              <button
                className="eng-btn eng-btn-success"
                style={{ fontSize: 12, padding: "8px 20px", fontWeight: 700, letterSpacing: 0.3 }}
                onClick={handleDownloadPDF}
                disabled={pdfLoading}
              >
                {pdfLoading ? (
                  <><span className="spinner" style={{ width: 14, height: 14, marginRight: 6, borderWidth: 2, display: "inline-block", verticalAlign: "middle" }} /> Generating PDF...</>
                ) : (
                  "📥 Download PDF"
                )}
              </button>
              <button
                className="eng-btn eng-btn-primary"
                style={{ fontSize: 12, padding: "6px 16px" }}
                onClick={() => {
                  const printWindow = window.open("", "_blank");
                  printWindow.document.write(contractHTML);
                  printWindow.document.close();
                  printWindow.focus();
                  setTimeout(() => { printWindow.print(); }, 500);
                }}
              >
                🖨️ Print
              </button>
              <button
                className="eng-btn eng-btn-outline"
                style={{ fontSize: 12, padding: "6px 16px" }}
                onClick={() => {
                  const printWindow = window.open("", "_blank");
                  printWindow.document.write(contractHTML);
                  printWindow.document.close();
                }}
              >
                🔎 Open Full View
              </button>
            </div>
            <div
              ref={contractRef}
              style={{
                border: "1px solid #e2e8f0",
                borderRadius: 8,
                overflow: "auto",
                maxHeight: 500,
                background: "#fff",
                boxShadow: "inset 0 2px 4px rgba(0,0,0,0.06)"
              }}
              dangerouslySetInnerHTML={{ __html: contractHTML }}
            />
          </div>
        );

      default:
        return <p>Unknown action</p>;
    }
  };

  const getModalTitle = () => {
    switch (modalType) {
      case "hire": return "🤝 Hire a Broker";
      case "broker_accept": return "🤝 Accept Representation";
      case "broker_reject": return "❌ Reject Representation";
      case "broker_negotiate": return "📝 Draft Offer for Buyer Approval";
      case "buyer_review_draft": return "📋 Review Draft Offer";
      case "owner_respond": return "📋 Respond to Broker's Offer";
      case "broker_advise": return "📋 Advise the Buyer";
      case "buyer_authorize": return "🔔 Authorize Action";
      case "broker_finalize": return "🎯 Finalize Deal";
      case "generate_contract": return "📄 Generate Contract";
      case "sign": return "✍️ Sign Contract";
      case "submit_payment": return "💰 Submit Payment";
      case "verify_payment": return "✅ Verify Payment";
      case "reject_payment": return "❌ Reject Payment";
      case "confirm_handover": return "🔑 Confirm Handover";
      case "release_funds": return "💸 Release Funds";
      case "send_message": return "💬 Send Message";
      case "messages": return "💬 Engagement Thread";
      case "details": return "👁️ Engagement Details";
      case "view_contract": return "📄 Agreement Document";
      default: return "Action";
    }
  };

  const showSubmitButton = !["messages", "details", "view_contract"].includes(modalType);

  // ── Main Render ──
  return (
    <div className="broker-engagement-page">
      <h2>🤝 Broker-Assisted Purchases</h2>
      <p className="page-subtitle">
        {isBuyer && "Hire a broker to negotiate property purchases on your behalf."}
        {isBroker && "Manage your buyer engagements and negotiate with property owners."}
        {isOwner && "View and respond to offers from brokers representing buyers."}
        {isAdmin && "Monitor all broker-assisted property purchase workflows."}
      </p>

      <div className="engagement-top-bar">
        <span style={{ color: "#64748b", fontSize: 14 }}>{engagements.length} engagement{engagements.length !== 1 ? "s" : ""}</span>
        {isBuyer && (
          <button className="btn-hire-broker" onClick={() => openModal("hire", null)}>
            🤝 Hire a Broker
          </button>
        )}
      </div>

      {loading ? (
        <div className="engagement-loading">
          <div className="spinner" />
          <p>Loading engagements...</p>
        </div>
      ) : engagements.length === 0 ? (
        <div className="engagement-empty">
          <div className="empty-icon">🤝</div>
          <p>
            {isBuyer && "No broker engagements yet. Click \"Hire a Broker\" to get started!"}
            {isBroker && "No engagement requests yet. Buyers will contact you when they need representation."}
            {isOwner && "No broker offers received yet."}
            {isAdmin && "No broker-assisted engagements in the system."}
          </p>
        </div>
      ) : (
        <div className="engagement-grid">
          {engagements.map(renderCard)}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="eng-modal-overlay" onClick={closeModal}>
          <div className="eng-modal" onClick={(e) => e.stopPropagation()}>
            <div className="eng-modal-header">
              <h3>{getModalTitle()}</h3>
              <button className="eng-modal-close" onClick={closeModal}>✕</button>
            </div>
            <div className="eng-modal-body">
              {renderModalContent()}
            </div>
            {showSubmitButton && (
              <div className="eng-modal-footer">
                <button className="eng-btn eng-btn-outline" onClick={closeModal}>Cancel</button>
                <button 
                  className="eng-btn eng-btn-primary" 
                  onClick={submitAction} 
                  disabled={actionLoading || (modalType === "sign" && !viewedEngagements[selectedEngagement?.id])}
                >
                  {actionLoading ? "Processing..." : "Confirm"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default BrokerEngagement;
