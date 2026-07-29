# Nijinzhe / Field Notes

An interactive personal exhibition built with Three.js and deployed to GitHub Pages.

## Public Site

<https://nijingzhe.github.io>

Every push to `main` runs `.github/workflows/deploy.yml`, builds the Vite application, and deploys `dist` to GitHub Pages.

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

- Desktop: click **ENTER THE ROOM**, then use `WASD` or the arrow keys to move. Click the scene to capture the pointer, move the mouse to look, and press `F` when the crosshair is over an exhibit.
- Mobile: tap **ENTER THE ROOM**, use the left virtual joystick to move and the right pad to look. When an exhibit is centered, tap the green prompt or the scene to open it.
- Reading mode: press `Escape`, click `CLOSE`, or click the backdrop to return to the room.

## Content Model

Exhibits are described by the `exhibits` array in `src/main.js`. Each entry owns its label, title, subtitle, palette, location, and reading content. The wall mesh uses a canvas texture so the exhibit remains part of the WebGL scene, while reading mode exposes the same content as responsive HTML rich text.
