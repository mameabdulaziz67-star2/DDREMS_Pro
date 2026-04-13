const db = require("./config/db");

async function fix() {
  try {
    console.log("Altering column type...");
    await db.query("ALTER TABLE agreement_payments ALTER COLUMN receipt_file_path TYPE TEXT");
    console.log("Successfully altered column to TEXT");
  } catch (error) {
    console.error("Error altering column:", error);
  } finally {
    process.exit(0);
  }
}

fix();
