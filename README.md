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

Production output can be verified with:

```bash
npm run build
npm run preview
```

## Interaction

- Desktop: click **ENTER THE MUSEUM**, then use `WASD` or the arrow keys to move. Click the scene
  to capture the pointer, move the mouse to look, and press `F` when you are near an exhibit.
- Mobile: tap **ENTER THE MUSEUM**, use the left virtual joystick to move and the right pad to look.
  When you are near an exhibit, tap the reading prompt or the scene to open it.
- Reading mode: press `Escape`, click **CLOSE**, or click the backdrop to return to the room.

## Content Model

Exhibits are described by the `exhibits` array in `src/content.tsx`. Each entry owns its label,
title, metadata, wall location, and an HTML article component. `TextureSource` renders that same
article into an offscreen DOM node, rasterizes it with `html2canvas`, and supplies the resulting
`CanvasTexture` to the Three.js wall panel. Reading mode reuses the exact article component as
responsive HTML, so the wall and reader cannot drift apart.

## Architecture

- `src/main.tsx`: React application shell, R3F canvas, scene components, controls, and reading UI.
- `src/content.tsx`: typed exhibit data and the three complete article bodies.
- `src/style.css`: museum UI, responsive reader, and offscreen article styling.
- `src/content.test.tsx`: route and content invariants.

The deployment workflow targets `ubuntu-22.04` runners and publishes the Vite `dist` directory to
GitHub Pages on every push to `main`.
