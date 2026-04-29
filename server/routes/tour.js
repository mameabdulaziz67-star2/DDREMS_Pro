const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const db = require('../config/db');

// Serve the 360° tour page for a property
// GET /tour/:propertyId
router.get('/:propertyId', async (req, res) => {
  try {
    const { propertyId } = req.params;

    // Fetch property images
    const [images] = await db.query(
      `SELECT image_url FROM property_images WHERE property_id = ? ORDER BY is_primary DESC, created_at ASC`,
      [propertyId]
    );

    const imageUrls = (images || []).map(img => img.image_url).filter(Boolean);

    // Read the viewer HTML and inject image data
    const viewerPath = path.resolve(__dirname, '../tour-viewer.html');

    if (!fs.existsSync(viewerPath)) {
      return res.status(503).send('<h2>Tour viewer not found.</h2>');
    }

    const html = fs.readFileSync(viewerPath, 'utf8')
      .replace('__IMAGES_DATA__', JSON.stringify(imageUrls));

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (err) {
    console.error('[TOUR] Error:', err.message);
    res.status(500).send('Server error loading tour');
  }
});

module.exports = router;
