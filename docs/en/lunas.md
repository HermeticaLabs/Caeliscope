---
title: Moons
order: 5
description: Natural satellites of Mars, Jupiter, Saturn, Uranus and Neptune.
---
Caeliscope draws the main moons of the five planets with relevant satellites:

| Planet | Moons |
|---|---|
| Mars | Phobos, Deimos |
| Jupiter | Io, Europa, Ganymede, Callisto |
| Saturn | Mimas, Enceladus, Tethys, Dione, Rhea, Titan |
| Uranus | Miranda, Ariel, Umbriel, Titania, Oberon |
| Neptune | Triton, Nereid |

## How to see them

Turn on **Options → Moons**. Moons appear when you zoom in on their planet, because their angular separation is a few arcseconds. Use **Zoom in** on the planet's card to reach a comfortable view.

Each moon is drawn with its shape (triaxial ellipsoid), its Sun-lit phase and its orientation relative to the planet. They behave as they should: they pass **in front of** the planet (transit), **behind** it (occultation), and darken when they enter its shadow (eclipse). At Saturn, they are also seen behind the rings.

## A moon's card

Click a moon to open its own card, with a portrait showing its shape, phase and orientation as seen from Earth, and the data: magnitude, apparent size, distance from the planet's centre, shape (axes), phase, sub-Earth point, separation, orbital period and its direction (prograde or retrograde), coordinates, status (visible, in transit, behind the planet, in its shadow) and visibility.

## How they are computed

> The moons' positions **do not come from a full ephemeris**. They are mean orbits: JPL mean orbital elements propagated by Hermetica Labs' own Keplerian model.

This gives a coherent shape, period and transits, but it does not reproduce the fine perturbations a numerical ephemeris contains. Use them to understand the geometry and the phenomena, not to predict an exact contact instant. The planet's position is the engine's. More detail in [Moon plugins](plugins-lunas.md).
