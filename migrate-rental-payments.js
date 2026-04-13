const db = require('./server/config/db');
const fs = require('fs');
const path = require('path');

async function migrate() {
  try {
    const sql = fs.readFileSync(path.join(__dirname, 'database', 'rental-payment-schedules.sql'), 'utf8');
    await db.pool.query(sql);
    console.log('✅ rental_payment_schedules table created successfully');

    // Verify
    const [cols] = await db.query(
      "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'rental_payment_schedules' ORDER BY ordinal_position"
    );
    console.log('Columns:', cols.map(c => c.column_name).join(', '));
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  }
}

migrate();
