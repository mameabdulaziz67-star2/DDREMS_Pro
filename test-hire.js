const axios = require('axios');

async function testHire() {
  try {
    const res = await axios.post('http://localhost:5000/api/broker-engagement/hire', {
      buyer_id: 4, // usually 4 is a customer
      broker_id: 2, // a broker
      property_id: 1, // property 1
      starting_offer: 5000000,
      buyer_message: "Test message"
    });
    console.log(res.data);
  } catch (err) {
    console.error("SERVER ERROR:", err.response ? err.response.data : err.message);
  }
}

testHire();
