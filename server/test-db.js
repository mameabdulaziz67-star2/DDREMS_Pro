const db = require("./config/db");

async function check() {
  try {
    const [rows] = await db.query("SELECT receipt_file_path FROM agreement_payments ORDER BY id DESC LIMIT 1");
    console.log("DB value: ", rows[0]?.receipt_file_path?.substring(0, 50));
  } catch (error) {
    console.error("Error:", error);
  } finally {
    process.exit(0);
  }
}

check();
