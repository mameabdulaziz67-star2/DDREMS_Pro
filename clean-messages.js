const db = require('./server/config/db');

async function run() {
  try {
    await db.query(`UPDATE broker_engagement_messages SET message_type = 'advice' WHERE message LIKE 'Buyer has requested broker representation%'`);
    await db.query(`UPDATE broker_engagement_messages SET message_type = 'advice' WHERE message_type = 'general' AND sender_role = 'buyer'`);
    await db.query(`UPDATE broker_engagement_messages SET message_type = 'advice' WHERE message LIKE 'Buyer rejected the draft offer%'`);
    await db.query(`UPDATE broker_engagement_messages SET message_type = 'advice' WHERE message LIKE 'Broker has declined the engagement%'`);
    console.log('Database messages updated for privacy!');
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    process.exit();
  }
}

run();
