const { Pool } = require("pg");
const dotenv = require("dotenv");
const path = require("path");
const bcrypt = require("bcryptjs");

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    })
  : new Pool({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: String(process.env.DB_PASSWORD),
      database: process.env.DB_NAME,
      port: parseInt(process.env.DB_PORT) || 5432,
    });

async function migrate() {
  const client = await pool.connect();
  try {
    console.log("[MIGRATE] Starting database migration...");

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        phone VARCHAR(20),
        role VARCHAR(50) DEFAULT 'user',
        status VARCHAR(20) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("[MIGRATE] users table OK");

    await client.query(`
      CREATE TABLE IF NOT EXISTS brokers (
        id SERIAL PRIMARY KEY,
        user_id INT REFERENCES users(id) ON DELETE SET NULL,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        phone VARCHAR(20),
        license_number VARCHAR(100),
        commission_rate DECIMAL(5,2) DEFAULT 2.5,
        total_sales INT DEFAULT 0,
        total_commission DECIMAL(15,2) DEFAULT 0,
        rating DECIMAL(3,2) DEFAULT 0,
        status VARCHAR(20) DEFAULT 'active',
        password VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("[MIGRATE] brokers table OK");

    await client.query(`
      CREATE TABLE IF NOT EXISTS properties (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        price DECIMAL(15,2) NOT NULL,
        location VARCHAR(255) NOT NULL,
        latitude DECIMAL(10,8),
        longitude DECIMAL(11,8),
        type VARCHAR(50) NOT NULL DEFAULT 'house',
        listing_type VARCHAR(20) DEFAULT 'sale',
        bedrooms INT,
        bathrooms INT,
        area DECIMAL(10,2),
        status VARCHAR(20) DEFAULT 'pending',
        broker_id INT REFERENCES brokers(id) ON DELETE SET NULL,
        owner_id INT REFERENCES users(id) ON DELETE SET NULL,
        property_admin_id INT REFERENCES users(id) ON DELETE SET NULL,
        verified BOOLEAN DEFAULT FALSE,
        verification_status VARCHAR(20) DEFAULT 'pending',
        verification_date TIMESTAMP,
        images TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("[MIGRATE] properties table OK");

    // Add matterport_model_id if it doesn't exist yet
    await client.query(`
      ALTER TABLE properties
        ADD COLUMN IF NOT EXISTS matterport_model_id VARCHAR(50)
    `);
    console.log("[MIGRATE] properties.matterport_model_id OK");

    await client.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id SERIAL PRIMARY KEY,
        property_id INT REFERENCES properties(id) ON DELETE CASCADE,
        user_id INT REFERENCES users(id) ON DELETE CASCADE,
        broker_id INT REFERENCES brokers(id) ON DELETE SET NULL,
        amount DECIMAL(15,2) NOT NULL,
        transaction_type VARCHAR(20) NOT NULL DEFAULT 'sale',
        payment_method VARCHAR(30) NOT NULL DEFAULT 'cash',
        status VARCHAR(20) DEFAULT 'pending',
        commission_amount DECIMAL(15,2),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("[MIGRATE] transactions table OK");

    await client.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        sender_id INT REFERENCES users(id) ON DELETE CASCADE,
        receiver_id INT REFERENCES users(id) ON DELETE CASCADE,
        subject VARCHAR(255),
        content TEXT NOT NULL,
        is_read BOOLEAN DEFAULT FALSE,
        message_type VARCHAR(50) DEFAULT 'general',
        related_property_id INT REFERENCES properties(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("[MIGRATE] messages table OK");

    await client.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id INT REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        message TEXT,
        type VARCHAR(50) DEFAULT 'info',
        is_read BOOLEAN DEFAULT FALSE,
        related_id INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("[MIGRATE] notifications table OK");

    await client.query(`
      CREATE TABLE IF NOT EXISTS announcements (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        author_id INT REFERENCES users(id) ON DELETE SET NULL,
        status VARCHAR(20) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("[MIGRATE] announcements table OK");

    await client.query(`
      CREATE TABLE IF NOT EXISTS favorites (
        id SERIAL PRIMARY KEY,
        user_id INT REFERENCES users(id) ON DELETE CASCADE,
        property_id INT REFERENCES properties(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, property_id)
      )
    `);
    console.log("[MIGRATE] favorites table OK");

    await client.query(`
      CREATE TABLE IF NOT EXISTS property_images (
        id SERIAL PRIMARY KEY,
        property_id INT REFERENCES properties(id) ON DELETE CASCADE,
        image_data TEXT,
        image_url VARCHAR(500),
        is_primary BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("[MIGRATE] property_images table OK");

    await client.query(`
      CREATE TABLE IF NOT EXISTS property_documents (
        id SERIAL PRIMARY KEY,
        property_id INT REFERENCES properties(id) ON DELETE CASCADE,
        document_name VARCHAR(255),
        document_data TEXT,
        document_type VARCHAR(100),
        access_key VARCHAR(255),
        is_locked BOOLEAN DEFAULT FALSE,
        uploaded_by INT REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("[MIGRATE] property_documents table OK");

    await client.query(`
      CREATE TABLE IF NOT EXISTS document_access_requests (
        id SERIAL PRIMARY KEY,
        document_id INT REFERENCES property_documents(id) ON DELETE CASCADE,
        property_id INT REFERENCES properties(id) ON DELETE CASCADE,
        user_id INT REFERENCES users(id) ON DELETE CASCADE,
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("[MIGRATE] document_access_requests table OK");

    await client.query(`
      CREATE TABLE IF NOT EXISTS agreements (
        id SERIAL PRIMARY KEY,
        property_id INT REFERENCES properties(id) ON DELETE CASCADE,
        buyer_id INT REFERENCES users(id) ON DELETE CASCADE,
        seller_id INT REFERENCES users(id) ON DELETE SET NULL,
        broker_id INT REFERENCES brokers(id) ON DELETE SET NULL,
        agreement_type VARCHAR(50),
        status VARCHAR(30) DEFAULT 'draft',
        terms TEXT,
        amount DECIMAL(15,2),
        start_date DATE,
        end_date DATE,
        signed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("[MIGRATE] agreements table OK");

    await client.query(`
      CREATE TABLE IF NOT EXISTS agreement_requests (
        id SERIAL PRIMARY KEY,
        property_id INT REFERENCES properties(id) ON DELETE CASCADE,
        requester_id INT REFERENCES users(id) ON DELETE CASCADE,
        broker_id INT REFERENCES brokers(id) ON DELETE SET NULL,
        request_type VARCHAR(50),
        status VARCHAR(30) DEFAULT 'pending',
        message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("[MIGRATE] agreement_requests table OK");

    await client.query(`
      CREATE TABLE IF NOT EXISTS key_requests (
        id SERIAL PRIMARY KEY,
        property_id INT REFERENCES properties(id) ON DELETE CASCADE,
        requester_id INT REFERENCES users(id) ON DELETE CASCADE,
        status VARCHAR(20) DEFAULT 'pending',
        message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("[MIGRATE] key_requests table OK");

    await client.query(`
      CREATE TABLE IF NOT EXISTS profiles (
        id SERIAL PRIMARY KEY,
        user_id INT UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        bio TEXT,
        address VARCHAR(255),
        city VARCHAR(100),
        national_id VARCHAR(100),
        profile_image TEXT,
        verification_status VARCHAR(20) DEFAULT 'pending',
        verified_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("[MIGRATE] profiles table OK");

    await client.query(`
      CREATE TABLE IF NOT EXISTS commissions (
        id SERIAL PRIMARY KEY,
        broker_id INT REFERENCES brokers(id) ON DELETE CASCADE,
        transaction_id INT REFERENCES transactions(id) ON DELETE CASCADE,
        amount DECIMAL(15,2) NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        paid_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("[MIGRATE] commissions table OK");

    await client.query(`
      CREATE TABLE IF NOT EXISTS rental_payment_schedules (
        id SERIAL PRIMARY KEY,
        property_id INT REFERENCES properties(id) ON DELETE CASCADE,
        tenant_id INT REFERENCES users(id) ON DELETE CASCADE,
        amount DECIMAL(15,2) NOT NULL,
        due_date DATE NOT NULL,
        paid_date DATE,
        status VARCHAR(20) DEFAULT 'pending',
        payment_reference VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("[MIGRATE] rental_payment_schedules table OK");

    await client.query(`
      CREATE TABLE IF NOT EXISTS broker_engagements (
        id SERIAL PRIMARY KEY,
        buyer_id INT REFERENCES users(id) ON DELETE CASCADE,
        broker_id INT REFERENCES brokers(id) ON DELETE CASCADE,
        property_id INT REFERENCES properties(id) ON DELETE SET NULL,
        status VARCHAR(20) DEFAULT 'pending',
        message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("[MIGRATE] broker_engagements table OK");

    await client.query(`
      CREATE TABLE IF NOT EXISTS property_views (
        id SERIAL PRIMARY KEY,
        property_id INT REFERENCES properties(id) ON DELETE CASCADE,
        user_id INT REFERENCES users(id) ON DELETE SET NULL,
        viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("[MIGRATE] property_views table OK");

    await client.query(`
      CREATE TABLE IF NOT EXISTS payment_confirmations (
        id SERIAL PRIMARY KEY,
        transaction_id INT REFERENCES transactions(id) ON DELETE CASCADE,
        confirmed_by INT REFERENCES users(id) ON DELETE SET NULL,
        amount DECIMAL(15,2),
        reference_number VARCHAR(100),
        receipt_image TEXT,
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("[MIGRATE] payment_confirmations table OK");

    // ── Seed admin users ──────────────────────────────────────
    const adminHash = await bcrypt.hash("admin123", 10);

    const seeds = [
      { name: "System Administrator", email: "admin@ddrems.com",    role: "admin" },
      { name: "Ahmed Broker",          email: "broker@ddrems.com",   role: "broker" },
      { name: "Fatima Owner",          email: "owner@ddrems.com",    role: "owner" },
      { name: "Customer User",         email: "customer@ddrems.com", role: "user" },
    ];

    for (const u of seeds) {
      await client.query(
        `INSERT INTO users (name, email, password, role, status)
         VALUES ($1, $2, $3, $4, 'active')
         ON CONFLICT (email) DO NOTHING`,
        [u.name, u.email, adminHash, u.role]
      );
    }
    console.log("[MIGRATE] Seed users OK (password: admin123)");

    console.log("[MIGRATE] ✅ Database migration complete!");
  } catch (err) {
    console.error("[MIGRATE] ❌ Migration error:", err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((err) => {
  console.error("[MIGRATE] Fatal:", err);
  process.exit(1);
});
