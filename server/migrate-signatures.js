const db = require("./config/db");

async function migrate() {
  try {
    console.log("Creating agreement_signatures table...");
    
    // PostgreSQL syntax for the signatures table
    await db.query(`
      CREATE TABLE IF NOT EXISTS agreement_signatures (
        id SERIAL PRIMARY KEY,
        agreement_request_id INTEGER NOT NULL,
        signer_id INTEGER NOT NULL,
        signer_role VARCHAR(50) NOT NULL,
        signature_data TEXT NOT NULL,
        signature_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ip_address VARCHAR(45),
        user_agent VARCHAR(255),
        device_info VARCHAR(255),
        is_verified BOOLEAN DEFAULT FALSE,
        verified_by_id INTEGER,
        verified_date TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (agreement_request_id) REFERENCES agreement_requests(id),
        FOREIGN KEY (signer_id) REFERENCES users(id),
        FOREIGN KEY (verified_by_id) REFERENCES users(id)
      )
    `);
    
    console.log("✅ agreement_signatures table created successfully.");
    
    // Check if agreement_documents content is TEXT instead of potentially restrictive VARCHAR
    console.log("Ensuring agreement_documents column types are correct...");
    await db.query("ALTER TABLE agreement_documents ALTER COLUMN document_content TYPE TEXT");
    console.log("✅ agreement_documents column types verified.");
    
  } catch (error) {
    console.error("❌ Migration failed:", error);
  } finally {
    process.exit(0);
  }
}

migrate();
