const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const db = require('../config/db');

// Serve the SPHR 3D tour page for a property
// GET /tour/:propertyId
router.get('/:propertyId', async (req, res) => {
  try {
    const { propertyId } = req.params;

    // Fetch property images
    const [images] = await db.query(
      `SELECT image_url FROM property_images WHERE property_id = ? ORDER BY is_primary DESC, created_at ASC`,
      [propertyId]
    );

    if (!images || images.length === 0) {
      return res.status(404).send('<h2>No 360° images found for this property.</h2>');
    }

    // Build SPHR space_data from property images
    // Each image becomes a node positioned in a line
    const nodes = images.map((img, i) => ({
      uuid: `node_${propertyId}_${i}`,
      image: img.image_url,
      index: i,
      position: { x: i * 5, y: 1.6, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      resolution: '2048',
      floorPosition: { x: i * 5, y: 0, z: 0 },
    }));

    const spaceData = {
      type: 'spaces',
      space_data: {
        nodes,
        initialNode: nodes[0].uuid,
        sceneSettings: {
          nodes: { scale: 1, offsetPosition: { x: 0, y: 0, z: 0 }, offsetRotation: { x: 0, y: 0, z: 0 } },
          dollhouse: { scale: 1, offsetPosition: { x: 0, y: 0, z: 0 }, offsetRotation: { x: 0, y: 0, z: 0 } },
          offsetPosition: { x: 0, y: 0, z: 0 },
          offsetRotation: { x: 0, y: 0, z: 0 },
        },
        initialRotation: { polar: 0, azimuth: 0 },
      },
    };

    // Read the built SPHR index.html and inject space data
    const sphrIndexPath = path.resolve(__dirname, '../../sphr-dist/index.html');

    if (!fs.existsSync(sphrIndexPath)) {
      return res.status(503).send(`
        <html><body style="font-family:sans-serif;padding:40px;background:#111;color:#fff">
          <h2>3D Tour not built yet</h2>
          <p>Run <code>cd sphr-main && npm run build</code> to build the 3D viewer.</p>
        </body></html>
      `);
    }

    let html = fs.readFileSync(sphrIndexPath, 'utf8');
    html = html.replace('SPACE_DATA_PLACEHOLDER', JSON.stringify(spaceData));

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (err) {
    console.error('[TOUR] Error:', err.message);
    res.status(500).send('Server error loading tour');
  }
});

module.exports = router;
