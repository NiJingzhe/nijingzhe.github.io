# Dino Museum / Nijinzhe

An interactive personal exhibition built with React, React Three Fiber, Three.js, and HTML in
Canvas. Visitors walk through a bright, polygonal museum corridor and read the portfolio as
exhibits embedded in the architecture.

## Public Site

<https://nijingzhe.github.io>

Every push to `main` runs `.github/workflows/deploy.yml`, builds the Vite application, and deploys
`dist` to GitHub Pages.

## Local Development

```bash
npm ci
npm run dev
```

Wall exhibits use Chromium's experimental native [HTML-in-Canvas API](https://github.com/WICG/html-in-canvas)
through `THREE.HTMLTexture`. Enable `chrome://flags/#canvas-draw-element` in Chrome before opening
the site. Detection requires both `HTMLCanvasElement.requestPaint` and the 3- or 6-argument
`WebGLRenderingContext.texElementImage2D` contract supported by Three.js 0.185. Chromium builds
with the experiment disabled receive the flag instruction; other browsers receive a browser-specific
compatibility notice instead. There is no screenshot fallback, and the HTML reading dialog remains
available.

Production output can be verified with:

```bash
npm run build
npm run preview
```

## Interaction

- Desktop: click **ENTER THE MUSEUM**, then use `WASD` or the arrow keys to move while pointer lock
  keeps mouse look centered. Aim the crosshair at an exhibit and click or press `F`; empty clicks
  only enter or preserve pointer lock. The About exhibit's GitHub CTA is selected through the same
  center ray rather than a separate DOM cursor mode.
- Touch and hybrid devices: the left virtual joystick moves, the right pad looks, and the reading
  prompt says **TAP**. Controls are selected from pointer capability, not screen width, so tablet
  and landscape-phone layouts remain navigable.
- Reading mode: press `Escape`, click **CLOSE**, or click the backdrop to return to the room. The
  reader keeps keyboard focus inside the dialog, hides the scene from assistive technology, and
  restores focus to the trigger when closed.

## Content Model

Exhibits are described by the `exhibits` array in `src/content.tsx`. Each entry owns its label,
title, metadata, wall location, and an HTML article component. `TextureSource` portals that same
article into an `HTMLTexture` element that Three.js attaches directly to the WebGL canvas. Native
canvas paint events keep the wall texture current without an intermediate bitmap. Reading mode
reuses the exact article component as responsive HTML, so the wall and reader cannot drift apart.
The first-person interaction model raycasts from the camera center into the exhibit surface. The
About exhibit maps the hit UV to the real GitHub link's measured rectangle in the shared article,
so the crosshair can distinguish GitHub from reading without enabling DOM pointer interaction or
duplicating content. Its live pulse and scan line exercise native paint updates; both animations stop
under `prefers-reduced-motion`.

## Architecture

- `src/main.tsx`: React application shell, R3F canvas, scene components, controls, and reading UI.
- `src/content.tsx`: typed exhibit data and the three complete article bodies.
- `src/style.css`: museum UI, responsive reader, and wall article styling.
- `src/content.test.tsx`: route and content invariants.
- `src/movement.ts`: camera-local movement math, with yaw and diagonal-normalization coverage.
- `src/inputCapabilities.ts`: pointer-capability detection for desktop, touch, and hybrid controls.
- `src/interaction.ts`: center-ray target resolution, CTA UV mapping, and unified input actions.
- `src/ReadingDialog.tsx`: modal reader focus management and background isolation.
- `src/htmlInCanvas.ts`: native HTML-in-Canvas capability detection.

The deployment workflow targets `ubuntu-22.04` runners and publishes the Vite `dist` directory to
GitHub Pages on every push to `main`.
