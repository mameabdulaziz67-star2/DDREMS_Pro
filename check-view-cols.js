const db = require('./server/config/db');
const fs = require('fs');
db.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'v_agreement_status' ORDER BY ordinal_position").then(res => {
  fs.writeFileSync('view_cols.txt', res[0].map(r => r.column_name).join('\n'));
  console.log('Done - wrote', res[0].length, 'columns');
  process.exit(0);
}).catch(err => {
  // Maybe it's a view, try pg_catalog
  console.error(err.message);
  // Try getting view definition
  db.query("SELECT definition FROM pg_views WHERE viewname = 'v_agreement_status'").then(res2 => {
    fs.writeFileSync('view_def.txt', res2[0][0]?.definition || 'NOT FOUND');
    console.log('Wrote view definition');
    process.exit(0);
  });
});
