import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const webPublic = path.join(root, 'apps', 'web', 'public');
const rootPublic = path.join(root, 'public');

console.log('[Build] Syncing web assets to root public directory for Vercel...');

// Ensure public directory exists
fs.mkdirSync(rootPublic, { recursive: true });

// Copy all files from apps/web/public to public/
fs.cpSync(webPublic, rootPublic, { recursive: true, force: true });

// Also copy HTML files, favicon, and assets to root directory for direct root serving
const files = fs.readdirSync(webPublic);
for (const f of files) {
  const src = path.join(webPublic, f);
  const dst = path.join(root, f);
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.cpSync(src, dst, { recursive: true, force: true });
  } else if (f.endsWith('.html') || f.endsWith('.svg') || f.endsWith('.ico')) {
    fs.copyFileSync(src, dst);
  }
}

console.log('[Build] Successfully synchronized assets to public/ and root directory.');
