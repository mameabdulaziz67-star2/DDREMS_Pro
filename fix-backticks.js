/**
 * Fix all remaining broken template literals in React components.
 * Patterns to fix:
 *   ${API_BASE_URL}/something"   -> `${API_BASE_URL}/something`
 *   ${API_BASE_URL}/something'   -> `${API_BASE_URL}/something`
 *   (${API_BASE_URL}/something`  -> (`${API_BASE_URL}/something`
 */
const fs = require('fs');
const path = require('path');

const componentsDir = path.join(__dirname, 'client/src/components');

function getAllJsFiles(dir) {
  let results = [];
  fs.readdirSync(dir).forEach(f => {
    const fp = path.join(dir, f);
    if (fs.statSync(fp).isDirectory()) results = results.concat(getAllJsFiles(fp));
    else if (f.endsWith('.js')) results.push(fp);
  });
  return results;
}

let totalFixed = 0;

getAllJsFiles(componentsDir).forEach(filePath => {
  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;

  // Fix: \n          ${API_BASE_URL}/path"  ->  \n          `${API_BASE_URL}/path`
  // These are lines where the opening backtick is missing before ${API_BASE_URL}
  // Pattern: whitespace + ${API_BASE_URL} + path + closing quote (no opening backtick)
  
  // Fix missing opening backtick before ${API_BASE_URL} when followed by closing " or '
  // e.g.   ${API_BASE_URL}/api/foo"   ->   `${API_BASE_URL}/api/foo`
  content = content.replace(/(\s)(\$\{API_BASE_URL\}[^`"'\n]+)"/g, '$1`$2`');
  content = content.replace(/(\s)(\$\{API_BASE_URL\}[^`"'\n]+)'/g, "$1`$2`");

  // Fix: (${API_BASE_URL}/path`  ->  (`${API_BASE_URL}/path`  (opening paren without backtick)
  content = content.replace(/\((\$\{API_BASE_URL\}[^`"'\n]+)`/g, '(`$1`');

  // Fix: ,\n          ${API_BASE_URL}/path"  (after comma in function args)
  content = content.replace(/(,\s*\n\s*)(\$\{API_BASE_URL\}[^`"'\n]+)"/g, '$1`$2`');
  content = content.replace(/(,\s*\n\s*)(\$\{API_BASE_URL\}[^`"'\n]+)'/g, "$1`$2`");

  // Fix mixed: `${API_BASE_URL}/path'  ->  `${API_BASE_URL}/path`
  content = content.replace(/(`\$\{API_BASE_URL\}[^`'\n]+)'/g, '$1`');

  // Fix mixed: `${API_BASE_URL}/path"  ->  `${API_BASE_URL}/path`
  content = content.replace(/(`\$\{API_BASE_URL\}[^`"\n]+)"/g, '$1`');

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    totalFixed++;
    console.log('Fixed:', path.relative(componentsDir, filePath));
  }
});

console.log(`\nDone. Fixed ${totalFixed} files.`);
