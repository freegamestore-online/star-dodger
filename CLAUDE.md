# APPNAME

## Platform: FreeGameStore
- Hosted on Cloudflare R2 (static SPA, served by host Worker)
- ONE environment only (production). No dev/staging. Fix forward, no rollbacks.
- Push to `main` auto-deploys to production via R2
- Domain: APPNAME.freegamestore.online

## Tech Stack
- TypeScript, React 19, Vite 8, Tailwind CSS 4, pnpm
- Excalibur.js for 2D rendering, physics and input
- No backend (standalone app) — all data in localStorage
- Must work offline (PWA)

## Engine: Excalibur.js
TypeScript-native, actor-based 2D engine. Game objects are `Actor` subclasses
with typed position/velocity/graphics/collision built in — code reads like
plain OOP classes, not engine callbacks.
- `new Engine({ canvasElement, displayMode: DisplayMode.FillContainer })`
- Entities: `class Player extends Actor { onInitialize(engine) {...} onPreUpdate(engine, delta) {...} }`
- Collisions: set `actor.body.collisionType`; listen with `actor.on("collisionstart", ...)`
- Input: `engine.input.pointers.primary.on("move", ...)`, `engine.input.keyboard`
- Scenes: `game.addScene("level", new MyScene())`, `game.goToScene("level")`
- Dispose the engine in the React cleanup (the template shows the pattern)

## Brand Guidelines
- Fonts: Manrope (body) + Fraunces (display)
- Follow CSS variables in index.css for colors
- Dark mode via prefers-color-scheme (no toggle)

## Rules
- No analytics, no tracking, no cookies
- All user data in localStorage only
- MIT license
