const express = require('express');
const router = express.Router();
const db = require('../config/db');

// Get videos for a property
router.get('/property/:propertyId', async (req, res) => {
  try {
    const [videos] = await db.query(
      'SELECT * FROM property_videos WHERE property_id = ? ORDER BY created_at DESC',
      [req.params.propertyId]
    );
    res.json(videos);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get single video
router.get('/:id', async (req, res) => {
  try {
    const [videos] = await db.query(
      'SELECT * FROM property_videos WHERE id = ?',
      [req.params.id]
    );
    
    if (videos.length === 0) {
      return res.status(404).json({ message: 'Video not found' });
    }
    
    res.json(videos[0]);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Upload property video
router.post('/', async (req, res) => {
  try {
    const { property_id, video_url, title, description, uploaded_by } = req.body;
    
    if (!property_id || !video_url || !title) {
      return res.status(400).json({ 
        message: 'Property ID, video URL, and title are required' 
      });
    }
    
    // Validate video size (base64 encoded, so actual size is ~33% larger)
    const estimatedSize = video_url.length * 0.75; // Approximate original file size
    const maxSize = 500 * 1024 * 1024; // 500MB

    if (estimatedSize > maxSize) {
      return res.status(400).json({
        message: `Video is too large. Maximum size is 500MB. Your file is approximately ${(estimatedSize / 1024 / 1024).toFixed(2)}MB`,
      });
    }

    // Check if property already has a video
    const [existingVideos] = await db.query(
      'SELECT id FROM property_videos WHERE property_id = ?',
      [property_id]
    );

    // If video exists, delete it first (one video per property)
    if (existingVideos.length > 0) {
      await db.query(
        'DELETE FROM property_videos WHERE property_id = ?',
        [property_id]
      );
    }

    const [result] = await db.query(
      'INSERT INTO property_videos (property_id, video_url, title, description, uploaded_by) VALUES (?, ?, ?, ?, ?)',
      [property_id, video_url, title, description || null, uploaded_by]
    );
    
    res.json({ id: result.insertId, message: 'Video uploaded successfully' });
  } catch (error) {
    console.error('Video upload error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete property video
router.delete('/:id', async (req, res) => {
  try {
    const [result] = await db.query(
      'DELETE FROM property_videos WHERE id = ?',
      [req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Video not found' });
    }

    res.json({ message: 'Video deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update video (title/description only)
router.put('/:id', async (req, res) => {
  try {
    const { title, description } = req.body;
    
    if (!title) {
      return res.status(400).json({ message: 'Title is required' });
    }

    const [result] = await db.query(
      'UPDATE property_videos SET title = ?, description = ? WHERE id = ?',
      [title, description || null, req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Video not found' });
    }

    res.json({ message: 'Video updated successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
