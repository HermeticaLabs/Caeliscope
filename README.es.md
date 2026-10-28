# Caeliscope

[![CI](https://img.shields.io/github/actions/workflow/status/HermeticaLabs/Caeliscope/ci.yml?branch=main&label=CI)](https://github.com/HermeticaLabs/Caeliscope/actions/workflows/ci.yml)
[![demo](https://img.shields.io/badge/demo-live-brightgreen)](https://hermeticalabs.github.io/Caeliscope/)
[![license](https://img.shields.io/badge/license-AGPL--3.0--or--later-orange)](LICENSE)
[![stars](https://img.shields.io/github/stars/HermeticaLabs/Caeliscope?label=stars&color=blue)](https://github.com/HermeticaLabs/Caeliscope/stargazers)
[![powered by](https://img.shields.io/badge/powered%20by-Caelis%20Engine-5edfe5)](https://github.com/hermeticalabs/caelis-engine)
[![node](https://img.shields.io/badge/node-%E2%89%A5%2022-339933)](https://nodejs.org/)

**Visor de cielo inmersivo construido sobre [Caelis Engine](https://github.com/hermeticalabs/caelis-engine). Un technical demo proof de [Hermetica Labs](https://github.com/hermeticalabs).**

Viaja desde el espacio hasta cualquier punto de la Tierra y mira hacia arriba: Sol, Luna, planetas, mÃ¡s de 5.000 estrellas con nombre, la VÃ­a LÃ¡ctea y eclipses solares y lunares, con el cielo iluminado segÃºn la posiciÃ³n real del Sol. Cada posiciÃ³n en pantalla sale de una consulta a Caelis Engine; este repositorio es la capa visual.

> El motor es la estrella. Caeliscope es una de varias demostraciones que muestran los mismos datos deterministas presentados de formas muy distintas.

![Portada de Caeliscope: la Tierra girando tras el logo](docs/img/hero-splash.jpg)

<!-- TODO: agregar un GIF corto del viaje del globo al cielo -->

## GalerÃ­a

| | |
|---|---|
| ![La Luna y la VÃ­a LÃ¡ctea, con una ficha de datos](docs/img/sky-milky-way.jpg) | ![Eclipse solar total con corona](docs/img/solar-eclipse.jpg) |
| Cielo nocturno con la VÃ­a LÃ¡ctea y la ficha de datos de la Luna | Eclipse solar total: corona y cielo oscurecido |
| ![Eclipse lunar parcial siguiendo la trayectoria de la Luna](docs/img/lunar-eclipse.jpg) | ![Constelaciones, nombres y la trayectoria de Betelgeuse](docs/img/constellations.jpg) |
| Eclipse lunar, siguiendo a la Luna por su trayectoria | Constelaciones, cuadrÃ­cula ecuatorial y la trayectoria de una estrella |

## Por quÃ© existe

[Caelis Engine](https://github.com/hermeticalabs/caelis-engine) es un motor de cÃ¡lculo astronÃ³mico determinista en JavaScript, sin dependencias. Una biblioteca se juzga mejor por lo que la gente construye con ella. Caeliscope muestra que una misma instantÃ¡nea del cielo puede alimentar un visor de nivel planetario, sin servidor, sin biblioteca de efemÃ©rides en C y sin ninguna API astronÃ³mica externa.

TambiÃ©n estÃ¡ pensado para leerse: [`docs/GUIDE.md`](docs/GUIDE.md) (en inglÃ©s) explica cÃ³mo pasar de los datos del motor a un cielo en pantalla, para desarrolladores profesionales y aficionados.

Toda posiciÃ³n, distancia, fase y hora que se muestra aquÃ­ sale de [Caelis Engine](https://github.com/hermeticalabs/caelis-engine), la Ãºnica fuente de verdad. Este repositorio solo dibuja lo que el motor calcula.

## Demo en vivo

<!-- TODO: https://hermeticalabs.github.io/Caeliscope/ cuando estÃ© desplegada -->
_PrÃ³ximamente._

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

Otros comandos: `npm run build` (paquete de producciÃ³n en `dist/`), `npm run preview` y `npm test` (pruebas unitarias con el ejecutor integrado de Node).

## CÃ³mo estÃ¡ organizado

| Ruta | Responsabilidad |
|---|---|
| `src/main.mjs` | AplicaciÃ³n: mÃ¡quina de estados, interfaz, una consulta al motor por actualizaciÃ³n |
| `src/sky-math.mjs`, `src/projection.mjs`, `src/stars.mjs` | MatemÃ¡tica pura: marco del observador, proyecciones, rotaciÃ³n de estrellas |
| `src/eclipse.mjs`, `src/magnitudes.mjs`, `src/events.mjs` | Eclipses, magnitudes aparentes, buscador de eventos |
| `src/globe.mjs`, `src/globe-math.mjs`, `src/tiles*.mjs` | Globo terrestre, viaje hasta el suelo, teselas NASA GIBS |
| `src/timeline.mjs`, `src/timezone.mjs` | LÃ­nea de tiempo de la portada, zonas horarias locales reales |
| `src/i18n.mjs` | InglÃ©s y espaÃ±ol: interfaz, astros, constelaciones y nombres de estrellas |
| `src/shaders.mjs` | GLSL para cielo, Sol, Luna, corona y umbra |
| `test/` | Pruebas unitarias de cada mÃ³dulo puro |

Todo lo que se puede calcular sin pantalla es una funciÃ³n pura con pruebas; WebGL solo dibuja lo que esas funciones decidieron.

## Controles

Arrastra para mirar alrededor, rueda o pellizco para el zoom, clic en un objeto para ver su ficha de datos, doble clic o `T` para seguirlo, `C` para centrarlo, `L` para elegir otra ubicaciÃ³n, `H` para ocultar los paneles y `Espacio` para pausar el tiempo. Los paneles permiten viajar en el tiempo (con calendario y botÃ³n Ir), cambiar la proyecciÃ³n, activar cuadrÃ­culas, elegir paisaje, buscar eclipses (solo los visibles desde tu ubicaciÃ³n) y cambiar de idioma (inglÃ©s por defecto, espaÃ±ol disponible).

## Licencia

Caeliscope es software libre bajo la **GNU Affero General Public License v3.0 o posterior** (ver [`LICENSE`](LICENSE)), la misma licencia que Caelis Engine. Si ejecutas una versiÃ³n modificada como servicio de red, debes ofrecer su cÃ³digo fuente a tus usuarios (secciÃ³n 13 de la AGPL); por eso la aplicaciÃ³n enlaza a este repositorio.

Los nombres **Caeliscope**, **Caelis Engine** y **Hermetica Labs** y sus logos son marcas de Hermetica Labs y **no** estÃ¡n licenciados bajo la AGPL; ver [`TRADEMARK.md`](TRADEMARK.md).

Los datos y recursos de terceros (catÃ¡logo estelar, texturas, teselas, tipografÃ­as) conservan sus propias licencias; ver [`NOTICE.md`](NOTICE.md).

## Contribuir

Las issues y los pull requests son bienvenidos; ver [`CONTRIBUTING.md`](CONTRIBUTING.md). Para reportes de seguridad, ver [`SECURITY.md`](SECURITY.md).

English: [`README.md`](README.md)

