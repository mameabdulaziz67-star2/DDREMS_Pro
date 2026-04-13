const db = require('./server/config/db');
const fs = require('fs');
const path = require('path');

async function run() {
  try {
    const sql = fs.readFileSync(path.join(__dirname, 'database', 'broker-assisted-workflow-schema.sql'), 'utf8');
    await db.pool.query(sql);
    console.log('Migration completed successfully!');
    
    // Verify tables
    const result = await db.pool.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'broker_engagement%' ORDER BY table_name"
    );
    console.log('Created tables:', result.rows.map(r => r.table_name));
    
    // Verify view
    const viewResult = await db.pool.query(
      "SELECT count(*) FROM information_schema.views WHERE table_name = 'v_broker_engagements'"
    );
    console.log('View v_broker_engagements exists:', viewResult.rows[0].count > 0);
    
    process.exit(0);
  } catch (err) {
    console.error('Migration error:', err.message);
    process.exit(1);
  }
}

run();
