import { readFile, writeFile } from 'node:fs/promises';

const sourcePath = 'tiko-wiko-diorama-3d.html';
const targetPath = 'index.html';
const selfServicePath = 'scripts/self-service-display.js';

let html = await readFile(sourcePath, 'utf8');

// Vite bundles the bare Three.js imports from node_modules, so the CDN import map
// is removed from the generated entry page. This keeps the APK functional offline.
html = html.replace(
  /<script\s+type=["']importmap["']>[\s\S]*?<\/script>\s*/i,
  ''
);

// Add the stocked self-service displays inside the existing Three.js module so
// the injected feature can reuse the scene, recipes, stock and customer AI.
const selfServiceCode = await readFile(selfServicePath, 'utf8');
const moduleEnd = html.lastIndexOf('</script>');
if (moduleEnd < 0) {
  throw new Error('Unable to find the closing module script in the game HTML.');
}
html = `${html.slice(0, moduleEnd)}\n\n${selfServiceCode}\n${html.slice(moduleEnd)}`;

await writeFile(targetPath, html, 'utf8');
console.log(`Prepared ${targetPath} from ${sourcePath} with self-service displays`);
