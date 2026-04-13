const db = require('./server/config/db');
db.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public'")
  .then(res => {
    res[0].forEach(r => console.log(r.table_name));
    process.exit();
  });
