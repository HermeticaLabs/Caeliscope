// Zona horaria real del lugar del observador (base tz-lookup, sin conexión) y conversiones con Intl.
import tzlookup from 'tz-lookup';
import { locale } from './i18n.mjs';

export function tzAt(lat, lon) {
  try { return tzlookup(lat, lon); } catch { const h = Math.round(lon / 15); return `Etc/GMT${h <= 0 ? '+' : '-'}${Math.abs(h)}`; }
}
const cache = new Map();
const dtf = (tz) => { let f = cache.get(tz); if (!f) { f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }); cache.set(tz, f); } return f; };
export function partsAt(ms, tz) { const o = {}; for (const p of dtf(tz).formatToParts(ms)) if (p.type !== 'literal') o[p.type] = +p.value; if (o.hour === 24) o.hour = 0; return o; }
export function offsetMs(ms, tz) { const p = partsAt(ms, tz); return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(ms / 1000) * 1000; }
const pad = (n, w = 2) => String(n).padStart(w, '0');
export function toInputValue(ms, tz) { const p = partsAt(ms, tz); return `${pad(p.year, 4)}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`; }
export function fromInputValue(str, tz) { // hora de pared del lugar -> instante UTC (maneja el cambio de horario)
  const m = /^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d)/.exec(str || ''); if (!m) return NaN;
  const guess = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]), o1 = offsetMs(guess, tz); let t = guess - o1; const o2 = offsetMs(t, tz); if (o2 !== o1) t = guess - o2; return t;
}
export function dayIndex(ms, tz) { const p = partsAt(ms, tz); return Math.floor(Date.UTC(p.year, p.month - 1, p.day) / 86400000); }
export function fmtOffset(ms, tz) { const m = Math.round(offsetMs(ms, tz) / 60000), s = m < 0 ? '−' : '+', a = Math.abs(m); return `UTC${s}${Math.floor(a / 60)}${a % 60 ? ':' + pad(a % 60) : ''}`; }
export const zoneName = (tz) => tz.split('/').pop().replace(/_/g, ' ');
export const fmtClock = (ms, tz) => new Intl.DateTimeFormat(locale(), { timeZone: tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(ms);
export const fmtHM = (ms, tz) => new Intl.DateTimeFormat(locale(), { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).format(ms);
export const fmtDateTime = (ms, tz) => new Intl.DateTimeFormat(locale(), { timeZone: tz, dateStyle: 'medium', timeStyle: 'short', hour12: false }).format(ms);

// Hora de pared del lugar (expresada como milisegundos UTC "de pared") -> instante UTC real; maneja el cambio de horario.
export function wallToMs(wallMs, tz) { const o1 = offsetMs(wallMs, tz); let t = wallMs - o1; const o2 = offsetMs(t, tz); if (o2 !== o1) t = wallMs - o2; return t; }
const daysIn = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
// Suma una unidad de la hora de pared (year, month, day, hour, minute, second), como una rueda de fecha y hora. dir = +1 o -1.
export function stepWall(ms, unit, dir, tz) {
  const p = partsAt(ms, tz); let { year: y, month: mo, day: d, hour: h, minute: mi, second: se } = p;
  if (unit === 'year') { y += dir; d = Math.min(d, daysIn(y, mo)); }
  else if (unit === 'month') { mo += dir; if (mo < 1) { mo = 12; y--; } else if (mo > 12) { mo = 1; y++; } d = Math.min(d, daysIn(y, mo)); }
  else if (unit === 'day') d += dir;
  else if (unit === 'hour') return ms + dir * 3600000;      // horas, minutos y segundos avanzan en tiempo real (correcto en el cambio de horario)
  else if (unit === 'minute') return ms + dir * 60000;
  else return ms + dir * 1000;
  return wallToMs(Date.UTC(y, mo - 1, d, h, mi, se), tz);
}
