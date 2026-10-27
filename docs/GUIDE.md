# From ephemeris to sky: building a spatial view on Caelis Engine

This guide explains what you have to do, step by step, to turn the numbers that [Caelis Engine](https://github.com/hermeticalabs/caelis-engine) produces into a convincing, interactive sky. It is written for professional and hobbyist developers. It is **not** a history of how Caeliscope was made; every section is something you would do in your own project, and each points to the file in this repository where it is done.

You need basic JavaScript and a little trigonometry. WebGL knowledge helps for the later sections but the first half works with a plain 2D canvas.

**The one idea to keep in mind:** the engine answers "where is everything, and what is it like, at this instant for this observer?". Your job is only to *present* that answer. Astronomy stays in the engine; geometry on the screen stays in your code.

---

## 1. Ask the engine one question

All of Caeliscope is driven by one call:

```js
import { CaelisAPI } from './engine/caelis-engine.generated.mjs';
const { getSnapshotAt, deltaT } = CaelisAPI;

const snap = getSnapshotAt(jdTT, latDeg, lonDeg);
```

`getSnapshotAt` returns a snapshot. The parts this viewer relies on:

| Field | Meaning |
|---|---|
| `snap.bodies.Sol`, `.Luna`, `.Mercurio` … | One entry per body |
| `body.alt_apparent_deg`, `body.az_deg` | Where it is in the observer's sky (altitude with refraction, azimuth from North towards East) |
| `body.ra_deg`, `body.dec_deg` | Equatorial coordinates |
| `body.lon_ecl_geocentric_deg`, `body.lat_ecl_geocentric_deg` | Geocentric ecliptic coordinates |
| `body.dist_au` / `body.dist_km` | Distance (AU for the Sun and planets, km for the Moon) |
| `snap.meta.sidereal.lst_deg` | Local apparent sidereal time |
| `snap.meta.jd_tt` | Julian Date in Terrestrial Time |
| `snap.meta.obliquity.true_deg` | True obliquity of the ecliptic |
| `snap.luna` | Lunar extras (phase and so on) |

Check the field names against the documentation of the engine version you use; this table reflects the version bundled in this repository.

**Time.** Caeliscope keeps simulated time as milliseconds since the Unix epoch (UTC), converts to a Julian Date, adds ΔT from the engine, and calls the engine:

```js
const jdUtc = ms / 86400000 + 2440587.5;
const snap  = getSnapshotAt(jdUtc + deltaT(jdUtc) / 86400, lat, lon);   // src/main.mjs, snapAt()
```

Whether your engine version expects UTC or TT is a contract detail: read its docs and convert exactly once. Applying ΔT twice or not at all shifts everything by about a minute of time.

Because the engine is deterministic, the same inputs give the same snapshot on every machine. That is what makes the tests in this repository possible.

## 2. Choose one coordinate system and never leave it

Pick a single convention for the scene and convert everything into it at the edges. Caeliscope uses (see `src/sky-math.mjs`):

- `+x` East, `+y` zenith (up), `−z` North
- azimuth measured from North towards East

```js
export function dirFromAltAz(altDeg, azDeg) {
  const a = altDeg * D2R, z = azDeg * D2R;
  return [Math.cos(a) * Math.sin(z), Math.sin(a), -Math.cos(a) * Math.cos(z)];
}
```

Every body becomes a unit vector with this one function. Angles between two bodies are then a dot product and an `acos`.

Most "it looks mirrored" bugs come from mixing two conventions. Decide early, write it in a comment at the top of the file, and test it with the Sun at local noon (it should be high and in the South in the northern hemisphere).

## 3. Place the Sun, Moon and planets

For the Sun, Moon and planets the engine already gives altitude and azimuth. Convert with `dirFromAltAz` and draw. Two details make them look right:

**Angular size.** Do not draw planets at a fixed size. The Sun's angular radius is `asin(696000 km / distance)`; the Moon's is `asin(1737.4 km / distance)`. The Moon's distance changes by about 12% over a month, and for an observer it also changes with altitude (you are closer to it when it is overhead): see `moonTopoDist()` in `src/eclipse.mjs`.

**Atmospheric reddening.** Near the horizon light passes through more air. `extinction(altDeg)` in `src/sky-math.mjs` uses the Kasten–Young air-mass formula to tint the Sun and Moon, so they redden as they set.

## 4. Draw the stars

Stars barely move, so do not ask the engine for them. Use a catalogue (Caeliscope uses Hipparcos via d3-celestial: RA, Dec, magnitude, B−V colour) in J2000 equatorial coordinates, and rotate the whole catalogue into the observer's frame with **one 3×3 matrix** built from what the engine gives you:

```js
// src/stars.mjs
export function skyRotation(lstDeg, latDeg, T = 0) {
  const L = lstDeg * D2R, f = latDeg * D2R;
  const [sL, cL, sf, cf] = [Math.sin(L), Math.cos(L), Math.sin(f), Math.cos(f)];
  const M = [-sL, cL, 0,   cf*cL, cf*sL, sf,   sf*cL, sf*sL, -cf];
  return mul(M, precessionMatrix(T));
}
```

- `lstDeg` is `snap.meta.sidereal.lst_deg`; this single number is what makes the sky turn.
- `latDeg` is the observer's latitude.
- `T` is Julian centuries since J2000 (`(jd_tt − 2451545) / 36525`); `precessionMatrix` moves J2000 coordinates to the date.

A star at `(ra, dec)` is `equatorialVector(ra, dec)` multiplied by that matrix. On the GPU the matrix is a uniform and every star is transformed in the vertex shader, so thousands of stars cost almost nothing per frame.

**Magnitude to brightness.** Map apparent magnitude to point size and alpha on a logarithmic scale, not linearly: five magnitudes is a factor of 100 in brightness. **B−V to colour:** `bvToRGB()` interpolates blue-white-orange-red; it is subtle but it is what makes Betelgeuse look like Betelgeuse.

## 5. Project the sphere onto a flat screen

You look at the inside of a sphere from its centre, so you need a projection. Caeliscope offers three (`src/projection.mjs`):

| Projection | Behaviour | Use |
|---|---|---|
| Stereographic | Conformal: circles stay circles | Default for immersive views up to 180° |
| Equidistant ("fisheye") | Screen distance proportional to angle | Honest angular distances |
| Rectilinear | Like a camera lens | Narrow fields of view; stretches objects near the edges |

The idea is the same in each: take the angle `θ` between the view direction and the object, compute a radius `r(θ)` on screen, and place the object at that radius in the object's direction.

```
stereographic:  r = 2f·tan(θ/2)     equidistant:  r = f·θ     rectilinear:  r = f·tan(θ)
```

If you choose the rectilinear projection for wide views, objects stretch into ovals towards the edges and the sky feels like you are looking at it from outside a dome; this is the most common reason an otherwise correct sky feels wrong. The same formulas must exist twice: in the shader (to draw) and in JavaScript (to place labels and map clicks back to the sky with `unprojectPx`). Test that `unproject(project(x)) == x`.

## 6. Make the sky colour follow the Sun

You do not need to simulate atmospheric scattering to get a believable sky. Caeliscope keys a palette (zenith colour, horizon colour, glow colour and intensity) on the **Sun's altitude** and interpolates between keys (`skyPalette()` in `src/sky-math.mjs`): deep night below −18°, astronomical, nautical and civil twilight, then day. Two derived values matter:

- the **night factor**, which fades stars in and out (stars vanish when the sky is bright);
- the **glow** near the Sun's azimuth at the horizon, which gives sunsets their direction.

Because the Sun's altitude comes from the engine, the sky is always correct for the chosen time and place.

## 7. Moon phase, orientation and daytime transparency

The Moon needs three things from the engine's numbers: the direction of the Sun (for the lit side), the direction of the celestial pole (to orient the disc), and the camera axes. `moonOrientation()` in `src/sky-math.mjs` returns the light direction on the disc and where lunar north points on screen. This is why the phase is tilted correctly: on the real Moon the bright limb points at the Sun, not "to the right".

For realism in daytime, make the unlit part of the Moon fade into the sky colour instead of drawing a black ball.

## 8. Magnitudes

`src/magnitudes.mjs` computes apparent magnitudes (Sun, Moon, planets, with the Saturn ring tilt) from distances and phase angles, using published formulae. Use them to decide what is visible and how bright to draw it, instead of hard-coding planet brightness.

## 9. Find events by searching the engine

Because the engine is a pure function of time, an "event finder" is just a numerical search over time. `src/events.mjs` takes any function `evalAt(ms)` that returns a snapshot-like object and finds, for example, the next eclipse by:

1. stepping forward in coarse intervals (a day or so) tracking the angular separation of Sun and Moon,
2. when the separation shrinks below a threshold, refining the minimum with a secant method,
3. checking whether the Moon's shadow actually reaches the observer's region.

Keep the search asynchronous (yield to the browser between chunks) so the interface never freezes. You can write the same search for oppositions, conjunctions or equinoxes.

## 10. Eclipses

Eclipses are mostly geometry, which is why they work well on top of the engine:

- **Solar:** compute the topocentric separation of Sun and Moon and the two angular radii; the fraction of the Sun's disc covered (the *obscuration*, `solarObscuration()` in `src/eclipse.mjs`) drives everything else: dimming of the sky, stars appearing, the corona and the diamond-ring effect near totality.
- **Lunar:** the Moon crosses Earth's shadow. Compute how far the Moon is from the shadow axis (opposite the Sun) in kilometres, then colour the disc by how much light Earth's atmosphere refracts into the shadow (a red-orange umbra, with a brightness parameter from the Danjon scale). `umbraLUT()` precomputes this as a lookup texture.

## 11. A globe and a journey (optional, but it changes the feel)

Caeliscope starts from space. The conventions are in `src/globe-math.mjs`: longitude 0 at `+x`, north `+y`, and

```js
latLonToVec(lat, lon) = [cosφ·cosλ, sinφ, −cosφ·sinλ]
```

- The Earth is lit by the real Sun: pass the subsolar point from the engine's Sun position, and the day/night terminator is correct.
- The journey from space to the ground is a camera dolly whose focus slides from the globe's centre to the horizon, hidden by a colour veil that matches the sky colour at the destination (see `journeyPose()` and the timeline in `src/timeline.mjs`).
- Close to the ground, higher-resolution Web-Mercator tiles are loaded on demand (`src/tiles.mjs`, `src/tiles-math.mjs`).

## 12. Test the pure parts

Everything above that does not touch WebGL is a pure function: projections, conversions, rotations, magnitudes, the event search, the timeline. Test them with Node's built-in runner (`node --test`), with a few well-chosen checks:

- project then unproject returns the input;
- a star at the pole does not move when the sidereal time changes;
- the Sun at local noon is due South (northern hemisphere) and high;
- the obscuration of a perfectly centred, equal-size eclipse is 100%.

A visual bug is easy to see and hard to explain; a unit test makes it explainable.

## Common pitfalls

1. **Mixed conventions** (mirrored sky). One convention, converted at the edges.
2. **Time scales.** Convert UTC to TT exactly once.
3. **Time zones.** Keep time in UTC internally and use a real time-zone database for display (Caeliscope uses `tz-lookup` plus `Intl`; never assume the browser's zone).
4. **Fixed-size planets.** Use real angular sizes.
5. **Linear brightness.** Magnitudes are logarithmic.
6. **Drawing the unlit Moon as black in daytime.**
7. **Doing astronomy in the viewer.** If a number can come from the engine, take it from the engine.

## Where to go next

- Start small: a 2D canvas, a stereographic projection, 100 stars and the Sun. Add one feature at a time.
- Read `test/` alongside `src/`: each test file documents what its module promises.
- Open an issue if a step in this guide is unclear; the guide improves with questions.
