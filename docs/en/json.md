---
title: JSON reference
order: 9
description: Structure, fields and units of the live JSON that Caeliscope shows and downloads.
---
The JSON shown by the developer view (and that you can copy or download) always has the same structure of three blocks plus an optional one. It is generated live for the selected object and the shown instant.

```json
{
  "_meta":  { "...": "provenance and context" },
  "object": { "kind": "moon", "id": "Enceladus", "name": "Enceladus" },
  "data":   { "...": "the object's data" },
  "extra":  { "...": "optional" }
}
```

## `_meta`

| Field | Meaning |
|---|---|
| `generated_by`, `app_url` | Application that generated the file (Caeliscope) and its repository. |
| `engine`, `engine_version`, `engine_url` | Caelis Engine and the engine version used. |
| `schema_version` | Version of the data schema the engine returns. |
| `publisher` | Hermetica Labs. |
| `data_origin` | Where the data for this kind of object comes from (engine, star catalogue, or moon plugin over the engine's position). |
| `instant_utc`, `jd_tt`, `delta_t_sec` | Instant in UTC, Julian date in TT and the ΔT used. |
| `observer` | Observer's latitude and longitude in degrees. |
| `rounding` | Moons only: how values are rounded (see below). |

## `object`

| Field | Meaning |
|---|---|
| `kind` | `body` (Sun, Moon, planets), `star` or `moon`. |
| `id` | Identifier in English (`Saturn`, `Enceladus`, `Moon`). |
| `engine_key` | Only when the engine's internal key differs (for example `Saturno`, `Luna`). It is the name under which the engine exposes that body. |
| `name` | Readable name in English. |

JSON identifiers are always in English, to ease use from other systems. Translation belongs to the interface, not to the data.

## `data`

- **Bodies** (`body`): the object exactly as returned by Caelis Engine's `getSnapshotAt()`, unmodified.
- **Stars** (`star`): `ra_j2000_deg`, `dec_j2000_deg`, `magnitude`, `bv_index`, `hip`, `az_deg`, `alt_geometric_deg` and `lst_deg`. Horizontal coordinates are computed in Caeliscope from the engine's sidereal time.
- **Moons** (`moon`):

| Field | Unit | Meaning |
|---|---|---|
| `planet`, `planet_engine_key` | | Planet, in English and with the engine's key. |
| `east_arcsec`, `north_arcsec` | arcsec | Position relative to the planet's centre (celestial east and north). |
| `separation_arcsec` | arcsec | Angular separation from the planet's centre. |
| `position_km` | km | Position `[x, y, z]` relative to the planet. |
| `transit`, `occulted` | boolean | Passes in front of the planet's disc; is behind the planet. |
| `in_planet_shadow` | boolean | Is inside the planet's shadow. |
| `shadow_on_disc` | boolean | Its shadow falls on the planet's disc. |
| `behind_rings_opacity` | 0–1 | How much the rings cover the moon (Saturn). |
| `mean_radius_km`, `magnitude` | km, mag | Mean radius and magnitude. |
| `orbit` | | The mean orbital elements used. |

In the JSON of a planet with moons, `extra.satellites` lists each moon with its English `id` and the same position and state fields.

## Rounding

Moon offsets and separations are rounded to 0.001 arcsec and distances to whole kilometres. JSON does not write trailing zeros, so `-3.000` appears as `-3`: it is the same number, not a loss of precision.

## Determinism

For the same instant and the same location, the JSON is the same: Caelis Engine is deterministic and Caeliscope adds no randomness. This lets you reproduce any capture.
