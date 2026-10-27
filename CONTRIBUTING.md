# Contributing

Thanks for helping. Caeliscope is a demo proof for Caelis Engine, so the priorities are correctness, readability and keeping the engine as the single source of astronomical truth.

## Ground rules
- **Astronomy comes from the engine.** Do not add ephemeris math to the viewer. Presentation math (projections, shading, geometry on the screen) belongs here.
- **Pure first.** If something can be a pure function, put it in its own module with a test in `test/`. WebGL code only draws.
- **No new runtime dependencies** without a clear reason; the dependency list is deliberately short.
- Keep UI text in Spanish or add proper i18n; do not mix languages in one string.

## Workflow
1. Open an issue to discuss anything bigger than a small fix.
2. Fork, create a branch, make the change.
3. Run `npm test` and `npm run build`; both must pass.
4. Open a pull request using the template.

By contributing you agree that your contribution is licensed under AGPL-3.0-or-later, like the rest of the project. Do not use the project names or logos in forks (see `TRADEMARK.md`).
