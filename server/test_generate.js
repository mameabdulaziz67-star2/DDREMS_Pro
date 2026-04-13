const db = require('./config/db');

async function testGenerateAgreement() {
  try {
    const agreementId = 1;
    const admin_id = 1;

    // Get agreement details
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
      [agreementId]
    );

    if (agreement.length === 0) {
      console.log("Agreement not found in db");
      return;
    }

    const agr = agreement[0];
    const agreedPrice = Number(agr.proposed_price || agr.property_price || 0);
    const systemFee = (agreedPrice * 0.02).toFixed(2);
    const ownerNet = (agreedPrice - Number(systemFee)).toFixed(2);
    const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

    // HTML Gen (truncated)
    const contractHTML = `<!DOCTYPE html><html><body><h1>Agreement</h1></body></html>`;
    console.log("HTML gen done");

    const [docResult] = await db.query(
      `
      INSERT INTO agreement_documents (
        agreement_request_id, version, document_type,
        document_content, generated_by_id
      ) VALUES (?, 1, 'initial', ?, ?)
    `,
      [agreementId, contractHTML, admin_id],
    );

    console.log("INSERT docs done", docResult);

    // Update agreement
    const [updateReq] = await db.query(
      `
      UPDATE agreement_requests SET
        status = 'agreement_generated',
        current_step = 4,
        agreement_generated_date = NOW(),
        updated_at = NOW()
      WHERE id = ?
    `,
      [agreementId],
    );
    console.log("UPDATE agreement done", updateReq);

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
    console.log("INSERT history done");

    console.log("All done.");
  } catch (error) {
    console.error("Test Error:", error);
  } finally {
    process.exit(0);
  }
}

testGenerateAgreement();
