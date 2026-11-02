// Caché acotada: guarda como máximo `max` resultados (los últimos usados); al llegar el siguiente se descarta el más antiguo.
// Se usa para las geometrías largas (roseta, ciclo, analema): re-consultar una ya calculada es instantáneo y la memoria nunca crece más allá de `max`.
export function createLru(max = 5) {
  const m = new Map();
  return {
    get(k) { if (!m.has(k)) return undefined; const v = m.get(k); m.delete(k); m.set(k, v); return v; },
    set(k, v) { if (m.has(k)) m.delete(k); m.set(k, v); while (m.size > max) m.delete(m.keys().next().value); return v; },
    has: (k) => m.has(k), delete: (k) => m.delete(k), clear: () => m.clear(),
    get size() { return m.size; }, keys: () => [...m.keys()],
  };
}
