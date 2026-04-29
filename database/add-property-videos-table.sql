-- ============================================================
-- Add Property Videos Table for Virtual Tours
-- ============================================================

-- Create property_videos table
CREATE TABLE IF NOT EXISTS property_videos (
  id INT PRIMARY KEY AUTO_INCREMENT,
  property_id INT NOT NULL,
  video_url LONGBLOB NOT NULL,        -- Base64 encoded video
  title VARCHAR(255) NOT NULL,
  description TEXT,
  duration INT,                        -- Video duration in seconds
  file_size INT,                       -- File size in bytes
  uploaded_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
  FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_property_id (property_id),
  INDEX idx_created_at (created_at)
);

-- Add video_count column to properties table if it doesn't exist
ALTER TABLE properties ADD COLUMN IF NOT EXISTS video_count INT DEFAULT 0 AFTER image_count;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_property_videos_property_id ON property_videos(property_id);

-- Add comment
ALTER TABLE property_videos COMMENT = 'Stores virtual tour videos for properties (max 3 minutes, 500MB)';

-- Verify table creation
SELECT 'property_videos table created successfully' as status;
