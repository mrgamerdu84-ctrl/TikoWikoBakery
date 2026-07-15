import { readFile, writeFile } from 'node:fs/promises';

const sourcePath = 'tiko-wiko-diorama-3d.html';
const targetPath = 'index.html';

let html = await readFile(sourcePath, 'utf8');

// Vite bundles the bare Three.js imports from node_modules, so the CDN import map
// is removed from the generated entry page. This keeps the APK functional offline.
html = html.replace(
  /<script\s+type=["']importmap["']>[\s\S]*?<\/script>\s*/i,
  ''
);

await writeFile(targetPath, html, 'utf8');
console.log(`Prepared ${targetPath} from ${sourcePath}`);
