# Caeliscope

**Visor de cielo inmersivo construido sobre [Caelis Engine](https://github.com/hermeticalabs/caelis-engine). Un technical demo proof de [Hermetica Labs](https://github.com/hermeticalabs).**

Viaja desde el espacio hasta cualquier punto de la Tierra y mira hacia arriba: Sol, Luna, planetas, más de 5.000 estrellas con nombre, la Vía Láctea y eclipses solares y lunares, con el cielo iluminado según la posición real del Sol. Cada posición en pantalla sale de una consulta a Caelis Engine; este repositorio es la capa visual.

> El motor es la estrella. Caeliscope es una de varias demostraciones que muestran los mismos datos deterministas presentados de formas muy distintas.

![Portada de Caeliscope: la Tierra girando tras el logo](docs/img/hero-splash.jpg)

<!-- TODO: agregar un GIF corto del viaje del globo al cielo -->

## Galería

| | |
|---|---|
| ![La Luna y la Vía Láctea, con una ficha de datos](docs/img/sky-milky-way.jpg) | ![Eclipse solar total con corona](docs/img/solar-eclipse.jpg) |
| Cielo nocturno con la Vía Láctea y la ficha de datos de la Luna | Eclipse solar total: corona y cielo oscurecido |
| ![Eclipse lunar parcial siguiendo la trayectoria de la Luna](docs/img/lunar-eclipse.jpg) | ![Constelaciones, nombres y la trayectoria de Betelgeuse](docs/img/constellations.jpg) |
| Eclipse lunar, siguiendo a la Luna por su trayectoria | Constelaciones, cuadrícula ecuatorial y la trayectoria de una estrella |

## Por qué existe

[Caelis Engine](https://github.com/hermeticalabs/caelis-engine) es un motor de cálculo astronómico determinista en JavaScript, sin dependencias. Una biblioteca se juzga mejor por lo que la gente construye con ella. Caeliscope muestra que una misma instantánea del cielo puede alimentar un visor de nivel planetario, sin servidor, sin biblioteca de efemérides en C y sin ninguna API astronómica externa.

También está pensado para leerse: [`docs/GUIDE.md`](docs/GUIDE.md) (en inglés) explica cómo pasar de los datos del motor a un cielo en pantalla, para desarrolladores profesionales y aficionados.

Toda posición, distancia, fase y hora que se muestra aquí sale de [Caelis Engine](https://github.com/hermeticalabs/caelis-engine), la única fuente de verdad. Este repositorio solo dibuja lo que el motor calcula.

## Demo en vivo

<!-- TODO: https://hermeticalabs.github.io/caeliscope/ cuando esté desplegada -->
_Próximamente._

## Ejecutarlo en local

Requisitos: Node.js 22 o superior.

```bash
git clone https://github.com/hermeticalabs/caeliscope.git
cd caeliscope
npm install
npm run dev        # http://localhost:5173
```

El motor viene dentro del repositorio como `src/engine/caelis-engine.generated.mjs`, una envoltura para navegador de `CaelisEngine.js` (el repositorio del motor no se modifica). Para actualizarlo desde una copia local del motor:

```bash
npm run sync -- "ruta/a/caelis-engine/core/CaelisEngine.js"
npm test
```

Otros comandos: `npm run build` (paquete de producción en `dist/`), `npm run preview` y `npm test` (pruebas unitarias con el ejecutor integrado de Node).

## Cómo está organizado

| Ruta | Responsabilidad |
|---|---|
| `src/main.mjs` | Aplicación: máquina de estados, interfaz, una consulta al motor por actualización |
| `src/sky-math.mjs`, `src/projection.mjs`, `src/stars.mjs` | Matemática pura: marco del observador, proyecciones, rotación de estrellas |
| `src/eclipse.mjs`, `src/magnitudes.mjs`, `src/events.mjs` | Eclipses, magnitudes aparentes, buscador de eventos |
| `src/globe.mjs`, `src/globe-math.mjs`, `src/tiles*.mjs` | Globo terrestre, viaje hasta el suelo, teselas NASA GIBS |
| `src/timeline.mjs`, `src/timezone.mjs` | Línea de tiempo de la portada, zonas horarias locales reales |
| `src/i18n.mjs` | Inglés y español: interfaz, astros, constelaciones y nombres de estrellas |
| `src/shaders.mjs` | GLSL para cielo, Sol, Luna, corona y umbra |
| `test/` | Pruebas unitarias de cada módulo puro |

Todo lo que se puede calcular sin pantalla es una función pura con pruebas; WebGL solo dibuja lo que esas funciones decidieron.

## Controles

Arrastra para mirar alrededor, rueda o pellizco para el zoom, clic en un objeto para ver su ficha de datos, doble clic o `T` para seguirlo, `C` para centrarlo, `L` para elegir otra ubicación, `H` para ocultar los paneles y `Espacio` para pausar el tiempo. Los paneles permiten viajar en el tiempo (con calendario y botón Ir), cambiar la proyección, activar cuadrículas, elegir paisaje, buscar eclipses (solo los visibles desde tu ubicación) y cambiar de idioma (inglés por defecto, español disponible).

## Licencia

Caeliscope es software libre bajo la **GNU Affero General Public License v3.0 o posterior** (ver [`LICENSE`](LICENSE)), la misma licencia que Caelis Engine. Si ejecutas una versión modificada como servicio de red, debes ofrecer su código fuente a tus usuarios (sección 13 de la AGPL); por eso la aplicación enlaza a este repositorio.

Los nombres **Caeliscope**, **Caelis Engine** y **Hermetica Labs** y sus logos son marcas de Hermetica Labs y **no** están licenciados bajo la AGPL; ver [`TRADEMARK.md`](TRADEMARK.md).

Los datos y recursos de terceros (catálogo estelar, texturas, teselas, tipografías) conservan sus propias licencias; ver [`NOTICE.md`](NOTICE.md).

## Contribuir

Las issues y los pull requests son bienvenidos; ver [`CONTRIBUTING.md`](CONTRIBUTING.md). Para reportes de seguridad, ver [`SECURITY.md`](SECURITY.md).

English: [`README.md`](README.md)
