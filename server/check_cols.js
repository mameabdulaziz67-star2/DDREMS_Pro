const db = require('./config/db');
const fs = require('fs');

async function testQuery() {
  try {
    const res = await db.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'users'`
    );
    const cols = res[0].map(r => r.column_name).join(", ");
    fs.writeFileSync('cols3.txt', cols, 'utf8');
  } catch (error) {
    console.error("Test Error:", error.message);
  } finally {
    process.exit(0);
  }
}

testQuery();
