const db = require("./server/config/db");

async function migrateViews() {
  console.log("🔄 Updating v_agreement_status view to include rental columns...\n");

  try {
    // Update the agreement status view to include rental columns
    await db.query(`
      DROP VIEW IF EXISTS v_agreement_status CASCADE;
    `);

    await db.query(`
      CREATE VIEW v_agreement_status AS
      SELECT 
        ar.id,
        ar.customer_id,
        ar.owner_id,
        ar.property_id,
        ar.broker_id,
        ar.property_admin_id,
        ar.status,
        ar.current_step,
        ar.request_date,
        ar.created_at,
        ar.updated_at,
        ar.proposed_price,
        ar.move_in_date,
        ar.property_price,
        ar.buyer_signed,
        ar.owner_signed,
        ar.broker_signed,
        ar.buyer_signed_date,
        ar.owner_signed_date,
        ar.broker_signed_date,
        ar.payment_submitted,
        ar.payment_verified,
        ar.handover_confirmed,
        ar.funds_released,
        ar.total_commission,
        ar.commission_percentage,
        ar.customer_notes,
        ar.owner_notes,
        ar.admin_notes,
        ar.agreement_type,
        ar.rental_duration_months,
        ar.payment_schedule,
        ar.security_deposit,
        p.title as property_title,
        p.price as listed_price,
        p.location as property_location,
        p.type as property_type,
        p.listing_type as property_listing_type,
        c.name as customer_name,
        c.email as customer_email,
        o.name as owner_name,
        o.email as owner_email,
        pa.name as admin_name
      FROM agreement_requests ar
      LEFT JOIN properties p ON ar.property_id = p.id
      LEFT JOIN users c ON ar.customer_id = c.id
      LEFT JOIN users o ON ar.owner_id = o.id
      LEFT JOIN users pa ON ar.property_admin_id = pa.id
    `);

    console.log("✅ v_agreement_status view updated successfully!");

    // Also recreate v_broker_engagements to ensure it picks up all columns
    await db.query(`
      DROP VIEW IF EXISTS v_broker_engagements CASCADE;
    `);

    await db.query(`
      CREATE VIEW v_broker_engagements AS
      SELECT
        be.*,
        p.title AS property_title,
        p.location AS property_location,
        p.price AS property_price,
        p.type AS property_type,
        p.listing_type AS property_listing_type,
        buyer.name AS buyer_name,
        buyer.email AS buyer_email,
        broker.name AS broker_name,
        broker.email AS broker_email,
        owner.name AS owner_name,
        owner.email AS owner_email
      FROM broker_engagements be
      JOIN properties p ON be.property_id = p.id
      JOIN users buyer ON be.buyer_id = buyer.id
      JOIN users broker ON be.broker_id = broker.id
      JOIN users owner ON be.owner_id = owner.id
    `);

    console.log("✅ v_broker_engagements view refreshed successfully!");
    console.log("\n🎉 All views updated with rental columns.");
    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed:", error.message);
    process.exit(1);
  }
}

migrateViews();
