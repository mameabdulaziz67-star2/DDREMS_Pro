const db = require("./config/db");

async function check() {
  try {
    const [rows] = await db.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
    const tables = rows.map(r => r.table_name);
    console.log("Full Table List:");
    tables.sort().forEach(t => console.log(` - ${t}`));
    
    const required = [
      'agreement_requests',
      'agreement_documents',
      'agreement_signatures',
      'agreement_payments',
      'agreement_notifications',
      'agreement_workflow_history',
      'agreement_commissions'
    ];
    
    console.log("\nAgreement Workflow Status:");
    required.forEach(t => {
      console.log(`[${tables.includes(t) ? 'X' : ' '}] ${t}`);
    });
  } catch (error) {
    console.error("Error:", error);
  } finally {
    process.exit(0);
  }
}

check();
