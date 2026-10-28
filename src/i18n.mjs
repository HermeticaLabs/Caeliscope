// Idiomas de la interfaz y nombres de los astros. Inglés por defecto; la elección se recuerda en este navegador.
// Todo es texto plano y funciones puras (salvo el almacenamiento), así que se prueba sin navegador.

const KEY = 'caeliscope.lang';
export const LANGS = ['en', 'es'];
let lang = 'en';
const listeners = [];

export const getLang = () => lang;
export const locale = () => (lang === 'es' ? 'es' : 'en-GB');
export function initLang() {
  try { const s = localStorage.getItem(KEY); if (LANGS.includes(s)) lang = s; } catch { /* sin almacenamiento */ }
  if (typeof document !== 'undefined') document.documentElement.lang = lang;
  return lang;
}
export function setLang(l) {
  if (!LANGS.includes(l) || l === lang) return;
  lang = l;
  try { localStorage.setItem(KEY, l); } catch { /* sin almacenamiento */ }
  if (typeof document !== 'undefined') document.documentElement.lang = l;
  for (const f of listeners) f(l);
}
export const onLang = (f) => listeners.push(f);

const DICT = {
  en: {
    'splash.skip': 'Tap, drag or press a key to continue',
    'globe.title': 'Observer location', 'globe.lat': 'Latitude', 'globe.lon': 'Longitude', 'globe.geo': 'My location', 'globe.geoTitle': 'Use this device’s location',
    'globe.zoomOut': 'Zoom out', 'globe.zoomIn': 'Zoom in', 'globe.go': 'See the sky from here',
    'globe.hint': 'Drag the globe to turn it, click to move the pin, wheel or pinch to zoom.',
    'globe.time': '{time} local time ({zone}, {off}) · {utc} UTC',
    'globe.detail.loading': 'Map detail: loading…', 'globe.detail.on': 'Map detail: {name} (NASA GIBS)', 'globe.detail.off': 'Map detail unavailable (no access to the NASA server)',
    'panel.min': 'Minimize', 'panel.restore': 'Restore', 'panel.minAria': 'Minimize panel', 'panel.restoreAria': 'Restore panel',
    'info.title': 'Georeference', 'info.geo': 'My location', 'info.new': '📍 New location', 'info.newTitle': 'Back to the globe to pick another place (key L)',
    'info.sun': 'Sun: altitude {alt}, azimuth {az}', 'info.moon': 'Moon: altitude {alt}, azimuth {az}, {ill}% lit',
    'info.perf': 'Engine: {us} µs per query', 'info.located': 'Location updated', 'info.noGeo': 'Could not get the location', 'info.noGeoApi': 'This browser has no geolocation',
    'info.notFound': 'Cannot find "{q}"', 'info.below': '{name}: below the horizon ({alt}°)', 'info.above': '{name}: altitude {alt}°',
    'clock.zone': '{zone}, {off} · {utc} UTC',
    'opt.title': 'Options', 'opt.search': 'Search: Moon, Mars, Sirius, Orion', 'opt.searchAria': 'Search object',
    'opt.const': 'Constellations', 'opt.names': 'Names', 'opt.mw': 'Milky Way', 'opt.ground': 'Ground', 'opt.az': 'Azimuthal grid', 'opt.eq': 'Equatorial grid', 'opt.ecl': 'Ecliptic', 'opt.mer': 'Meridian',
    'opt.key.z': 'Key Z', 'opt.key.e': 'Key E', 'opt.key.4': 'Key 4', 'opt.key.6': 'Key 6',
    'opt.land': 'Landscape', 'opt.land.1': 'Countryside with hills', 'opt.land.2': 'Village', 'opt.land.3': 'Mountains and forest', 'opt.land.0': 'No landscape (flat horizon)', 'opt.landAria': 'Horizon landscape',
    'opt.proj': 'Projection', 'opt.proj.0': 'Stereographic (immersive)', 'opt.proj.1': 'Equidistant (fisheye)', 'opt.proj.2': 'Perspective (camera)', 'opt.projAria': 'View projection',
    'opt.mwLevel': 'Milky Way brightness',
    'opt.danjon': 'Lunar eclipse: darkness (Danjon L = {v}; 0 very dark, 4 bright)',
    'opt.lang': 'Language',
    'opt.help': 'H hides the panels, Space pauses, Z/E/4/6 grids, click an object for its card, double-click or T to follow it, C to center it, L to pick another location',
    'opt.legal': '<a href="https://github.com/HermeticaLabs/Caeliscope" target="_blank" rel="noopener">Source code (AGPL-3.0)</a> · <a href="https://github.com/HermeticaLabs/Caeliscope/blob/main/public/THIRD-PARTY-LICENSES.txt" target="_blank" rel="noopener">Third-party licenses</a>',
    'ev.title': 'Find event', 'ev.prev': '← Previous', 'ev.next': 'Next →',
    'ev.solar': 'Solar eclipse', 'ev.lunar': 'Lunar eclipse', 'ev.total': 'Total', 'ev.partial': 'Partial', 'ev.annular': 'Annular', 'ev.penumbral': 'Penumbral',
    'ev.new': 'New Moon', 'ev.season': 'Equinox or solstice', 'ev.visibleNote': 'Only eclipses visible from your location',
    'ev.searching': 'Searching…', 'ev.searchingN': 'Searching… ({n} lunations)', 'ev.error': 'Search error: {msg}',
    'ev.none': 'No {what} visible from this location in the next {years} years.', 'ev.noneBack': 'No {what} visible from this location in the previous {years} years.',
    'ev.what.solar': 'solar eclipse', 'ev.what.solar.total': 'total solar eclipse', 'ev.what.solar.partial': 'partial solar eclipse', 'ev.what.solar.annular': 'annular solar eclipse',
    'ev.what.lunar': 'lunar eclipse', 'ev.what.lunar.total': 'total lunar eclipse', 'ev.what.lunar.partial': 'partial lunar eclipse', 'ev.what.lunar.penumbral': 'penumbral lunar eclipse',
    'ev.res.solar': '{what}: maximum {time}. {cover}{below}',
    'ev.res.cover.total': 'TOTALITY.', 'ev.res.cover.pct': '{pct}% of the Sun covered.', 'ev.res.below': ' Sun below the horizon at maximum.',
    'ev.res.lunar': '{what}: {time}, magnitude {mag}. {up}', 'ev.res.moonUp': 'The Moon is above your horizon.', 'ev.res.moonDown': 'The Moon is below your horizon at maximum.',
    'ev.res.new': 'New Moon: {time}',
    'ev.season.0': 'March equinox', 'ev.season.1': 'June solstice', 'ev.season.2': 'September equinox', 'ev.season.3': 'December solstice',
    'ecl.solarTotal': 'TOTAL SOLAR ECLIPSE — totality', 'ecl.solarAnnular': 'Annular solar eclipse', 'ecl.solarPct': 'Solar eclipse: {pct}% of the solar disc covered',
    'ecl.lunar': 'Lunar eclipse {type}: umbral magnitude {mag}{where}', 'ecl.pen': 'Moon in Earth’s penumbra (magnitude {mag}){where}', 'ecl.below': ' (the Moon is below your horizon)',
    'ecl.type.total': 'total', 'ecl.type.parcial': 'partial', 'ecl.type.penumbral': 'penumbral',
    'cal.title': 'Pick a date and time', 'cal.aria': 'Calendar', 'cal.go': 'Go', 'cal.cancel': 'Cancel', 'cal.date': 'Date', 'cal.time': 'Time (local)', 'cal.invalid': 'Enter a valid date and time',
    'time.title': 'Time', 'time.hourOfDay': 'Hour of day', 'time.now': 'Back to now (real time)', 'time.nowAria': 'Now', 'time.pause': 'Pause (Space)', 'time.resume': 'Resume (Space)', 'time.pauseAria': 'Pause',
    'time.real': 'Real', 'time.realTitle': 'Real time',
    'time.fwd1': '30 s per second', 'time.fwd2': '1 min per second', 'time.fwd3': '10 min per second', 'time.back1': 'Backwards: 30 s per second', 'time.back2': 'Backwards: 1 min per second', 'time.back3': 'Backwards: 10 min per second',
    'time.fs': 'Full screen (key F)', 'time.fsAria': 'Full screen',
    'unit.year': 'the year', 'unit.month': 'the month', 'unit.day': 'the day', 'unit.hour': 'the hour', 'unit.minute': 'the minutes', 'unit.second': 'the seconds', 'unit.inc': 'Increase {u}', 'unit.dec': 'Decrease {u}',
    'day.day': 'Day', 'day.sunrise': 'Sunrise', 'day.sunset': 'Sunset', 'day.dawn': 'Dawn', 'day.dusk': 'Dusk', 'day.night': 'Night',
    'card.follow': '⌖ Follow', 'card.followTitle': 'The camera follows the object (key T; double-click too)',
    'card.zoom': '⌕ Zoom in', 'card.zoomTitle': 'Zooms until the disc fills a good part of the screen, and follows it',
    'card.path': 'Trajectory', 'card.pathTitle': 'Draws its ±12-hour path in its own color; several can be on at once',
    'card.all': 'All', 'card.allLive': 'All · live', 'card.allCycle': 'All · cycle',
    'card.allTitle': 'Star trails of all bright stars (long exposure): one click shows them forming live as time runs, another the full cycle, another turns them off',
    'card.min': 'Minimize card', 'card.close': 'Close card', 'card.wiki': 'More on Wikipedia',
    'chip.followingN': 'Following: {name}', 'chip.below': ' (below the horizon)', 'chip.stop': 'Stop following', 'chip.removePath': 'Remove trajectory of {name}',
    'chip.trailsLive': 'All stars (live)', 'chip.trailsCycle': 'All stars (cycle)', 'chip.star': 'Star',
    'sub.sun': 'Star', 'sub.moon': 'Natural satellite', 'sub.planet': 'Planet', 'sub.star': 'Star', 'sub.starCat': 'Star · catalogue only',
    'row.mag': 'Magnitude', 'row.covered': 'Covered by the Moon', 'row.apparent': 'Apparent diameter', 'row.dist': 'Distance', 'row.radec': 'RA/Dec (of date)', 'row.radec2000': 'RA/Dec (J2000)',
    'row.azalt': 'Az/Alt', 'row.ecl': 'Ecliptic', 'row.phase': 'Phase', 'row.sunDist': 'Distance to the Sun', 'row.elong': 'Elongation', 'row.obs': 'Observation', 'row.needsScope': 'Needs a telescope',
    'row.state': 'Status', 'row.up': 'Above the horizon', 'row.down': 'Below the horizon', 'row.bv': 'B-V index', 'row.hip': 'Hipparcos catalogue',
    'row.vis': 'Visibility', 'row.always': 'Always above the horizon', 'row.never': 'Does not rise in the next 26 h', 'row.rise': 'Rises', 'row.set': 'Sets',
    'row.tomorrow': ' (tomorrow)', 'row.yesterday': ' (yesterday)', 'unit.au': 'AU',
    'fov': 'FOV {v}',
  },
  es: {
    'splash.skip': 'Toca, arrastra o pulsa una tecla para continuar',
    'globe.title': 'Ubicación del observador', 'globe.lat': 'Latitud', 'globe.lon': 'Longitud', 'globe.geo': 'Mi ubicación', 'globe.geoTitle': 'Usar la ubicación de este dispositivo',
    'globe.zoomOut': 'Alejar', 'globe.zoomIn': 'Acercar', 'globe.go': 'Ver el cielo desde aquí',
    'globe.hint': 'Arrastra el globo para girarlo, haz clic para mover el pin, rueda o pellizco para el zoom.',
    'globe.time': '{time} hora local ({zone}, {off}) · {utc} UTC',
    'globe.detail.loading': 'Detalle del mapa: cargando…', 'globe.detail.on': 'Detalle del mapa: {name} (NASA GIBS)', 'globe.detail.off': 'Detalle del mapa no disponible (sin acceso al servidor de NASA)',
    'panel.min': 'Minimizar', 'panel.restore': 'Restaurar', 'panel.minAria': 'Minimizar panel', 'panel.restoreAria': 'Restaurar panel',
    'info.title': 'Georeferencia', 'info.geo': 'Mi ubicación', 'info.new': '📍 Nueva ubicación', 'info.newTitle': 'Volver al globo para elegir otro lugar (tecla L)',
    'info.sun': 'Sol: altura {alt}, azimut {az}', 'info.moon': 'Luna: altura {alt}, azimut {az}, iluminada {ill}%',
    'info.perf': 'Motor: {us} µs por consulta', 'info.located': 'Ubicación actualizada', 'info.noGeo': 'No se pudo obtener la ubicación', 'info.noGeoApi': 'Este navegador no tiene geolocalización',
    'info.notFound': 'No encuentro "{q}"', 'info.below': '{name}: bajo el horizonte ({alt}°)', 'info.above': '{name}: altura {alt}°',
    'clock.zone': '{zone}, {off} · {utc} UTC',
    'opt.title': 'Opciones', 'opt.search': 'Buscar: Luna, Marte, Sirio, Orión', 'opt.searchAria': 'Buscar objeto',
    'opt.const': 'Constelaciones', 'opt.names': 'Nombres', 'opt.mw': 'Vía Láctea', 'opt.ground': 'Suelo', 'opt.az': 'Cuadrícula azimutal', 'opt.eq': 'Cuadrícula ecuatorial', 'opt.ecl': 'Eclíptica', 'opt.mer': 'Meridiano',
    'opt.key.z': 'Tecla Z', 'opt.key.e': 'Tecla E', 'opt.key.4': 'Tecla 4', 'opt.key.6': 'Tecla 6',
    'opt.land': 'Paisaje', 'opt.land.1': 'Campo con cerros', 'opt.land.2': 'Pueblo', 'opt.land.3': 'Montañas y bosque', 'opt.land.0': 'Sin paisaje (horizonte plano)', 'opt.landAria': 'Paisaje del horizonte',
    'opt.proj': 'Proyección', 'opt.proj.0': 'Estereográfica (inmersiva)', 'opt.proj.1': 'Equidistante (ojo de pez)', 'opt.proj.2': 'Perspectiva (cámara)', 'opt.projAria': 'Proyección de la vista',
    'opt.mwLevel': 'Brillo de la Vía Láctea',
    'opt.danjon': 'Eclipse lunar: oscuridad (Danjon L = {v}; 0 muy oscuro, 4 brillante)',
    'opt.lang': 'Idioma',
    'opt.help': 'H oculta los paneles, Espacio pausa, Z/E/4/6 cuadrículas, clic en un objeto para ver su ficha, doble clic o T para seguirlo, C para centrarlo, L para elegir otra ubicación',
    'opt.legal': '<a href="https://github.com/HermeticaLabs/Caeliscope" target="_blank" rel="noopener">Código fuente (AGPL-3.0)</a> · <a href="https://github.com/HermeticaLabs/Caeliscope/blob/main/public/THIRD-PARTY-LICENSES.txt" target="_blank" rel="noopener">Licencias de terceros</a>',
    'ev.title': 'Buscar evento', 'ev.prev': '← Anterior', 'ev.next': 'Siguiente →',
    'ev.solar': 'Eclipse solar', 'ev.lunar': 'Eclipse lunar', 'ev.total': 'Total', 'ev.partial': 'Parcial', 'ev.annular': 'Anular', 'ev.penumbral': 'Penumbral',
    'ev.new': 'Luna nueva', 'ev.season': 'Equinoccio o solsticio', 'ev.visibleNote': 'Solo eclipses visibles desde tu ubicación',
    'ev.searching': 'Buscando…', 'ev.searchingN': 'Buscando… ({n} lunaciones)', 'ev.error': 'Error en la búsqueda: {msg}',
    'ev.none': 'No hay {what} visible desde esta ubicación en los próximos {years} años.', 'ev.noneBack': 'No hubo {what} visible desde esta ubicación en los últimos {years} años.',
    'ev.what.solar': 'eclipse solar', 'ev.what.solar.total': 'eclipse solar total', 'ev.what.solar.partial': 'eclipse solar parcial', 'ev.what.solar.annular': 'eclipse solar anular',
    'ev.what.lunar': 'eclipse lunar', 'ev.what.lunar.total': 'eclipse lunar total', 'ev.what.lunar.partial': 'eclipse lunar parcial', 'ev.what.lunar.penumbral': 'eclipse lunar penumbral',
    'ev.res.solar': '{what}: máximo {time}. {cover}{below}',
    'ev.res.cover.total': 'TOTALIDAD.', 'ev.res.cover.pct': '{pct}% del Sol tapado.', 'ev.res.below': ' Sol bajo el horizonte en el máximo.',
    'ev.res.lunar': '{what}: {time}, magnitud {mag}. {up}', 'ev.res.moonUp': 'La Luna está sobre tu horizonte.', 'ev.res.moonDown': 'La Luna está bajo tu horizonte en el máximo.',
    'ev.res.new': 'Luna nueva: {time}',
    'ev.season.0': 'Equinoccio de marzo', 'ev.season.1': 'Solsticio de junio', 'ev.season.2': 'Equinoccio de septiembre', 'ev.season.3': 'Solsticio de diciembre',
    'ecl.solarTotal': 'ECLIPSE SOLAR TOTAL — totalidad', 'ecl.solarAnnular': 'Eclipse solar anular', 'ecl.solarPct': 'Eclipse solar: {pct}% del disco solar tapado',
    'ecl.lunar': 'Eclipse lunar {type}: magnitud umbral {mag}{where}', 'ecl.pen': 'Luna en la penumbra de la Tierra (magnitud {mag}){where}', 'ecl.below': ' (la Luna está bajo tu horizonte)',
    'ecl.type.total': 'total', 'ecl.type.parcial': 'parcial', 'ecl.type.penumbral': 'penumbral',
    'cal.title': 'Elegir fecha y hora', 'cal.aria': 'Calendario', 'cal.go': 'Ir', 'cal.cancel': 'Cancelar', 'cal.date': 'Fecha', 'cal.time': 'Hora (local)', 'cal.invalid': 'Ingresa una fecha y hora válidas',
    'time.title': 'Tiempo', 'time.hourOfDay': 'Hora del día', 'time.now': 'Volver a ahora (tiempo real)', 'time.nowAria': 'Ahora', 'time.pause': 'Pausa (Espacio)', 'time.resume': 'Reanudar (Espacio)', 'time.pauseAria': 'Pausa',
    'time.real': 'Real', 'time.realTitle': 'Tiempo real',
    'time.fwd1': '30 s por segundo', 'time.fwd2': '1 min por segundo', 'time.fwd3': '10 min por segundo', 'time.back1': 'Hacia atrás: 30 s por segundo', 'time.back2': 'Hacia atrás: 1 min por segundo', 'time.back3': 'Hacia atrás: 10 min por segundo',
    'time.fs': 'Pantalla completa (tecla F)', 'time.fsAria': 'Pantalla completa',
    'unit.year': 'el año', 'unit.month': 'el mes', 'unit.day': 'el día', 'unit.hour': 'la hora', 'unit.minute': 'los minutos', 'unit.second': 'los segundos', 'unit.inc': 'Aumentar {u}', 'unit.dec': 'Disminuir {u}',
    'day.day': 'Día', 'day.sunrise': 'Amanecer', 'day.sunset': 'Atardecer', 'day.dawn': 'Alba', 'day.dusk': 'Crepúsculo', 'day.night': 'Noche',
    'card.follow': '⌖ Seguir', 'card.followTitle': 'La cámara sigue al objeto (tecla T; doble clic también)',
    'card.zoom': '⌕ Acercar', 'card.zoomTitle': 'Acerca la vista hasta que el disco llene buena parte de la pantalla y lo sigue',
    'card.path': 'Trayectoria', 'card.pathTitle': 'Dibuja su recorrido de ±12 horas, con su propio color; se pueden activar varios a la vez',
    'card.all': 'Todas', 'card.allLive': 'Todas · en vivo', 'card.allCycle': 'Todas · ciclo',
    'card.allTitle': 'Estelas de todas las estrellas brillantes (larga exposición): un clic las muestra formándose en vivo al correr el tiempo, otro el ciclo completo y otro las apaga',
    'card.min': 'Minimizar ficha', 'card.close': 'Cerrar ficha', 'card.wiki': 'Más en Wikipedia',
    'chip.followingN': 'Siguiendo: {name}', 'chip.below': ' (bajo el horizonte)', 'chip.stop': 'Dejar de seguir', 'chip.removePath': 'Quitar trayectoria de {name}',
    'chip.trailsLive': 'Todas las estrellas (en vivo)', 'chip.trailsCycle': 'Todas las estrellas (ciclo)', 'chip.star': 'Estrella',
    'sub.sun': 'Estrella', 'sub.moon': 'Satélite natural', 'sub.planet': 'Planeta', 'sub.star': 'Estrella', 'sub.starCat': 'Estrella · solo catálogo',
    'row.mag': 'Magnitud', 'row.covered': 'Tapado por la Luna', 'row.apparent': 'Diámetro aparente', 'row.dist': 'Distancia', 'row.radec': 'AR/Dec (fecha)', 'row.radec2000': 'AR/Dec (J2000)',
    'row.azalt': 'Az/Alt', 'row.ecl': 'Eclíptica', 'row.phase': 'Fase', 'row.sunDist': 'Distancia al Sol', 'row.elong': 'Elongación', 'row.obs': 'Observación', 'row.needsScope': 'Requiere telescopio',
    'row.state': 'Estado', 'row.up': 'Sobre el horizonte', 'row.down': 'Bajo el horizonte', 'row.bv': 'Índice B-V', 'row.hip': 'Catálogo Hipparcos',
    'row.vis': 'Visibilidad', 'row.always': 'Siempre sobre el horizonte', 'row.never': 'No sale en las próximas 26 h', 'row.rise': 'Sale', 'row.set': 'Se pone',
    'row.tomorrow': ' (mañana)', 'row.yesterday': ' (ayer)', 'unit.au': 'UA',
    'fov': 'FOV {v}',
  },
};

export const KEYS = (l) => Object.keys(DICT[l]);
export function t(key, vars) {
  let s = DICT[lang][key] ?? DICT.en[key] ?? key;
  if (vars) s = s.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? vars[k] : `{${k}}`));
  return s;
}

// Aplica los textos a todo lo marcado con data-i18n (texto), data-i18n-html, data-i18n-title, data-i18n-ph (placeholder) y data-i18n-aria.
export function applyStatic(root = document) {
  for (const el of root.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  for (const el of root.querySelectorAll('[data-i18n-html]')) el.innerHTML = t(el.dataset.i18nHtml);
  for (const el of root.querySelectorAll('[data-i18n-title]')) el.title = t(el.dataset.i18nTitle);
  for (const el of root.querySelectorAll('[data-i18n-ph]')) el.placeholder = t(el.dataset.i18nPh);
  for (const el of root.querySelectorAll('[data-i18n-aria]')) el.setAttribute('aria-label', t(el.dataset.i18nAria));
}

// ── Nombres de los astros ──
// Las claves internas de los cuerpos son las del motor (Sol, Luna, Mercurio, ...).
const BODY = {
  Sol: { en: 'Sun', es: 'Sol' }, Luna: { en: 'Moon', es: 'Luna' }, Mercurio: { en: 'Mercury', es: 'Mercurio' }, Venus: { en: 'Venus', es: 'Venus' },
  Marte: { en: 'Mars', es: 'Marte' }, Jupiter: { en: 'Jupiter', es: 'Júpiter' }, Saturno: { en: 'Saturn', es: 'Saturno' }, Urano: { en: 'Uranus', es: 'Urano' }, Neptuno: { en: 'Neptune', es: 'Neptuno' },
};
export const bodyName = (key, l = lang) => (BODY[key] ? BODY[key][l] : key);
export const bodyKeys = () => Object.keys(BODY);

// Constelaciones: el catálogo trae el nombre en español; en inglés se usa el nombre latino de la UAI (Gemini, Ursa Major...).
const CON_EN = {
  'Andrómeda': 'Andromeda', 'Máquina Neumática': 'Antlia', 'Ave del Paraíso': 'Apus', 'Acuario': 'Aquarius', 'Águila': 'Aquila', 'Altar': 'Ara', 'Carnero': 'Aries', 'Cochero': 'Auriga',
  'Boyero': 'Boötes', 'Cincel': 'Caelum', 'Jirafa': 'Camelopardalis', 'Cangrejo': 'Cancer', 'Lebreles': 'Canes Venatici', 'Perro Mayor': 'Canis Major', 'Perro Menor': 'Canis Minor',
  'Capricornio': 'Capricornus', 'Carina': 'Carina', 'Casiopea': 'Cassiopeia', 'Centauro': 'Centaurus', 'Cefeo': 'Cepheus', 'Ballena': 'Cetus', 'Camaleón': 'Chamaeleon', 'Compás': 'Circinus',
  'Paloma': 'Columba', 'Pelo de Berenice': 'Coma Berenices', 'Corona Austral': 'Corona Australis', 'Corona Boreal': 'Corona Borealis', 'Cuervo': 'Corvus', 'Copa': 'Crater', 'Cruz del Sur': 'Crux',
  'Cisne': 'Cygnus', 'Delfín': 'Delphinus', 'Pez dorado': 'Dorado', 'Dragón': 'Draco', 'Caballito': 'Equuleus', 'Erídano': 'Eridanus', 'Horno': 'Fornax', 'Gemelos': 'Gemini', 'Grulla': 'Grus',
  'Hércules': 'Hercules', 'Reloj': 'Horologium', 'Hidra': 'Hydra', 'Hidra Macho': 'Hydrus', 'Indio': 'Indus', 'Lagarto': 'Lacerta', 'León': 'Leo', 'León Menor': 'Leo Minor', 'Conejo': 'Lepus',
  'Balanza': 'Libra', 'Lobo': 'Lupus', 'Lince': 'Lynx', 'Lira': 'Lyra', 'Mesa': 'Mensa', 'Microscopio': 'Microscopium', 'Unicornio': 'Monoceros', 'Mosca': 'Musca', 'Escuadra': 'Norma', 'Bastón': 'Octans',
  'Ofiuco': 'Ophiuchus', 'Orión': 'Orion', 'Pavo': 'Pavo', 'Pegaso': 'Pegasus', 'Perseo': 'Perseus', 'Fénix': 'Phoenix', 'Paleta del Pintor': 'Pictor', 'Peces': 'Pisces', 'Pez Austral': 'Piscis Austrinus',
  'Popa': 'Puppis', 'Brújula': 'Pyxis', 'Retículo': 'Reticulum', 'Flecha': 'Sagitta', 'Sagitario': 'Sagittarius', 'Escorpión': 'Scorpius', 'Escultor': 'Sculptor', 'Escudo': 'Scutum',
  'Serpiente': 'Serpens', 'Sextante': 'Sextans', 'Toro': 'Taurus', 'Telescopio': 'Telescopium', 'Triángulo': 'Triangulum', 'Triángulo Austral': 'Triangulum Australe', 'Tucán': 'Tucana',
  'Osa Mayor': 'Ursa Major', 'Osa Menor': 'Ursa Minor', 'Vela': 'Vela', 'Virgen': 'Virgo', 'Pez Volador': 'Volans', 'Zorro': 'Vulpecula',
};
export const conName = (es, l = lang) => (l === 'es' ? es : CON_EN[es] || es);
export const conNamesEs = () => Object.keys(CON_EN);

// Estrellas con nombre propio: el catálogo usa formas españolas en unas pocas; el resto (Vega, Rigel...) es igual en ambos idiomas.
const STAR_EN = {
  'Sirio': 'Sirius', 'Arturo': 'Arcturus', 'Proción': 'Procyon', 'Aldebarán': 'Aldebaran', 'Régulo': 'Regulus', 'Denébola': 'Denebola',
  'Alderamín': 'Alderamin', 'Alcíone': 'Alcyone', 'Estrella Polar': 'Polaris',
};
export const starName = (es, l = lang) => (l === 'es' || !es ? es : STAR_EN[es] || es);
export const starNamesEs = () => Object.keys(STAR_EN);
