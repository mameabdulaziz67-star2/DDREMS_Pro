-- Add Matterport model ID to properties table
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS matterport_model_id VARCHAR(50);
