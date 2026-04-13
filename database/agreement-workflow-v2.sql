-- ============================================================================
-- AGREEMENT WORKFLOW V2 — Add missing columns for 11-step workflow
-- ============================================================================

-- Add proposed price & move-in date
ALTER TABLE agreement_requests ADD COLUMN IF NOT EXISTS proposed_price DECIMAL(15, 2);
ALTER TABLE agreement_requests ADD COLUMN IF NOT EXISTS move_in_date DATE;

-- Add signature tracking booleans & timestamps
ALTER TABLE agreement_requests ADD COLUMN IF NOT EXISTS buyer_signed BOOLEAN DEFAULT FALSE;
ALTER TABLE agreement_requests ADD COLUMN IF NOT EXISTS owner_signed BOOLEAN DEFAULT FALSE;
ALTER TABLE agreement_requests ADD COLUMN IF NOT EXISTS broker_signed BOOLEAN DEFAULT FALSE;
ALTER TABLE agreement_requests ADD COLUMN IF NOT EXISTS buyer_signed_date TIMESTAMP NULL;
ALTER TABLE agreement_requests ADD COLUMN IF NOT EXISTS owner_signed_date TIMESTAMP NULL;
ALTER TABLE agreement_requests ADD COLUMN IF NOT EXISTS broker_signed_date TIMESTAMP NULL;

-- Add payment & handover tracking
ALTER TABLE agreement_requests ADD COLUMN IF NOT EXISTS payment_submitted BOOLEAN DEFAULT FALSE;
ALTER TABLE agreement_requests ADD COLUMN IF NOT EXISTS payment_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE agreement_requests ADD COLUMN IF NOT EXISTS payment_verified_date TIMESTAMP NULL;
ALTER TABLE agreement_requests ADD COLUMN IF NOT EXISTS payment_verified_by INT;
ALTER TABLE agreement_requests ADD COLUMN IF NOT EXISTS handover_confirmed BOOLEAN DEFAULT FALSE;
ALTER TABLE agreement_requests ADD COLUMN IF NOT EXISTS handover_confirmed_date TIMESTAMP NULL;
ALTER TABLE agreement_requests ADD COLUMN IF NOT EXISTS funds_released BOOLEAN DEFAULT FALSE;
ALTER TABLE agreement_requests ADD COLUMN IF NOT EXISTS funds_released_date TIMESTAMP NULL;
ALTER TABLE agreement_requests ADD COLUMN IF NOT EXISTS funds_released_by INT;

-- Add broker tracking
ALTER TABLE agreement_requests ADD COLUMN IF NOT EXISTS broker_id INT;

-- Add payment_confirmed if missing (used by payment-confirmations.js)
ALTER TABLE agreement_requests ADD COLUMN IF NOT EXISTS payment_confirmed BOOLEAN DEFAULT FALSE;
ALTER TABLE agreement_requests ADD COLUMN IF NOT EXISTS payment_receipt_id INT;

-- ============================================================================
-- END
-- ============================================================================
