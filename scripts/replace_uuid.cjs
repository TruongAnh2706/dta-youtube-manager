const fs = require('fs');
const path = require('path');

function processDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDir(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      const original = content;
      content = content.replace(/Date\.now\(\)\.toString\(\) \+ Math\.random\(\)\.toString\(36\)\.substr\(2, 9\)/g, 'crypto.randomUUID()');
      content = content.replace(/`topic-\$\{Date\.now\(\)\}-\$\{Math\.random\(\)\.toString\(36\)\.substr\(2, 9\)\}`/g, 'crypto.randomUUID()');
      content = content.replace(/`task_\$\{Date\.now\(\)\}`/g, 'crypto.randomUUID()');
      content = content.replace(/`email_\$\{Date\.now\(\)\}`/g, 'crypto.randomUUID()');
      content = content.replace(/Date\.now\(\)\.toString\(\)/g, 'crypto.randomUUID()');
      content = content.replace(/`proxy-\$\{Date\.now\(\)\}-\$\{Math\.random\(\)\.toString\(36\)\.substr\(2, 9\)\}`/g, 'crypto.randomUUID()');
      if (content !== original) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log('Updated', fullPath);
      }
    }
  }
}
processDir('./src');
