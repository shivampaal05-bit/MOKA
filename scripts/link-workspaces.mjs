// Creates node_modules/@queuebite/* symlinks so the workspace packages resolve without `npm install`.
// (`npm install` does the same thing; this exists so the project runs with zero downloads.)
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const dest = path.join(root, 'node_modules', '@queuebite');
fs.mkdirSync(dest, { recursive: true });
for (const dir of ['packages/core', 'apps/api', 'tools/simulator']) {
  const name = JSON.parse(fs.readFileSync(path.join(root, dir, 'package.json'), 'utf8')).name.split('/')[1]; const link = path.join(dest, name);
  fs.rmSync(link, { force: true, recursive: true });
  const target = path.resolve(root, dir);
  try {
    fs.symlinkSync(target, link, process.platform === 'win32' ? 'junction' : 'dir');
  } catch (err) {
    fs.cpSync(target, link, { recursive: true });
  }
  console.log('linked', `@queuebite/${name} ->`, dir);
}

