"use strict";
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");
const bodyParser = require("body-parser");
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");

dotenv.config({ path: path.resolve(__dirname, "../.env") });

// ── Database pool (shared) ────────────────────────────────────
const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 10,
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 30000,
    })
  : new Pool({
      host: process.env.DB_HOST || "localhost",
      user: process.env.DB_USER || "postgres",
      password: String(process.env.DB_PASSWORD || ""),
      database: process.env.DB_NAME || "ddrems",
      port: parseInt(process.env.DB_PORT) || 5432,
      max: 10,
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 30000,
    });

pool.on("error", (err) => {
  console.error("[DB] Unexpected pool error:", err.message);
});

// ── Auto-migrate on startup ───────────────────────────────────
async function runMigrations() {
  let client;
  try {
    client = await pool.connect();
    console.log("[MIGRATE] Connected to database, running migrations...");

    const tables = [
      `CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        phone VARCHAR(20),
        role VARCHAR(50) DEFAULT 'user',
        status VARCHAR(20) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS brokers (
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
      )`,
      `CREATE TABLE IF NOT EXISTS properties (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        price DECIMAL(15,2) NOT NULL,
        location VARCHAR(255) NOT NULL,
        address VARCHAR(255),
        city VARCHAR(100),
        state VARCHAR(100),
        zip_code VARCHAR(20),
        latitude DECIMAL(10,8),
        longitude DECIMAL(11,8),
        type VARCHAR(50) NOT NULL DEFAULT 'house',
        listing_type VARCHAR(20) DEFAULT 'sale',
        bedrooms INT,
        bathrooms INT,
        area DECIMAL(10,2),
        features TEXT,
        views INT DEFAULT 0,
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
      )`,
      `CREATE TABLE IF NOT EXISTS property_verification (
        id SERIAL PRIMARY KEY,
        property_id INT REFERENCES properties(id) ON DELETE CASCADE,
        verification_status VARCHAR(20) DEFAULT 'pending',
        verification_notes TEXT,
        verified_by INT REFERENCES users(id) ON DELETE SET NULL,
        verified_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS transactions (
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
      )`,
      `CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        sender_id INT REFERENCES users(id) ON DELETE CASCADE,
        receiver_id INT REFERENCES users(id) ON DELETE CASCADE,
        subject VARCHAR(255),
        content TEXT NOT NULL,
        is_read BOOLEAN DEFAULT FALSE,
        message_type VARCHAR(50) DEFAULT 'general',
        related_property_id INT REFERENCES properties(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id INT REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        message TEXT,
        type VARCHAR(50) DEFAULT 'info',
        is_read BOOLEAN DEFAULT FALSE,
        related_id INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS announcements (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        author_id INT REFERENCES users(id) ON DELETE SET NULL,
        status VARCHAR(20) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS favorites (
        id SERIAL PRIMARY KEY,
        user_id INT REFERENCES users(id) ON DELETE CASCADE,
        property_id INT REFERENCES properties(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, property_id)
      )`,
      `CREATE TABLE IF NOT EXISTS property_images (
        id SERIAL PRIMARY KEY,
        property_id INT REFERENCES properties(id) ON DELETE CASCADE,
        image_data TEXT,
        image_url TEXT,
        image_type VARCHAR(20) DEFAULT 'gallery',
        uploaded_by INT REFERENCES users(id) ON DELETE SET NULL,
        is_primary BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS property_documents (
        id SERIAL PRIMARY KEY,
        property_id INT REFERENCES properties(id) ON DELETE CASCADE,
        document_name VARCHAR(255),
        document_data TEXT,
        document_type VARCHAR(100),
        access_key VARCHAR(255),
        is_locked BOOLEAN DEFAULT FALSE,
        uploaded_by INT REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS document_access_requests (
        id SERIAL PRIMARY KEY,
        document_id INT REFERENCES property_documents(id) ON DELETE CASCADE,
        property_id INT REFERENCES properties(id) ON DELETE CASCADE,
        user_id INT REFERENCES users(id) ON DELETE CASCADE,
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS agreements (
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
      )`,
      `CREATE TABLE IF NOT EXISTS agreement_requests (
        id SERIAL PRIMARY KEY,
        property_id INT REFERENCES properties(id) ON DELETE CASCADE,
        requester_id INT REFERENCES users(id) ON DELETE CASCADE,
        broker_id INT REFERENCES brokers(id) ON DELETE SET NULL,
        request_type VARCHAR(50),
        status VARCHAR(30) DEFAULT 'pending',
        message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS key_requests (
        id SERIAL PRIMARY KEY,
        property_id INT REFERENCES properties(id) ON DELETE CASCADE,
        requester_id INT REFERENCES users(id) ON DELETE CASCADE,
        status VARCHAR(20) DEFAULT 'pending',
        message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS profiles (
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
      )`,
      `CREATE TABLE IF NOT EXISTS commissions (
        id SERIAL PRIMARY KEY,
        broker_id INT REFERENCES brokers(id) ON DELETE CASCADE,
        transaction_id INT REFERENCES transactions(id) ON DELETE CASCADE,
        amount DECIMAL(15,2) NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        paid_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS rental_payment_schedules (
        id SERIAL PRIMARY KEY,
        property_id INT REFERENCES properties(id) ON DELETE CASCADE,
        tenant_id INT REFERENCES users(id) ON DELETE CASCADE,
        amount DECIMAL(15,2) NOT NULL,
        due_date DATE NOT NULL,
        paid_date DATE,
        status VARCHAR(20) DEFAULT 'pending',
        payment_reference VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS broker_engagements (
        id SERIAL PRIMARY KEY,
        buyer_id INT REFERENCES users(id) ON DELETE CASCADE,
        broker_id INT REFERENCES brokers(id) ON DELETE CASCADE,
        property_id INT REFERENCES properties(id) ON DELETE SET NULL,
        status VARCHAR(20) DEFAULT 'pending',
        message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS property_views (
        id SERIAL PRIMARY KEY,
        property_id INT REFERENCES properties(id) ON DELETE CASCADE,
        user_id INT REFERENCES users(id) ON DELETE SET NULL,
        viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS payment_confirmations (
        id SERIAL PRIMARY KEY,
        transaction_id INT REFERENCES transactions(id) ON DELETE CASCADE,
        confirmed_by INT REFERENCES users(id) ON DELETE SET NULL,
        amount DECIMAL(15,2),
        reference_number VARCHAR(100),
        receipt_image TEXT,
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
    ];

    for (const sql of tables) {
      await client.query(sql);
    }

    // Add missing columns to existing tables (safe — IF NOT EXISTS)
    const alterations = [
      `ALTER TABLE properties ADD COLUMN IF NOT EXISTS address VARCHAR(255)`,
      `ALTER TABLE properties ADD COLUMN IF NOT EXISTS city VARCHAR(100)`,
      `ALTER TABLE properties ADD COLUMN IF NOT EXISTS state VARCHAR(100)`,
      `ALTER TABLE properties ADD COLUMN IF NOT EXISTS zip_code VARCHAR(20)`,
      `ALTER TABLE properties ADD COLUMN IF NOT EXISTS features TEXT`,
      `ALTER TABLE properties ADD COLUMN IF NOT EXISTS views INT DEFAULT 0`,
      `ALTER TABLE property_images ADD COLUMN IF NOT EXISTS image_type VARCHAR(20) DEFAULT 'gallery'`,
      `ALTER TABLE property_images ADD COLUMN IF NOT EXISTS uploaded_by INT REFERENCES users(id) ON DELETE SET NULL`,
      `ALTER TABLE property_images ALTER COLUMN image_url TYPE TEXT`,
    ];
    for (const sql of alterations) {
      await client.query(sql);
    }

    // Seed default users
    const hash = await bcrypt.hash("admin123", 10);
    const seeds = [
      ["System Administrator", "admin@ddrems.com",    "admin"],
      ["Ahmed Broker",          "broker@ddrems.com",   "broker"],
      ["Fatima Owner",          "owner@ddrems.com",    "owner"],
      ["Customer User",         "customer@ddrems.com", "user"],
    ];
    for (const [name, email, role] of seeds) {
      await client.query(
        `INSERT INTO users (name,email,password,role,status)
         VALUES ($1,$2,$3,$4,'active') ON CONFLICT (email) DO NOTHING`,
        [name, email, hash, role]
      );
    }

    console.log("[MIGRATE] ✅ Done. Login: admin@ddrems.com / admin123");
  } catch (err) {
    console.error("[MIGRATE] ❌ Failed:", err.message);
  } finally {
    if (client) client.release();
  }
}

// Run migrations in background — don't block server startup
runMigrations().catch((err) =>
  console.error("[MIGRATE] Unhandled:", err.message)
);

// ── Express app ───────────────────────────────────────────────
const app = express();

app.use(cors({ origin: "*", credentials: true }));
app.use(bodyParser.json({ limit: "50mb" }));
app.use(bodyParser.urlencoded({ extended: true, limit: "50mb" }));

app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// ── API Routes ────────────────────────────────────────────────
const routes = [
  ["/api/auth",                require("./routes/auth")],
  ["/api/dashboard",           require("./routes/dashboard")],
  ["/api/properties",          require("./routes/properties")],
  ["/api/brokers",             require("./routes/brokers")],
  ["/api/users",               require("./routes/users")],
  ["/api/transactions",        require("./routes/transactions")],
  ["/api/announcements",       require("./routes/announcements")],
  ["/api/agreements",          require("./routes/agreements")],
  ["/api/favorites",           require("./routes/favorites")],
  ["/api/notifications",       require("./routes/notifications")],
  ["/api/system",              require("./routes/system")],
  ["/api/property-views",      require("./routes/property-views")],
  ["/api/messages",            require("./routes/messages")],
  ["/api/property-images",     require("./routes/property-images")],
  ["/api/property-documents",  require("./routes/property-documents")],
  ["/api/document-access",     require("./routes/document-access")],
  ["/api/feedback",            require("./routes/feedback")],
  ["/api/commissions",         require("./routes/commissions")],
  ["/api/verification",        require("./routes/verification")],
  ["/api/profiles",            require("./routes/profiles")],
  ["/api/documents",           require("./routes/documents")],
  ["/api/agreement-requests",  require("./routes/agreement-requests")],
  ["/api/property-requests",   require("./routes/property-requests")],
  ["/api/payment-confirmations", require("./routes/payment-confirmations")],
  ["/api/ai",                  require("./routes/ai")],
  ["/api/key-requests",        require("./routes/key-requests")],
  ["/api/agreement-workflow",  require("./routes/agreement-workflow")],
  ["/api/agreement-management",require("./routes/agreement-management")],
  ["/api/real-estate-agreement",require("./routes/real-estate-agreement")],
  ["/api/broker-engagement",   require("./routes/broker-engagement")],
  ["/api/rental-payments",     require("./routes/rental-payments")],
];

for (const [path_, router] of routes) {
  try {
    app.use(path_, router);
  } catch (err) {
    console.error(`[ROUTE] Failed to load ${path_}:`, err.message);
  }
}

// ── Serve React frontend ──────────────────────────────────────
const buildPath = path.join(__dirname, "../client/build");
const fs = require("fs");
if (fs.existsSync(buildPath)) {
  app.use(express.static(buildPath));
  app.get("*", (req, res) => {
    res.sendFile(path.join(buildPath, "index.html"));
  });
  console.log(`[STATIC] Serving React build from ${buildPath}`);
} else {
  console.warn(`[STATIC] Build directory not found at ${buildPath} — React frontend will not be served`);
}

// ── Global error handler ──────────────────────────────────────
app.use((err, req, res, next) => {
  console.error("[ERROR]", err.message);
  res.status(500).json({ message: "Internal server error" });
});

// ── Start server ──────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
});
