const db = require('./server/config/db');

async function run() {
  try {
    await db.query('ALTER TABLE broker_engagements ADD COLUMN IF NOT EXISTS draft_offer_price DECIMAL(15,2) DEFAULT NULL');
    console.log('draft_offer_price column added successfully!');
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    process.exit();
  }
}

run();
