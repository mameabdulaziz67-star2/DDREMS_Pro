const db = require('./config/db');

async function migrate() {
  try {
    // 1. Add listing_type to properties
    await db.query(`
      ALTER TABLE properties
      ADD COLUMN IF NOT EXISTS listing_type VARCHAR(20) DEFAULT 'sale'
    `);
    console.log('✅ properties.listing_type added');

    // 2. Add rental columns to agreement_requests
    await db.query(`
      ALTER TABLE agreement_requests
      ADD COLUMN IF NOT EXISTS agreement_type VARCHAR(20) DEFAULT 'sale'
    `);
    await db.query(`
      ALTER TABLE agreement_requests
      ADD COLUMN IF NOT EXISTS rental_duration_months INT
    `);
    await db.query(`
      ALTER TABLE agreement_requests
      ADD COLUMN IF NOT EXISTS payment_schedule VARCHAR(30) DEFAULT 'monthly'
    `);
    await db.query(`
      ALTER TABLE agreement_requests
      ADD COLUMN IF NOT EXISTS security_deposit DECIMAL(15, 2)
    `);
    console.log('✅ agreement_requests rental columns added');

    // 3. Add rental columns to broker_engagements
    await db.query(`
      ALTER TABLE broker_engagements
      ADD COLUMN IF NOT EXISTS engagement_type VARCHAR(20) DEFAULT 'sale'
    `);
    await db.query(`
      ALTER TABLE broker_engagements
      ADD COLUMN IF NOT EXISTS rental_duration_months INT
    `);
    await db.query(`
      ALTER TABLE broker_engagements
      ADD COLUMN IF NOT EXISTS payment_schedule VARCHAR(30) DEFAULT 'monthly'
    `);
    await db.query(`
      ALTER TABLE broker_engagements
      ADD COLUMN IF NOT EXISTS security_deposit DECIMAL(15, 2)
    `);
    console.log('✅ broker_engagements rental columns added');

    console.log('\n🎉 All migrations completed successfully!');
  } catch (err) {
    console.error('❌ Migration error:', err.message);
  }
  process.exit(0);
}

migrate();
