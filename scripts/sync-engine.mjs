// Prepara CaelisEngine.js (CommonJS) para el navegador SIN modificar el repo del motor.
// Uso: npm run sync            (usa la ruta por defecto)
//      node scripts/sync-engine.mjs "ruta/a/CaelisEngine.js"
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const SRC = process.argv[2] || '../caelis-engine/core/CaelisEngine.js';
const OUT = 'src/engine/caelis-engine.generated.mjs';

const code = readFileSync(SRC, 'utf8');
const wrapped = `// GENERADO por scripts/sync-engine.mjs desde ${SRC}. No editar a mano.
const module = { exports: {} };
const exports = module.exports;
${code}
if (typeof module.exports.getSnapshotAt !== 'function') {
  throw new Error('CaelisEngine: no se encontró getSnapshotAt en module.exports');
}
export const CaelisAPI = module.exports;
`;
mkdirSync('src/engine', { recursive: true });
writeFileSync(OUT, wrapped, 'utf8');
console.log(`Motor sincronizado: ${SRC} -> ${OUT} (${(wrapped.length / 1024).toFixed(0)} KB)`);
