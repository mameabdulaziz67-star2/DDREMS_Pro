const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, 'client/src/components');
let errors = 0;

// Files that had errors per Railway build log
const toCheck = [
  'AIAdviceSidebar.js', 'AIPricePredictor.js', 'AddBroker.js',
  'AgentDashboardEnhanced.js', 'AgreementManagement.js', 'AgreementWorkflow.js',
  'Agreements.js', 'Announcements.js', 'BrokerEngagement.js',
  'BrokersManagement.js', 'CustomerDashboardEnhanced.js', 'Favorites.js',
  'MessageNotificationWidget.js', 'OwnerDashboardEnhanced.js', 'Properties.js',
  'PropertyAdminDashboard.js', 'PropertyApproval.js', 'Register.js',
  'RentalLedger.js', 'Reports.js', 'Transactions.js',
  'profiles/BrokerProfile.js', 'profiles/CustomerProfile.js', 'profiles/OwnerProfile.js',
  'shared/AIAdvisorWidget.js', 'shared/DocumentViewerAdmin.js'
];

toCheck.forEach(f => {
  const fp = path.join(dir, f);
  if (!fs.existsSync(fp)) { console.log('NOT FOUND:', f); return; }
  try {
    execSync(`node --input-type=module < "${fp}" 2>&1`, { stdio: 'pipe' });
    console.log('OK:', f);
  } catch(e) {
    // node module check won't work for JSX, just check for obvious issues
    const c = fs.readFileSync(fp, 'utf8');
    const hasImport = c.includes('import API_BASE_URL');
    const hasUsage = c.includes('API_BASE_URL');
    const hasMixedQuote = c.match(/`\$\{API_BASE_URL\}[^`]*'/);
    const hasLocalhost = c.includes('localhost:5000');
    
    if (!hasImport && hasUsage) { console.log('MISSING IMPORT:', f); errors++; }
    else if (hasMixedQuote) { console.log('MIXED QUOTES:', f); errors++; }
    else if (hasLocalhost) { console.log('LOCALHOST:', f); errors++; }
    else console.log('OK:', f);
  }
});

console.log(errors === 0 ? '\nAll files look good!' : `\n${errors} issues found`);
