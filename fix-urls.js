/**
 * Fix all hardcoded localhost:5000 URLs in React components
 * Also fixes broken template literals from previous replacement attempts
 */
const fs = require('fs');
const path = require('path');

const componentsDir = path.join(__dirname, 'client/src/components');

function getAllJsFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getAllJsFiles(filePath));
    } else if (file.endsWith('.js')) {
      results.push(filePath);
    }
  });
  return results;
}

function getImportPath(filePath) {
  const rel = path.relative(componentsDir, filePath);
  const depth = rel.split(path.sep).length - 1;
  if (depth === 0) return '../config/api';
  if (depth === 1) return '../../config/api';
  return '../'.repeat(depth + 1) + 'config/api';
}

function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;

  // Step 1: Fix broken mixed-quote template literals
  // Pattern: `${API_BASE_URL}/something') -> `${API_BASE_URL}/something`)
  content = content.replace(/`(\$\{API_BASE_URL\}[^`']*?)'/g, '`$1`');
  
  // Step 2: Fix broken escaped: $\{API_BASE_URL\} -> ${API_BASE_URL}
  content = content.replace(/\$\\{API_BASE_URL\\}/g, '${API_BASE_URL}');

  // Step 3: Fix remaining hardcoded localhost:5000 (not yet replaced)
  // Replace 'http://localhost:5000/api/... with `${API_BASE_URL}/api/...`
  content = content.replace(/'http:\/\/localhost:5000\/api\/([^']+)'/g, '`${API_BASE_URL}/api/$1`');
  content = content.replace(/"http:\/\/localhost:5000\/api\/([^"]+)"/g, '`${API_BASE_URL}/api/$1`');
  content = content.replace(/'http:\/\/localhost:5000'/g, '`${API_BASE_URL}`');
  content = content.replace(/"http:\/\/localhost:5000"/g, '`${API_BASE_URL}`');

  // Step 4: Fix template literals that are missing the opening backtick
  // Pattern: axios.get(${API_BASE_URL}/ -> axios.get(`${API_BASE_URL}/
  content = content.replace(/\((\$\{API_BASE_URL\})/g, '(`$1');

  // Step 5: Add import if API_BASE_URL is used but not imported
  const hasUsage = content.includes('API_BASE_URL');
  const hasImport = content.includes('import API_BASE_URL');
  
  if (hasUsage && !hasImport) {
    const importPath = getImportPath(filePath);
    if (content.includes("import axios from 'axios';")) {
      content = content.replace(
        "import axios from 'axios';",
        `import axios from 'axios';\nimport API_BASE_URL from '${importPath}';`
      );
    } else if (content.includes('import axios from "axios";')) {
      content = content.replace(
        'import axios from "axios";',
        `import axios from "axios";\nimport API_BASE_URL from '${importPath}';`
      );
    } else {
      // Add at top after first import line
      const firstImport = content.indexOf('import ');
      const endOfLine = content.indexOf('\n', firstImport);
      content = content.slice(0, endOfLine + 1) + 
                `import API_BASE_URL from '${importPath}';\n` + 
                content.slice(endOfLine + 1);
    }
  }

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    return true;
  }
  return false;
}

const files = getAllJsFiles(componentsDir);
let fixedCount = 0;

files.forEach(f => {
  try {
    const fixed = fixFile(f);
    if (fixed) {
      console.log('Fixed:', path.relative(componentsDir, f));
      fixedCount++;
    }
  } catch (e) {
    console.error('Error fixing', f, e.message);
  }
});

console.log(`\nDone. Fixed ${fixedCount} files.`);
