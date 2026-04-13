const db = require('./server/config/db');
const fs = require('fs');

async function checkSchemas() {
  try {
    let p = await db.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'payments'");
    let ap = await db.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'agreement_payments'");
    let rt = await db.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'transactions'");

    const result = {
      payments: p[0],
      agreement_payments: ap[0],
      transactions: rt[0]
    };
    fs.writeFileSync('payment_schema.json', JSON.stringify(result, null, 2), 'utf8');
    process.exit(0);
  } catch(e) {
    console.error(e);
    process.exit(1);
  }
}
checkSchemas();
