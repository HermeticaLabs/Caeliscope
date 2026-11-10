---
title: Objects and cards
order: 4
description: Searching objects, reading their cards and the engine's live JSON.
---
## Search

The **Search** field in Options finds objects by name: *Moon, Mars, Sirius, Orion…* When you pick one, the view turns toward it. If it is below the horizon, Caeliscope tells you with its altitude.

## The card

Click (or tap) an object to open its card. Depending on the object type, it shows:

| Item | Description |
|---|---|
| Magnitude | Apparent brightness. |
| Apparent diameter | Angular size seen from your location. |
| Distance | From the Earth, and from the Sun for planets. |
| RA/Dec | Right ascension and declination, of date and J2000. |
| Az/Alt | Direction and height above your horizon. |
| Ecliptic | Ecliptic longitude and latitude. |
| Phase and elongation | For the Moon and planets. |
| Status | Above or below the horizon; when it rises and sets. |
| Observation | Whether it needs a telescope. |

Stars also show the B-V index and their Hipparcos catalogue number.

### Card buttons

- **Follow** (`T`): the camera accompanies the object as time runs. Double-click does the same.
- **Zoom in**: zooms until the disc fills a good part of the screen and follows it.
- **Trajectory**: draws its path in its own color. You can turn on several at once. See [Trajectories and geometries](trayectorias-y-geometrias.md).
- **All**: on stars, draws the trails of all bright stars like a long exposure: one click shows them forming live, another the full cycle, another turns them off.
- **Wikipedia**: opens more information about the object on an external site, only if you click.
- **`</>`**: flips the card and shows the engine's JSON (see below).

You can minimize the card or close it (`Esc`).

## Developer view: live JSON

Turn on **Options → Developer view → JSON snapshot**. Every card gains a `</>` button that flips it and shows, live, the JSON Caelis Engine returns for that object at the current instant.

From there you can **Copy** the JSON or **Download .json**. The file includes provenance metadata at the top: engine version, UTC instant, Julian date and ΔT, and the observer's location. See the [JSON reference](json.md).
