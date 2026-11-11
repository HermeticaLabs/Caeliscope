// Contenido de la ventana "Acerca de" (se abre con el logo): qué es, privacidad, créditos, controles y compatibilidad. Texto plano en EN/ES, sin dependencias del navegador.
export const ABOUT_VERSION = '1.53.3';
export const REPO = 'https://github.com/HermeticaLabs/Caeliscope';
export const ENGINE_REPO = 'https://github.com/hermeticalabs/caelis-engine';
export const HERMETICA_LINK = `${ENGINE_REPO}#built-with-caelis-engine`;
export const LICENSES = `${REPO}/blob/main/public/THIRD-PARTY-LICENSES.txt`;
export const CONTACT = 'hermeticalabs.dev@proton.me';
export const STORAGE_KEYS = ['caeliscope.lang', 'caeliscope.obs', 'caeliscope.ui', 'caeliscope.min', 'caeliscope.winpos'];

const a = (href, txt) => `<a href="${href}" target="_blank" rel="noopener">${txt}</a>`;

export const ABOUT = {
  en: {
    title: 'About Caeliscope',
    close: 'Close',
    contact: 'Contact Us',
    install: 'Install as an app',
    altDocs: 'Caeliscope documentation',
    community: 'CAELISCOPE PARTNERS, COMMUNITY & RECOGNITION',
    altComm: 'Caeliscope Partners, Community & Recognition directory',
    altGO: 'El Gran Observatorio (website)',
    altXerj: 'XERJ Corpus Hub',
    altRepo: 'Caeliscope on GitHub',
    altEngine: 'Caelis Engine on GitHub',
    altHerm: 'Hermetica Labs: built with Caelis Engine',
    sections: [
      { id: 'what', h: 'What it is', p: [
        `Caeliscope is a technical demo: an immersive sky viewer that draws the Sun, Moon, planets, their moons and the stars for any place and time. It computes nothing by itself: every position is calculated by ${a(ENGINE_REPO, 'Caelis Engine')}. The viewer only draws what the engine returns.`,
        `Code under AGPL-3.0-or-later. Version ${ABOUT_VERSION}.`] },
      { id: 'privacy', h: 'Privacy and permissions', p: [
        'Your location is used only to compute and draw the sky on your own device. It is never sent anywhere: there is no server, no account, no analytics and no cookies. The page downloads its own static files (star catalogue, textures, fonts). The only exception is the globe: when you zoom in, it requests satellite imagery tiles from NASA GIBS, so NASA’s servers receive your IP address and the map area you are viewing, as with any map. Nothing else leaves your device.',
        'The browser asks for your permission only if you press the “use my location” button. You can also pick a place on the globe or type coordinates, without sharing anything.',
        'To remember your choices between visits, Caeliscope uses your browser’s local storage: language, last observer location, interface preferences (text size, panel opacity, night mode, toggles), minimised panels and window positions. If you install the app or visit it again, a copy of its own files is also kept in the browser’s cache so it can open offline. It stays in your browser and you can erase it at any time from your browser’s site data settings.',
        'Opening a Wikipedia link from an object’s card contacts that site, and only when you click it.'] },
      { id: 'credits', h: 'Engine, data and credits', p: [
        'Positions of the Sun, Moon and planets, sidereal time, eclipses and visibility: Caelis Engine (AGPL-3.0-or-later). The natural satellites of Mars, Jupiter, Saturn, Uranus and Neptune use mean orbital elements from NASA’s Jet Propulsion Laboratory.',
        'Stars, constellations and names: Hipparcos (ESA) through d3-celestial by Olaf Frohn (BSD-3-Clause). Milky Way and Moon textures: NASA (Scientific Visualization Studio, CGI Moon Kit). Earth imagery: NASA Blue Marble, Black Marble and GIBS. Planet textures: NASA and Solar System Scope (CC BY 4.0). Time zones: tz-lookup. Graphics: three.js (MIT). Fonts: SIL Open Font License.',
        `Full texts: ${a(LICENSES, 'third-party licenses')}. “Caelis Engine”, “Caeliscope” and “Hermetica Labs” names and logos are not covered by the code licence. Contact: ${CONTACT}.`] },
      { id: 'controls', h: 'Controls', p: [
        'Drag to look around, wheel or pinch to zoom. Click or tap an object for its card; double-click or T follows it; C centres it; L picks another location.',
        'Time bar: step back or forward 10 min, 1 min or 30 s, run at real time or speed it up, jump to a date, and find the next eclipse or event. Space pauses.',
        'H hides the panels · Z / E / 4 / 6 grids · F full screen · N night mode · Esc closes cards and windows. The text size selector (A A A) and the panel opacity are in Options.'] },
      { id: 'compat', h: 'Compatibility', p: [
        'Any current browser with WebGL 2 and hardware acceleration enabled: Chrome, Edge, Firefox or Safari, on desktop, tablet or phone. A modern integrated or discrete GPU is enough; on weak devices, reduce the window size or the field of view.',
        'It can be installed as an app (PWA) from the browser’s install option, on desktop and mobile, and opens offline after the first visit; only the NASA map detail of the globe needs a connection.',
        'If the page stays black, check that hardware acceleration is on and that WebGL 2 is not blocked.'] },
    ],
  },
  es: {
    title: 'Acerca de Caeliscope',
    close: 'Cerrar',
    contact: 'Contáctanos',
    install: 'Instalar como app',
    altDocs: 'Documentación de Caeliscope',
    community: 'CAELISCOPE PARTNERS, COMMUNITY & RECOGNITION',
    altComm: 'Directorio Caeliscope Partners, Community & Recognition',
    altGO: 'El Gran Observatorio (sitio web)',
    altXerj: 'XERJ Corpus Hub',
    altRepo: 'Caeliscope en GitHub',
    altEngine: 'Caelis Engine en GitHub',
    altHerm: 'Hermetica Labs: construido con Caelis Engine',
    sections: [
      { id: 'what', h: 'Qué es', p: [
        `Caeliscope es una demo técnica: un visor de cielo inmersivo que dibuja el Sol, la Luna, los planetas, sus lunas y las estrellas para cualquier lugar y momento. No calcula nada por sí mismo: cada posición es calculada por ${a(ENGINE_REPO, 'Caelis Engine')}. El visor solo dibuja lo que el motor entrega.`,
        `Código bajo AGPL-3.0-or-later. Versión ${ABOUT_VERSION}.`] },
      { id: 'privacy', h: 'Privacidad y permisos', p: [
        'Tu ubicación se usa solo para calcular y dibujar el cielo en tu propio dispositivo. No se envía a ningún lado: no hay servidor, ni cuentas, ni analítica, ni cookies. La página descarga sus propios archivos estáticos (catálogo de estrellas, texturas, tipografías). La única excepción es el globo: al acercarte pide teselas de imágenes satelitales a NASA GIBS, por lo que los servidores de la NASA reciben tu dirección IP y la zona del mapa que miras, como ocurre con cualquier mapa. Nada más sale de tu dispositivo.',
        'El navegador te pide permiso únicamente si pulsas el botón de usar mi ubicación. También puedes elegir un lugar en el globo o escribir coordenadas, sin compartir nada.',
        'Para recordar tus elecciones entre visitas, Caeliscope usa el almacenamiento local del navegador: idioma, última ubicación del observador, preferencias de interfaz (tamaño de texto, opacidad de paneles, modo nocturno, interruptores), paneles minimizados y posición de las ventanas. Si instalas la app o vuelves a visitarla, también se guarda en la caché del navegador una copia de sus propios archivos para que abra sin conexión. Se queda en tu navegador y puedes borrarlo cuando quieras desde los datos del sitio en la configuración del navegador.',
        'Abrir un enlace a Wikipedia desde la ficha de un objeto contacta ese sitio, y solo si haces clic.'] },
      { id: 'credits', h: 'Motor, datos y créditos', p: [
        'Posiciones del Sol, la Luna y los planetas, tiempo sidéreo, eclipses y visibilidad: Caelis Engine (AGPL-3.0-or-later). Los satélites naturales de Marte, Júpiter, Saturno, Urano y Neptuno usan elementos orbitales medios del Jet Propulsion Laboratory de la NASA.',
        'Estrellas, constelaciones y nombres: Hipparcos (ESA) a través de d3-celestial de Olaf Frohn (BSD-3-Clause). Texturas de la Vía Láctea y la Luna: NASA (Scientific Visualization Studio, CGI Moon Kit). Imágenes de la Tierra: NASA Blue Marble, Black Marble y GIBS. Texturas de planetas: NASA y Solar System Scope (CC BY 4.0). Husos horarios: tz-lookup. Gráficos: three.js (MIT). Tipografías: SIL Open Font License.',
        `Textos completos: ${a(LICENSES, 'licencias de terceros')}. Los nombres y logotipos “Caelis Engine”, “Caeliscope” y “Hermetica Labs” no están cubiertos por la licencia del código. Contacto: ${CONTACT}.`] },
      { id: 'controls', h: 'Controles', p: [
        'Arrastra para mirar alrededor, rueda o pellizco para acercar. Clic o toque en un objeto para ver su ficha; doble clic o T lo sigue; C lo centra; L elige otra ubicación.',
        'Barra de tiempo: avanza o retrocede 10 min, 1 min o 30 s, corre en tiempo real o acelera, salta a una fecha y busca el próximo eclipse o evento. Espacio pausa.',
        'H oculta los paneles · Z / E / 4 / 6 cuadrículas · F pantalla completa · N modo nocturno · Esc cierra fichas y ventanas. El selector de tamaño de texto (A A A) y la opacidad de los paneles están en Opciones.'] },
      { id: 'compat', h: 'Compatibilidad', p: [
        'Cualquier navegador actual con WebGL 2 y aceleración por hardware activada: Chrome, Edge, Firefox o Safari, en escritorio, tableta o teléfono. Basta una GPU moderna, integrada o dedicada; en equipos modestos, reduce el tamaño de la ventana o el campo de visión.',
        'Se puede instalar como app (PWA) desde la opción de instalar del navegador, en escritorio y móvil, y abre sin conexión después de la primera visita; solo el detalle de mapa de la NASA en el globo necesita conexión.',
        'Si la página queda en negro, revisa que la aceleración por hardware esté activa y que WebGL 2 no esté bloqueado.'] },
    ],
  },
};

export function aboutHtml(lang) {
  const A = ABOUT[lang] || ABOUT.en;
  return A.sections.map((s) => `<section><h3>${s.h}</h3>${s.p.map((x) => `<p>${x}</p>`).join('')}</section>`).join('');
}
