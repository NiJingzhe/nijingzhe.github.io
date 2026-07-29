import * as THREE from 'three';
import './style.css';

const exhibits = [
  {
    id: 'profile',
    label: 'ABOUT / 01',
    title: 'A small room for serious ideas.',
    subtitle: 'Nijinzhe · ZJU 26 · CUHK MSc AI',
    color: '#d7efdc',
    position: [-7.5, 3.3, -15.85],
    rotation: [0, 0, 0],
    type: 'profile',
  },
  {
    id: 'work',
    label: 'WORK / 02',
    title: 'Interfaces for agents\nthat understand form.',
    subtitle: 'PhyXiForma / CEO',
    color: '#f7c978',
    position: [0, 3.3, -15.85],
    rotation: [0, 0, 0],
    type: 'work',
  },
  {
    id: 'writing',
    label: 'WRITING / 03',
    title: 'Field notes from the\nedge of the interface.',
    subtitle: 'Essays, fragments, working notes',
    color: '#d5d9ff',
    position: [7.5, 3.3, -15.85],
    rotation: [0, 0, 0],
    type: 'writing',
  },
];

const state = {
  activeExhibit: null,
  focusedExhibit: null,
  started: false,
  isMobile: matchMedia('(pointer: coarse)').matches,
  keys: new Set(),
  joystick: { x: 0, y: 0, active: false },
  look: { active: false, lastX: 0, lastY: 0 },
};

const app = document.querySelector('#app');
app.innerHTML = `
  <div class="experience-shell">
    <header class="site-header">
      <a class="wordmark" href="#">N / Z</a>
      <div class="header-meta"><span>PERSONAL EXHIBITION</span><span class="live-dot"></span><span>SHENZHEN · 2024</span></div>
      <button class="menu-button" type="button" aria-label="Open navigation"><span></span><span></span></button>
    </header>

    <main class="scene-wrap" aria-label="Interactive exhibition space">
      <div id="scene-container"></div>
      <div class="scene-vignette"></div>
      <div class="crosshair" aria-hidden="true"><span></span><i></i></div>

      <section class="intro-panel">
        <p class="eyebrow">FIELD NOTES / 001</p>
        <h1>Make space<br /><em>for thinking.</em></h1>
        <p class="intro-copy">An open room for work in progress,<br class="desktop-only" /> research, and unfinished questions.</p>
        <button class="enter-button" type="button"><span>ENTER THE ROOM</span><b>↗</b></button>
      </section>

      <div class="room-index"><span>ROOM 00</span><i></i><span>EXHIBITIONS</span></div>
      <div class="status-line"><span class="status-dot"></span><span id="status-text">ROOM IS QUIET</span></div>
      <div class="desktop-hint"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd><span>MOVE</span><kbd>F</kbd><span>READ</span><kbd>ESC</kbd><span>PAUSE</span></div>

      <div class="mobile-controls" aria-label="Touch controls">
        <div class="joystick" id="joystick"><div class="joystick-knob"></div></div>
        <div class="look-pad" id="look-pad"><span>DRAG<br />TO LOOK</span></div>
      </div>

      <button class="focus-prompt" type="button"><span id="prompt-label">F</span><span id="prompt-copy">FOCUS ON WORK</span></button>
    </main>

    <footer class="site-footer"><span>© 2024 NIJINZHE</span><span class="footer-center">THE ROOM CHANGES WITH THE QUESTIONS</span><span>SCROLL / MOVE TO EXPLORE</span></footer>

    <div class="read-overlay" aria-hidden="true">
      <div class="read-backdrop"></div>
      <article class="reading-card">
        <button class="close-reading" type="button" aria-label="Close reading mode">CLOSE <span>×</span></button>
        <div id="reading-content"></div>
      </article>
    </div>
  </div>
`;

const container = document.querySelector('#scene-container');
const statusText = document.querySelector('#status-text');
const focusPrompt = document.querySelector('.focus-prompt');
const promptLabel = document.querySelector('#prompt-label');
const promptCopy = document.querySelector('#prompt-copy');
const introPanel = document.querySelector('.intro-panel');
const enterButton = document.querySelector('.enter-button');
const readOverlay = document.querySelector('.read-overlay');
const readingContent = document.querySelector('#reading-content');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111312);
scene.fog = new THREE.Fog(0x111312, 8, 30);

const camera = new THREE.PerspectiveCamera(64, innerWidth / innerHeight, 0.1, 60);
camera.position.set(0, 2.1, 7.8);
camera.rotation.order = 'YXZ';

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.85;
container.appendChild(renderer.domElement);

const ambient = new THREE.HemisphereLight(0xa5b9a6, 0x161512, 1.7);
scene.add(ambient);
const sun = new THREE.DirectionalLight(0xf9e3b8, 2.3);
sun.position.set(-6, 11, 7);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -18;
sun.shadow.camera.right = 18;
sun.shadow.camera.top = 18;
sun.shadow.camera.bottom = -18;
scene.add(sun);

const warmLight = new THREE.PointLight(0xffad62, 8, 18, 2);
warmLight.position.set(0, 3, -12);
scene.add(warmLight);
const coolLight = new THREE.PointLight(0x8999ff, 5, 14, 2);
coolLight.position.set(-10, 2, -7);
scene.add(coolLight);

const interactiveMeshes = [];
const exhibitGroups = new Map();

function makeMaterial(color, roughness = 0.78, emissive = 0x000000) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.05, emissive, emissiveIntensity: emissive ? 0.35 : 0 });
}

function addBox(parent, size, position, material, options = {}) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.position.set(...position);
  mesh.castShadow = options.castShadow ?? true;
  mesh.receiveShadow = options.receiveShadow ?? true;
  parent.add(mesh);
  return mesh;
}

function createRoom() {
  const room = new THREE.Group();
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(36, 34), makeMaterial(0x35352f, 0.92));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  room.add(floor);
  const ceiling = addBox(room, [36, 0.2, 34], [0, 7.5, -5], makeMaterial(0x161815, 0.85), { castShadow: false });
  ceiling.receiveShadow = false;
  addBox(room, [36, 7.5, 0.25], [0, 3.75, -18], makeMaterial(0x282a25, 0.88));
  addBox(room, [0.25, 7.5, 34], [-18, 3.75, -5], makeMaterial(0x232521, 0.88));
  addBox(room, [0.25, 7.5, 34], [18, 3.75, -5], makeMaterial(0x232521, 0.88));

  for (let x = -15; x <= 15; x += 3) {
    const line = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.012, 32), makeMaterial(0x8d8770, 0.65));
    line.position.set(x, 0.012, -5);
    room.add(line);
  }
  for (let z = -17; z <= 7; z += 3) {
    const line = new THREE.Mesh(new THREE.BoxGeometry(32, 0.012, 0.012), makeMaterial(0x8d8770, 0.65));
    line.position.set(0, 0.014, z);
    room.add(line);
  }

  const backGlow = new THREE.Mesh(new THREE.PlaneGeometry(15, 6), new THREE.MeshBasicMaterial({ color: 0x465448, transparent: true, opacity: 0.18 }));
  backGlow.position.set(0, 3.4, -17.83);
  room.add(backGlow);

  for (const x of [-14.5, -4.5, 5.5, 14.5]) {
    const pillar = addBox(room, [0.34, 7.4, 0.34], [x, 3.7, -17.3], makeMaterial(0x4f5047, 0.62));
    pillar.castShadow = false;
  }
  createBench(room, [-10.5, 0, -10.5], 0.35);
  createBench(room, [10.5, 0, -10.5], -0.35);
  createBench(room, [0, 0, -4], Math.PI / 2);
  createPlant(room, [-14, 0, -2], 1.4);
  createPlant(room, [14, 0, -2], 1.1);
  scene.add(room);
}

function createBench(parent, position, rotation) {
  const bench = new THREE.Group();
  bench.position.set(...position);
  bench.rotation.y = rotation;
  addBox(bench, [3.2, 0.18, 0.62], [0, 0.9, 0], makeMaterial(0x6e5a3d, 0.72));
  for (const x of [-1.2, 1.2]) addBox(bench, [0.12, 0.9, 0.42], [x, 0.45, 0], makeMaterial(0x4a4031, 0.86));
  parent.add(bench);
}

function createPlant(parent, position, scale) {
  const plant = new THREE.Group();
  plant.position.set(...position);
  plant.scale.setScalar(scale);
  addBox(plant, [0.85, 0.55, 0.85], [0, 0.28, 0], makeMaterial(0x926e4e, 0.8));
  const leafMaterial = makeMaterial(0x60765a, 0.9);
  for (let i = 0; i < 6; i += 1) {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.52, 8, 5), leafMaterial);
    leaf.scale.set(0.55, 1.25, 0.35);
    leaf.position.set(Math.cos(i * 1.05) * 0.36, 1.05 + (i % 2) * 0.2, Math.sin(i * 1.05) * 0.36);
    leaf.rotation.z = (i - 2) * 0.22;
    leaf.castShadow = true;
    plant.add(leaf);
  }
  parent.add(plant);
}

function createExhibit(exhibit) {
  const group = new THREE.Group();
  group.position.set(...exhibit.position);
  group.rotation.set(...exhibit.rotation);
  group.userData.exhibit = exhibit;
  const frameMaterial = makeMaterial(0x847c6a, 0.52);
  const frame = new THREE.Group();
  addBox(frame, [5.9, 0.12, 0.18], [0, 3.1, 0], frameMaterial);
  addBox(frame, [5.9, 0.12, 0.18], [0, -3.1, 0], frameMaterial);
  addBox(frame, [0.12, 6.2, 0.18], [-2.9, 0, 0], frameMaterial);
  addBox(frame, [0.12, 6.2, 0.18], [2.9, 0, 0], frameMaterial);
  group.add(frame);

  const panel = createHtmlPanel(exhibit);
  panel.position.z = -0.11;
  group.add(panel);

  const backing = new THREE.Mesh(new THREE.BoxGeometry(5.72, 5.98, 0.12), makeMaterial(0x1e211d, 0.82));
  backing.position.z = 0.06;
  group.add(backing);

  const marker = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 10), new THREE.MeshBasicMaterial({ color: exhibit.color }));
  marker.position.set(-2.52, 2.72, -0.24);
  group.add(marker);
  const halo = new THREE.PointLight(new THREE.Color(exhibit.color), 1.6, 5, 2);
  halo.position.set(-2.5, 2.7, -0.4);
  group.add(halo);

  panel.userData.exhibit = exhibit;
  interactiveMeshes.push(panel);
  exhibitGroups.set(exhibit.id, group);
  scene.add(group);
}

function createHtmlPanel(exhibit) {
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(5.7, 5.95), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 }));
  const element = document.createElement('div');
  element.className = `exhibit-panel panel-${exhibit.type}`;
  element.innerHTML = getExhibitMarkup(exhibit);
  element.style.width = '570px';
  element.style.height = '595px';
  element.style.transform = 'translate(-50%, -50%)';
  element.style.position = 'absolute';
  element.style.left = '50%';
  element.style.top = '50%';
  element.style.pointerEvents = 'none';
  const texture = new THREE.CanvasTexture(renderPanelCanvas(element, exhibit));
  texture.colorSpace = THREE.SRGBColorSpace;
  panel.material = new THREE.MeshBasicMaterial({ map: texture, transparent: true });
  panel.userData.htmlElement = element;
  return panel;
}

function renderPanelCanvas(element, exhibit) {
  const canvas = document.createElement('canvas');
  canvas.width = 1140;
  canvas.height = 1190;
  const context = canvas.getContext('2d');
  context.fillStyle = exhibit.color;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#161815';
  context.font = '500 27px Arial, sans-serif';
  context.letterSpacing = '4px';
  context.fillText(exhibit.label, 64, 78);
  context.fillStyle = 'rgba(22,24,21,.28)';
  context.fillRect(64, 105, 1012, 2);
  context.fillStyle = '#161815';
  context.font = '700 72px Arial, sans-serif';
  const lines = exhibit.title.split('\n');
  lines.forEach((line, index) => context.fillText(line, 64, 270 + index * 86));
  context.font = '400 27px Arial, sans-serif';
  context.fillText(exhibit.subtitle, 64, 1030);
  context.font = '700 84px Georgia, serif';
  context.globalAlpha = 0.18;
  context.fillText(exhibit.type === 'profile' ? '01' : exhibit.type === 'work' ? '02' : '03', 860, 1090);
  context.globalAlpha = 1;
  return canvas;
}

function getExhibitMarkup(exhibit) {
  const common = `<div class="panel-header"><span>${exhibit.label}</span><span>F TO OPEN</span></div><div class="panel-body"><h2>${exhibit.title.replace('\n', '<br />')}</h2><p>${exhibit.subtitle}</p></div><div class="panel-number">${exhibit.type === 'profile' ? '01' : exhibit.type === 'work' ? '02' : '03'}</div>`;
  return common;
}

function createFloatingDust() {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(220 * 3);
  for (let i = 0; i < 220; i += 1) {
    positions[i * 3] = (Math.random() - 0.5) * 32;
    positions[i * 3 + 1] = Math.random() * 7;
    positions[i * 3 + 2] = Math.random() * 25 - 18;
  }
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  scene.add(new THREE.Points(geometry, new THREE.PointsMaterial({ color: 0xd6c6a3, size: 0.025, transparent: true, opacity: 0.42 })));
}

createRoom();
exhibits.forEach(createExhibit);
createFloatingDust();

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const clock = new THREE.Clock();
let hoveredExhibit = null;
let yaw = 0;
let pitch = -0.035;

function setStarted() {
  if (state.started) return;
  state.started = true;
  introPanel.classList.add('is-hidden');
  statusText.textContent = 'EXPLORE THE ROOM';
  if (!state.isMobile && document.body.requestPointerLock) renderer.domElement.requestPointerLock();
}

function updateCamera() {
  camera.rotation.y = yaw;
  camera.rotation.x = pitch;
}

function handleMovement(delta) {
  if (!state.started || state.activeExhibit) return;
  let forward = 0;
  let right = 0;
  if (state.keys.has('KeyW') || state.keys.has('ArrowUp')) forward += 1;
  if (state.keys.has('KeyS') || state.keys.has('ArrowDown')) forward -= 1;
  if (state.keys.has('KeyD') || state.keys.has('ArrowRight')) right += 1;
  if (state.keys.has('KeyA') || state.keys.has('ArrowLeft')) right -= 1;
  if (state.joystick.active) {
    right += state.joystick.x;
    forward += state.joystick.y;
  }
  const length = Math.hypot(forward, right);
  if (!length) return;
  const speed = (state.isMobile ? 2.8 : 4.4) * delta;
  forward /= Math.max(length, 1);
  right /= Math.max(length, 1);
  const direction = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
  const strafe = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
  camera.position.addScaledVector(direction, -forward * speed);
  camera.position.addScaledVector(strafe, right * speed);
  camera.position.x = THREE.MathUtils.clamp(camera.position.x, -15.7, 15.7);
  camera.position.z = THREE.MathUtils.clamp(camera.position.z, -15.8, 6.5);
  camera.position.y = 2.1;
}

function checkHover() {
  if (!state.started || state.activeExhibit) return;
  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
  const intersections = raycaster.intersectObjects(interactiveMeshes, false);
  const next = intersections.length && intersections[0].distance < 12 ? intersections[0].object.userData.exhibit : null;
  if (next?.id !== hoveredExhibit?.id) {
    hoveredExhibit = next;
    document.body.classList.toggle('is-looking', Boolean(next));
    focusPrompt.classList.toggle('is-visible', Boolean(next));
    if (next) {
      promptLabel.textContent = state.isMobile ? 'TAP' : 'F';
      promptCopy.textContent = `OPEN ${next.label}`;
      statusText.textContent = `LOOKING AT ${next.label}`;
    } else {
      statusText.textContent = 'EXPLORE THE ROOM';
    }
  }
}

function openReading(exhibit = hoveredExhibit) {
  if (!exhibit) return;
  state.activeExhibit = exhibit;
  focusPrompt.classList.remove('is-visible');
  statusText.textContent = `READING ${exhibit.label}`;
  readingContent.innerHTML = getReadingContent(exhibit);
  readOverlay.classList.add('is-open');
  readOverlay.setAttribute('aria-hidden', 'false');
  if (document.pointerLockElement) document.exitPointerLock();
}

function closeReading() {
  state.activeExhibit = null;
  readOverlay.classList.remove('is-open');
  readOverlay.setAttribute('aria-hidden', 'true');
  statusText.textContent = hoveredExhibit ? `LOOKING AT ${hoveredExhibit.label}` : 'EXPLORE THE ROOM';
  if (state.started && !state.isMobile && document.body.requestPointerLock) renderer.domElement.requestPointerLock();
}

function getReadingContent(exhibit) {
  if (exhibit.type === 'profile') return `<p class="reading-kicker">ABOUT / 01</p><h2>Learning to see<br /><em>the whole system.</em></h2><p class="reading-lead">I am Nijinzhe, a builder working at the intersection of physical intelligence, interfaces, and serious 3D assets.</p><div class="reading-columns"><p>My path runs from Zhejiang University to a Master of Science in Artificial Intelligence at CUHK. I care about the gap between what a machine can represent and what a person can actually understand.</p><p>At <strong>PhyXiForma</strong>, I am building tools that make complex forms legible to LM-based agents, so they can reason about the world with more than a flat image of it.</p></div><div class="reading-signoff">N / Z <span>SHENZHEN · 2024</span></div>`;
  if (exhibit.type === 'work') return `<p class="reading-kicker">WORK / 02</p><h2>PhyXiForma<br /><em>in progress.</em></h2><p class="reading-lead">An interface layer for language-model agents to understand and interact with serious 3D assets.</p><div class="work-list"><div><span>01</span><p>Asset understanding<br /><small>Turning geometry into context.</small></p></div><div><span>02</span><p>Agent interaction<br /><small>Giving intent a physical shape.</small></p></div><div><span>03</span><p>Open-ended tools<br /><small>Making the next move visible.</small></p></div></div><div class="reading-signoff">PHY X I FORMA <span>CEO / BUILDER</span></div>`;
  return `<p class="reading-kicker">WRITING / 03</p><h2>Notes from<br /><em>the unfinished.</em></h2><p class="reading-lead">The things I write down while a thought is still changing shape.</p><div class="note-preview"><span>01 / ON MAKING ROOMS</span><p>“A good interface does not hide the complexity. It gives complexity somewhere generous to sit.”</p><span>02 / AGENTS IN SPACE</span><p>What changes when a model can orient itself, not just answer?</p></div><div class="reading-signoff">FIELD NOTES <span>UPDATED AS I GO</span></div>`;
}

function updatePointer(event) {
  if (!state.started || state.activeExhibit || state.isMobile) return;
  if (document.pointerLockElement === renderer.domElement) {
    yaw -= event.movementX * 0.0022;
    pitch -= event.movementY * 0.0022;
  }
}

function setPointerFromEvent(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
}

function bindJoystick() {
  const joystick = document.querySelector('#joystick');
  const knob = joystick.querySelector('.joystick-knob');
  const radius = 42;
  const move = (event) => {
    const touch = event.touches[0];
    if (!touch) return;
    const rect = joystick.getBoundingClientRect();
    const x = touch.clientX - (rect.left + rect.width / 2);
    const y = touch.clientY - (rect.top + rect.height / 2);
    const distance = Math.min(Math.hypot(x, y), radius);
    const angle = Math.atan2(y, x);
    const dx = Math.cos(angle) * distance;
    const dy = Math.sin(angle) * distance;
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    state.joystick.x = dx / radius;
    state.joystick.y = dy / radius;
  };
  const reset = () => {
    state.joystick.active = false;
    state.joystick.x = 0;
    state.joystick.y = 0;
    knob.style.transform = 'translate(0, 0)';
  };
  joystick.addEventListener('touchstart', (event) => { state.joystick.active = true; move(event); }, { passive: true });
  joystick.addEventListener('touchmove', move, { passive: true });
  joystick.addEventListener('touchend', reset, { passive: true });
  joystick.addEventListener('touchcancel', reset, { passive: true });
}

function bindLookPad() {
  const pad = document.querySelector('#look-pad');
  pad.addEventListener('touchstart', (event) => {
    const touch = event.touches[0];
    state.look.active = true;
    state.look.lastX = touch.clientX;
    state.look.lastY = touch.clientY;
  }, { passive: true });
  pad.addEventListener('touchmove', (event) => {
    if (!state.look.active || state.activeExhibit) return;
    const touch = event.touches[0];
    yaw -= (touch.clientX - state.look.lastX) * 0.006;
    pitch -= (touch.clientY - state.look.lastY) * 0.006;
    pitch = THREE.MathUtils.clamp(pitch, -1.35, 1.35);
    state.look.lastX = touch.clientX;
    state.look.lastY = touch.clientY;
  }, { passive: true });
  pad.addEventListener('touchend', () => { state.look.active = false; }, { passive: true });
}

enterButton.addEventListener('click', setStarted);
focusPrompt.addEventListener('click', () => openReading());
document.querySelector('.close-reading').addEventListener('click', closeReading);
document.querySelector('.read-backdrop').addEventListener('click', closeReading);
renderer.domElement.addEventListener('click', () => {
  if (!state.started) return;
  if (!state.isMobile && !document.pointerLockElement && !state.activeExhibit) renderer.domElement.requestPointerLock();
  if (state.isMobile && hoveredExhibit) openReading();
});
renderer.domElement.addEventListener('pointermove', (event) => setPointerFromEvent(event));
document.addEventListener('mousemove', updatePointer);
document.addEventListener('keydown', (event) => {
  state.keys.add(event.code);
  if (event.code === 'KeyF' || event.code === 'Enter') openReading();
  if (event.code === 'Escape' && state.activeExhibit) closeReading();
  if (event.code === 'Escape' && !state.activeExhibit) introPanel.classList.toggle('is-hidden', !state.started);
});
document.addEventListener('keyup', (event) => state.keys.delete(event.code));
document.addEventListener('pointerlockchange', () => {
  document.body.classList.toggle('is-captured', document.pointerLockElement === renderer.domElement);
});
window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

if (state.isMobile) {
  document.querySelector('.desktop-hint').hidden = true;
  bindJoystick();
  bindLookPad();
}

function animate() {
  const delta = Math.min(clock.getDelta(), 0.05);
  handleMovement(delta);
  updateCamera();
  checkHover();
  warmLight.intensity = 7.5 + Math.sin(clock.elapsedTime * 0.7) * 0.45;
  renderer.render(scene, camera);
}

renderer.setAnimationLoop(animate);
