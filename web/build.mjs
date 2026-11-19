// Génère web/primal-scan.html : UN SEUL fichier (moteurs + interface), sans serveur ni dépendance.
import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';
const out = await build({ entryPoints: ['web/entry.ts'], bundle: true, minify: true, format: 'iife', globalName: 'PS', target: 'es2019', write: false, legalComments: 'none' });
const js = out.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const html = readFileSync('web/app.html', 'utf8').replace('/*__BUNDLE__*/', () => js);
writeFileSync('web/primal-scan.html', html);
console.log('web/primal-scan.html', Math.round(html.length / 1024), 'Ko');
