import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { stampServiceWorker } from './scripts/stamp-sw.mjs';
import { buildDocs } from './scripts/build-docs.mjs';

const version = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version;
let dist = 'dist', root = '.';

export default {
  base: './',
  plugins: [{
    name: 'caeliscope-stamp-sw',            // al terminar la compilación, deja en dist/sw.js un identificador nuevo (versión + hora de compilación)
    apply: 'build',
    configResolved(c) { root = c.root; dist = resolve(c.root, c.build.outDir); },
    closeBundle() { const pages = buildDocs({ srcDir: resolve(root, 'docs'), outDir: resolve(dist, 'docs') }); console.log(`documentación: ${pages.length} páginas`); const id = stampServiceWorker(dist, version); if (id) console.log(`service worker sellado: ${id}`); },
  }],
};
