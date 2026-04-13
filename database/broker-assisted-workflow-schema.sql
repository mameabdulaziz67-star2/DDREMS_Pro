-- ============================================================================
-- BROKER-ASSISTED PROPERTY PURCHASE WORKFLOW - DATABASE SCHEMA
-- ============================================================================
-- Run this migration against your PostgreSQL database (ddrems).
-- ============================================================================

-- ============================================================================
-- 1. BROKER_ENGAGEMENTS TABLE (Core workflow tracking)
-- ============================================================================
CREATE TABLE IF NOT EXISTS broker_engagements (
  id SERIAL PRIMARY KEY,

  -- Parties
  buyer_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  broker_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  property_id INT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  owner_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Workflow status
  status VARCHAR(50) NOT NULL DEFAULT 'pending_broker_acceptance',

  -- Offer tracking
  starting_offer DECIMAL(15,2),
  current_offer DECIMAL(15,2),
  agreed_price DECIMAL(15,2),

  -- Buyer initial request
  buyer_message TEXT,

  -- Broker advice to buyer
  broker_advice TEXT,
  broker_recommendation VARCHAR(20) CHECK (broker_recommendation IN ('accept', 'counter', 'walk_away')),

  -- Owner counter-offer
  owner_counter_price DECIMAL(15,2),
  owner_counter_message TEXT,

  -- Buyer authorization
  buyer_authorization VARCHAR(30) CHECK (buyer_authorization IN ('authorize_accept', 'authorize_counter', 'cancel')),
  buyer_auth_counter_price DECIMAL(15,2),
  buyer_auth_message TEXT,

  -- Broker decline reason
  broker_decline_reason TEXT,

  -- Commission
  commission_percentage DECIMAL(5,2) DEFAULT 5.00,

  -- Linked agreement request (created when deal is finalized)
  agreement_request_id INT REFERENCES agreement_requests(id) ON DELETE SET NULL,

  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  broker_accepted_at TIMESTAMP,
  owner_responded_at TIMESTAMP,
  broker_advised_at TIMESTAMP,
  buyer_authorized_at TIMESTAMP,
  finalized_at TIMESTAMP,
  contract_generated_at TIMESTAMP,
  completed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_be_buyer ON broker_engagements(buyer_id);
CREATE INDEX IF NOT EXISTS idx_be_broker ON broker_engagements(broker_id);
CREATE INDEX IF NOT EXISTS idx_be_property ON broker_engagements(property_id);
CREATE INDEX IF NOT EXISTS idx_be_owner ON broker_engagements(owner_id);
CREATE INDEX IF NOT EXISTS idx_be_status ON broker_engagements(status);

-- ============================================================================
-- 2. BROKER_ENGAGEMENT_MESSAGES TABLE (Secure in-system messaging)
-- ============================================================================
CREATE TABLE IF NOT EXISTS broker_engagement_messages (
  id SERIAL PRIMARY KEY,
  engagement_id INT NOT NULL REFERENCES broker_engagements(id) ON DELETE CASCADE,
  sender_id INT REFERENCES users(id) ON DELETE CASCADE,
  sender_role VARCHAR(20) NOT NULL CHECK (sender_role IN ('buyer', 'broker', 'owner', 'admin', 'system')),
  message_type VARCHAR(30) NOT NULL DEFAULT 'general' CHECK (message_type IN ('general', 'negotiation', 'advice', 'authorization', 'system', 'counter_offer')),
  message TEXT NOT NULL,
  metadata JSONB,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_bem_engagement ON broker_engagement_messages(engagement_id);
CREATE INDEX IF NOT EXISTS idx_bem_sender ON broker_engagement_messages(sender_id);

-- ============================================================================
-- 3. BROKER_ENGAGEMENT_SIGNATURES TABLE (Triple digital signature)
-- ============================================================================
CREATE TABLE IF NOT EXISTS broker_engagement_signatures (
  id SERIAL PRIMARY KEY,
  engagement_id INT NOT NULL REFERENCES broker_engagements(id) ON DELETE CASCADE,
  signer_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  signer_role VARCHAR(20) NOT NULL CHECK (signer_role IN ('buyer', 'broker', 'owner')),
  signature_data TEXT NOT NULL,
  signed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ip_address VARCHAR(45),
  user_agent VARCHAR(500),
  UNIQUE (engagement_id, signer_role)
);

CREATE INDEX IF NOT EXISTS idx_bes_engagement ON broker_engagement_signatures(engagement_id);

-- ============================================================================
-- 4. BROKER_ENGAGEMENT_HISTORY TABLE (Full audit trail)
-- ============================================================================
CREATE TABLE IF NOT EXISTS broker_engagement_history (
  id SERIAL PRIMARY KEY,
  engagement_id INT NOT NULL REFERENCES broker_engagements(id) ON DELETE CASCADE,
  action VARCHAR(100) NOT NULL,
  action_by_id INT REFERENCES users(id) ON DELETE SET NULL,
  action_by_role VARCHAR(20),
  previous_status VARCHAR(50),
  new_status VARCHAR(50),
  notes TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_beh_engagement ON broker_engagement_history(engagement_id);
CREATE INDEX IF NOT EXISTS idx_beh_action ON broker_engagement_history(action);

-- ============================================================================
-- 5. ADD LINKING COLUMN TO AGREEMENT_REQUESTS (if not exists)
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agreement_requests' AND column_name = 'broker_engagement_id'
  ) THEN
    ALTER TABLE agreement_requests ADD COLUMN broker_engagement_id INT REFERENCES broker_engagements(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================================
-- 6. VIEW FOR DASHBOARD QUERIES
-- ============================================================================
CREATE OR REPLACE VIEW v_broker_engagements AS
SELECT
  be.*,
  p.title AS property_title,
  p.location AS property_location,
  p.price AS property_price,
  p.type AS property_type,
  p.listing_type AS property_listing_type,
  buyer.name AS buyer_name,
  buyer.email AS buyer_email,
  broker.name AS broker_name,
  broker.email AS broker_email,
  owner.name AS owner_name,
  owner.email AS owner_email,
  COALESCE(
    (
      SELECT json_agg(bes.signer_role)
      FROM broker_engagement_signatures bes
      WHERE bes.engagement_id = be.id
    ),
    '[]'::json
  ) AS signed_roles
FROM broker_engagements be
JOIN properties p ON be.property_id = p.id
JOIN users buyer ON be.buyer_id = buyer.id
JOIN users broker ON be.broker_id = broker.id
JOIN users owner ON be.owner_id = owner.id;

-- ============================================================================
-- END OF BROKER-ASSISTED WORKFLOW SCHEMA
-- ============================================================================
