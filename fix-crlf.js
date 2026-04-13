const fs = require('fs');
const path = require('path');

function fixDir(dir) {
  const entries = fs.readdirSync(dir);
  for (const entry of entries) {
    const full = path.join(dir, entry);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      if (entry !== 'node_modules' && entry !== '.git') fixDir(full);
    } else if (entry.endsWith('.js') || entry.endsWith('.jsx') || entry.endsWith('.ts') || entry.endsWith('.tsx') || entry.endsWith('.json') || entry.endsWith('.css')) {
      const content = fs.readFileSync(full, 'utf8');
      if (content.includes('\r')) {
        const fixed = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        fs.writeFileSync(full, fixed, 'utf8');
        console.log('Fixed CRLF:', path.relative(process.cwd(), full));
      }
    }
  }
}

fixDir(path.join(__dirname, 'client/src'));
console.log('Done.');
