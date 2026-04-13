const fs = require('fs');
const db = require('./server/config/db');
db.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public'")
  .then(res => {
    fs.writeFileSync('tables_list_utf8.txt', res[0].map(r => r.table_name).join('\n'), 'utf8');
    process.exit();
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
