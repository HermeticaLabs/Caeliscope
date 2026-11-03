// Registro de plugins de satélites. Cada plugin describe un planeta y sus lunas; se incorporan de a uno.
import { MARS_PLUGIN } from './mars.mjs';
export const SAT_PLUGINS = [MARS_PLUGIN];
export const pluginFor = (planet) => SAT_PLUGINS.find((p) => p.planet === planet) || null;
export const moonName = (m, lang) => m.name[lang] || m.name.en;
