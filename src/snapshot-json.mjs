// Exportación en JSON de lo que Caelis Engine devuelve para un objeto en un instante, con los metadatos de procedencia al principio.
// Funciones puras (sin DOM), con prueba.
export const APP = { name: 'Caeliscope', url: 'https://github.com/HermeticaLabs/Caeliscope' };
export const ENGINE = { name: 'Caelis Engine', version: '4.0.13', url: 'https://github.com/hermeticalabs/caelis-engine' };   // actualizar al sincronizar el motor
export const PUBLISHER = 'Hermetica Labs';
export const ORIGIN = { star: 'Hipparcos catalogue (via d3-celestial); horizontal coordinates computed by Caeliscope from the engine sidereal time', body: 'Caelis Engine getSnapshotAt()', moon: 'Caeliscope satellite plugin (mean orbital elements) over the planet position resolved by Caelis Engine getSnapshotAt()' };

// kind: 'body' | 'star' | 'moon'. snap = lo que devolvió getSnapshotAt. data = objeto del cuerpo (o de la estrella).
export const ROUNDING_MOON = 'Moon offsets and separations in arcseconds rounded to 0.001 (JSON drops trailing zeros: -3.000 is written -3); distances in km rounded to integers';
// key = identificador en inglés (para uso externo); engineKey = clave interna del motor, solo si es distinta.
export function buildExport({ kind, key, engineKey, name, data, snap, observer, extra, rounding }) {
  const meta = snap?.meta ?? {};
  const out = {
    _meta: {
      generated_by: APP.name, app_url: APP.url,
      engine: ENGINE.name, engine_version: ENGINE.version, engine_url: ENGINE.url,
      schema_version: snap?.schema_version ?? null,
      publisher: PUBLISHER,
      data_origin: ORIGIN[kind] ?? ORIGIN.body,
      instant_utc: meta.utc ?? null, jd_tt: meta.jd_tt ?? null, delta_t_sec: meta.delta_t_sec ?? null,
      observer: { lat_deg: observer.lat, lon_deg: observer.lon },
      ...(rounding ? { rounding } : {}),
    },
    object: { kind, id: key, ...(engineKey && engineKey !== key ? { engine_key: engineKey } : {}), name },
    data,
  };
  if (extra) out.extra = extra;
  return out;
}
export const toText = (o) => JSON.stringify(o, null, 2);
export const fileName = (o) => {
  const slug = String(o.object.name || o.object.id).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'object';
  const t = (o._meta.instant_utc || '').replace(/[-:]/g, '').replace(/\.\d+Z?$/, '').replace('T', '-').replace(/Z$/, '');
  return `caeliscope-${slug}${t ? '-' + t : ''}.json`;
};
