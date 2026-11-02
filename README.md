# Caeliscope

[![Live demo](https://img.shields.io/badge/live%20demo-open-5edfe5?style=flat)](https://hermeticalabs.github.io/Caeliscope/)
[![CI](https://github.com/HermeticaLabs/Caeliscope/actions/workflows/ci.yml/badge.svg)](https://github.com/HermeticaLabs/Caeliscope/actions/workflows/ci.yml)
[![License: AGPL v3+](https://img.shields.io/badge/license-AGPL--3.0--or--later-blue.svg)](LICENSE)
[![Powered by Caelis Engine](https://img.shields.io/badge/powered%20by-Caelis%20Engine%204.0.13-dcb450.svg)](https://github.com/HermeticaLabs/caelis-engine)
[![GitHub stars](https://img.shields.io/github/stars/HermeticaLabs/Caeliscope?style=flat)](https://github.com/HermeticaLabs/Caeliscope/stargazers)
[![Node.js 22+](https://img.shields.io/badge/node-%E2%89%A522-339933.svg)](package.json)

**An immersive sky viewer built on [Caelis Engine](https://github.com/HermeticaLabs/caelis-engine). A technical demo proof by [Hermetica Labs](https://github.com/HermeticaLabs).**

Fly from space down to any point on Earth and look up: Sun, Moon, planets, 5,000+ named stars, the Milky Way, solar and lunar eclipses, with the sky shaded by the real position of the Sun. Every position on screen comes from one call to Caelis Engine; this repository is the rendering layer on top.

> The engine is the star. Caeliscope is one of several demo proofs showing the same deterministic data presented in very different ways.

**[Open the live demo →](https://hermeticalabs.github.io/Caeliscope/)**

![Caeliscope splash: the Earth turning behind the logo](docs/img/hero-splash.jpg)

## Gallery

| | |
|---|---|
| ![The Moon and the Milky Way, with a data card](docs/img/sky-milky-way.jpg) | ![Total solar eclipse with corona](docs/img/solar-eclipse.jpg) |
| Night sky with the Milky Way and a data card for the Moon | Total solar eclipse: corona and a darkened sky |
| ![Partial lunar eclipse following the Moon's path](docs/img/lunar-eclipse.jpg) | ![Constellations, names and the path of Betelgeuse](docs/img/constellations.jpg) |
| Lunar eclipse, following the Moon along its path | Constellations, the equatorial grid and a star's trajectory |

## Features

- **Globe to sky journey** over NASA GIBS imagery, then the sky of that exact place, with real local time zones.
- **Time travel**: date and time wheels, a calendar with a "Go" button, speeds from real time to minutes per second, and the day strip.
- **Eclipse and event finder**: next or previous solar eclipse (total, annular, partial) or lunar eclipse **visible from your location**, plus equinoxes, solstices and lunar phases.
- **Trajectories per object**: pick the Sun, the Moon or any of the 7 planets and a range (±12 h, ±3 / ±6 months, synodic cycle, full rosette). Retrograde stretches get their own colour, dates and stations (℞ / D) can be labelled, the Sun has an **analemma**, and a minimizable window draws the geometry (such as Venus's 5-petal rosette) live.
- **Live JSON view**: flip any object card to the exact Caelis Engine snapshot behind it, copy or download it with metadata.
- **Accessibility and comfort**: English / Spanish, three text sizes, adjustable panel opacity, a red **night mode** (`N`), minimizable panels, keyboard shortcuts.

## Why this exists

[Caelis Engine](https://github.com/HermeticaLabs/caelis-engine) is a zero-dependency, deterministic astronomical computation engine in JavaScript. A library is easiest to judge by what people build with it. Caeliscope shows that the same snapshot of the sky can drive a planetarium-grade viewer, with no server, no C ephemeris library and no external astronomy API.

It is also meant to be read: [`docs/GUIDE.md`](docs/GUIDE.md) explains how to go from engine output to an on-screen sky (including turning the engine's angles into a Three.js `Vector3`), for professional and hobbyist developers.

Every position, distance, phase and time shown here comes from [Caelis Engine](https://github.com/HermeticaLabs/caelis-engine), the single source of truth. This repository only draws what the engine computes.

## Run it locally

Requirements: Node.js 22 or newer.

```bash
git clone https://github.com/HermeticaLabs/Caeliscope.git
cd Caeliscope
npm install
npm run dev        # http://localhost:5173
```

The engine ships inside the repo as `src/engine/caelis-engine.generated.mjs`, a browser wrapper around `CaelisEngine.js` (the engine repository is not modified). To update it from a local copy of the engine:

```bash
npm run sync -- "path/to/caelis-engine/core/CaelisEngine.js"
npm test
```

Other commands: `npm run build` (production bundle in `dist/`), `npm run preview`, `npm test` (unit tests, Node's built-in runner). Every push to `main` is built and published to GitHub Pages by `.github/workflows/pages.yml`.

## How it is organised

| Path | Responsibility |
|---|---|
| `src/main.mjs` | Application: state machine, UI, one engine query per update |
| `src/sky-math.mjs`, `src/projection.mjs`, `src/stars.mjs` | Pure math: observer frame, projections, star rotation |
| `src/eclipse.mjs`, `src/magnitudes.mjs`, `src/events.mjs` | Eclipses, apparent magnitudes, event finder |
| `src/trajectory.mjs` | Trajectory ranges, synodic cycles, rosettes, retrograde detection, date labels |
| `src/globe.mjs`, `src/globe-math.mjs`, `src/tiles*.mjs` | Earth globe, journey to the ground, NASA GIBS tiles |
| `src/timeline.mjs`, `src/timezone.mjs` | Splash timeline, real local time zones |
| `src/i18n.mjs`, `src/ui-prefs.mjs`, `src/snapshot-json.mjs` | English / Spanish text, accessibility preferences, JSON export |
| `src/shaders.mjs` | GLSL for sky, Sun, Moon, corona, umbra |
| `test/` | Unit tests for every pure module |

Anything that can be computed without a screen is a pure function with tests; WebGL only draws what those functions decided.

## Controls

Drag to look around, wheel or pinch to zoom, click an object for its data card, double-click or `T` to follow it, `C` to centre it, `L` to choose another location, `H` to hide panels, `N` for night mode, `F` for full screen, `Space` to pause time. The Options panel holds layers, landscape, projection, trajectory range and labels, text size, panel opacity and the event finder.

## License

Caeliscope is free software under the **GNU Affero General Public License v3.0 or later** (see [`LICENSE`](LICENSE)), the same license as Caelis Engine. If you run a modified version as a network service, you must offer its source to your users (AGPL section 13); the app links to this repository for that reason.

The names **Caeliscope**, **Caelis Engine** and **Hermetica Labs** and their logos are trademarks of Hermetica Labs and are **not** licensed under the AGPL; see [`TRADEMARK.md`](TRADEMARK.md).

Third-party data and assets (star catalogue, textures, tiles, fonts) keep their own licenses; see [`NOTICE.md`](NOTICE.md) and [`public/THIRD-PARTY-LICENSES.txt`](public/THIRD-PARTY-LICENSES.txt).

## Contributing

Issues and pull requests are welcome; see [`CONTRIBUTING.md`](CONTRIBUTING.md). For security reports see [`SECURITY.md`](SECURITY.md).

Español: [`README.es.md`](README.es.md)
