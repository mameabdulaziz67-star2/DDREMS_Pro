const express = require("express");
const router = express.Router();
const db = require("../config/db");
const { generateRentalSchedule } = require("./rental-payments");

// ============================================================================
// DELETE: Admin deletes an agreement request
// ============================================================================
router.delete("/:agreementId", async (req, res) => {
  try {
    const { agreementId } = req.params;
    const [existing] = await db.query("SELECT id FROM agreement_requests WHERE id = ?", [agreementId]);
    if (existing.length === 0) return res.status(404).json({ message: "Agreement not found", success: false });

    await db.query("DELETE FROM agreement_workflow_history WHERE agreement_request_id = ?", [agreementId]).catch(() => {});
    await db.query("DELETE FROM agreement_notifications WHERE agreement_request_id = ?", [agreementId]).catch(() => {});
    await db.query("DELETE FROM agreement_requests WHERE id = ?", [agreementId]);

    res.json({ success: true, message: "Agreement request deleted successfully" });
  } catch (error) {
    console.error("Delete agreement error:", error);
    res.status(500).json({ message: "Server error", error: error.message, success: false });
  }
});

// ============================================================================
// STEP 1: CUSTOMER INITIATES REQUEST
// ============================================================================

// POST /api/agreement-workflow/request
// Customer clicks "Request Agreement"
router.post("/request", async (req, res) => {
  try {
    const {
      customer_id,
      property_id,
      customer_notes,
      proposed_price,
      move_in_date,
      agreement_type,
      rental_duration_months,
      payment_schedule,
      security_deposit,
    } = req.body;

    if (!customer_id || !property_id) {
      return res.status(400).json({
        message: "Customer ID and Property ID required",
        success: false,
      });
    }

    // Get property details to find owner
    const [property] = await db.query(
      "SELECT owner_id, price, broker_id, listing_type FROM properties WHERE id = ?",
      [property_id],
    );

    if (property.length === 0) {
      return res.status(404).json({
        message: "Property not found",
        success: false,
      });
    }

    const owner_id = property[0].owner_id;
    const property_price = property[0].price;
    const broker_id = property[0].broker_id || null;
    const resolvedType = agreement_type || property[0].listing_type || 'sale';

    // Check if property has an owner
    if (!owner_id) {
      return res.status(400).json({
        message: "Property does not have an owner assigned",
        success: false,
      });
    }

    // Check for duplicate pending requests
    const [existing] = await db.query(
      `SELECT id FROM agreement_requests WHERE customer_id = ? AND property_id = ? AND status NOT IN ('completed', 'owner_rejected')`,
      [customer_id, property_id],
    );
    if (existing.length > 0) {
      return res.status(400).json({
        message:
          "You already have an active agreement request for this property",
        success: false,
      });
    }

    // Create agreement request
    const [result] = await db.query(
      `
      INSERT INTO agreement_requests (
        customer_id, owner_id, property_id, broker_id, status, current_step,
        customer_notes, property_price, proposed_price, move_in_date,
        agreement_type, rental_duration_months, payment_schedule, security_deposit
      ) VALUES (?, ?, ?, ?, 'pending_admin_review', 1, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      [
        customer_id,
        owner_id,
        property_id,
        broker_id,
        customer_notes,
        property_price,
        proposed_price || property_price,
        move_in_date || null,
        resolvedType,
        resolvedType === 'rent' ? (rental_duration_months || 12) : null,
        resolvedType === 'rent' ? (payment_schedule || 'monthly') : null,
        resolvedType === 'rent' ? (security_deposit || null) : null,
      ],
    );

    // Log workflow history
    await db.query(
      `
      INSERT INTO agreement_workflow_history (
        agreement_request_id, step_number, step_name, action,
        action_by_id, previous_status, new_status, notes
      ) VALUES (?, 1, 'Customer Request', 'created', ?, NULL, 'pending_admin_review', ?)
    `,
      [result.insertId, customer_id, "Customer initiated agreement request"],
    );

    // Notify property admin
    const [admins] = await db.query(
      "SELECT id FROM users WHERE role = 'property_admin' LIMIT 1",
    );

    if (admins.length > 0) {
      await db.query(
        `
        INSERT INTO agreement_notifications (
          agreement_request_id, recipient_id, notification_type,
          notification_title, notification_message
        ) VALUES (?, ?, 'request_received', 
          'New Agreement Request', 
          'Customer has requested an agreement for a property')
      `,
        [result.insertId, admins[0].id],
      );
    }

    res.json({
      success: true,
      message: "Agreement request created successfully",
      agreement_id: result.insertId,
      status: "pending_admin_review",
      current_step: 1,
    });
  } catch (error) {
    console.error("Error creating agreement request:", error);
    res.status(500).json({
      message: "Server error",
      error: error.message,
      success: false,
    });
  }
});

// ============================================================================
// STEP 2: PROPERTY ADMIN REVIEWS & FORWARDS
// ============================================================================

// PUT /api/agreement-workflow/:agreementId/forward-to-owner
// Property admin forwards request to owner
router.put("/:agreementId/forward-to-owner", async (req, res) => {
  try {
    const { agreementId } = req.params;
    const { admin_id, admin_notes } = req.body;

    // Get agreement details
    const [agreement] = await db.query(
      "SELECT * FROM agreement_requests WHERE id = ?",
      [agreementId],
    );

    if (agreement.length === 0) {
      return res.status(404).json({
        message: "Agreement not found",
        success: false,
      });
    }

    // Update agreement
    await db.query(
      `
      UPDATE agreement_requests SET
        status = 'waiting_owner_response',
        current_step = 2,
        property_admin_id = ?,
        forwarded_to_owner_date = NOW(),
        admin_notes = ?,
        updated_at = NOW()
      WHERE id = ?
    `,
      [admin_id, admin_notes, agreementId],
    );

    // Log workflow history
    await db.query(
      `
      INSERT INTO agreement_workflow_history (
        agreement_request_id, step_number, step_name, action,
        action_by_id, previous_status, new_status, notes
      ) VALUES (?, 2, 'Forward to Owner', 'forwarded', ?, 
        'pending_admin_review', 'waiting_owner_response', ?)
    `,
      [agreementId, admin_id, admin_notes],
    );

    // Notify owner
    await db.query(
      `
      INSERT INTO agreement_notifications (
        agreement_request_id, recipient_id, notification_type,
        notification_title, notification_message
      ) VALUES (?, ?, 'forwarded_to_owner', 
        'Agreement Request Forwarded', 
        'Property admin has forwarded an agreement request for your review')
    `,
      [agreementId, agreement[0].owner_id],
    );

    // Also notify buyer that their request is being processed
    await db.query(
      "INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)",
      [agreement[0].customer_id, "📋 Agreement Request in Progress",
       "Your agreement request has been reviewed and forwarded to the property owner.", "info"]
    ).catch(() => {});

    // Notify owner via notifications table too
    await db.query(
      "INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)",
      [agreement[0].owner_id, "📋 Agreement Request Awaiting Your Decision",
       "A buyer has requested an agreement for your property. Please review and decide.", "info"]
    ).catch(() => {});

    res.json({
      success: true,
      message: "Agreement forwarded to owner",
      status: "waiting_owner_response",
      current_step: 2,
    });
  } catch (error) {
    console.error("Error forwarding agreement:", error);
    res.status(500).json({
      message: "Server error",
      error: error.message,
      success: false,
    });
  }
});

// ============================================================================
// STEP 3: OWNER DECISION
// ============================================================================

// PUT /api/agreement-workflow/:agreementId/owner-decision
// Owner accepts or rejects the request
router.put("/:agreementId/owner-decision", async (req, res) => {
  try {
    const { agreementId } = req.params;
    const { owner_id, decision, owner_notes } = req.body;

    if (!["accepted", "rejected", "counter_offer"].includes(decision)) {
      return res.status(400).json({
        message:
          'Invalid decision. Must be "accepted", "rejected", or "counter_offer"',
        success: false,
      });
    }

    // Get agreement
    const [agreement] = await db.query(
      "SELECT * FROM agreement_requests WHERE id = ?",
      [agreementId],
    );

    if (agreement.length === 0) {
      return res.status(404).json({
        message: "Agreement not found",
        success: false,
      });
    }

    const new_status =
      decision === "accepted"
        ? "owner_accepted"
        : decision === "counter_offer"
          ? "counter_offer"
          : "owner_rejected";
    const next_step = 3;

    // Determine the final agreed price when accepting
    let agreedPrice = null;
    if (decision === "accepted") {
      // Check buyer's counter offer price in customer_notes
      const customerNotes = agreement[0].customer_notes || "";
      const buyerPriceMatch = customerNotes.match(/Price:\s*([\d,]+)\s*ETB/i);
      if (buyerPriceMatch) {
        agreedPrice = parseFloat(buyerPriceMatch[1].replace(/,/g, ""));
      }
    }
    // If owner sends a counter offer with a price, save it as proposed_price
    if (decision === "counter_offer" && owner_notes) {
      const priceMatch = owner_notes.match(
        /Price:\s*([\d,]+(?:\.\d+)?)\s*ETB/i,
      );
      if (priceMatch) agreedPrice = parseFloat(priceMatch[1].replace(/,/g, ""));
    }

    await db.query(
      `UPDATE agreement_requests SET
        status = ?,
        current_step = ?,
        owner_decision = ?,
        owner_decision_date = NOW(),
        owner_notes = ?,
        ${agreedPrice ? "proposed_price = ?," : ""}
        updated_at = NOW()
      WHERE id = ?`,
      agreedPrice
        ? [
            new_status,
            next_step,
            decision,
            owner_notes,
            agreedPrice,
            agreementId,
          ]
        : [new_status, next_step, decision, owner_notes, agreementId],
    );

    // Log workflow history
    await db.query(
      `
      INSERT INTO agreement_workflow_history (
        agreement_request_id, step_number, step_name, action,
        action_by_id, previous_status, new_status, notes
      ) VALUES (?, 3, 'Owner Decision', ?, ?, 
        'waiting_owner_response', ?, ?)
    `,
      [agreementId, decision, owner_id, new_status, owner_notes],
    );

    // Notify based on decision
    const notifTitle =
      decision === "accepted"
        ? "Owner Accepted Agreement"
        : decision === "counter_offer"
          ? "Owner Sent Counter Offer 🔄"
          : "Owner Rejected Agreement";
    const notifMsg =
      decision === "accepted"
        ? "Owner has accepted the agreement request"
        : decision === "counter_offer"
          ? `Owner has sent a counter offer: ${owner_notes || ""}`
          : "Owner has rejected the agreement request";

    // Notify property admin
    if (agreement[0].property_admin_id) {
      await db.query(
        `
        INSERT INTO agreement_notifications (
          agreement_request_id, recipient_id, notification_type,
          notification_title, notification_message
        ) VALUES (?, ?, ?, ?, ?)
      `,
        [
          agreementId,
          agreement[0].property_admin_id,
          decision,
          notifTitle,
          notifMsg,
        ],
      );
    }

    // Notify customer for counter offer or rejection
    if (decision === "rejected" || decision === "counter_offer") {
      await db.query(
        `
        INSERT INTO agreement_notifications (
          agreement_request_id, recipient_id, notification_type,
          notification_title, notification_message
        ) VALUES (?, ?, ?, ?, ?)
      `,
        [agreementId, agreement[0].customer_id, decision, notifTitle, notifMsg],
      );

      // Also add to notifications table
      await db.query(
        "INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)",
        [
          agreement[0].customer_id,
          notifTitle,
          notifMsg,
          decision === "counter_offer" ? "info" : "error",
        ],
      );
    }

    res.json({
      success: true,
      message: `Agreement ${decision} by owner`,
      status: new_status,
      current_step: next_step,
    });
  } catch (error) {
    console.error("Error processing owner decision:", error);
    res.status(500).json({
      message: "Server error",
      error: error.message,
      success: false,
    });
  }
});

// ============================================================================
// STEP 3b: ADMIN FORWARDS COUNTER OFFER TO BUYER
// ============================================================================

// PUT /api/agreement-workflow/:agreementId/forward-counter-offer
router.put("/:agreementId/forward-counter-offer", async (req, res) => {
  try {
    const { agreementId } = req.params;
    const { admin_id, admin_notes } = req.body;

    const [agreement] = await db.query(
      "SELECT * FROM agreement_requests WHERE id = ?",
      [agreementId],
    );

    if (agreement.length === 0) {
      return res
        .status(404)
        .json({ message: "Agreement not found", success: false });
    }

    await db.query(
      `UPDATE agreement_requests SET
        status = 'counter_offer_forwarded',
        property_admin_id = ?,
        admin_notes = ?,
        updated_at = NOW()
       WHERE id = ?`,
      [admin_id, admin_notes || agreement[0].admin_notes, agreementId],
    );

    await db.query(
      `INSERT INTO agreement_workflow_history (
        agreement_request_id, step_number, step_name, action,
        action_by_id, previous_status, new_status, notes
      ) VALUES (?, 3, 'Forward Counter Offer', 'forwarded_counter', ?,
        'counter_offer', 'counter_offer_forwarded', ?)`,
      [agreementId, admin_id, admin_notes],
    );

    // Notify buyer
    await db.query(
      `INSERT INTO agreement_notifications (
        agreement_request_id, recipient_id, notification_type,
        notification_title, notification_message
      ) VALUES (?, ?, 'counter_offer_forwarded',
        '🔄 Counter Offer from Owner',
        'The owner has sent a counter offer. Please review and respond.')`,
      [agreementId, agreement[0].customer_id],
    );

    await db.query(
      "INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)",
      [
        agreement[0].customer_id,
        "🔄 Counter Offer Received",
        `The owner has sent a counter offer for your agreement request. Please review and respond.`,
        "info",
      ],
    );

    res.json({
      success: true,
      message: "Counter offer forwarded to buyer",
      status: "counter_offer_forwarded",
    });
  } catch (error) {
    console.error("Error forwarding counter offer:", error);
    res
      .status(500)
      .json({ message: "Server error", error: error.message, success: false });
  }
});

// ============================================================================
// STEP 3b2: ADMIN FORWARDS BUYER COUNTER OFFER TO OWNER
// ============================================================================

router.put("/:agreementId/forward-buyer-counter", async (req, res) => {
  try {
    const { agreementId } = req.params;
    const { admin_id, admin_notes } = req.body;

    const [agreement] = await db.query(
      "SELECT * FROM agreement_requests WHERE id = ?",
      [agreementId],
    );
    if (agreement.length === 0)
      return res
        .status(404)
        .json({ message: "Agreement not found", success: false });

    await db.query(
      `UPDATE agreement_requests SET status = 'buyer_counter_offer_forwarded', property_admin_id = ?, admin_notes = ?, updated_at = NOW() WHERE id = ?`,
      [admin_id, admin_notes || agreement[0].admin_notes, agreementId],
    );

    await db.query(
      `INSERT INTO agreement_workflow_history (agreement_request_id, step_number, step_name, action, action_by_id, previous_status, new_status, notes)
       VALUES (?, 3, 'Forward Buyer Counter to Owner', 'forwarded_to_owner', ?, 'buyer_counter_offer', 'buyer_counter_offer_forwarded', ?)`,
      [agreementId, admin_id, admin_notes],
    );

    // Notify owner
    await db.query(
      `INSERT INTO agreement_notifications (agreement_request_id, recipient_id, notification_type, notification_title, notification_message)
       VALUES (?, ?, 'buyer_counter_forwarded', '🔄 Buyer Counter Offer', 'The buyer has sent a counter offer. Please review and respond.')`,
      [agreementId, agreement[0].owner_id],
    );
    await db.query(
      "INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)",
      [
        agreement[0].owner_id,
        "🔄 Buyer Counter Offer Received",
        `The buyer has sent a counter offer: ${agreement[0].customer_notes || ""}`,
        "info",
      ],
    );

    res.json({
      success: true,
      message: "Buyer counter offer forwarded to owner",
      status: "buyer_counter_offer_forwarded",
    });
  } catch (error) {
    console.error("Error forwarding buyer counter offer:", error);
    res
      .status(500)
      .json({ message: "Server error", error: error.message, success: false });
  }
});

// ============================================================================
// STEP 3c: BUYER RESPONDS TO COUNTER OFFER
// ============================================================================

// PUT /api/agreement-workflow/:agreementId/buyer-counter-response
router.put("/:agreementId/buyer-counter-response", async (req, res) => {
  try {
    const { agreementId } = req.params;
    const { buyer_id, response, counter_price, buyer_notes } = req.body;

    if (!["accepted", "rejected", "counter_offer"].includes(response)) {
      return res
        .status(400)
        .json({ message: "Invalid response", success: false });
    }

    const [agreement] = await db.query(
      "SELECT * FROM agreement_requests WHERE id = ?",
      [agreementId],
    );

    if (agreement.length === 0) {
      return res
        .status(404)
        .json({ message: "Agreement not found", success: false });
    }

    let new_status;
    if (response === "accepted") new_status = "owner_accepted";
    else if (response === "rejected") new_status = "buyer_rejected";
    else new_status = "buyer_counter_offer";

    const notes =
      response === "counter_offer"
        ? `Buyer Counter Offer${counter_price ? ` — Price: ${Number(counter_price).toLocaleString()} ETB` : ""}: ${buyer_notes || ""}`
        : buyer_notes;

    // If buyer accepts, the agreed price is the owner's last counter offer price
    // Parse it from owner_notes e.g. "Counter Offer — Price: 4,500,000 ETB: message"
    let agreedPrice = null;
    if (response === "accepted") {
      const ownerNotes = agreement[0].owner_notes || "";
      const priceMatch = ownerNotes.match(/Price:\s*([\d,]+)\s*ETB/);
      if (priceMatch) {
        agreedPrice = parseFloat(priceMatch[1].replace(/,/g, ""));
      }
    }
    // If buyer sends a counter offer, save their proposed price
    if (response === "counter_offer" && counter_price) {
      agreedPrice = parseFloat(counter_price);
    }

    await db.query(
      `UPDATE agreement_requests SET
        status = ?,
        customer_notes = ?,
        ${agreedPrice ? "proposed_price = ?," : ""}
        updated_at = NOW()
       WHERE id = ?`,
      agreedPrice
        ? [new_status, notes, agreedPrice, agreementId]
        : [new_status, notes, agreementId],
    );

    await db.query(
      `INSERT INTO agreement_workflow_history (
        agreement_request_id, step_number, step_name, action,
        action_by_id, previous_status, new_status, notes
      ) VALUES (?, 3, 'Buyer Counter Response', ?, ?,
        ?, ?, ?)`,
      [agreementId, response, buyer_id, agreement[0].status, new_status, notes],
    );

    // Notify owner and admin
    const notifTitle =
      response === "accepted"
        ? "✅ Buyer Accepted Counter Offer"
        : response === "rejected"
          ? "❌ Buyer Rejected Counter Offer"
          : "🔄 Buyer Sent Counter Offer";
    const notifMsg =
      response === "accepted"
        ? "The buyer has accepted your counter offer. The admin will generate the agreement."
        : response === "rejected"
          ? "The buyer has rejected your counter offer."
          : `The buyer has sent a counter offer: ${notes}`;

    for (const recipientId of [
      agreement[0].owner_id,
      agreement[0].property_admin_id,
    ].filter(Boolean)) {
      await db.query(
        "INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)",
        [
          recipientId,
          notifTitle,
          notifMsg,
          response === "rejected" ? "error" : "info",
        ],
      );
    }

    res.json({
      success: true,
      message: `Buyer response: ${response}`,
      status: new_status,
    });
  } catch (error) {
    console.error("Error processing buyer counter response:", error);
    res
      .status(500)
      .json({ message: "Server error", error: error.message, success: false });
  }
});

// ============================================================================
// STEP 4: ADMIN GENERATES AGREEMENT
// ============================================================================

// POST /api/agreement-workflow/:agreementId/generate-agreement
// Admin generates agreement document
router.post("/:agreementId/generate-agreement", async (req, res) => {
  try {
    const { agreementId } = req.params;
    const { admin_id, template_id } = req.body;

    // Get agreement details with joined property and user data
    const [agreement] = await db.query(
      `SELECT a.*, 
              p.title as property_title, p.location as property_location, p.type as property_type,
              c.name as buyer_first, '' as buyer_last, c.email as buyer_email,
              o.name as owner_first, '' as owner_last, o.email as owner_email
       FROM agreement_requests a
       LEFT JOIN properties p ON a.property_id = p.id
       LEFT JOIN users c ON a.customer_id = c.id
       LEFT JOIN users o ON a.owner_id = o.id
       WHERE a.id = ?`,
      [agreementId],
    );

    if (agreement.length === 0) {
      return res.status(404).json({
        message: "Agreement not found",
        success: false,
      });
    }

    const agr = agreement[0];
    const isRental = agr.agreement_type === 'rent';
    const agreedPrice = Number(agr.proposed_price || agr.property_price || 0);
    const systemFee = (agreedPrice * 0.02).toFixed(2);
    const ownerNet = (agreedPrice - Number(systemFee)).toFixed(2);
    const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    const rentalMonths = agr.rental_duration_months || 12;
    const paymentSchedule = agr.payment_schedule || 'monthly';
    const securityDeposit = Number(agr.security_deposit || 0);
    const moveInDate = agr.move_in_date ? new Date(agr.move_in_date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : 'To Be Determined';

    // ── Shared CSS styles ──
    const sharedStyles = `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Georgia', 'Times New Roman', serif; color: #1a1a2e; background: #fff; padding: 50px; max-width: 900px; margin: 0 auto; line-height: 1.7; }
    .watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-30deg); font-size: 100px; color: rgba(59, 130, 246, 0.04); font-weight: 900; letter-spacing: 10px; pointer-events: none; z-index: 0; }
    .header { text-align: center; border-bottom: 4px double #16213e; padding-bottom: 24px; margin-bottom: 30px; position: relative; z-index: 1; }
    .header .logo { font-size: 32px; font-weight: 900; color: #16213e; letter-spacing: 4px; margin-bottom: 4px; }
    .header .subtitle { font-size: 18px; color: #0f3460; font-weight: 500; margin-bottom: 6px; }
    .header .tagline { font-size: 12px; color: #6b7280; font-style: italic; }
    .meta-row { display: flex; justify-content: space-between; font-size: 12px; color: #6b7280; margin-bottom: 24px; border-bottom: 1px solid #e5e7eb; padding-bottom: 10px; }
    .section { margin-bottom: 28px; position: relative; z-index: 1; }
    .section-title { font-size: 15px; font-weight: 700; color: #16213e; text-transform: uppercase; letter-spacing: 1.5px; border-bottom: 2px solid #3b82f6; padding-bottom: 6px; margin-bottom: 14px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .info-item { padding: 10px 14px; background: #f8fafc; border-radius: 6px; border-left: 3px solid #3b82f6; }
    .info-item label { display: block; font-size: 10px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 2px; }
    .info-item span { font-size: 14px; font-weight: 600; color: #1e293b; }
    .party-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .party-box { border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; background: #fafbfc; }
    .party-box h4 { color: #0f3460; margin-bottom: 6px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; }
    .party-box p { font-size: 12px; color: #374151; line-height: 1.6; }
    .price-highlight { text-align: center; border-radius: 10px; padding: 20px; margin: 16px 0; }
    .price-highlight .label { font-size: 12px; text-transform: uppercase; letter-spacing: 2px; opacity: 0.8; margin-bottom: 4px; }
    .price-highlight .amount { font-size: 36px; font-weight: 900; letter-spacing: 1px; }
    .breakdown-table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .breakdown-table th, .breakdown-table td { padding: 10px 14px; border-bottom: 1px solid #e5e7eb; text-align: left; }
    .breakdown-table th { background: #f1f5f9; color: #374151; font-weight: 700; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px; }
    .breakdown-table td.amount { text-align: right; font-weight: 600; }
    .breakdown-table tr.total td { border-top: 2px solid #16213e; font-weight: 800; font-size: 14px; }
    .terms-text { padding: 18px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; font-size: 13px; line-height: 1.9; }
    .terms-text ol { padding-left: 20px; }
    .terms-text li { margin-bottom: 8px; }
    .signature-section { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 32px; padding-top: 24px; border-top: 3px double #e2e8f0; }
    .signature-box { text-align: center; }
    .signature-box h4 { font-size: 12px; color: #16213e; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px; }
    .signature-line { border: 2px solid #d1d5db; border-radius: 8px; height: 80px; margin-bottom: 6px; display: flex; align-items: center; justify-content: center; color: #9ca3af; font-style: italic; font-size: 12px; background: #fefefe; overflow: hidden; }
    .signature-line img { max-height: 72px; max-width: 90%; }
    .signature-name { font-size: 12px; color: #374151; border-top: 1px solid #374151; padding-top: 4px; margin-top: 4px; }
    .signature-date { font-size: 10px; color: #6b7280; margin-top: 2px; }
    .footer { text-align: center; margin-top: 40px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #9ca3af; }
    .footer p { margin-bottom: 2px; }
    .stamp { display: inline-block; border: 2px solid #3b82f6; border-radius: 8px; padding: 4px 12px; font-size: 10px; color: #3b82f6; font-weight: 700; letter-spacing: 1px; margin-top: 8px; }
    @media print { body { padding: 20px; } .watermark { display: none; } }
    `;

    let contractHTML;

    if (isRental) {
      // ── RENTAL / LEASE AGREEMENT TEMPLATE ──
      const monthlyRent = agreedPrice;
      const totalRent = monthlyRent * rentalMonths;
      const scheduleLabel = paymentSchedule.charAt(0).toUpperCase() + paymentSchedule.slice(1);

      contractHTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Residential Lease Agreement - DDREMS #${agr.id}</title>
  <style>${sharedStyles}
    .price-highlight { background: linear-gradient(135deg, #065f46, #064e3b); color: #fff; }
    .rental-badge { display: inline-block; background: #d1fae5; color: #065f46; font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 20px; text-transform: uppercase; letter-spacing: 1px; margin-left: 8px; }
  </style>
</head>
<body>
  <div class="watermark">DDREMS</div>
  <div class="header">
    <div class="logo">DDREMS</div>
    <div class="subtitle">Residential Lease Agreement <span class="rental-badge">Rental</span></div>
    <div class="tagline">Dire Dawa Real Estate Management System</div>
  </div>
  <div class="meta-row">
    <span>Agreement Reference: <strong>LEASE-${String(agr.id).padStart(5, '0')}</strong></span>
    <span>Date: <strong>${today}</strong></span>
    <span>Status: <strong>Pending Signatures</strong></span>
  </div>
  <div class="section">
    <h3 class="section-title">🏠 Property Information</h3>
    <div class="info-grid">
      <div class="info-item"><label>Property Title</label><span>${agr.property_title || "N/A"}</span></div>
      <div class="info-item"><label>Location</label><span>${agr.property_location || "N/A"}</span></div>
      <div class="info-item"><label>Property Type</label><span>${(agr.property_type || "N/A").charAt(0).toUpperCase() + (agr.property_type || "").slice(1)}</span></div>
      <div class="info-item"><label>Listing Type</label><span>For Rent</span></div>
    </div>
  </div>
  <div class="section">
    <h3 class="section-title">👥 Parties to this Lease</h3>
    <div class="party-grid">
      <div class="party-box">
        <h4>🙋 Tenant (Lessee)</h4>
        <p><strong>${agr.buyer_first} ${agr.buyer_last}</strong></p>
        <p>${agr.buyer_email || "N/A"}</p>
      </div>
      <div class="party-box">
        <h4>🏢 Landlord (Lessor)</h4>
        <p><strong>${agr.owner_first} ${agr.owner_last}</strong></p>
        <p>${agr.owner_email || "N/A"}</p>
      </div>
    </div>
  </div>
  <div class="section">
    <h3 class="section-title">📅 Lease Terms</h3>
    <div class="info-grid">
      <div class="info-item"><label>Lease Duration</label><span>${rentalMonths} Month${rentalMonths > 1 ? 's' : ''}</span></div>
      <div class="info-item"><label>Payment Schedule</label><span>${scheduleLabel}</span></div>
      <div class="info-item"><label>Move-In Date</label><span>${moveInDate}</span></div>
      <div class="info-item"><label>Security Deposit</label><span>${securityDeposit > 0 ? securityDeposit.toLocaleString() + ' ETB' : 'None'}</span></div>
    </div>
  </div>
  <div class="section">
    <h3 class="section-title">💰 Rent Amount</h3>
    <div class="price-highlight">
      <div class="label">Monthly Rent</div>
      <div class="amount">${monthlyRent.toLocaleString()} ETB</div>
    </div>
  </div>
  <div class="section">
    <h3 class="section-title">📊 Financial Summary</h3>
    <table class="breakdown-table">
      <thead><tr><th>Description</th><th style="text-align:right">Amount</th></tr></thead>
      <tbody>
        <tr><td>Monthly Rent</td><td class="amount">${monthlyRent.toLocaleString()} ETB</td></tr>
        <tr><td>Lease Duration</td><td class="amount">${rentalMonths} months</td></tr>
        ${securityDeposit > 0 ? `<tr><td>Security Deposit (refundable)</td><td class="amount">${securityDeposit.toLocaleString()} ETB</td></tr>` : ''}
        <tr><td>System Service Fee (2%)</td><td class="amount">- ${Number(systemFee).toLocaleString()} ETB / month</td></tr>
        <tr class="total"><td>Total Lease Value</td><td class="amount">${totalRent.toLocaleString()} ETB</td></tr>
      </tbody>
    </table>
  </div>
  <div class="section">
    <h3 class="section-title">📝 Lease Terms and Conditions</h3>
    <div class="terms-text">
      <ol>
        <li><strong>Lease Agreement:</strong> The Landlord agrees to lease, and the Tenant agrees to rent, the above-described property at a monthly rent of <strong>${monthlyRent.toLocaleString()} ETB</strong> for a period of <strong>${rentalMonths} months</strong>.</li>
        <li><strong>Rent Payments:</strong> Rent is due on the <strong>1st of each month</strong>, payable via the DDREMS platform. Late payments may be subject to penalties as per local regulations.</li>
        <li><strong>Security Deposit:</strong> ${securityDeposit > 0 ? `A security deposit of <strong>${securityDeposit.toLocaleString()} ETB</strong> shall be paid by the Tenant before move-in. The deposit will be refunded within 30 days of lease termination, less any deductions for damages or unpaid rent.` : 'No security deposit is required for this lease.'}</li>
        <li><strong>Move-In Date:</strong> The Tenant shall take possession of the property on <strong>${moveInDate}</strong>.</li>
        <li><strong>Maintenance:</strong> The Tenant shall maintain the property in good condition. Major structural repairs remain the responsibility of the Landlord.</li>
        <li><strong>Termination:</strong> Either party may terminate the lease with <strong>30 days written notice</strong>. Early termination by the Tenant may result in forfeiture of the security deposit.</li>
        <li><strong>System Fee:</strong> A 2% platform facilitation fee is deducted from each payment to the Landlord.</li>
        <li><strong>Disputes:</strong> Disputes arising from this lease shall be resolved through mediation facilitated by the DDREMS administration.</li>
        <li><strong>Signatures:</strong> Digital signatures applied through DDREMS are legally binding.</li>
      </ol>
    </div>
  </div>
  <div class="section">
    <h3 class="section-title">✍️ Digital Signatures</h3>
    <div class="signature-section">
      <div class="signature-box">
        <h4>Tenant</h4>
        <div class="signature-line" id="sig-buyer">Awaiting Signature</div>
        <div class="signature-name">${agr.buyer_first} ${agr.buyer_last}</div>
        <div class="signature-date" id="sig-buyer-date">Date: ___________</div>
      </div>
      <div class="signature-box">
        <h4>Landlord</h4>
        <div class="signature-line" id="sig-owner">Awaiting Signature</div>
        <div class="signature-name">${agr.owner_first} ${agr.owner_last}</div>
        <div class="signature-date" id="sig-owner-date">Date: ___________</div>
      </div>
    </div>
  </div>
  <div class="footer">
    <p>This document was generated by the Dire Dawa Real Estate Management System (DDREMS)</p>
    <p>Agreement Reference: LEASE-${String(agr.id).padStart(5, '0')} | Generated: ${today}</p>
    <div class="stamp">OFFICIAL DDREMS LEASE DOCUMENT</div>
  </div>
</body>
</html>`;
    } else {
      // ── PURCHASE AGREEMENT TEMPLATE (original) ──
      contractHTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Direct Purchase Agreement - DDREMS #${agr.id}</title>
  <style>${sharedStyles}
    .price-highlight { background: linear-gradient(135deg, #1e3a5f, #16213e); color: #fff; }
  </style>
</head>
<body>
  <div class="watermark">DDREMS</div>
  <div class="header">
    <div class="logo">DDREMS</div>
    <div class="subtitle">Direct Property Purchase Agreement</div>
    <div class="tagline">Dire Dawa Real Estate Management System</div>
  </div>
  <div class="meta-row">
    <span>Agreement Reference: <strong>AGR-${String(agr.id).padStart(5, '0')}</strong></span>
    <span>Date: <strong>${today}</strong></span>
    <span>Status: <strong>Pending Signatures</strong></span>
  </div>
  <div class="section">
    <h3 class="section-title">🏠 Property Information</h3>
    <div class="info-grid">
      <div class="info-item"><label>Property Title</label><span>${agr.property_title || "N/A"}</span></div>
      <div class="info-item"><label>Location</label><span>${agr.property_location || "N/A"}</span></div>
      <div class="info-item"><label>Property Type</label><span>${(agr.property_type || "N/A").charAt(0).toUpperCase() + (agr.property_type || "").slice(1)}</span></div>
      <div class="info-item"><label>Listed Price</label><span>${Number(agr.property_price || 0).toLocaleString()} ETB</span></div>
    </div>
  </div>
  <div class="section">
    <h3 class="section-title">👥 Parties to this Agreement</h3>
    <div class="party-grid">
      <div class="party-box">
        <h4>🙋 Buyer</h4>
        <p><strong>${agr.buyer_first} ${agr.buyer_last}</strong></p>
        <p>${agr.buyer_email || "N/A"}</p>
      </div>
      <div class="party-box">
        <h4>🏢 Property Owner</h4>
        <p><strong>${agr.owner_first} ${agr.owner_last}</strong></p>
        <p>${agr.owner_email || "N/A"}</p>
      </div>
    </div>
  </div>
  <div class="section">
    <h3 class="section-title">💰 Agreed Transaction Price</h3>
    <div class="price-highlight">
      <div class="label">Final Agreed Price</div>
      <div class="amount">${agreedPrice.toLocaleString()} ETB</div>
    </div>
  </div>
  <div class="section">
    <h3 class="section-title">📊 Financial Breakdown</h3>
    <table class="breakdown-table">
      <thead><tr><th>Description</th><th style="text-align:right">Amount</th></tr></thead>
      <tbody>
        <tr><td>Agreed Purchase Price</td><td class="amount">${agreedPrice.toLocaleString()} ETB</td></tr>
        <tr><td>System Service Fee (2%)</td><td class="amount">- ${Number(systemFee).toLocaleString()} ETB</td></tr>
        <tr class="total"><td>Net Amount to Owner</td><td class="amount">${Number(ownerNet).toLocaleString()} ETB</td></tr>
      </tbody>
    </table>
  </div>
  <div class="section">
    <h3 class="section-title">📝 Terms and Conditions</h3>
    <div class="terms-text">
      <ol>
        <li><strong>Sale Agreement:</strong> The Buyer agrees to purchase, and the Owner agrees to sell, the above-described property at the agreed price of <strong>${agreedPrice.toLocaleString()} ETB</strong>.</li>
        <li><strong>System Fee:</strong> The transaction is subject to a 2% platform facilitation fee deducted from the final payout to the owner.</li>
        <li><strong>Payment:</strong> The Buyer shall submit the full agreed amount via the DDREMS platform. Payment must be verified by a system administrator before the ownership transfer can proceed.</li>
        <li><strong>Property Handover:</strong> Upon payment verification, the Owner shall hand over the property to the Buyer within <strong>14 business days</strong> unless otherwise agreed upon.</li>
        <li><strong>Resolutions:</strong> Disputes arising from this agreement shall be resolved through mediation facilitated by the DDREMS administration.</li>
        <li><strong>Signatures:</strong> Digital signatures applied through DDREMS are legally binding.</li>
      </ol>
    </div>
  </div>
  <div class="section">
    <h3 class="section-title">✍️ Digital Signatures</h3>
    <div class="signature-section">
      <div class="signature-box">
        <h4>Buyer</h4>
        <div class="signature-line" id="sig-buyer">Awaiting Signature</div>
        <div class="signature-name">${agr.buyer_first} ${agr.buyer_last}</div>
        <div class="signature-date" id="sig-buyer-date">Date: ___________</div>
      </div>
      <div class="signature-box">
        <h4>Property Owner</h4>
        <div class="signature-line" id="sig-owner">Awaiting Signature</div>
        <div class="signature-name">${agr.owner_first} ${agr.owner_last}</div>
        <div class="signature-date" id="sig-owner-date">Date: ___________</div>
      </div>
    </div>
  </div>
  <div class="footer">
    <p>This document was generated by the Dire Dawa Real Estate Management System (DDREMS)</p>
    <p>Agreement Reference: AGR-${String(agr.id).padStart(5, '0')} | Generated: ${today}</p>
    <div class="stamp">OFFICIAL DDREMS DOCUMENT</div>
  </div>
</body>
</html>`;
    }

    const [docResult] = await db.query(
      `
      INSERT INTO agreement_documents (
        agreement_request_id, version, document_type,
        document_content, generated_by_id
      ) VALUES (?, 1, 'initial', ?, ?)
    `,
      [agreementId, contractHTML, admin_id],
    ).catch(() => ({ insertId: null }));

    // Update agreement — also store HTML directly as fallback
    await db.query(
      `
      UPDATE agreement_requests SET
        status = 'agreement_generated',
        current_step = 4,
        agreement_html = ?,
        agreement_generated_date = NOW(),
        updated_at = NOW()
      WHERE id = ?
    `,
      [contractHTML, agreementId],
    );

    // Log workflow history
    await db.query(
      `
      INSERT INTO agreement_workflow_history (
        agreement_request_id, step_number, step_name, action,
        action_by_id, previous_status, new_status
      ) VALUES (?, 4, 'Generate Agreement', 'generated', ?, 
        'owner_accepted', 'agreement_generated')
    `,
      [agreementId, admin_id],
    );

    // Notify customer
    await db.query(
      `
      INSERT INTO agreement_notifications (
        agreement_request_id, recipient_id, notification_type,
        notification_title, notification_message
      ) VALUES (?, ?, 'agreement_generated', 
        'Agreement Generated', 
        'Your agreement document has been generated. Please review and complete it.')
    `,
      [agreementId, agreement[0].customer_id],
    );

    res.json({
      success: true,
      message: "Agreement generated successfully",
      document_id: docResult.insertId,
      status: "agreement_generated",
      current_step: 4,
    });
  } catch (error) {
    console.error("Error generating agreement:", error);
    res.status(500).json({
      message: "Server error",
      error: error.message,
      success: false,
    });
  }
});

// ============================================================================
// STEP 4b: AUTO-GENERATE AGREEMENT PDF (using HTML from agreements.js)
// ============================================================================

// GET /api/agreement-workflow/:agreementId/view-agreement
// View the generated agreement document with live signatures
router.get("/:agreementId/view-agreement", async (req, res) => {
  try {
    const { agreementId } = req.params;

    const [docs] = await db.query(
      "SELECT * FROM agreement_documents WHERE agreement_request_id = ? ORDER BY version DESC LIMIT 1",
      [agreementId],
    );

    let contractHTML;
    let docRow;

    if (docs.length === 0) {
      // Fallback: check agreement_requests for stored HTML
      const [agRows] = await db.query(
        "SELECT id, agreement_html FROM agreement_requests WHERE id = ?",
        [agreementId],
      );
      if (!agRows.length || !agRows[0].agreement_html) {
        return res
          .status(404)
          .json({ success: false, message: "No agreement document found. Please generate the agreement first." });
      }
      contractHTML = agRows[0].agreement_html;
      docRow = { document_content: contractHTML, agreement_request_id: agreementId };
    } else {
      contractHTML = docs[0].document_content;
      docRow = docs[0];
    }

    // Fetch signatures and explicitly inject them
    const [signatures] = await db.query(
      "SELECT signer_role, signature_data, signed_at FROM agreement_signatures WHERE agreement_request_id = ?",
      [agreementId]
    ).catch(() => [[]]);

    const formatSigDate = (dateString) => {
      if (!dateString) return '';
      const date = new Date(dateString);
      return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) +
             " " + date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    };

    signatures.forEach(sig => {
      const sigImg = sig.signature_data.startsWith("data:image") 
          ? `<img src="${sig.signature_data}" alt="${sig.signer_role} signature" />`
          : `<div style="font-family: 'Brush Script MT', cursive; font-size: 24px; color: #1e3a5f;">${sig.signature_data}</div>`;
      
      const sigDate = formatSigDate(sig.signed_at);

      if (sig.signer_role === 'buyer') {
        contractHTML = contractHTML.replace('<div class="signature-line" id="sig-buyer">Awaiting Signature</div>', `<div class="signature-line" id="sig-buyer">${sigImg}</div>`);
        contractHTML = contractHTML.replace('<div class="signature-date" id="sig-buyer-date">Date: ___________</div>', `<div class="signature-date" id="sig-buyer-date">Date: ${sigDate}</div>`);
      } else if (sig.signer_role === 'owner') {
        contractHTML = contractHTML.replace('<div class="signature-line" id="sig-owner">Awaiting Signature</div>', `<div class="signature-line" id="sig-owner">${sigImg}</div>`);
        contractHTML = contractHTML.replace('<div class="signature-date" id="sig-owner-date">Date: ___________</div>', `<div class="signature-date" id="sig-owner-date">Date: ${sigDate}</div>`);
      }
    });

    docs[0] && (docs[0].document_content = contractHTML);
    docRow.document_content = contractHTML;

    res.json({ success: true, document: docRow });
  } catch (error) {
    console.error("Error viewing agreement:", error);
    res
      .status(500)
      .json({ message: "Server error", error: error.message, success: false });
  }
});

// ============================================================================
// STEP 5: BUYER SIGNS AGREEMENT
// ============================================================================

// PUT /api/agreement-workflow/:agreementId/buyer-sign
router.put("/:agreementId/buyer-sign", async (req, res) => {
  try {
    const { agreementId } = req.params;
    const { buyer_id, signature_data } = req.body;

    // Get agreement
    const [agreement] = await db.query(
      "SELECT * FROM agreement_requests WHERE id = ?",
      [agreementId],
    );

    if (agreement.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Agreement not found" });
    }

    if (
      agreement[0].status !== "agreement_generated" &&
      agreement[0].status !== "buyer_signed"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Agreement must be generated before signing. Current status: " +
          agreement[0].status,
      });
    }

    // Record signature
    await db.query(
      `
      INSERT INTO agreement_signatures (
        agreement_request_id, signer_id, signer_role, signature_data
      ) VALUES (?, ?, 'buyer', ?)
    `,
      [agreementId, buyer_id, signature_data || "digital_signature"],
    ).catch(() => {});

    // Update agreement
    await db.query(
      `
      UPDATE agreement_requests SET
        buyer_signed = TRUE,
        buyer_signed_date = NOW(),
        status = 'buyer_signed',
        current_step = 5,
        updated_at = NOW()
      WHERE id = ?
    `,
      [agreementId],
    );

    // Log workflow history
    await db.query(
      `
      INSERT INTO agreement_workflow_history (
        agreement_request_id, step_number, step_name, action,
        action_by_id, previous_status, new_status
      ) VALUES (?, 5, 'Buyer Signature', 'signed', ?, 'agreement_generated', 'buyer_signed')
    `,
      [agreementId, buyer_id],
    );

    // Notify owner to sign
    await db.query(
      `
      INSERT INTO agreement_notifications (
        agreement_request_id, recipient_id, notification_type,
        notification_title, notification_message
      ) VALUES (?, ?, 'buyer_signed', 
        'Buyer Has Signed Agreement', 
        'The buyer has signed the agreement. Please review and add your signature.')
    `,
      [agreementId, agreement[0].owner_id],
    );

    res.json({
      success: true,
      message: "Agreement signed by buyer",
      status: "buyer_signed",
      current_step: 5,
    });
  } catch (error) {
    console.error("Error recording buyer signature:", error);
    res
      .status(500)
      .json({ message: "Server error", error: error.message, success: false });
  }
});

// ============================================================================
// STEP 6: OWNER SIGNS AGREEMENT
// ============================================================================

// PUT /api/agreement-workflow/:agreementId/owner-sign
router.put("/:agreementId/owner-sign", async (req, res) => {
  try {
    const { agreementId } = req.params;
    const { owner_id, signature_data } = req.body;

    // Get agreement
    const [agreement] = await db.query(
      "SELECT * FROM agreement_requests WHERE id = ?",
      [agreementId],
    );

    if (agreement.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Agreement not found" });
    }

    if (!agreement[0].buyer_signed) {
      return res.status(400).json({
        success: false,
        message: "Buyer must sign first before the owner can sign",
      });
    }

    // Record signature
    await db.query(
      `
      INSERT INTO agreement_signatures (
        agreement_request_id, signer_id, signer_role, signature_data
      ) VALUES (?, ?, 'owner', ?)
    `,
      [agreementId, owner_id, signature_data || "digital_signature"],
    ).catch(() => {});

    // Update agreement — now fully signed (contract locked)
    await db.query(
      `
      UPDATE agreement_requests SET
        owner_signed = TRUE,
        owner_signed_date = NOW(),
        status = 'fully_signed',
        current_step = 7,
        updated_at = NOW()
      WHERE id = ?
    `,
      [agreementId],
    );

    // Log workflow history
    await db.query(
      `
      INSERT INTO agreement_workflow_history (
        agreement_request_id, step_number, step_name, action,
        action_by_id, previous_status, new_status
      ) VALUES (?, 6, 'Owner Signature', 'signed', ?, 'buyer_signed', 'fully_signed')
    `,
      [agreementId, owner_id],
    );

    // Notify buyer — payment is now unlocked
    await db.query(
      `
      INSERT INTO agreement_notifications (
        agreement_request_id, recipient_id, notification_type,
        notification_title, notification_message
      ) VALUES (?, ?, 'contract_locked', 
        '✅ Contract Signed & Locked', 
        'Both parties have signed. The contract is now binding. You can proceed to make payment.')
    `,
      [agreementId, agreement[0].customer_id],
    );

    // Notify admin
    await db.query(
      `
      INSERT INTO agreement_notifications (
        agreement_request_id, recipient_id, notification_type,
        notification_title, notification_message
      ) VALUES (?, ?, 'contract_locked', 
        'Agreement Fully Signed', 
        'Both buyer and owner have signed. Awaiting buyer payment.')
    `,
      [agreementId, agreement[0].property_admin_id],
    );

    res.json({
      success: true,
      message: "Agreement signed by owner. Contract is now locked.",
      status: "fully_signed",
      current_step: 7,
    });
  } catch (error) {
    console.error("Error recording owner signature:", error);
    res
      .status(500)
      .json({ message: "Server error", error: error.message, success: false });
  }
});

// ============================================================================
// STEP 6b: BROKER SIGNS (if applicable)
// ============================================================================

// PUT /api/agreement-workflow/:agreementId/broker-sign
router.put("/:agreementId/broker-sign", async (req, res) => {
  try {
    const { agreementId } = req.params;
    const { broker_id, signature_data } = req.body;

    const [agreement] = await db.query(
      "SELECT * FROM agreement_requests WHERE id = ?",
      [agreementId],
    );

    if (agreement.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Agreement not found" });
    }

    // Record broker signature
    await db.query(
      `
      INSERT INTO agreement_signatures (
        agreement_request_id, signer_id, signer_role, signature_data
      ) VALUES (?, ?, 'broker', ?)
    `,
      [agreementId, broker_id, signature_data || "digital_signature"],
    );

    await db.query(
      `
      UPDATE agreement_requests SET
        broker_signed = TRUE,
        broker_signed_date = NOW(),
        broker_id = ?,
        updated_at = NOW()
      WHERE id = ?
    `,
      [broker_id, agreementId],
    );

    // Log workflow history
    await db.query(
      `
      INSERT INTO agreement_workflow_history (
        agreement_request_id, step_number, step_name, action,
        action_by_id, previous_status, new_status, notes
      ) VALUES (?, 6, 'Broker Signature', 'signed', ?, ?, ?, 'Broker confirmed commission agreement')
    `,
      [agreementId, broker_id, agreement[0].status, agreement[0].status],
    );

    res.json({
      success: true,
      message: "Agreement signed by broker",
      status: agreement[0].status,
    });
  } catch (error) {
    console.error("Error recording broker signature:", error);
    res
      .status(500)
      .json({ message: "Server error", error: error.message, success: false });
  }
});

// ============================================================================
// STEP 9: BUYER SUBMITS PAYMENT
// ============================================================================

// POST /api/agreement-workflow/:agreementId/submit-payment
router.post("/:agreementId/submit-payment", async (req, res) => {
  try {
    const { agreementId } = req.params;
    const {
      buyer_id,
      payment_method,
      payment_amount,
      payment_reference,
      receipt_document,
    } = req.body;

    // Get agreement
    const [agreement] = await db.query(
      "SELECT * FROM agreement_requests WHERE id = ?",
      [agreementId],
    );

    if (agreement.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Agreement not found" });
    }

    // Enforce: contract must be fully signed before payment
    if (agreement[0].status !== "fully_signed") {
      return res.status(400).json({
        success: false,
        message:
          "Both buyer and owner must sign the contract before payment can be made. Current status: " +
          agreement[0].status,
      });
    }

    // Record payment
    await db.query(
      `
      INSERT INTO agreement_payments (
        agreement_request_id, payment_method, payment_amount,
        receipt_file_path, transaction_reference, payment_status, payment_date
      ) VALUES (?, ?, ?, ?, ?, 'pending_verification', NOW())
    `,
      [
        agreementId,
        payment_method,
        payment_amount,
        receipt_document,
        payment_reference,
      ],
    ).catch(() => {});

    // Update agreement
    await db.query(
      `
      UPDATE agreement_requests SET
        payment_submitted = TRUE,
        status = 'payment_submitted',
        current_step = 9,
        updated_at = NOW()
      WHERE id = ?
    `,
      [agreementId],
    );

    // Log workflow history
    await db.query(
      `
      INSERT INTO agreement_workflow_history (
        agreement_request_id, step_number, step_name, action,
        action_by_id, previous_status, new_status
      ) VALUES (?, 9, 'Payment Submitted', 'paid', ?, 'fully_signed', 'payment_submitted')
    `,
      [agreementId, buyer_id],
    );

    // Notify admin to verify funds
    await db.query(
      `
      INSERT INTO agreement_notifications (
        agreement_request_id, recipient_id, notification_type,
        notification_title, notification_message
      ) VALUES (?, ?, 'payment_submitted', 
        '💰 Payment Submitted', 
        'Buyer has submitted payment. Please verify the funds have arrived.')
    `,
      [agreementId, agreement[0].property_admin_id],
    );

    res.json({
      success: true,
      message: "Payment submitted. Awaiting admin verification.",
      status: "payment_submitted",
      current_step: 9,
    });
  } catch (error) {
    console.error("Error submitting payment:", error);
    res
      .status(500)
      .json({ message: "Server error", error: error.message, success: false });
  }
});

// ============================================================================
// STEP 10: ADMIN VERIFIES FUNDS
// ============================================================================

// PUT /api/agreement-workflow/:agreementId/verify-payment
router.put("/:agreementId/verify-payment", async (req, res) => {
  try {
    const { agreementId } = req.params;
    const { admin_id, admin_notes } = req.body;

    const [agreement] = await db.query(
      "SELECT * FROM agreement_requests WHERE id = ?",
      [agreementId],
    );

    if (agreement.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Agreement not found" });
    }

    if (agreement[0].status !== "payment_submitted") {
      return res.status(400).json({
        success: false,
        message: "Payment must be submitted before it can be verified",
      });
    }

    // Update payment record
    await db.query(
      `
      UPDATE agreement_payments SET
        payment_status = 'verified',
        verified_by_id = ?,
        verified_date = NOW(),
        verification_notes = ?
      WHERE agreement_request_id = ? AND payment_status = 'pending_verification'
    `,
      [admin_id, admin_notes, agreementId],
    ).catch(() => {});

    // Update agreement
    await db.query(
      `
      UPDATE agreement_requests SET
        payment_verified = TRUE,
        payment_verified_date = NOW(),
        payment_verified_by = ?,
        status = 'payment_verified',
        current_step = 10,
        updated_at = NOW()
      WHERE id = ?
    `,
      [admin_id, agreementId],
    );

    // Log workflow history
    await db.query(
      `
      INSERT INTO agreement_workflow_history (
        agreement_request_id, step_number, step_name, action,
        action_by_id, previous_status, new_status, notes
      ) VALUES (?, 10, 'Payment Verified', 'verified', ?, 'payment_submitted', 'payment_verified', ?)
    `,
      [agreementId, admin_id, admin_notes],
    );

    // Notify owner — funds received, please hand over keys
    await db.query(
      `
      INSERT INTO agreement_notifications (
        agreement_request_id, recipient_id, notification_type,
        notification_title, notification_message
      ) VALUES (?, ?, 'payment_verified', 
        '✅ Funds Received & Verified', 
        'The admin has verified that payment has been received. Please hand over the property keys to the buyer.')
    `,
      [agreementId, agreement[0].owner_id],
    );

    // Notify buyer — payment verified
    await db.query(
      `
      INSERT INTO agreement_notifications (
        agreement_request_id, recipient_id, notification_type,
        notification_title, notification_message
      ) VALUES (?, ?, 'payment_verified', 
        '✅ Payment Verified', 
        'Your payment has been verified. The owner will hand over the keys. Once you receive them, please confirm handover.')
    `,
      [agreementId, agreement[0].customer_id],
    );

    res.json({
      success: true,
      message: "Payment verified. Owner notified to hand over keys.",
      status: "payment_verified",
      current_step: 10,
    });
  } catch (error) {
    console.error("Error verifying payment:", error);
    res
      .status(500)
      .json({ message: "Server error", error: error.message, success: false });
  }
});

// ============================================================================
// STEP 11a: BUYER CONFIRMS HANDOVER (received keys)
// ============================================================================

// PUT /api/agreement-workflow/:agreementId/confirm-handover
router.put("/:agreementId/confirm-handover", async (req, res) => {
  try {
    const { agreementId } = req.params;
    const { buyer_id } = req.body;

    const [agreement] = await db.query(
      "SELECT * FROM agreement_requests WHERE id = ?",
      [agreementId],
    );

    if (agreement.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Agreement not found" });
    }

    if (agreement[0].status !== "payment_verified") {
      return res.status(400).json({
        success: false,
        message: "Payment must be verified before handover can be confirmed",
      });
    }

    // Update agreement
    await db.query(
      `
      UPDATE agreement_requests SET
        handover_confirmed = TRUE,
        handover_confirmed_date = NOW(),
        status = 'handover_confirmed',
        current_step = 11,
        updated_at = NOW()
      WHERE id = ?
    `,
      [agreementId],
    );

    // Log workflow history
    await db.query(
      `
      INSERT INTO agreement_workflow_history (
        agreement_request_id, step_number, step_name, action,
        action_by_id, previous_status, new_status
      ) VALUES (?, 11, 'Handover Confirmed', 'confirmed', ?, 'payment_verified', 'handover_confirmed')
    `,
      [agreementId, buyer_id],
    );

    // Notify admin — buyer confirmed, ready to release funds
    await db.query(
      `
      INSERT INTO agreement_notifications (
        agreement_request_id, recipient_id, notification_type,
        notification_title, notification_message
      ) VALUES (?, ?, 'handover_confirmed', 
        '🔑 Buyer Confirmed Handover', 
        'The buyer has confirmed receiving the keys. You can now release funds to the owner.')
    `,
      [agreementId, agreement[0].property_admin_id],
    );

    res.json({
      success: true,
      message: "Handover confirmed. Admin can now release funds.",
      status: "handover_confirmed",
      current_step: 11,
    });
  } catch (error) {
    console.error("Error confirming handover:", error);
    res
      .status(500)
      .json({ message: "Server error", error: error.message, success: false });
  }
});

// ============================================================================
// STEP 11b: ADMIN RELEASES FUNDS → COMPLETED
// ============================================================================

// PUT /api/agreement-workflow/:agreementId/release-funds
router.put("/:agreementId/release-funds", async (req, res) => {
  try {
    const { agreementId } = req.params;
    const { admin_id, commission_percentage, admin_notes } = req.body;

    const [agreement] = await db.query(
      "SELECT * FROM agreement_requests WHERE id = ?",
      [agreementId],
    );

    if (agreement.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Agreement not found" });
    }

    if (agreement[0].status !== "handover_confirmed") {
      return res.status(400).json({
        success: false,
        message: "Buyer must confirm handover before funds can be released",
      });
    }

    const property_price =
      agreement[0].proposed_price || agreement[0].property_price;
    const comm_pct =
      commission_percentage || agreement[0].commission_percentage || 5.0;
    const total_commission = (property_price * comm_pct) / 100;
    const net_amount = property_price - total_commission;

    // Create final transaction record
    const [transactionResult] = await db.query(
      `
      INSERT INTO agreement_transactions (
        agreement_request_id, transaction_type, transaction_status,
        buyer_id, seller_id, broker_id, property_id,
        transaction_amount, commission_amount, net_amount,
        completion_date
      ) VALUES (?, 'sale', 'completed', ?, ?, ?, ?, ?, ?, ?, NOW())
    `,
      [
        agreementId,
        agreement[0].customer_id,
        agreement[0].owner_id,
        agreement[0].broker_id,
        agreement[0].property_id,
        property_price,
        total_commission,
        net_amount,
      ],
    ).catch(() => [{ insertId: null }]);

    // Create commission records
    if (agreement[0].broker_id) {
      // With broker: commission goes to broker
      await db.query(
        `
        INSERT INTO agreement_commissions (
          agreement_request_id, commission_type, recipient_id,
          property_price, commission_percentage, commission_amount,
          payment_status, calculated_by_id
        ) VALUES (?, 'broker', ?, ?, ?, ?, 'paid', ?)
      `,
        [
          agreementId,
          agreement[0].broker_id,
          property_price,
          comm_pct,
          total_commission,
          admin_id,
        ],
      ).catch(() => {});
    }

    // Platform fee commission record
    await db.query(
      `
      INSERT INTO agreement_commissions (
        agreement_request_id, commission_type, recipient_id,
        property_price, commission_percentage, commission_amount,
        payment_status, calculated_by_id
      ) VALUES (?, 'platform', ?, ?, ?, ?, 'recorded', ?)
    `,
      [
        agreementId,
        admin_id,
        property_price,
        comm_pct,
        total_commission,
        admin_id,
      ],
    ).catch(() => {});

    // Update agreement to completed
    await db.query(
      `
      UPDATE agreement_requests SET
        funds_released = TRUE,
        funds_released_date = NOW(),
        funds_released_by = ?,
        commission_percentage = ?,
        total_commission = ?,
        status = 'completed',
        completed_date = NOW(),
        updated_at = NOW()
      WHERE id = ?
    `,
      [admin_id, comm_pct, total_commission, agreementId],
    );

    // Update payment status
    await db.query(
      `
      UPDATE agreement_payments SET payment_status = 'released'
      WHERE agreement_request_id = ?
    `,
      [agreementId],
    ).catch(() => {});

    // Log workflow history
    await db.query(
      `
      INSERT INTO agreement_workflow_history (
        agreement_request_id, step_number, step_name, action,
        action_by_id, previous_status, new_status, notes
      ) VALUES (?, 11, 'Funds Released', 'completed', ?, 'handover_confirmed', 'completed', ?)
    `,
      [
        agreementId,
        admin_id,
        admin_notes || "Funds released and transaction completed",
      ],
    );

    // Notify both parties
    await db.query(
      `
      INSERT INTO agreement_notifications (
        agreement_request_id, recipient_id, notification_type,
        notification_title, notification_message
      ) VALUES (?, ?, 'transaction_completed', 
        '🎉 Transaction Completed!', 
        'Congratulations! The property transaction is complete. Funds have been released.')
    `,
      [agreementId, agreement[0].customer_id],
    );

    await db.query(
      `
      INSERT INTO agreement_notifications (
        agreement_request_id, recipient_id, notification_type,
        notification_title, notification_message
      ) VALUES (?, ?, 'transaction_completed', 
        '🎉 Property Sold - Funds Released!', 
        'Your property has been sold. Funds have been released to your account.')
    `,
      [agreementId, agreement[0].owner_id],
    );

    if (agreement[0].broker_id) {
      await db.query(
        `
        INSERT INTO agreement_notifications (
          agreement_request_id, recipient_id, notification_type,
          notification_title, notification_message
        ) VALUES (?, ?, 'commission_paid', 
          '💰 Commission Paid!', 
          'Your commission for this transaction has been processed.')
      `,
        [agreementId, agreement[0].broker_id],
      );
    }

    // Check if this is a rental agreement
    const isRental = agreement[0].agreement_type === 'rental' || agreement[0].agreement_type === 'rent';

    if (isRental) {
      // Auto-generate rental payment schedule for months 2+
      try {
        const rentalMonths = Number(agreement[0].rental_duration_months) || 12;
        const scheduleCount = await generateRentalSchedule({
          agreementRequestId: Number(agreementId),
          tenantId: agreement[0].customer_id,
          ownerId: agreement[0].owner_id,
          propertyId: agreement[0].property_id,
          monthlyRent: property_price,
          leaseDurationMonths: rentalMonths,
          paymentSchedule: agreement[0].payment_schedule || 'monthly',
          brokerCommissionPct: agreement[0].broker_id ? comm_pct : 0,
          systemFeePct: 2,
          brokerId: agreement[0].broker_id
        });
        console.log(`📅 Generated ${scheduleCount} rental payment installments for agreement #${agreementId}`);
      } catch (schedErr) {
        console.error("Rental schedule generation error (non-fatal):", schedErr.message);
      }

      // Mark property as rented
      try {
        await db.query("UPDATE properties SET status = 'rented' WHERE id = ?", [agreement[0].property_id]);
      } catch (propErr) {
        console.error("Property status update error (non-fatal):", propErr.message);
      }
    }

    res.json({
      success: true,
      message: isRental ? "First month processed. Rental schedule created!" : "Funds released. Transaction completed!",
      transaction_id: transactionResult.insertId,
      status: "completed",
      current_step: 11,
      summary: {
        property_price,
        commission_percentage: comm_pct,
        total_commission,
        net_to_owner: net_amount,
      },
    });
  } catch (error) {
    console.error("Error releasing funds:", error);
    res
      .status(500)
      .json({ message: "Server error", error: error.message, success: false });
  }
});

// ============================================================================
// GET ENDPOINTS FOR DASHBOARD VIEWS
// ============================================================================

// GET /api/agreement-workflow/admin/pending
router.get("/admin/pending", async (req, res) => {
  try {
    const [agreements] = await db.query(`
      SELECT ar.*, p.title as property_title, p.location as property_location,
        p.listing_type as property_listing_type, p.price as property_price_val,
        c.name as customer_name, c.email as customer_email,
        o.name as owner_name, o.email as owner_email
      FROM agreement_requests ar
      LEFT JOIN properties p ON ar.property_id = p.id
      LEFT JOIN users c ON ar.customer_id = c.id
      LEFT JOIN users o ON ar.owner_id = o.id
      WHERE ar.status IN ('pending_admin_review','owner_accepted','payment_submitted','handover_confirmed')
      ORDER BY ar.created_at ASC
    `);
    res.json({ success: true, agreements, count: agreements.length });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message, success: false });
  }
});

// GET /api/agreement-workflow/admin/all
router.get("/admin/all", async (req, res) => {
  try {
    const [agreements] = await db.query(`
      SELECT ar.*, p.title as property_title, p.location as property_location,
        p.listing_type as property_listing_type,
        c.name as customer_name, c.email as customer_email,
        o.name as owner_name, o.email as owner_email
      FROM agreement_requests ar
      LEFT JOIN properties p ON ar.property_id = p.id
      LEFT JOIN users c ON ar.customer_id = c.id
      LEFT JOIN users o ON ar.owner_id = o.id
      ORDER BY ar.created_at DESC
    `);
    res.json({ success: true, agreements, count: agreements.length });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message, success: false });
  }
});

// GET /api/agreement-workflow/owner/:ownerId
router.get("/owner/:ownerId", async (req, res) => {
  try {
    const [agreements] = await db.query(`
      SELECT ar.*, p.title as property_title, p.location as property_location,
        p.listing_type as property_listing_type,
        c.name as customer_name, c.email as customer_email
      FROM agreement_requests ar
      LEFT JOIN properties p ON ar.property_id = p.id
      LEFT JOIN users c ON ar.customer_id = c.id
      WHERE ar.owner_id = ? AND ar.status != 'pending_admin_review'
      ORDER BY ar.created_at DESC
    `, [req.params.ownerId]);
    res.json({ success: true, agreements, count: agreements.length });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message, success: false });
  }
});

// GET /api/agreement-workflow/buyer/:buyerId
router.get("/buyer/:buyerId", async (req, res) => {
  try {
    const [agreements] = await db.query(`
      SELECT ar.*, p.title as property_title, p.location as property_location,
        p.listing_type as property_listing_type,
        o.name as owner_name, o.email as owner_email
      FROM agreement_requests ar
      LEFT JOIN properties p ON ar.property_id = p.id
      LEFT JOIN users o ON ar.owner_id = o.id
      WHERE ar.customer_id = ? ORDER BY ar.created_at DESC
    `, [req.params.buyerId]);
    res.json({ success: true, agreements, count: agreements.length });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message, success: false });
  }
});

// GET /api/agreement-workflow/user/:userId
router.get("/user/:userId", async (req, res) => {
  try {
    const [agreements] = await db.query(`
      SELECT ar.*, p.title as property_title, p.location as property_location,
        p.listing_type as property_listing_type,
        c.name as customer_name, o.name as owner_name
      FROM agreement_requests ar
      LEFT JOIN properties p ON ar.property_id = p.id
      LEFT JOIN users c ON ar.customer_id = c.id
      LEFT JOIN users o ON ar.owner_id = o.id
      WHERE ar.customer_id = ? OR ar.owner_id = ?
      ORDER BY ar.created_at DESC
    `, [req.params.userId, req.params.userId]);
    res.json({ success: true, agreements, count: agreements.length });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message, success: false });
  }
});

// GET /api/agreement-workflow/:agreementId
router.get("/:agreementId", async (req, res) => {
  try {
    const [agreement] = await db.query(`
      SELECT ar.*, p.title as property_title, p.location as property_location,
        p.listing_type as property_listing_type,
        c.name as customer_name, c.email as customer_email,
        o.name as owner_name, o.email as owner_email
      FROM agreement_requests ar
      LEFT JOIN properties p ON ar.property_id = p.id
      LEFT JOIN users c ON ar.customer_id = c.id
      LEFT JOIN users o ON ar.owner_id = o.id
      WHERE ar.id = ?
    `, [req.params.agreementId]);

    if (agreement.length === 0) {
      return res.status(404).json({ message: "Agreement not found", success: false });
    }

    const [history] = await db.query(
      "SELECT * FROM agreement_workflow_history WHERE agreement_request_id = ? ORDER BY created_at DESC",
      [req.params.agreementId]
    ).catch(() => [[]]);

    res.json({ success: true, agreement: agreement[0], documents: [], payments: [], commissions: [], history });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message, success: false });
  }
});

module.exports = router;
