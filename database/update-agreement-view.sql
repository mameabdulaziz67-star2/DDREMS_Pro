-- Update the v_agreement_status view with new columns
DROP VIEW IF EXISTS v_agreement_status;

CREATE VIEW v_agreement_status AS
SELECT 
  ar.id,
  ar.customer_id,
  ar.owner_id,
  ar.property_id,
  ar.broker_id,
  ar.property_admin_id,
  ar.status,
  ar.current_step,
  ar.request_date,
  ar.created_at,
  ar.updated_at,
  ar.proposed_price,
  ar.move_in_date,
  ar.property_price,
  ar.buyer_signed,
  ar.owner_signed,
  ar.broker_signed,
  ar.buyer_signed_date,
  ar.owner_signed_date,
  ar.broker_signed_date,
  ar.payment_submitted,
  ar.payment_verified,
  ar.handover_confirmed,
  ar.funds_released,
  ar.total_commission,
  ar.commission_percentage,
  ar.customer_notes,
  ar.owner_notes,
  ar.admin_notes,
  p.title as property_title,
  p.price as listed_price,
  p.location as property_location,
  p.type as property_type,
  c.name as customer_name,
  c.email as customer_email,
  o.name as owner_name,
  o.email as owner_email,
  pa.name as admin_name
FROM agreement_requests ar
LEFT JOIN properties p ON ar.property_id = p.id
LEFT JOIN users c ON ar.customer_id = c.id
LEFT JOIN users o ON ar.owner_id = o.id
LEFT JOIN users pa ON ar.property_admin_id = pa.id;
