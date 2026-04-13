const db = require('./server/config/db');
async function checkSchemas() {
  try {
    let p = await db.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'payments'");
    console.log("payments:", p[0]);

    let ap = await db.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'agreement_payments'");
    console.log("\n\nagreement_payments:", ap[0]);

    let rt = await db.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'transactions'");
    console.log("\n\ntransactions:", rt[0]);
    process.exit(0);
  } catch(e) {
    console.error(e);
    process.exit(1);
  }
}
checkSchemas();
