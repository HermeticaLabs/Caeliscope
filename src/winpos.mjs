// Posición de ventanas flotantes sin superposición. Rectángulos { x, y, w, h }.
export const overlaps = (a, b, gap = 6) => a.x < b.x + b.w + gap && a.x + a.w + gap > b.x && a.y < b.y + b.h + gap && a.y + a.h + gap > b.y;
export const hitsAny = (r, others, gap) => others.some((o) => overlaps(r, o, gap));
export const clampRect = (r, vw, vh) => ({ ...r, x: Math.min(Math.max(0, r.x), Math.max(0, vw - r.w)), y: Math.min(Math.max(0, r.y), Math.max(0, vh - r.h)) });
// Mueve r hacia (x, y) sin entrar en otras ventanas: si el destino choca, intenta deslizar solo en x o solo en y; si tampoco, se queda.
export function slideTo(r, x, y, others, vw, vh, gap = 6) {
  const t = clampRect({ ...r, x, y }, vw, vh);
  if (!hitsAny(t, others, gap)) return t;
  const tx = clampRect({ ...r, x: t.x }, vw, vh), ty = clampRect({ ...r, y: t.y }, vw, vh);
  const okx = !hitsAny(tx, others, gap), oky = !hitsAny(ty, others, gap);
  if (okx && oky) return Math.abs(t.x - r.x) >= Math.abs(t.y - r.y) ? tx : ty;
  return okx ? tx : oky ? ty : r;
}
// Si r ya choca, busca el lugar libre más cercano en una grilla; devuelve r sin cambios si está libre o si no hay lugar.
export function findFree(r, others, vw, vh, step = 24, gap = 6) {
  const c = clampRect(r, vw, vh); if (!hitsAny(c, others, gap)) return c;
  let best = null, bd = Infinity;
  for (let y = 0; y <= vh - r.h; y += step) for (let x = 0; x <= vw - r.w; x += step) {
    const cand = { ...r, x, y }; if (hitsAny(cand, others, gap)) continue;
    const d = (x - r.x) ** 2 + (y - r.y) ** 2; if (d < bd) { bd = d; best = cand; }
  }
  return best || c;
}
