const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, 'client/src/components');
const errors = [];

function check(d) {
  fs.readdirSync(d).forEach(f => {
    const fp = path.join(d, f);
    if (fs.statSync(fp).isDirectory()) check(fp);
    else if (f.endsWith('.js')) {
      const c = fs.readFileSync(fp, 'utf8');
      const name = path.relative(dir, fp);
      if (c.includes('localhost:5000')) errors.push('LOCALHOST: ' + name);
      if (c.includes('API_BASE_URL') && !c.includes('import API_BASE_URL')) errors.push('MISSING IMPORT: ' + name);
    }
  });
}

check(dir);
if (errors.length === 0) console.log('ALL CLEAN - no issues found!');
else { errors.forEach(e => console.log(e)); process.exit(1); }
