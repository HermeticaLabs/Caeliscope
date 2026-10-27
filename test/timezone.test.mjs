import test from 'node:test';
import assert from 'node:assert/strict';
import { tzAt, offsetMs, toInputValue, fromInputValue, dayIndex, fmtOffset, zoneName } from '../src/timezone.mjs';

test('zona del lugar a partir de latitud y longitud', () => {
  assert.equal(tzAt(45.42, -75.7), 'America/Toronto'); assert.equal(tzAt(-33.45, -70.66), 'America/Santiago');
  assert.equal(tzAt(35.68, 139.69), 'Asia/Tokyo'); assert.equal(tzAt(25.54, -103.4), 'America/Monterrey');
});
test('desfase real con horario de verano', () => {
  const oct = Date.UTC(2026, 9, 17, 17, 0), jan = Date.UTC(2026, 0, 17, 17, 0);
  assert.equal(offsetMs(oct, 'America/Toronto') / 3600000, -4); assert.equal(offsetMs(jan, 'America/Toronto') / 3600000, -5);
  assert.equal(offsetMs(oct, 'America/Santiago') / 3600000, -3); assert.equal(offsetMs(jan, 'America/Santiago') / 3600000, -3);
  assert.equal(offsetMs(oct, 'Asia/Kolkata') / 60000, 330);
});
test('ida y vuelta entre instante y hora de pared', () => {
  for (const tz of ['America/Toronto', 'America/Santiago', 'Asia/Tokyo', 'Asia/Kolkata', 'Pacific/Auckland']) for (const t of [Date.UTC(2026, 9, 17, 17, 0), Date.UTC(2026, 0, 3, 5, 30), Date.UTC(2024, 3, 8, 18, 19)]) {
    assert.equal(fromInputValue(toInputValue(t, tz), tz), Math.floor(t / 60000) * 60000, `${tz} ${t}`);
  }
  assert.equal(toInputValue(Date.UTC(2026, 9, 17, 17, 0), 'America/Toronto'), '2026-10-17T13:00');
  assert.equal(fromInputValue('2026-10-17T13:00', 'America/Toronto'), Date.UTC(2026, 9, 17, 17, 0));
});
test('el día cambia según la zona', () => {
  const t = Date.UTC(2026, 9, 17, 2, 0); assert.equal(dayIndex(t, 'Asia/Tokyo') - dayIndex(t, 'America/Toronto'), 1);
});
test('etiquetas', () => { assert.equal(fmtOffset(Date.UTC(2026, 9, 17, 17), 'America/Toronto'), 'UTC−4'); assert.equal(fmtOffset(Date.UTC(2026, 9, 17, 17), 'Asia/Kolkata'), 'UTC+5:30'); assert.equal(zoneName('America/Buenos_Aires'), 'Buenos Aires'); });

import { stepWall, wallToMs, partsAt } from '../src/timezone.mjs';
test('ruedas de fecha: el día del mes se ajusta y el mes y el año dan la vuelta', () => {
  const tz = 'America/Santiago', at = (y, m, d, h = 12) => wallToMs(Date.UTC(y, m - 1, d, h, 0, 0), tz);
  const eq = (ms, y, m, d) => { const p = partsAt(ms, tz); assert.deepEqual([p.year, p.month, p.day], [y, m, d]); };
  eq(stepWall(at(2026, 1, 31), 'month', +1, tz), 2026, 2, 28);
  eq(stepWall(at(2026, 12, 15), 'month', +1, tz), 2027, 1, 15);
  eq(stepWall(at(2026, 1, 15), 'month', -1, tz), 2025, 12, 15);
  eq(stepWall(at(2024, 2, 29), 'year', +1, tz), 2025, 2, 28);
  eq(stepWall(at(2026, 10, 31), 'day', +1, tz), 2026, 11, 1);
  assert.equal(stepWall(at(2026, 10, 21), 'minute', +1, tz) - at(2026, 10, 21), 60000);
  assert.equal(partsAt(wallToMs(Date.UTC(2026, 6, 1, 8, 30, 0), tz), tz).hour, 8);
});
