const db = require('./server/config/db');
const fs = require('fs');
db.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'agreement_requests'").then(res => {
  fs.writeFileSync('cols.txt', res[0].map(r => r.column_name).join(', '));
  process.exit(0);
});
