const db = require("./config/db");

async function check() {
  try {
    const [rows] = await db.query("SELECT * FROM agreement_payments ORDER BY id DESC LIMIT 5");
    console.log("DB value: ", rows.map(x => ({ id: x.id, req_id: x.agreement_request_id, rfp: x.receipt_file_path?.substring(0, 20) })));
  } catch (error) {
    console.error("Error:", error);
  } finally {
    process.exit(0);
  }
}

check();
