// Registro de plugins de satélites. Cada plugin describe un planeta y sus lunas; se incorporan de a uno.
import { MARS_PLUGIN } from './mars.mjs';
import { JUPITER_PLUGIN } from './jupiter.mjs';
import { SATURN_PLUGIN } from './saturn.mjs';
import { URANUS_PLUGIN } from './uranus.mjs';
import { NEPTUNE_PLUGIN } from './neptune.mjs';
export const SAT_PLUGINS = [MARS_PLUGIN, JUPITER_PLUGIN, SATURN_PLUGIN, URANUS_PLUGIN, NEPTUNE_PLUGIN];
export const pluginFor = (planet) => SAT_PLUGINS.find((p) => p.planet === planet) || null;
export const moonName = (m, lang) => m.name[lang] || m.name.en;
