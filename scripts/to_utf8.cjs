const fs = require('fs');
const path = require('path');

function processDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDir(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      // Read buffer, check for BOM or try to read as utf16
      const buf = fs.readFileSync(fullPath);
      let content;
      if (buf.length >= 2 && buf[0] === 0xFF && buf[1] === 0xFE) {
        content = buf.toString('utf16le');
      } else {
        content = buf.toString('utf8');
      }
      fs.writeFileSync(fullPath, content, 'utf8');
    }
  }
}
processDir('./src');
console.log('Done converting to UTF-8');
