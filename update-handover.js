const db = require('./server/config/db');

async function run() {
  try {
    await db.query('DROP VIEW IF EXISTS v_broker_engagements');

    await db.query('ALTER TABLE broker_engagements ADD COLUMN IF NOT EXISTS buyer_handover_confirmed BOOLEAN DEFAULT false');
    await db.query('ALTER TABLE broker_engagements ADD COLUMN IF NOT EXISTS owner_handover_confirmed BOOLEAN DEFAULT false');

    await db.query(`
      CREATE OR REPLACE VIEW v_broker_engagements AS
      SELECT
        be.*,
        p.title AS property_title,
        p.location AS property_location,
        p.price AS property_price,
        p.type AS property_type,
        buyer.name AS buyer_name,
        buyer.email AS buyer_email,
        broker.name AS broker_name,
        broker.email AS broker_email,
        owner.name AS owner_name,
        owner.email AS owner_email,
        (
          SELECT string_agg(signer_role, ',')
          FROM broker_engagement_signatures
          WHERE engagement_id = be.id
        ) AS signed_roles
      FROM broker_engagements be
      JOIN properties p ON be.property_id = p.id
      JOIN users buyer ON be.buyer_id = buyer.id
      JOIN users broker ON be.broker_id = broker.id
      JOIN users owner ON be.owner_id = owner.id
    `);
    console.log('Handover columns added and view updated successfully!');
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    process.exit();
  }
}

run();
