import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';

let html = await readFile('tiko-wiko-diorama-3d.html', 'utf8');
html = html.replace(/<script\s+type=["']importmap["']>[\s\S]*?<\/script>\s*/i, '');

const additions = await Promise.all([
  'scripts/self-service-display.js',
  'scripts/premium-bakery-theme.js',
  'scripts/mobile-fixes.js',
  'scripts/character-overhaul.js',
  'scripts/service-dining-overhaul.js',
  'scripts/navigation-final-fix.js',
  'scripts/visual-bugfix-v211.js',
  'scripts/layout-service-fix-v22.js'
].map(path => readFile(path, 'utf8')));

const moduleEnd = html.lastIndexOf('</script>');
if (moduleEnd < 0) throw new Error('Closing module script not found.');
html = `${html.slice(0, moduleEnd)}\n${additions.join('\n')}\n${html.slice(moduleEnd)}`;

await rm('public/assets', { recursive: true, force: true });
await mkdir('public', { recursive: true });
await cp('assets', 'public/assets', { recursive: true, force: true });
await writeFile('index.html', html, 'utf8');
console.log('Prepared TikoWikoBakery 2.2 with clear layout, reliable service and tap priority');
