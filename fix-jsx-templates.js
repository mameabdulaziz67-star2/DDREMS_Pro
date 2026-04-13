/**
 * Fix template literals inside JSX className={`...`} attributes
 * by converting them to string concatenation className={"..." + ...}
 * This avoids Babel parse issues on Linux with CRLF files
 */
const fs = require('fs');
const path = require('path');

function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;

  // Fix: className={`static-class ${expr}`} -> className={"static-class " + (expr)}
  // Pattern: className={`word-chars ${...}`}
  content = content.replace(
    /className=\{`([^`$]*)\$\{([^}]+)\}`\}/g,
    (match, prefix, expr) => {
      const trimmedPrefix = prefix.trimEnd();
      if (trimmedPrefix) {
        return `className={"${trimmedPrefix} " + (${expr})}`;
      }
      return `className={(${expr})}`;
    }
  );

  // Fix: className={`${expr}`} -> className={(expr)}
  content = content.replace(
    /className=\{`\$\{([^}]+)\}`\}/g,
    (match, expr) => `className={(${expr})}`
  );

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    return true;
  }
  return false;
}

function fixDir(dir) {
  let count = 0;
  const entries = fs.readdirSync(dir);
  for (const entry of entries) {
    const full = path.join(dir, entry);
    const stat = fs.statSync(full);
    if (stat.isDirectory() && entry !== 'node_modules') {
      count += fixDir(full);
    } else if (entry.endsWith('.js') || entry.endsWith('.jsx')) {
      if (fixFile(full)) {
        console.log('Fixed:', path.relative(process.cwd(), full));
        count++;
      }
    }
  }
  return count;
}

const total = fixDir(path.join(__dirname, 'client/src'));
console.log(`Done. Fixed ${total} files.`);
