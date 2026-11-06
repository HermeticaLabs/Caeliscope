import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { stampServiceWorker } from './scripts/stamp-sw.mjs';

const version = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version;
let dist = 'dist';

export default {
  base: './',
  plugins: [{
    name: 'caeliscope-stamp-sw',            // al terminar la compilación, deja en dist/sw.js un identificador nuevo (versión + hora de compilación)
    apply: 'build',
    configResolved(c) { dist = resolve(c.root, c.build.outDir); },
    closeBundle() { const id = stampServiceWorker(dist, version); if (id) console.log(`service worker sellado: ${id}`); },
  }],
};
