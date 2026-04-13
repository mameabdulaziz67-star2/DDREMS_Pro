-- ============================================================================
-- RENTAL PAYMENT SCHEDULES - DATABASE SCHEMA
-- ============================================================================
-- Tracks recurring rent payment installments for rental agreements
-- ============================================================================

CREATE TABLE IF NOT EXISTS rental_payment_schedules (
  id SERIAL PRIMARY KEY,

  -- Source: which agreement flow generated this schedule
  -- For standard agreements
  agreement_request_id INT REFERENCES agreement_requests(id) ON DELETE CASCADE,
  -- For broker-assisted agreements
  broker_engagement_id INT REFERENCES broker_engagements(id) ON DELETE CASCADE,

  -- Parties
  tenant_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  owner_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  property_id INT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,

  -- Payment details
  installment_number INT NOT NULL DEFAULT 1,
  amount DECIMAL(15,2) NOT NULL,
  due_date DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'submitted', 'paid', 'overdue', 'cancelled')),

  -- Payment submission by tenant
  payment_method VARCHAR(50),
  receipt_url TEXT,
  transaction_reference VARCHAR(100),
  paid_at TIMESTAMP,

  -- Verification by landlord
  verified_by_id INT REFERENCES users(id) ON DELETE SET NULL,
  verified_at TIMESTAMP,
  verification_notes TEXT,

  -- Commission deduction (only for installment_number = 1)
  commission_deducted BOOLEAN DEFAULT FALSE,
  broker_commission_amount DECIMAL(15,2) DEFAULT 0,
  system_fee_amount DECIMAL(15,2) DEFAULT 0,
  owner_net_amount DECIMAL(15,2),

  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Ensure one installment per due_date per agreement
  CONSTRAINT check_source CHECK (
    agreement_request_id IS NOT NULL OR broker_engagement_id IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_rps_tenant ON rental_payment_schedules(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rps_owner ON rental_payment_schedules(owner_id);
CREATE INDEX IF NOT EXISTS idx_rps_property ON rental_payment_schedules(property_id);
CREATE INDEX IF NOT EXISTS idx_rps_status ON rental_payment_schedules(status);
CREATE INDEX IF NOT EXISTS idx_rps_due_date ON rental_payment_schedules(due_date);
CREATE INDEX IF NOT EXISTS idx_rps_agreement ON rental_payment_schedules(agreement_request_id);
CREATE INDEX IF NOT EXISTS idx_rps_engagement ON rental_payment_schedules(broker_engagement_id);
