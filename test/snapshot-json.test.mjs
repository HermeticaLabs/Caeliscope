import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { buildExport, toText, fileName, ENGINE, PUBLISHER } from '../src/snapshot-json.mjs';

const has = existsSync(new URL('../src/engine/caelis-engine.generated.mjs', import.meta.url));
const { CaelisAPI } = has ? await import('../src/engine/caelis-engine.generated.mjs') : { CaelisAPI: null };

test('los metadatos de procedencia van primero y nombran a Caeliscope, Caelis Engine, su versión, el esquema y Hermetica Labs', { skip: !has }, () => {
  const snap = CaelisAPI.getSnapshotAt(2461000.5, -33.45, -70.66);
  const o = buildExport({ kind: 'body', key: 'Luna', name: 'Moon', data: snap.bodies.Luna, snap, observer: { lat: -33.45, lon: -70.66 }, extra: snap.luna });
  assert.equal(Object.keys(o)[0], '_meta');
  assert.equal(o._meta.generated_by, 'Caeliscope'); assert.equal(o._meta.engine, 'Caelis Engine');
  assert.equal(o._meta.engine_version, ENGINE.version); assert.equal(o._meta.schema_version, snap.schema_version); assert.equal(o._meta.publisher, PUBLISHER);
  assert.equal(o._meta.instant_utc, snap.meta.utc); assert.deepEqual(o._meta.observer, { lat_deg: -33.45, lon_deg: -70.66 });
  assert.deepEqual(o.data, snap.bodies.Luna);
  const back = JSON.parse(toText(o)); assert.equal(back.data.az_deg, snap.bodies.Luna.az_deg);
});
test('nombre de archivo seguro con el instante', () => {
  const o = { object: { id: 'Jupiter', name: 'Júpiter' }, _meta: { instant_utc: '2025-11-20T23:58:50.792Z' } };
  assert.equal(fileName(o), 'caeliscope-jupiter-20251120-235850.json');
  assert.equal(fileName({ object: { id: 'star:3', name: 'Alpha/β Ori' }, _meta: {} }), 'caeliscope-alpha-ori.json');
});

test('JSON de una luna: tipo moon, origen del plugin y nombre en inglés', async () => {
  const { buildExport, ORIGIN } = await import('../src/snapshot-json.mjs');
  const o = buildExport({ kind: 'moon', key: 'Io', name: 'Io', data: { planet: 'Jupiter' }, snap: { meta: {} }, observer: { lat: 0, lon: 0 } });
  assert.equal(o.object.kind, 'moon'); assert.equal(o._meta.data_origin, ORIGIN.moon); assert.ok(/plugin/.test(o._meta.data_origin));
});
