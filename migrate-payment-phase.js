const db = require('./server/config/db');

async function run() {
  // Drop view first — it uses SELECT be.* and blocks column changes
  try {
    await db.query('DROP VIEW IF EXISTS v_broker_engagements');
    console.log('Dropped view OK');
  } catch (e) { console.error('Drop view err:', e.message); }

  const queries = [
    `ALTER TABLE broker_engagements ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50)`,
    `ALTER TABLE broker_engagements ADD COLUMN IF NOT EXISTS payment_reference VARCHAR(255)`,
    `ALTER TABLE broker_engagements ADD COLUMN IF NOT EXISTS payment_receipt TEXT`,
    `ALTER TABLE broker_engagements ADD COLUMN IF NOT EXISTS payment_submitted_at TIMESTAMP`,
    `ALTER TABLE broker_engagements ADD COLUMN IF NOT EXISTS payment_verified_at TIMESTAMP`,
    `ALTER TABLE broker_engagements ADD COLUMN IF NOT EXISTS payment_verified_by INT`,
    `ALTER TABLE broker_engagements ADD COLUMN IF NOT EXISTS handover_confirmed_at TIMESTAMP`,
    `ALTER TABLE broker_engagements ADD COLUMN IF NOT EXISTS funds_released_at TIMESTAMP`,
    `ALTER TABLE broker_engagements ADD COLUMN IF NOT EXISTS funds_released_by INT`,
    `ALTER TABLE broker_engagements ADD COLUMN IF NOT EXISTS system_commission_pct DECIMAL(5,2) DEFAULT 2.00`,
    `ALTER TABLE broker_engagements ADD COLUMN IF NOT EXISTS broker_commission_pct DECIMAL(5,2) DEFAULT 2.00`,
    `ALTER TABLE broker_engagements ADD COLUMN IF NOT EXISTS system_commission_amount DECIMAL(15,2)`,
    `ALTER TABLE broker_engagements ADD COLUMN IF NOT EXISTS broker_commission_amount DECIMAL(15,2)`,
    `ALTER TABLE broker_engagements ADD COLUMN IF NOT EXISTS owner_payout_amount DECIMAL(15,2)`,
  ];

  for (const q of queries) {
    try {
      await db.query(q);
      console.log('OK:', q.substring(40));
    } catch (err) {
      console.error('ERR:', q.substring(40), err.message);
    }
  }

  // Recreate the view to include new columns
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
      owner.email AS owner_email
    FROM broker_engagements be
    JOIN properties p ON be.property_id = p.id
    JOIN users buyer ON be.buyer_id = buyer.id
    JOIN users broker ON be.broker_id = broker.id
    JOIN users owner ON be.owner_id = owner.id
  `);
  console.log('View recreated OK');

  console.log('\nALL DONE - Payment phase columns added!');
  process.exit();
}
run();
