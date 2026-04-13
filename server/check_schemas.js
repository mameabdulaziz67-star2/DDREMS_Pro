const db = require('./config/db');
const fs = require('fs');

async function check() {
  try {
    let out = '';
    let res = await db.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'properties' ORDER BY ordinal_position");
    out += 'properties cols: ' + res[0].map(r => r.column_name).join(', ') + '\n';
    
    res = await db.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'agreement_requests' ORDER BY ordinal_position");
    out += 'agreement_requests cols: ' + res[0].map(r => r.column_name).join(', ') + '\n';
    
    res = await db.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'broker_engagements' ORDER BY ordinal_position");
    out += 'broker_engagements cols: ' + res[0].map(r => r.column_name).join(', ') + '\n';

    fs.writeFileSync('schemas.utf8.txt', out, 'utf8');
  } catch (e) {
    console.error(e.message);
  }
  process.exit(0);
}
check();
