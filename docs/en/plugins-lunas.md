---
title: Moon plugins
order: 10
description: How moons are modelled and how to describe a new planet.
---
Moons do not come from the engine: Caeliscope computes them with **plugins**, one per planet. Each plugin starts from the planet's position resolved by Caelis Engine and adds the moons around it.

## Model

The model is a **Hermetica Labs Keplerian propagation** of JPL mean orbital elements (epoch J2000, local Laplace planes). The mean longitude advances with the classical sidereal mean motions, and the node and apsis precess with the periods each moon defines (no secular precession at Uranus and Neptune).

What it delivers and what it does not:

| Yes | No |
|---|---|
| Shape of the configuration, periods and direction of motion | Fine mutual perturbations between moons |
| Transits, occultations, eclipses and shadows on the disc | Arcsecond-level ephemerides of an exact contact |
| Phase and orientation of each moon | Resonances and long-term variations |

At Neptune, Nereid has a very eccentric orbit (e ≈ 0.75) and non-synchronous rotation; its orientation is approximate. Triton is retrograde (inclination ≈ 157°).

## What a plugin defines

A plugin is an object with:

| Field | Content |
|---|---|
| `id` | Plugin identifier (for example `saturn-classical-mean`). |
| `planet` | The planet's key in the engine. |
| `radiusKm`, `flattening`, `pole` | Equatorial radius, flattening and pole (RA, Dec) of the planet. |
| `model` | Text with the model and source; it appears in the JSON. |
| `rings` | Rings, if any (Saturn). |
| `moons` | List of moons. |

And each moon:

| Field | Content |
|---|---|
| `key`, `name` | Internal key and names `{ en, es }`. |
| `meanRadiusKm`, `mag`, `color` | Mean radius, magnitude and drawing color. |
| `elements` | Semi-major axis `a`, eccentricity `e`, argument of periapsis `w`, mean anomaly `M`, inclination `i`, node, sidereal mean motion `nSid`, precession periods and orbital pole. |

Plugins are registered in `src/satellites/index.mjs`. The moons' shapes (each ellipsoid's axes) are in `src/satellites/shape.mjs`.

## Attribution

The mean orbital elements are public JPL data; the computation and implementation are Hermetica Labs'. Full credits are in **About** and in the `THIRD-PARTY-LICENSES` file.
