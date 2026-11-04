// Contenido de la ventana "Acerca de" (se abre con el logo): qué es, privacidad, créditos, controles y compatibilidad. Texto plano en EN/ES, sin dependencias del navegador.
export const ABOUT_VERSION = '1.45.0';
export const REPO = 'https://github.com/HermeticaLabs/Caeliscope';
export const ENGINE_REPO = 'https://github.com/hermeticalabs/caelis-engine';
export const LICENSES = `${REPO}/blob/main/public/THIRD-PARTY-LICENSES.txt`;
export const CONTACT = 'hermeticalabs.dev@proton.me';
export const STORAGE_KEYS = ['caeliscope.lang', 'caeliscope.obs', 'caeliscope.ui', 'caeliscope.min', 'caeliscope.winpos'];

const a = (href, txt) => `<a href="${href}" target="_blank" rel="noopener">${txt}</a>`;

export const ABOUT = {
  en: {
    title: 'About Caeliscope',
    close: 'Close',
    repo: 'View source on GitHub',
    tagline: 'Demo Proof powered by Caelis Engine · Hermetica Labs',
    sections: [
      { id: 'what', h: 'What it is', p: [
        `Caeliscope is a technical demo: an immersive sky viewer that draws the Sun, Moon, planets, their moons and the stars for any place and time. It computes nothing by itself: every position comes from ${a(ENGINE_REPO, 'Caelis Engine')}, Hermetica Labs’ deterministic, zero-dependency astronomical engine in JavaScript. The viewer only draws what the engine returns.`,
        `Code under AGPL-3.0-or-later. Version ${ABOUT_VERSION}.`] },
      { id: 'privacy', h: 'Privacy and permissions', p: [
        'Your location is used only to compute and draw the sky on your own device. It is never sent anywhere: there is no server, no account, no analytics and no cookies. The page only downloads its own static files (star catalogue, textures, fonts).',
        'The browser asks for your permission only if you press the “use my location” button. You can also pick a place on the globe or type coordinates, without sharing anything.',
        'To remember your choices between visits, Caeliscope uses your browser’s local storage: language, last observer location, interface preferences (text size, panel opacity, night mode, toggles), minimised panels and window positions. It stays in your browser and you can erase it at any time from your browser’s site data settings.',
        'Opening a Wikipedia link from an object’s card is the only moment a third-party site is contacted, and only when you click it.'] },
      { id: 'credits', h: 'Engine, data and credits', p: [
        'Positions of the Sun, Moon and planets, sidereal time, eclipses and visibility: Caelis Engine (AGPL-3.0-or-later). Natural satellites (Mars, Jupiter, Saturn, Uranus) use JPL mean orbital elements with classical mean motions: a coherent mean model, not a precision ephemeris.',
        'Stars, constellations and names: Hipparcos (ESA) through d3-celestial by Olaf Frohn (BSD-3-Clause). Milky Way and Moon textures: NASA (Scientific Visualization Studio, CGI Moon Kit). Earth and planet textures: NASA and Solar System Scope (CC BY 4.0). Time zones: tz-lookup. Graphics: three.js (MIT). Fonts: SIL Open Font License.',
        `Full texts: ${a(LICENSES, 'third-party licenses')}. “Caelis”, “Caeliscope” and “Hermetica Labs” names and logos are not covered by the code licence. Contact: ${CONTACT}.`] },
      { id: 'controls', h: 'Controls', p: [
        'Drag to look around, wheel or pinch to zoom. Click or tap an object for its card; double-click or T follows it; C centres it; L picks another location.',
        'Time bar: step back or forward 10 min, 1 min or 30 s, run at real time or speed it up, jump to a date, and find the next eclipse or event. Space pauses.',
        'H hides the panels · Z / E / 4 / 6 grids · F full screen · N night mode · Esc closes cards and windows. Text size (A A A) and panel opacity are in Options.'] },
      { id: 'compat', h: 'Compatibility', p: [
        'Any current browser with WebGL 2 and hardware acceleration enabled: Chrome, Edge, Firefox or Safari, on desktop, tablet or phone. A modern integrated or discrete GPU is enough; on weak devices, reduce the window size or the field of view.',
        'If the page stays black, check that hardware acceleration is on and that WebGL 2 is not blocked.'] },
    ],
  },
  es: {
    title: 'Acerca de Caeliscope',
    close: 'Cerrar',
    repo: 'Ver el código en GitHub',
    tagline: 'Demo Proof powered by Caelis Engine · Hermetica Labs',
    sections: [
      { id: 'what', h: 'Qué es', p: [
        `Caeliscope es una demo técnica: un visor de cielo inmersivo que dibuja el Sol, la Luna, los planetas, sus lunas y las estrellas para cualquier lugar y momento. No calcula nada por sí mismo: cada posición viene de ${a(ENGINE_REPO, 'Caelis Engine')}, el motor astronómico determinista y sin dependencias de Hermetica Labs, escrito en JavaScript. El visor solo dibuja lo que el motor entrega.`,
        `Código bajo AGPL-3.0-or-later. Versión ${ABOUT_VERSION}.`] },
      { id: 'privacy', h: 'Privacidad y permisos', p: [
        'Tu ubicación se usa solo para calcular y dibujar el cielo en tu propio dispositivo. No se envía a ningún lado: no hay servidor, ni cuentas, ni analítica, ni cookies. La página solo descarga sus propios archivos estáticos (catálogo de estrellas, texturas, tipografías).',
        'El navegador te pide permiso únicamente si pulsas el botón de usar mi ubicación. También puedes elegir un lugar en el globo o escribir coordenadas, sin compartir nada.',
        'Para recordar tus elecciones entre visitas, Caeliscope usa el almacenamiento local del navegador: idioma, última ubicación del observador, preferencias de interfaz (tamaño de texto, opacidad de paneles, modo nocturno, interruptores), paneles minimizados y posición de las ventanas. Se queda en tu navegador y puedes borrarlo cuando quieras desde los datos del sitio en la configuración del navegador.',
        'Abrir un enlace a Wikipedia desde la ficha de un objeto es el único momento en que se contacta un sitio de terceros, y solo si haces clic.'] },
      { id: 'credits', h: 'Motor, datos y créditos', p: [
        'Posiciones del Sol, la Luna y los planetas, tiempo sidéreo, eclipses y visibilidad: Caelis Engine (AGPL-3.0-or-later). Los satélites naturales (Marte, Júpiter, Saturno, Urano) usan elementos orbitales medios de JPL con movimientos medios clásicos: un modelo medio coherente, no una efeméride de precisión.',
        'Estrellas, constelaciones y nombres: Hipparcos (ESA) a través de d3-celestial de Olaf Frohn (BSD-3-Clause). Texturas de la Vía Láctea y la Luna: NASA (Scientific Visualization Studio, CGI Moon Kit). Texturas de la Tierra y los planetas: NASA y Solar System Scope (CC BY 4.0). Husos horarios: tz-lookup. Gráficos: three.js (MIT). Tipografías: SIL Open Font License.',
        `Textos completos: ${a(LICENSES, 'licencias de terceros')}. Los nombres y logotipos “Caelis”, “Caeliscope” y “Hermetica Labs” no están cubiertos por la licencia del código. Contacto: ${CONTACT}.`] },
      { id: 'controls', h: 'Controles', p: [
        'Arrastra para mirar alrededor, rueda o pellizco para acercar. Clic o toque en un objeto para ver su ficha; doble clic o T lo sigue; C lo centra; L elige otra ubicación.',
        'Barra de tiempo: avanza o retrocede 10 min, 1 min o 30 s, corre en tiempo real o acelera, salta a una fecha y busca el próximo eclipse o evento. Espacio pausa.',
        'H oculta los paneles · Z / E / 4 / 6 cuadrículas · F pantalla completa · N modo nocturno · Esc cierra fichas y ventanas. El tamaño del texto (A A A) y la opacidad de los paneles están en Opciones.'] },
      { id: 'compat', h: 'Compatibilidad', p: [
        'Cualquier navegador actual con WebGL 2 y aceleración por hardware activada: Chrome, Edge, Firefox o Safari, en escritorio, tableta o teléfono. Basta una GPU moderna, integrada o dedicada; en equipos modestos, reduce el tamaño de la ventana o el campo de visión.',
        'Si la página queda en negro, revisa que la aceleración por hardware esté activa y que WebGL 2 no esté bloqueado.'] },
    ],
  },
};

export function aboutHtml(lang) {
  const A = ABOUT[lang] || ABOUT.en;
  return `<p class="ab-tag">${A.tagline}</p>` + A.sections.map((s) => `<section><h3>${s.h}</h3>${s.p.map((x) => `<p>${x}</p>`).join('')}</section>`).join('');
}
