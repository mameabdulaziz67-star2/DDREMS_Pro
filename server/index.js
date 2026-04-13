const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");
const bodyParser = require("body-parser");
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");

dotenv.config({ path: path.resolve(__dirname, "../.env") });

// ── Auto-migrate database on startup ─────────────────────────
async function runMigrations() {
  if (!process.env.DATABASE_URL && !process.env.DB_HOST) {
    console.log("[MIGRATE] No database config found, skipping migrations.");
    return;
  }

  let pool;
  let client;

  try {
    pool = process.env.DATABASE_URL
      ? new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 5000 })
      : new Pool({
          host: process.env.DB_HOST,
          user: process.env.DB_USER,
          password: String(process.env.DB_PASSWORD),
          database: process.env.DB_NAME,
          port: parseInt(process.env.DB_PORT) || 5432,
          connectionTimeoutMillis: 5000,
        });

    client = await pool.connect();
    console.log("[MIGRATE] Running database migrations...");

    await client.query(`CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL, password VARCHAR(255) NOT NULL,
      phone VARCHAR(20), role VARCHAR(50) DEFAULT 'user',
      status VARCHAR(20) DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);

    await client.query(`CREATE TABLE IF NOT EXISTS brokers (
      id SERIAL PRIMARY KEY, user_id INT REFERENCES users(id) ON DELETE SET NULL,
      name VARCHAR(255) NOT NULL, email VARCHAR(255) UNIQUE NOT NULL,
      phone VARCHAR(20), license_number VARCHAR(100),
      commission_rate DECIMAL(5,2) DEFAULT 2.5, total_sales INT DEFAULT 0,
      total_commission DECIMAL(15,2) DEFAULT 0, rating DECIMAL(3,2) DEFAULT 0,
      status VARCHAR(20) DEFAULT 'active', password VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);

    await client.query(`CREATE TABLE IF NOT EXISTS properties (
      id SERIAL PRIMARY KEY, title VARCHAR(255) NOT NULL, description TEXT,
      price DECIMAL(15,2) NOT NULL, location VARCHAR(255) NOT NULL,
      latitude DECIMAL(10,8), longitude DECIMAL(11,8),
      type VARCHAR(50) NOT NULL DEFAULT 'house', listing_type VARCHAR(20) DEFAULT 'sale',
      bedrooms INT, bathrooms INT, area DECIMAL(10,2),
      status VARCHAR(20) DEFAULT 'pending',
      broker_id INT REFERENCES brokers(id) ON DELETE SET NULL,
      owner_id INT REFERENCES users(id) ON DELETE SET NULL,
      property_admin_id INT REFERENCES users(id) ON DELETE SET NULL,
      verified BOOLEAN DEFAULT FALSE, verification_status VARCHAR(20) DEFAULT 'pending',
      verification_date TIMESTAMP, images TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);

    await client.query(`CREATE TABLE IF NOT EXISTS transactions (
      id SERIAL PRIMARY KEY,
      property_id INT REFERENCES properties(id) ON DELETE CASCADE,
      user_id INT REFERENCES users(id) ON DELETE CASCADE,
      broker_id INT REFERENCES brokers(id) ON DELETE SET NULL,
      amount DECIMAL(15,2) NOT NULL,
      transaction_type VARCHAR(20) NOT NULL DEFAULT 'sale',
      payment_method VARCHAR(30) NOT NULL DEFAULT 'cash',
      status VARCHAR(20) DEFAULT 'pending', commission_amount DECIMAL(15,2),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);

    await client.query(`CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      sender_id INT REFERENCES users(id) ON DELETE CASCADE,
      receiver_id INT REFERENCES users(id) ON DELETE CASCADE,
      subject VARCHAR(255), content TEXT NOT NULL, is_read BOOLEAN DEFAULT FALSE,
      message_type VARCHAR(50) DEFAULT 'general',
      related_property_id INT REFERENCES properties(id) ON DELETE SET NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);

    await client.query(`CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY, user_id INT REFERENCES users(id) ON DELETE CASCADE,
      title VARCHAR(255) NOT NULL, message TEXT, type VARCHAR(50) DEFAULT 'info',
      is_read BOOLEAN DEFAULT FALSE, related_id INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);

    await client.query(`CREATE TABLE IF NOT EXISTS announcements (
      id SERIAL PRIMARY KEY, title VARCHAR(255) NOT NULL, content TEXT NOT NULL,
      author_id INT REFERENCES users(id) ON DELETE SET NULL,
      status VARCHAR(20) DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);

    await client.query(`CREATE TABLE IF NOT EXISTS favorites (
      id SERIAL PRIMARY KEY, user_id INT REFERENCES users(id) ON DELETE CASCADE,
      property_id INT REFERENCES properties(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, property_id))`);

    await client.query(`CREATE TABLE IF NOT EXISTS property_images (
      id SERIAL PRIMARY KEY,
      property_id INT REFERENCES properties(id) ON DELETE CASCADE,
      image_data TEXT, image_url VARCHAR(500), is_primary BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);

    await client.query(`CREATE TABLE IF NOT EXISTS property_documents (
      id SERIAL PRIMARY KEY,
      property_id INT REFERENCES properties(id) ON DELETE CASCADE,
      document_name VARCHAR(255), document_data TEXT, document_type VARCHAR(100),
      access_key VARCHAR(255), is_locked BOOLEAN DEFAULT FALSE,
      uploaded_by INT REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);

    await client.query(`CREATE TABLE IF NOT EXISTS document_access_requests (
      id SERIAL PRIMARY KEY,
      document_id INT REFERENCES property_documents(id) ON DELETE CASCADE,
      property_id INT REFERENCES properties(id) ON DELETE CASCADE,
      user_id INT REFERENCES users(id) ON DELETE CASCADE,
      status VARCHAR(20) DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);

    await client.query(`CREATE TABLE IF NOT EXISTS agreements (
      id SERIAL PRIMARY KEY,
      property_id INT REFERENCES properties(id) ON DELETE CASCADE,
      buyer_id INT REFERENCES users(id) ON DELETE CASCADE,
      seller_id INT REFERENCES users(id) ON DELETE SET NULL,
      broker_id INT REFERENCES brokers(id) ON DELETE SET NULL,
      agreement_type VARCHAR(50), status VARCHAR(30) DEFAULT 'draft',
      terms TEXT, amount DECIMAL(15,2), start_date DATE, end_date DATE,
      signed_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);

    await client.query(`CREATE TABLE IF NOT EXISTS agreement_requests (
      id SERIAL PRIMARY KEY,
      property_id INT REFERENCES properties(id) ON DELETE CASCADE,
      requester_id INT REFERENCES users(id) ON DELETE CASCADE,
      broker_id INT REFERENCES brokers(id) ON DELETE SET NULL,
      request_type VARCHAR(50), status VARCHAR(30) DEFAULT 'pending', message TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);

    await client.query(`CREATE TABLE IF NOT EXISTS key_requests (
      id SERIAL PRIMARY KEY,
      property_id INT REFERENCES properties(id) ON DELETE CASCADE,
      requester_id INT REFERENCES users(id) ON DELETE CASCADE,
      status VARCHAR(20) DEFAULT 'pending', message TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);

    await client.query(`CREATE TABLE IF NOT EXISTS profiles (
      id SERIAL PRIMARY KEY, user_id INT UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      bio TEXT, address VARCHAR(255), city VARCHAR(100), national_id VARCHAR(100),
      profile_image TEXT, verification_status VARCHAR(20) DEFAULT 'pending',
      verified_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);

    await client.query(`CREATE TABLE IF NOT EXISTS commissions (
      id SERIAL PRIMARY KEY, broker_id INT REFERENCES brokers(id) ON DELETE CASCADE,
      transaction_id INT REFERENCES transactions(id) ON DELETE CASCADE,
      amount DECIMAL(15,2) NOT NULL, status VARCHAR(20) DEFAULT 'pending',
      paid_at TIMESTAMP, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);

    await client.query(`CREATE TABLE IF NOT EXISTS rental_payment_schedules (
      id SERIAL PRIMARY KEY,
      property_id INT REFERENCES properties(id) ON DELETE CASCADE,
      tenant_id INT REFERENCES users(id) ON DELETE CASCADE,
      amount DECIMAL(15,2) NOT NULL, due_date DATE NOT NULL, paid_date DATE,
      status VARCHAR(20) DEFAULT 'pending', payment_reference VARCHAR(100),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);

    await client.query(`CREATE TABLE IF NOT EXISTS broker_engagements (
      id SERIAL PRIMARY KEY, buyer_id INT REFERENCES users(id) ON DELETE CASCADE,
      broker_id INT REFERENCES brokers(id) ON DELETE CASCADE,
      property_id INT REFERENCES properties(id) ON DELETE SET NULL,
      status VARCHAR(20) DEFAULT 'pending', message TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);

    await client.query(`CREATE TABLE IF NOT EXISTS property_views (
      id SERIAL PRIMARY KEY,
      property_id INT REFERENCES properties(id) ON DELETE CASCADE,
      user_id INT REFERENCES users(id) ON DELETE SET NULL,
      viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);

    await client.query(`CREATE TABLE IF NOT EXISTS payment_confirmations (
      id SERIAL PRIMARY KEY,
      transaction_id INT REFERENCES transactions(id) ON DELETE CASCADE,
      confirmed_by INT REFERENCES users(id) ON DELETE SET NULL,
      amount DECIMAL(15,2), reference_number VARCHAR(100), receipt_image TEXT,
      status VARCHAR(20) DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);

    const hash = await bcrypt.hash("admin123", 10);
    const seeds = [
      ["System Administrator", "admin@ddrems.com",    "admin"],
      ["Ahmed Broker",          "broker@ddrems.com",   "broker"],
      ["Fatima Owner",          "owner@ddrems.com",    "owner"],
      ["Customer User",         "customer@ddrems.com", "user"],
    ];
    for (const [name, email, role] of seeds) {
      await client.query(
        `INSERT INTO users (name,email,password,role,status) VALUES ($1,$2,$3,$4,'active') ON CONFLICT (email) DO NOTHING`,
        [name, email, hash, role]
      );
    }

    console.log("[MIGRATE] ✅ All tables created. Seed users ready (password: admin123)");
  } catch (err) {
    console.error("[MIGRATE] ❌ Error:", err.message);
    console.error("[MIGRATE] Server will continue - check DATABASE_URL variable");
  } finally {
    if (client) client.release();
    if (pool) await pool.end().catch(() => {});
  }
}

    await client.query(`CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL, password VARCHAR(255) NOT NULL,
      phone VARCHAR(20), role VARCHAR(50) DEFAULT 'user',
      status VARCHAR(20) DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);

    await client.query(`CREATE TABLE IF NOT EXISTS brokers (
      id SERIAL PRIMARY KEY, user_id INT REFERENCES users(id) ON DELETE SET NULL,
      name VARCHAR(255) NOT NULL, email VARCHAR(255) UNIQUE NOT NULL,
      phone VARCHAR(20), license_number VARCHAR(100),
      commission_rate DECIMAL(5,2) DEFAULT 2.5, total_sales INT DEFAULT 0,
      total_commission DECIMAL(15,2) DEFAULT 0, rating DECIMAL(3,2) DEFAULT 0,
      status VARCHAR(20) DEFAULT 'active', password VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);

    await client.query(`CREATE TABLE IF NOT EXISTS properties (
      id SERIAL PRIMARY KEY, title VARCHAR(255) NOT NULL, description TEXT,
      price DECIMAL(15,2) NOT NULL, location VARCHAR(255) NOT NULL,
      latitude DECIMAL(10,8), longitude DECIMAL(11,8),
      type VARCHAR(50) NOT NULL DEFAULT 'house', listing_type VARCHAR(20) DEFAULT 'sale',
      bedrooms INT, bathrooms INT, area DECIMAL(10,2),
      status VARCHAR(20) DEFAULT 'pending',
      broker_id INT REFERENCES brokers(id) ON DELETE SET NULL,
      owner_id INT REFERENCES users(id) ON DELETE SET NULL,
      property_admin_id INT REFERENCES users(id) ON DELETE SET NULL,
      verified BOOLEAN DEFAULT FALSE, verification_status VARCHAR(20) DEFAULT 'pending',
      verification_date TIMESTAMP, images TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);

    await client.query(`CREATE TABLE IF NOT EXISTS transactions (
      id SERIAL PRIMARY KEY,
      property_id INT REFERENCES properties(id) ON DELETE CASCADE,
      user_id INT REFERENCES users(id) ON DELETE CASCADE,
      broker_id INT REFERENCES brokers(id) ON DELETE SET NULL,
      amount DECIMAL(15,2) NOT NULL,
      transaction_type VARCHAR(20) NOT NULL DEFAULT 'sale',
      payment_method VARCHAR(30) NOT NULL DEFAULT 'cash',
      status VARCHAR(20) DEFAULT 'pending', commission_amount DECIMAL(15,2),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);

    await client.query(`CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      sender_id INT REFERENCES users(id) ON DELETE CASCADE,
      receiver_id INT REFERENCES users(id) ON DELETE CASCADE,
      subject VARCHAR(255), content TEXT NOT NULL, is_read BOOLEAN DEFAULT FALSE,
      message_type VARCHAR(50) DEFAULT 'general',
      related_property_id INT REFERENCES properties(id) ON DELETE SET NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);

    await client.query(`CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY, user_id INT REFERENCES users(id) ON DELETE CASCADE,
      title VARCHAR(255) NOT NULL, message TEXT, type VARCHAR(50) DEFAULT 'info',
      is_read BOOLEAN DEFAULT FALSE, related_id INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);

    await client.query(`CREATE TABLE IF NOT EXISTS announcements (
      id SERIAL PRIMARY KEY, title VARCHAR(255) NOT NULL, content TEXT NOT NULL,
      author_id INT REFERENCES users(id) ON DELETE SET NULL,
      status VARCHAR(20) DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);

    await client.query(`CREATE TABLE IF NOT EXISTS favorites (
      id SERIAL PRIMARY KEY, user_id INT REFERENCES users(id) ON DELETE CASCADE,
      property_id INT REFERENCES properties(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, property_id))`);

    await client.query(`CREATE TABLE IF NOT EXISTS property_images (
      id SERIAL PRIMARY KEY,
      property_id INT REFERENCES properties(id) ON DELETE CASCADE,
      image_data TEXT, image_url VARCHAR(500), is_primary BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);

    await client.query(`CREATE TABLE IF NOT EXISTS property_documents (
      id SERIAL PRIMARY KEY,
      property_id INT REFERENCES properties(id) ON DELETE CASCADE,
      document_name VARCHAR(255), document_data TEXT, document_type VARCHAR(100),
      access_key VARCHAR(255), is_locked BOOLEAN DEFAULT FALSE,
      uploaded_by INT REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);

    await client.query(`CREATE TABLE IF NOT EXISTS document_access_requests (
      id SERIAL PRIMARY KEY,
      document_id INT REFERENCES property_documents(id) ON DELETE CASCADE,
      property_id INT REFERENCES properties(id) ON DELETE CASCADE,
      user_id INT REFERENCES users(id) ON DELETE CASCADE,
      status VARCHAR(20) DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);

    await client.query(`CREATE TABLE IF NOT EXISTS agreements (
      id SERIAL PRIMARY KEY,
      property_id INT REFERENCES properties(id) ON DELETE CASCADE,
      buyer_id INT REFERENCES users(id) ON DELETE CASCADE,
      seller_id INT REFERENCES users(id) ON DELETE SET NULL,
      broker_id INT REFERENCES brokers(id) ON DELETE SET NULL,
      agreement_type VARCHAR(50), status VARCHAR(30) DEFAULT 'draft',
      terms TEXT, amount DECIMAL(15,2), start_date DATE, end_date DATE,
      signed_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);

    await client.query(`CREATE TABLE IF NOT EXISTS agreement_requests (
      id SERIAL PRIMARY KEY,
      property_id INT REFERENCES properties(id) ON DELETE CASCADE,
      requester_id INT REFERENCES users(id) ON DELETE CASCADE,
      broker_id INT REFERENCES brokers(id) ON DELETE SET NULL,
      request_type VARCHAR(50), status VARCHAR(30) DEFAULT 'pending', message TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);

    await client.query(`CREATE TABLE IF NOT EXISTS key_requests (
      id SERIAL PRIMARY KEY,
      property_id INT REFERENCES properties(id) ON DELETE CASCADE,
      requester_id INT REFERENCES users(id) ON DELETE CASCADE,
      status VARCHAR(20) DEFAULT 'pending', message TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);

    await client.query(`CREATE TABLE IF NOT EXISTS profiles (
      id SERIAL PRIMARY KEY, user_id INT UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      bio TEXT, address VARCHAR(255), city VARCHAR(100), national_id VARCHAR(100),
      profile_image TEXT, verification_status VARCHAR(20) DEFAULT 'pending',
      verified_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);

    await client.query(`CREATE TABLE IF NOT EXISTS commissions (
      id SERIAL PRIMARY KEY, broker_id INT REFERENCES brokers(id) ON DELETE CASCADE,
      transaction_id INT REFERENCES transactions(id) ON DELETE CASCADE,
      amount DECIMAL(15,2) NOT NULL, status VARCHAR(20) DEFAULT 'pending',
      paid_at TIMESTAMP, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);

    await client.query(`CREATE TABLE IF NOT EXISTS rental_payment_schedules (
      id SERIAL PRIMARY KEY,
      property_id INT REFERENCES properties(id) ON DELETE CASCADE,
      tenant_id INT REFERENCES users(id) ON DELETE CASCADE,
      amount DECIMAL(15,2) NOT NULL, due_date DATE NOT NULL, paid_date DATE,
      status VARCHAR(20) DEFAULT 'pending', payment_reference VARCHAR(100),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);

    await client.query(`CREATE TABLE IF NOT EXISTS broker_engagements (
      id SERIAL PRIMARY KEY, buyer_id INT REFERENCES users(id) ON DELETE CASCADE,
      broker_id INT REFERENCES brokers(id) ON DELETE CASCADE,
      property_id INT REFERENCES properties(id) ON DELETE SET NULL,
      status VARCHAR(20) DEFAULT 'pending', message TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);

    await client.query(`CREATE TABLE IF NOT EXISTS property_views (
      id SERIAL PRIMARY KEY,
      property_id INT REFERENCES properties(id) ON DELETE CASCADE,
      user_id INT REFERENCES users(id) ON DELETE SET NULL,
      viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);

    await client.query(`CREATE TABLE IF NOT EXISTS payment_confirmations (
      id SERIAL PRIMARY KEY,
      transaction_id INT REFERENCES transactions(id) ON DELETE CASCADE,
      confirmed_by INT REFERENCES users(id) ON DELETE SET NULL,
      amount DECIMAL(15,2), reference_number VARCHAR(100), receipt_image TEXT,
      status VARCHAR(20) DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);

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
        `INSERT INTO users (name,email,password,role,status) VALUES ($1,$2,$3,$4,'active') ON CONFLICT (email) DO NOTHING`,
        [name, email, hash, role]
      );
    }

runMigrations().catch(err => {
  console.error("[MIGRATE] Fatal migration error (non-blocking):", err.message);
});

const app = express();

// CORS — allow Railway frontend URL and localhost for dev
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:5000",
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (mobile apps, curl, etc.)
      if (!origin) return callback(null, true);
      if (
        allowedOrigins.includes(origin) ||
        origin.endsWith(".railway.app") ||
        origin.endsWith(".up.railway.app")
      ) {
        return callback(null, true);
      }
      return callback(null, true); // Allow all for now — restrict after testing
    },
    credentials: true,
  })
);

app.use(bodyParser.json({ limit: "50mb" }));
app.use(bodyParser.urlencoded({ extended: true, limit: "50mb" }));

app.use((req, res, next) => {
  console.log(`[SERVER] ${req.method} ${req.url}`);
  next();
});

app.use((req, res, next) => {
  req.setTimeout(300000);
  res.setTimeout(300000);
  next();
});

// API Routes
app.use("/api/auth", require("./routes/auth"));
app.use("/api/dashboard", require("./routes/dashboard"));
app.use("/api/properties", require("./routes/properties"));
app.use("/api/brokers", require("./routes/brokers"));
app.use("/api/users", require("./routes/users"));
app.use("/api/transactions", require("./routes/transactions"));
app.use("/api/announcements", require("./routes/announcements"));
app.use("/api/agreements", require("./routes/agreements"));
app.use("/api/favorites", require("./routes/favorites"));
app.use("/api/notifications", require("./routes/notifications"));
app.use("/api/system", require("./routes/system"));
app.use("/api/property-views", require("./routes/property-views"));
app.use("/api/messages", require("./routes/messages"));
app.use("/api/property-images", require("./routes/property-images"));
app.use("/api/property-documents", require("./routes/property-documents"));
app.use("/api/document-access", require("./routes/document-access"));
app.use("/api/feedback", require("./routes/feedback"));
app.use("/api/commissions", require("./routes/commissions"));
app.use("/api/verification", require("./routes/verification"));
app.use("/api/profiles", require("./routes/profiles"));
app.use("/api/documents", require("./routes/documents"));
app.use("/api/agreement-requests", require("./routes/agreement-requests"));
app.use("/api/property-requests", require("./routes/property-requests"));
app.use("/api/payment-confirmations", require("./routes/payment-confirmations"));
app.use("/api/ai", require("./routes/ai"));
app.use("/api/key-requests", require("./routes/key-requests"));
app.use("/api/agreement-workflow", require("./routes/agreement-workflow"));
app.use("/api/agreement-management", require("./routes/agreement-management"));
app.use("/api/real-estate-agreement", require("./routes/real-estate-agreement"));
app.use("/api/broker-engagement", require("./routes/broker-engagement"));
app.use("/api/rental-payments", require("./routes/rental-payments"));

// Serve React frontend in production
if (process.env.NODE_ENV === "production") {
  const clientBuildPath = path.join(__dirname, "../client/build");
  app.use(express.static(clientBuildPath));
  // All non-API routes serve React app
  app.get("*", (req, res) => {
    res.sendFile(path.join(clientBuildPath, "index.html"));
  });
}

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`Port ${PORT} is already in use!`);
    process.exit(1);
  } else {
    console.error("Server error:", error);
    process.exit(1);
  }
});
