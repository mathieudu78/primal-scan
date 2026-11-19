// Génère deux fichiers à partir de web/app.html :
//  - web/primal-scan.html : version "Artifact" (hors ligne, sans scan : le cadre bloque réseau et caméra)
//  - docs/index.html (+ manifest, icônes) : version hébergée (GitHub Pages, etc.) avec scan caméra et Open Food Facts
import { build } from 'esbuild';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
const out = await build({ entryPoints: ['web/entry.ts'], bundle: true, minify: true, format: 'iife', globalName: 'PS', target: 'es2019', write: false, legalComments: 'none' });
const js = out.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const tpl = readFileSync('web/app.html', 'utf8').replace('/*__BUNDLE__*/', () => js);

writeFileSync('web/primal-scan.html', tpl.replace('<!--__PWA__-->', '').replace('/*__ONLINE__*/false', 'false'));

mkdirSync('docs', { recursive: true });
const pwa = '<link rel="manifest" href="manifest.webmanifest">\n<link rel="apple-touch-icon" href="icon-180.png">\n<meta name="theme-color" content="#0b1510">';
const page = tpl.replace('<!--__PWA__-->', pwa).replace('/*__ONLINE__*/false', 'true');
writeFileSync('docs/index.html', '<!doctype html>\n<html lang="fr">\n<head>\n<meta charset="utf-8">\n' + page.replace('<main id="app">', '</head>\n<body>\n<main id="app">') + '\n</body>\n</html>\n');
writeFileSync('docs/manifest.webmanifest', JSON.stringify({ name: 'Primal Scan', short_name: 'Primal Scan', start_url: './', display: 'standalone', background_color: '#0b1510', theme_color: '#0b1510', lang: 'fr', icons: [{ src: 'icon-512.png', sizes: '512x512', type: 'image/png' }, { src: 'icon-180.png', sizes: '180x180', type: 'image/png' }] }));
console.log('ok', Math.round(tpl.length / 1024), 'Ko');
