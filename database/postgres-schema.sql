-- ============================================================================
-- DDREMS PostgreSQL Schema
-- Converted from MySQL unified-schema.sql
-- ============================================================================

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- Users table (base for all actors)
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  profile_image VARCHAR(255),
  role VARCHAR(50) DEFAULT 'user' CHECK (role IN ('admin', 'broker', 'user', 'owner', 'property_admin', 'system_admin')),
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  profile_approved BOOLEAN DEFAULT FALSE,
  profile_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

-- Brokers table
CREATE TABLE IF NOT EXISTS brokers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(20),
  profile_image VARCHAR(255),
  license_number VARCHAR(100) UNIQUE,
  commission_rate DECIMAL(5,2) DEFAULT 2.5,
  total_sales INT DEFAULT 0,
  total_commission DECIMAL(15,2) DEFAULT 0,
  rating DECIMAL(3,2) DEFAULT 0,
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_brokers_email ON brokers(email);
CREATE INDEX IF NOT EXISTS idx_brokers_license ON brokers(license_number);
CREATE INDEX IF NOT EXISTS idx_brokers_status ON brokers(status);

-- Properties table
CREATE TABLE IF NOT EXISTS properties (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(15,2) NOT NULL,
  location VARCHAR(255) NOT NULL,
  address VARCHAR(500),
  city VARCHAR(100),
  state VARCHAR(100),
  zip_code VARCHAR(20),
  latitude DECIMAL(10,8),
  longitude DECIMAL(11,8),
  type VARCHAR(50) NOT NULL CHECK (type IN ('house', 'apartment', 'land', 'commercial', 'villa')),
  bedrooms INT,
  bathrooms INT,
  area DECIMAL(10,2),
  images TEXT,
  main_image TEXT,
  features JSONB,
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'pending', 'sold', 'rented', 'inactive')),
  broker_id INT REFERENCES brokers(id) ON DELETE SET NULL,
  owner_id INT REFERENCES users(id) ON DELETE SET NULL,
  property_admin_id INT REFERENCES users(id) ON DELETE SET NULL,
  listing_date DATE,
  expiry_date DATE,
  verified BOOLEAN DEFAULT FALSE,
  verification_date TIMESTAMP NULL,
  views INT DEFAULT 0,
  favorites INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_properties_status ON properties(status);
CREATE INDEX IF NOT EXISTS idx_properties_type ON properties(type);
CREATE INDEX IF NOT EXISTS idx_properties_location ON properties(location);
CREATE INDEX IF NOT EXISTS idx_properties_verified ON properties(verified);
CREATE INDEX IF NOT EXISTS idx_properties_broker ON properties(broker_id);
CREATE INDEX IF NOT EXISTS idx_properties_owner ON properties(owner_id);

-- Transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id SERIAL PRIMARY KEY,
  property_id INT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  broker_id INT REFERENCES brokers(id) ON DELETE SET NULL,
  amount DECIMAL(15,2) NOT NULL,
  transaction_type VARCHAR(50) NOT NULL CHECK (transaction_type IN ('sale', 'rent', 'installment')),
  payment_method VARCHAR(50) NOT NULL CHECK (payment_method IN ('cash', 'bank_transfer', 'mobile_money', 'installment')),
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled', 'failed')),
  installment_plan JSONB,
  commission_amount DECIMAL(15,2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_property ON transactions(property_id);

-- Payments table (for installments)
CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  transaction_id INT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  amount DECIMAL(15,2) NOT NULL,
  payment_date DATE NOT NULL,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled')),
  payment_method VARCHAR(50),
  reference_number VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_transaction ON payments(transaction_id);

-- User preferences table
CREATE TABLE IF NOT EXISTS user_preferences (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  property_type VARCHAR(50),
  min_price DECIMAL(15,2),
  max_price DECIMAL(15,2),
  preferred_location VARCHAR(255),
  bedrooms INT,
  bathrooms INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Fraud alerts table
CREATE TABLE IF NOT EXISTS fraud_alerts (
  id SERIAL PRIMARY KEY,
  alert_type VARCHAR(100) NOT NULL,
  severity VARCHAR(50) DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  description TEXT,
  related_entity_type VARCHAR(50) CHECK (related_entity_type IN ('user', 'broker', 'property', 'transaction')),
  related_entity_id INT,
  status VARCHAR(50) DEFAULT 'new' CHECK (status IN ('new', 'investigating', 'resolved', 'false_positive')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP NULL
);

CREATE INDEX IF NOT EXISTS idx_fraud_status ON fraud_alerts(status);
CREATE INDEX IF NOT EXISTS idx_fraud_severity ON fraud_alerts(severity);

-- Announcements table
CREATE TABLE IF NOT EXISTS announcements (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  priority VARCHAR(50) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high')),
  target_role VARCHAR(50) DEFAULT 'all' CHECK (target_role IN ('all', 'user', 'owner', 'broker', 'admin')),
  author_id INT REFERENCES users(id) ON DELETE SET NULL,
  created_by INT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- PROFILE TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS customer_profiles (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  full_name VARCHAR(255),
  phone_number VARCHAR(20),
  address TEXT,
  profile_photo TEXT,
  id_document TEXT,
  profile_status VARCHAR(50) DEFAULT 'pending' CHECK (profile_status IN ('pending', 'approved', 'rejected', 'suspended')),
  approved_by INT REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMP,
  rejection_reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cp_status ON customer_profiles(profile_status);
CREATE INDEX IF NOT EXISTS idx_cp_user ON customer_profiles(user_id);

CREATE TABLE IF NOT EXISTS owner_profiles (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  full_name VARCHAR(255),
  phone_number VARCHAR(20),
  address TEXT,
  profile_photo TEXT,
  id_document TEXT,
  business_license TEXT,
  profile_status VARCHAR(50) DEFAULT 'pending' CHECK (profile_status IN ('pending', 'approved', 'rejected', 'suspended')),
  approved_by INT REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMP,
  rejection_reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_op_status ON owner_profiles(profile_status);
CREATE INDEX IF NOT EXISTS idx_op_user ON owner_profiles(user_id);

CREATE TABLE IF NOT EXISTS broker_profiles (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  full_name VARCHAR(255),
  phone_number VARCHAR(20),
  address TEXT,
  profile_photo TEXT,
  id_document TEXT,
  broker_license TEXT,
  license_number VARCHAR(100),
  profile_status VARCHAR(50) DEFAULT 'pending' CHECK (profile_status IN ('pending', 'approved', 'rejected', 'suspended')),
  approved_by INT REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMP,
  rejection_reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_bp_status ON broker_profiles(profile_status);
CREATE INDEX IF NOT EXISTS idx_bp_user ON broker_profiles(user_id);

-- ============================================================================
-- AGREEMENT & REQUEST TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS agreements (
  id SERIAL PRIMARY KEY,
  property_id INT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  owner_id INT REFERENCES users(id) ON DELETE SET NULL,
  customer_id INT REFERENCES users(id) ON DELETE SET NULL,
  buyer_id INT REFERENCES users(id) ON DELETE SET NULL,
  broker_id INT REFERENCES users(id) ON DELETE SET NULL,
  agreement_type VARCHAR(50) NOT NULL DEFAULT 'sale' CHECK (agreement_type IN ('sale', 'rent', 'lease')),
  amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'active', 'completed', 'cancelled')),
  start_date DATE,
  end_date DATE,
  terms TEXT,
  agreement_text TEXT,
  agreement_html TEXT,
  document_key VARCHAR(8),
  document_url TEXT,
  agreement_document VARCHAR(500),
  terms_accepted BOOLEAN DEFAULT FALSE,
  accepted_at TIMESTAMP,
  duration VARCHAR(100),
  payment_terms TEXT,
  special_conditions TEXT,
  additional_terms TEXT,
  owner_signature TEXT,
  customer_signature TEXT,
  owner_signed_at TIMESTAMP,
  customer_signed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_agreements_status ON agreements(status);
CREATE INDEX IF NOT EXISTS idx_agreements_property ON agreements(property_id);

CREATE TABLE IF NOT EXISTS request_key (
  id SERIAL PRIMARY KEY,
  property_id INT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  customer_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  owner_id INT REFERENCES users(id) ON DELETE SET NULL,
  admin_id INT REFERENCES users(id) ON DELETE SET NULL,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled')),
  key_code VARCHAR(50),
  request_message TEXT,
  response_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  responded_at TIMESTAMP NULL
);

CREATE INDEX IF NOT EXISTS idx_rk_status ON request_key(status);
CREATE INDEX IF NOT EXISTS idx_rk_customer ON request_key(customer_id);
CREATE INDEX IF NOT EXISTS idx_rk_property ON request_key(property_id);

CREATE TABLE IF NOT EXISTS agreement_requests (
  id SERIAL PRIMARY KEY,
  property_id INT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  customer_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  owner_id INT REFERENCES users(id) ON DELETE SET NULL,
  broker_id INT REFERENCES users(id) ON DELETE SET NULL,
  property_admin_id INT REFERENCES users(id) ON DELETE SET NULL,
  request_message TEXT,
  customer_notes TEXT,
  admin_notes TEXT,
  owner_notes TEXT,
  response_message TEXT,
  status VARCHAR(100) DEFAULT 'pending',
  current_step INT DEFAULT 1,
  property_price DECIMAL(15,2),
  commission_percentage DECIMAL(5,2),
  owner_decision VARCHAR(50),
  owner_decision_date TIMESTAMP,
  admin_action VARCHAR(50),
  admin_action_date TIMESTAMP,
  request_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  forwarded_to_owner_date TIMESTAMP,
  agreement_generated_date TIMESTAMP,
  customer_submitted_date TIMESTAMP,
  owner_final_submitted_date TIMESTAMP,
  completion_date TIMESTAMP,
  owner_response_date TIMESTAMP,
  responded_by INT REFERENCES users(id) ON DELETE SET NULL,
  responded_at TIMESTAMP,
  payment_confirmed BOOLEAN DEFAULT FALSE,
  payment_receipt_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ar_status ON agreement_requests(status);
CREATE INDEX IF NOT EXISTS idx_ar_customer ON agreement_requests(customer_id);
CREATE INDEX IF NOT EXISTS idx_ar_property ON agreement_requests(property_id);

CREATE TABLE IF NOT EXISTS property_requests (
  id SERIAL PRIMARY KEY,
  property_id INT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  broker_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  owner_id INT REFERENCES users(id) ON DELETE SET NULL,
  request_type VARCHAR(50) DEFAULT 'information' CHECK (request_type IN ('viewing', 'information', 'collaboration')),
  request_message TEXT,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  response_message TEXT,
  responded_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS broker_requests (
  id SERIAL PRIMARY KEY,
  broker_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  agreement_request_id INT NOT NULL REFERENCES agreement_requests(id) ON DELETE CASCADE,
  status VARCHAR(50) DEFAULT 'new' CHECK (status IN ('new', 'viewed', 'responded')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  viewed_at TIMESTAMP NULL,
  UNIQUE (broker_id, agreement_request_id)
);

CREATE TABLE IF NOT EXISTS payment_confirmations (
  id SERIAL PRIMARY KEY,
  agreement_request_id INT NOT NULL REFERENCES agreement_requests(id) ON DELETE CASCADE,
  amount DECIMAL(15,2) NOT NULL,
  payment_method VARCHAR(50),
  payment_reference VARCHAR(100),
  receipt_document VARCHAR(500),
  confirmed_by INT REFERENCES users(id) ON DELETE SET NULL,
  confirmed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS profile_edit_requests (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  profile_id INT,
  request_type VARCHAR(50) NOT NULL CHECK (request_type IN ('customer', 'owner', 'broker')),
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS profile_status_history (
  id SERIAL PRIMARY KEY,
  profile_id INT NOT NULL,
  profile_type VARCHAR(50) NOT NULL CHECK (profile_type IN ('customer', 'owner', 'broker')),
  old_status VARCHAR(50),
  new_status VARCHAR(50) NOT NULL,
  changed_by INT REFERENCES users(id) ON DELETE SET NULL,
  reason TEXT,
  changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- PROPERTY & DOCUMENT TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS property_views (
  id SERIAL PRIMARY KEY,
  property_id INT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  user_id INT REFERENCES users(id) ON DELETE SET NULL,
  ip_address VARCHAR(45),
  viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pv_property ON property_views(property_id);

CREATE TABLE IF NOT EXISTS property_documents (
  id SERIAL PRIMARY KEY,
  property_id INT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  document_type VARCHAR(50) NOT NULL CHECK (document_type IN ('title_deed', 'survey_plan', 'tax_clearance', 'building_permit', 'other')),
  document_name VARCHAR(255) NOT NULL,
  document_path VARCHAR(500) NOT NULL,
  access_key VARCHAR(50),
  uploaded_by INT REFERENCES users(id) ON DELETE SET NULL,
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS document_access (
  id SERIAL PRIMARY KEY,
  property_id INT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  responded_at TIMESTAMP NULL,
  response_message TEXT NULL
);

CREATE TABLE IF NOT EXISTS property_verification (
  id SERIAL PRIMARY KEY,
  property_id INT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  verification_status VARCHAR(50) DEFAULT 'pending' CHECK (verification_status IN ('pending', 'approved', 'rejected', 'suspended')),
  verification_notes TEXT NULL,
  verified_by INT REFERENCES users(id) ON DELETE SET NULL,
  verified_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS favorites (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  property_id INT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, property_id)
);

-- ============================================================================
-- COMMUNICATION TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,
  sender_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id INT REFERENCES users(id) ON DELETE CASCADE,
  property_id INT REFERENCES properties(id) ON DELETE SET NULL,
  subject VARCHAR(255),
  message TEXT NOT NULL,
  message_type VARCHAR(50) DEFAULT 'general',
  status VARCHAR(50) DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'read', 'failed')),
  is_read BOOLEAN DEFAULT FALSE,
  is_group BOOLEAN DEFAULT FALSE,
  parent_id INT REFERENCES messages(id) ON DELETE SET NULL,
  reply_count INT DEFAULT 0,
  updated_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);

CREATE TABLE IF NOT EXISTS message_recipients (
  id SERIAL PRIMARY KEY,
  message_id INT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (message_id, user_id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(50) DEFAULT 'info' CHECK (type IN ('info', 'success', 'warning', 'error', 'request')),
  notification_type VARCHAR(50),
  is_read BOOLEAN DEFAULT FALSE,
  link VARCHAR(500),
  action_url VARCHAR(255),
  related_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);

CREATE TABLE IF NOT EXISTS feedback (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  property_id INT REFERENCES properties(id) ON DELETE SET NULL,
  rating INT CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  feedback_type VARCHAR(50) DEFAULT 'system' CHECK (feedback_type IN ('property', 'service', 'broker', 'system')),
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- SYSTEM TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS system_config (
  id SERIAL PRIMARY KEY,
  config_key VARCHAR(100) UNIQUE NOT NULL,
  config_value TEXT,
  description VARCHAR(500),
  updated_by INT REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_log (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  table_name VARCHAR(100),
  record_id INT,
  old_value TEXT,
  new_value TEXT,
  ip_address VARCHAR(45),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS receipts (
  id SERIAL PRIMARY KEY,
  transaction_id INT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  receipt_number VARCHAR(100) UNIQUE NOT NULL,
  receipt_document VARCHAR(500),
  issued_date DATE NOT NULL,
  issued_by INT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- AGREEMENT WORKFLOW TABLES (used by real-estate-agreement.js and agreement-workflow.js)
-- ============================================================================

CREATE TABLE IF NOT EXISTS agreement_notifications (
  id SERIAL PRIMARY KEY,
  agreement_request_id INT,
  agreement_id INT,
  recipient_id INT REFERENCES users(id) ON DELETE CASCADE,
  notification_type VARCHAR(100),
  notification_title VARCHAR(255),
  notification_message TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  sent_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS agreement_audit_log (
  id SERIAL PRIMARY KEY,
  agreement_request_id INT,
  action_type VARCHAR(100),
  action_description TEXT,
  performed_by_id INT REFERENCES users(id) ON DELETE SET NULL,
  old_status VARCHAR(100),
  new_status VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS agreement_documents (
  id SERIAL PRIMARY KEY,
  agreement_request_id INT,
  version INT DEFAULT 1,
  document_type VARCHAR(50),
  document_content TEXT,
  document_html TEXT,
  generated_by_id INT REFERENCES users(id) ON DELETE SET NULL,
  generated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS agreement_templates (
  id SERIAL PRIMARY KEY,
  template_name VARCHAR(255),
  template_content TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS agreement_fields (
  id SERIAL PRIMARY KEY,
  agreement_request_id INT,
  field_name VARCHAR(255) NOT NULL,
  field_value TEXT,
  is_editable BOOLEAN DEFAULT TRUE,
  edited_by_id INT REFERENCES users(id) ON DELETE SET NULL,
  edited_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (agreement_request_id, field_name)
);

CREATE TABLE IF NOT EXISTS agreement_workflow_history (
  id SERIAL PRIMARY KEY,
  agreement_request_id INT,
  step_number INT,
  step_name VARCHAR(255),
  action VARCHAR(100),
  action_by_id INT REFERENCES users(id) ON DELETE SET NULL,
  previous_status VARCHAR(100),
  new_status VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS agreement_payments (
  id SERIAL PRIMARY KEY,
  agreement_request_id INT,
  agreement_id INT,
  payment_method VARCHAR(50),
  payment_amount DECIMAL(15,2),
  receipt_file_path VARCHAR(500),
  receipt_file_name VARCHAR(255),
  receipt_uploaded_date TIMESTAMP,
  payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payment_receipts (
  id SERIAL PRIMARY KEY,
  agreement_request_id INT,
  payment_method VARCHAR(50),
  payment_amount DECIMAL(15,2),
  receipt_file_path VARCHAR(500),
  verification_status VARCHAR(50) DEFAULT 'pending',
  verification_notes TEXT,
  verified_by_id INT REFERENCES users(id) ON DELETE SET NULL,
  verification_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS commission_tracking (
  id SERIAL PRIMARY KEY,
  agreement_request_id INT,
  agreement_amount DECIMAL(15,2),
  customer_commission_percentage DECIMAL(5,2),
  owner_commission_percentage DECIMAL(5,2),
  customer_commission DECIMAL(15,2),
  owner_commission DECIMAL(15,2),
  total_commission DECIMAL(15,2),
  calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- SAMPLE DATA
-- ============================================================================

-- Insert admin user (password: admin123 — bcrypt hash)
INSERT INTO users (name, email, password, role, profile_approved, profile_completed)
VALUES ('System Administrator', 'admin@ddrems.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin', TRUE, TRUE)
ON CONFLICT (email) DO NOTHING;

-- Insert property admin
INSERT INTO users (name, email, password, role, profile_approved, profile_completed)
VALUES ('Property Admin', 'propadmin@ddrems.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'property_admin', TRUE, TRUE)
ON CONFLICT (email) DO NOTHING;

-- Insert sample brokers in brokers table
INSERT INTO brokers (name, email, phone, license_number, commission_rate, total_sales, rating)
VALUES
  ('John Doe', 'john@ddrems.com', '+251911234567', 'BRK001', 2.5, 15, 4.5),
  ('Jane Smith', 'jane@ddrems.com', '+251922345678', 'BRK002', 3.0, 22, 4.8),
  ('Ahmed Hassan', 'ahmed@ddrems.com', '+251933456789', 'BRK003', 2.5, 8, 4.2)
ON CONFLICT (email) DO NOTHING;

-- Insert sample properties
INSERT INTO properties (title, description, price, location, type, bedrooms, bathrooms, area, broker_id, verified)
VALUES
  ('Modern Villa in Kezira', 'Beautiful 4-bedroom villa with garden', 8500000, 'Kezira, Dire Dawa', 'villa', 4, 3, 350.00, 1, TRUE),
  ('Downtown Apartment', 'Spacious 2-bedroom apartment near city center', 2500000, 'Downtown, Dire Dawa', 'apartment', 2, 1, 120.00, 2, TRUE),
  ('Commercial Building', 'Prime location commercial property', 15000000, 'Sabian, Dire Dawa', 'commercial', 0, 2, 500.00, 1, TRUE),
  ('Residential Land', '500 sqm residential plot', 1200000, 'Legehare, Dire Dawa', 'land', 0, 0, 500.00, 3, FALSE)
ON CONFLICT DO NOTHING;

-- Insert system configuration
INSERT INTO system_config (config_key, config_value, description) VALUES
  ('site_name', 'DDREMS', 'System name'),
  ('commission_rate', '2.5', 'Default commission rate percentage'),
  ('max_property_images', '10', 'Maximum number of images per property'),
  ('property_expiry_days', '90', 'Days before property listing expires')
ON CONFLICT (config_key) DO NOTHING;

-- ============================================================================
-- VIEWS
-- ============================================================================

CREATE OR REPLACE VIEW v_customer_profiles AS
SELECT
    cp.*,
    u.name as user_name,
    u.email as user_email,
    u.role as user_role,
    approver.name as approved_by_name
FROM customer_profiles cp
JOIN users u ON cp.user_id = u.id
LEFT JOIN users approver ON cp.approved_by = approver.id;

CREATE OR REPLACE VIEW v_owner_profiles AS
SELECT
    op.*,
    u.name as user_name,
    u.email as user_email,
    u.role as user_role,
    approver.name as approved_by_name
FROM owner_profiles op
JOIN users u ON op.user_id = u.id
LEFT JOIN users approver ON op.approved_by = approver.id;

CREATE OR REPLACE VIEW v_broker_profiles AS
SELECT
    bp.*,
    u.name as user_name,
    u.email as user_email,
    u.role as user_role,
    approver.name as approved_by_name
FROM broker_profiles bp
JOIN users u ON bp.user_id = u.id
LEFT JOIN users approver ON bp.approved_by = approver.id;

CREATE OR REPLACE VIEW v_agreement_requests AS
SELECT
    ar.*,
    p.title as property_title,
    p.location as property_location,
    customer.name as customer_name,
    customer.email as customer_email,
    owner.name as owner_name,
    broker.name as broker_name,
    responder.name as responded_by_name
FROM agreement_requests ar
JOIN properties p ON ar.property_id = p.id
JOIN users customer ON ar.customer_id = customer.id
LEFT JOIN users owner ON ar.owner_id = owner.id
LEFT JOIN users broker ON ar.broker_id = broker.id
LEFT JOIN users responder ON ar.responded_by = responder.id;

