-- ============================================================
-- DDREMS Railway PostgreSQL Setup
-- Run this in Railway PostgreSQL console after deployment
-- ============================================================

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  role VARCHAR(50) DEFAULT 'user' CHECK (role IN ('admin','broker','user','owner','property_admin','system_admin')),
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active','inactive','suspended')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Brokers table
CREATE TABLE IF NOT EXISTS brokers (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(20),
  license_number VARCHAR(100) UNIQUE,
  commission_rate DECIMAL(5,2) DEFAULT 2.5,
  total_sales INT DEFAULT 0,
  total_commission DECIMAL(15,2) DEFAULT 0,
  rating DECIMAL(3,2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active','inactive','suspended')),
  password VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Properties table
CREATE TABLE IF NOT EXISTS properties (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(15,2) NOT NULL,
  location VARCHAR(255) NOT NULL,
  latitude DECIMAL(10,8),
  longitude DECIMAL(11,8),
  type VARCHAR(50) NOT NULL CHECK (type IN ('house','apartment','land','commercial','villa')),
  listing_type VARCHAR(20) DEFAULT 'sale' CHECK (listing_type IN ('sale','rent')),
  bedrooms INT,
  bathrooms INT,
  area DECIMAL(10,2),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('active','pending','sold','rented','inactive')),
  broker_id INT REFERENCES brokers(id) ON DELETE SET NULL,
  owner_id INT REFERENCES users(id) ON DELETE SET NULL,
  property_admin_id INT REFERENCES users(id) ON DELETE SET NULL,
  verified BOOLEAN DEFAULT FALSE,
  verification_status VARCHAR(20) DEFAULT 'pending',
  verification_date TIMESTAMP,
  images TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id SERIAL PRIMARY KEY,
  property_id INT REFERENCES properties(id) ON DELETE CASCADE,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  broker_id INT REFERENCES brokers(id) ON DELETE SET NULL,
  amount DECIMAL(15,2) NOT NULL,
  transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('sale','rent','installment')),
  payment_method VARCHAR(30) NOT NULL CHECK (payment_method IN ('cash','bank_transfer','mobile_money','installment')),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','completed','cancelled','failed')),
  commission_amount DECIMAL(15,2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Messages table
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
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  message TEXT,
  type VARCHAR(50) DEFAULT 'info',
  is_read BOOLEAN DEFAULT FALSE,
  related_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Announcements table
CREATE TABLE IF NOT EXISTS announcements (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  author_id INT REFERENCES users(id) ON DELETE SET NULL,
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Favorites table
CREATE TABLE IF NOT EXISTS favorites (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  property_id INT REFERENCES properties(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, property_id)
);

-- Property images table
CREATE TABLE IF NOT EXISTS property_images (
  id SERIAL PRIMARY KEY,
  property_id INT REFERENCES properties(id) ON DELETE CASCADE,
  image_data TEXT,
  image_url VARCHAR(500),
  is_primary BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Property documents table
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
);

-- Document access requests
CREATE TABLE IF NOT EXISTS document_access_requests (
  id SERIAL PRIMARY KEY,
  document_id INT REFERENCES property_documents(id) ON DELETE CASCADE,
  property_id INT REFERENCES properties(id) ON DELETE CASCADE,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Agreements table
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
);

-- Agreement requests
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
);

-- Key requests
CREATE TABLE IF NOT EXISTS key_requests (
  id SERIAL PRIMARY KEY,
  property_id INT REFERENCES properties(id) ON DELETE CASCADE,
  requester_id INT REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'pending',
  message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Profiles table
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
);

-- Commissions table
CREATE TABLE IF NOT EXISTS commissions (
  id SERIAL PRIMARY KEY,
  broker_id INT REFERENCES brokers(id) ON DELETE CASCADE,
  transaction_id INT REFERENCES transactions(id) ON DELETE CASCADE,
  amount DECIMAL(15,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  paid_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Rental payment schedules
CREATE TABLE IF NOT EXISTS rental_payment_schedules (
  id SERIAL PRIMARY KEY,
  property_id INT REFERENCES properties(id) ON DELETE CASCADE,
  tenant_id INT REFERENCES users(id) ON DELETE CASCADE,
  amount DECIMAL(15,2) NOT NULL,
  due_date DATE NOT NULL,
  paid_date DATE,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','paid','overdue','cancelled')),
  payment_reference VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Broker engagement (hire requests)
CREATE TABLE IF NOT EXISTS broker_engagements (
  id SERIAL PRIMARY KEY,
  buyer_id INT REFERENCES users(id) ON DELETE CASCADE,
  broker_id INT REFERENCES brokers(id) ON DELETE CASCADE,
  property_id INT REFERENCES properties(id) ON DELETE SET NULL,
  status VARCHAR(20) DEFAULT 'pending',
  message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Property views
CREATE TABLE IF NOT EXISTS property_views (
  id SERIAL PRIMARY KEY,
  property_id INT REFERENCES properties(id) ON DELETE CASCADE,
  user_id INT REFERENCES users(id) ON DELETE SET NULL,
  viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Payment confirmations
CREATE TABLE IF NOT EXISTS payment_confirmations (
  id SERIAL PRIMARY KEY,
  transaction_id INT REFERENCES transactions(id) ON DELETE CASCADE,
  confirmed_by INT REFERENCES users(id) ON DELETE SET NULL,
  amount DECIMAL(15,2),
  reference_number VARCHAR(100),
  receipt_image TEXT,
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- SEED DATA — Admin user (password: admin123)
-- ============================================================
INSERT INTO users (name, email, password, role, status) VALUES
('System Administrator', 'admin@ddrems.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin', 'active')
ON CONFLICT (email) DO NOTHING;

-- Sample broker user
INSERT INTO users (name, email, password, role, status) VALUES
('Ahmed Broker', 'broker@ddrems.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'broker', 'active')
ON CONFLICT (email) DO NOTHING;

-- Sample owner user
INSERT INTO users (name, email, password, role, status) VALUES
('Fatima Owner', 'owner@ddrems.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'owner', 'active')
ON CONFLICT (email) DO NOTHING;

-- Sample customer
INSERT INTO users (name, email, password, role, status) VALUES
('Customer User', 'customer@ddrems.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'user', 'active')
ON CONFLICT (email) DO NOTHING;
