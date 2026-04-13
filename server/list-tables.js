const db = require("./config/db");

async function check() {
  try {
    const [rows] = await db.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
    console.log("Tables:", rows.map(r => r.table_name));
  } catch (error) {
    console.error("Error:", error);
  } finally {
    process.exit(0);
  }
}

check();
