const db = require("./config/db");

async function check() {
  try {
    const [rows] = await db.query(`
      SELECT v.id, (SELECT receipt_file_path FROM agreement_payments p WHERE p.agreement_request_id = v.id ORDER BY p.id DESC LIMIT 1) as receipt_document 
      FROM v_agreement_status v
      WHERE v.id = 10
    `);
    console.log("SQL DB value: ", rows[0]?.id, rows[0]?.receipt_document?.substring(0, 50));
  } catch (error) {
    console.error("Error:", error);
  } finally {
    process.exit(0);
  }
}

check();
