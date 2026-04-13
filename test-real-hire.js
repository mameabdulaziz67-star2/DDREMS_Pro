const db = require('./server/config/db');
const axios = require('axios');

async function test() {
  try {
    const [p] = await db.query("SELECT id, owner_id FROM properties LIMIT 1");
    if (!p.length) return console.log("No properties");
    
    const [buyer] = await db.query("SELECT id FROM users WHERE role='user' LIMIT 1");
    const [broker] = await db.query("SELECT id FROM users WHERE role='broker' LIMIT 1");

    console.log("Using:", { buyer_id: buyer[0].id, broker_id: broker[0].id, property_id: p[0].id });

    // Try to hire
    const res = await axios.post('http://localhost:5000/api/broker-engagement/hire', {
      buyer_id: buyer[0].id,
      broker_id: broker[0].id,
      property_id: p[0].id,
      starting_offer: 5000000,
      buyer_message: "Test message"
    });
    console.log("SUCCESS:", res.data);
  } catch (err) {
    console.error("SERVER ERROR:", err.response ? err.response.data : err.message);
  } finally {
    process.exit();
  }
}
test();
