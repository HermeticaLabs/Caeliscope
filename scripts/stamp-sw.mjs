// Sella el service worker compilado con un identificador único de cada compilación, para que cada versión publicada invalide sola la caché anterior.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export const PLACEHOLDER = '__BUILD_ID__';
export function stampServiceWorker(distDir, version, now = Date.now()) {
  const f = join(distDir, 'sw.js'); if (!existsSync(f)) return null;
  const src = readFileSync(f, 'utf8'); if (!src.includes(PLACEHOLDER)) return null;
  const id = `${version}-${now.toString(36)}`;
  writeFileSync(f, src.split(PLACEHOLDER).join(id)); return id;
}
