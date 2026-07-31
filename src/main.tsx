import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { createRoot } from 'react-dom/client'
import * as THREE from 'three'
import { exhibits, type Exhibit, type ExhibitId } from './content'
import { ExhibitTextureContent } from './ExhibitTextureContent'
import {
  detectNativeHTMLInCanvas,
  getHTMLInCanvasNotice,
  SharedCanvasHTMLTexture,
  type HTMLInCanvasSupport,
} from './htmlInCanvas'
import { hasFinePointer, useTouchControls } from './inputCapabilities'
import {
  activateCrosshairTarget,
  getCrosshairTarget,
  getNormalizedElementRect,
  resolveCrosshairKeyboardTarget,
  resolveCrosshairPointerIntent,
  type CrosshairTarget,
  type NormalizedRect,
} from './interaction'
import { layoutErrors, museumLayout, resolveAllPlacements, resolveWalkMovement, type ResolvedHangingPoint, type Room, type WallSurface } from './layout'
import { calculateMovementDelta } from './movement'
import { ReadingDialog } from './ReadingDialog'
import { TouchControls, type ControlInput } from './TouchControls'
import './style.css'

type TextureMap = Partial<Record<ExhibitId, THREE.HTMLTexture>>

const initialInput: ControlInput = { move: { x: 0, y: 0 }, look: { x: 0, y: 0 } }
const resolvedPlacements = resolveAllPlacements(museumLayout)

function App() {
  const [started, setStarted] = useState(false)
  const [crosshairTarget, setCrosshairTarget] = useState<CrosshairTarget | null>(null)
  const [readingId, setReadingId] = useState<ExhibitId | null>(null)
  const [textures, setTextures] = useState<TextureMap>({})
  const [htmlInCanvasSupport, setHTMLInCanvasSupport] = useState<HTMLInCanvasSupport | null>(null)
  const input = useRef<ControlInput>(initialInput)
  const githubRectRef = useRef<NormalizedRect | null>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)
  const supportsTouch = useTouchControls()

  const readingExhibit = readingId ? exhibits.find((exhibit) => exhibit.id === readingId) : null
  const aimedExhibit = crosshairTarget
    ? exhibits.find((exhibit) => exhibit.id === crosshairTarget.exhibitId)
    : null

  useEffect(() => {
    if (started) return
    setCrosshairTarget(null)
  }, [started])

  useEffect(() => {
    if (layoutErrors.length > 0) console.error('Museum layout is invalid', layoutErrors)
  }, [])

  const handleTexture = useCallback((id: ExhibitId, texture: THREE.HTMLTexture) => {
    setTextures((current) => ({ ...current, [id]: texture }))
  }, [])

  const handleGithubRect = useCallback((rect: NormalizedRect | null) => {
    githubRectRef.current = rect
  }, [])

  const openReading = useCallback((id: ExhibitId, trigger?: HTMLElement | null) => {
    returnFocusRef.current = trigger ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null)
    setReadingId(id)
    document.exitPointerLock?.()
  }, [])

  const activateTarget = useCallback((target: CrosshairTarget, trigger?: HTMLElement | null) => {
    activateCrosshairTarget(
      target,
      (id) => openReading(id, trigger),
      (url, windowTarget, features) => window.open(url, windowTarget, features),
    )
  }, [openReading])

  const beginVisit = () => {
    setStarted(true)
    if (hasFinePointer(window)) {
      void stageRef.current?.querySelector('canvas')?.requestPointerLock()
    }
  }

  const closeReading = () => {
    setReadingId(null)
    if (hasFinePointer(window)) {
      void stageRef.current?.querySelector('canvas')?.requestPointerLock()
    }
  }

  return (
    <main className={`museum-app ${started ? 'is-started' : ''}`}>
      <div ref={stageRef} className="museum-stage">
        <Canvas
          shadows
          dpr={[1, 2]}
          camera={{ fov: 56, near: 0.1, far: 100, position: [0, 2.2, 12.5] }}
          gl={{ antialias: true, powerPreference: 'high-performance' }}
          tabIndex={0}
          aria-label="Interactive museum scene"
          onCreated={({ camera, gl }) => {
            camera.lookAt(0, 2.1, 4)
            setHTMLInCanvasSupport(detectNativeHTMLInCanvas(gl.domElement, gl.getContext()))
          }}
        >
          <color attach="background" args={['#ede9df']} />
          <fog attach="fog" args={['#ede9df', 25, 72]} />
          <ambientLight intensity={1.5} color="#fffaf0" />
          <hemisphereLight intensity={1.4} color="#fff8e8" groundColor="#b5aa98" />
          <directionalLight
            castShadow
            position={[-8, 13, 9]}
            intensity={3.2}
            color="#fff4d5"
            shadow-mapSize={[1024, 1024]}
          />
          <pointLight position={[0, 6.2, 4]} intensity={4.5} distance={20} color="#f4b26d" />
          <MuseumArchitecture />
          {exhibits.map((exhibit) => (
            <PictureFrame
              key={exhibit.id}
              exhibit={exhibit}
              placement={resolvedPlacements.get(exhibit.id)}
              texture={textures[exhibit.id]}
            />
          ))}
          <WalkController
            active={started && !readingId}
            input={input}
            githubRectRef={githubRectRef}
            onTarget={setCrosshairTarget}
            onActivate={activateTarget}
          />
        </Canvas>

        <header className="site-header">
          <a className="wordmark" href="#top" aria-label="Dino Museum home">
            <span className="wordmark-mark">D</span>
            <span>Dino Museum</span>
          </a>
          <div className="header-meta">
            <span>NIJINZHE / 2025</span>
            <span className="live-dot">OPEN TO VISITORS</span>
          </div>
        </header>

        <div className="scene-labels" aria-hidden="true">
          <span>ROOM 01</span>
          <span>WALK / AIM / ACT</span>
        </div>

        {!started && (
          <section className="welcome-panel" id="top">
            <p className="eyebrow">A WALKABLE PORTFOLIO / ONLINE EXHIBITION</p>
            <h1>
              Field notes
              <br />
              in three dimensions<span className="title-mark">.</span>
            </h1>
            <p className="welcome-copy">
              Enter a small museum of work, writing, and the questions that sit between intelligent
              systems and real space.
            </p>
            <button className="enter-button" type="button" onClick={beginVisit}>
              <span>Enter the museum</span>
              <span className="button-arrow">↗</span>
            </button>
            <div className="welcome-footer">
              <span>THREE.JS / HTML IN CANVAS</span>
              <span>USE WASD OR TOUCH TO WALK</span>
            </div>
          </section>
        )}

        {started && (
          <>
            {!supportsTouch && (
              <div
                className={`crosshair${crosshairTarget ? ` is-${crosshairTarget.action}` : ''}`}
                aria-hidden="true"
              >
                <span />
              </div>
            )}
            <div className="visit-hud">
              <span className="hud-status"><i /> LIVE WALKTHROUGH</span>
              <span className="hud-controls">
                {supportsTouch
                  ? 'LEFT PAD TO MOVE  •  RIGHT PAD TO AIM'
                  : 'WASD TO MOVE  •  MOUSE TO AIM  •  CLICK / F TO ACT'}
              </span>
            </div>
            {crosshairTarget && aimedExhibit && (
              <CrosshairPrompt
                target={crosshairTarget}
                exhibit={aimedExhibit}
                supportsTouch={supportsTouch}
                onActivate={activateTarget}
              />
            )}
            {supportsTouch && <TouchControls input={input} />}
          </>
        )}

        {htmlInCanvasSupport && !htmlInCanvasSupport.supported && (
          <HTMLInCanvasCompatibilityNotice reason={htmlInCanvasSupport.reason} />
        )}

        {htmlInCanvasSupport?.supported && exhibits.map((exhibit) => (
          <TextureSource
            key={exhibit.id}
            exhibit={exhibit}
            onTexture={handleTexture}
            onGithubRect={exhibit.id === 'about' ? handleGithubRect : undefined}
          />
        ))}
      </div>
      {readingExhibit && (
        <ReadingDialog
          exhibit={readingExhibit}
          backgroundRef={stageRef}
          returnFocus={returnFocusRef.current}
          onClose={closeReading}
        />
      )}
    </main>
  )
}

function HTMLInCanvasCompatibilityNotice({ reason }: { reason: Extract<HTMLInCanvasSupport, { supported: false }>['reason'] }) {
  const notice = getHTMLInCanvasNotice(reason)

  return (
    <aside className="html-in-canvas-notice" role="status">
      <strong>{notice.title}</strong>
      <span>{notice.message}</span>
      {notice.flag && <span>Enable <code>{notice.flag}</code> in Chrome.</span>}
    </aside>
  )
}

function CrosshairPrompt({
  target,
  exhibit,
  supportsTouch,
  onActivate,
}: {
  target: CrosshairTarget
  exhibit: Exhibit
  supportsTouch: boolean
  onActivate: (target: CrosshairTarget, trigger?: HTMLElement | null) => void
}) {
  const githubAction = target.action === 'github'
  const content = (
    <>
      <span className="prompt-key">{supportsTouch ? 'TAP' : 'F'}</span>
      <span>
        <strong>{githubAction ? 'Open GitHub' : 'Read exhibit'}</strong>
        <small>{githubAction ? 'NIJINZHE / GITHUB' : exhibit.label}</small>
      </span>
      <span className="prompt-arrow">↗</span>
    </>
  )

  if (!supportsTouch) {
    return (
      <div className={`read-prompt${githubAction ? ' is-github' : ''}`} role="status">
        {content}
      </div>
    )
  }

  return (
    <button
      className={`read-prompt${githubAction ? ' is-github' : ''}`}
      type="button"
      onClick={(event) => onActivate(target, event.currentTarget)}
    >
      {content}
    </button>
  )
}

function TextureSource({
  exhibit,
  onTexture,
  onGithubRect,
}: {
  exhibit: Exhibit
  onTexture: (id: ExhibitId, texture: THREE.HTMLTexture) => void
  onGithubRect?: (rect: NormalizedRect | null) => void
}) {
  const [element] = useState(() => {
    const source = document.createElement('div')
    source.className = 'texture-card'
    source.inert = true
    source.setAttribute('aria-hidden', 'true')
    return source
  })

  useEffect(() => {
    const texture = new SharedCanvasHTMLTexture(element)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.minFilter = THREE.LinearFilter
    texture.magFilter = THREE.LinearFilter
    onTexture(exhibit.id, texture)

    return () => {
      texture.dispose()
      element.remove()
    }
  }, [element, exhibit.id, onTexture])

  useEffect(() => {
    if (!onGithubRect) return
    let frame = 0
    let attempts = 0
    let active = true
    let observedControl: HTMLElement | null = null
    const measure = () => {
      const control = element.querySelector<HTMLElement>('[data-crosshair-action="github"]')
      if (control && control !== observedControl) {
        observedControl = control
        resizeObserver.observe(control)
      }
      const rect = control ? getNormalizedElementRect(element, control) : null
      onGithubRect(rect)
      if (!rect && attempts < 60) {
        attempts += 1
        frame = requestAnimationFrame(measure)
      }
    }
    frame = requestAnimationFrame(measure)
    const resizeObserver = new ResizeObserver(measure)
    resizeObserver.observe(element)
    void document.fonts?.ready.then(() => {
      if (active) measure()
    })
    return () => {
      active = false
      cancelAnimationFrame(frame)
      resizeObserver.disconnect()
      onGithubRect(null)
    }
  }, [element, onGithubRect])

  return createPortal(<ExhibitTextureContent exhibit={exhibit} />, element)
}

function MuseumArchitecture() {
  return (
    <group>
      {museumLayout.rooms.map((room) => <RoomShell key={room.id} room={room} />)}
      {museumLayout.walls.map((wall) => <WallSurfaceMesh key={wall.id} wall={wall} />)}
      <mesh position={[0, -0.12, -8]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[48, 54]} />
        <meshStandardMaterial color="#a39d91" roughness={0.96} />
      </mesh>
      <mesh position={[0, 0.01, -5.2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.5, 42]} />
        <meshBasicMaterial color="#d17d4e" transparent opacity={0.45} />
      </mesh>
      <mesh position={[17, 0.01, -6]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.9, 15]} />
        <meshBasicMaterial color="#d17d4e" transparent opacity={0.28} />
      </mesh>
      {[-2, 3.5, 9, 14.5].map((z) => <CeilingLight key={`entrance-light-${z}`} position={[0, 7.15, z]} width={3.2} />)}
      {[-1, 4.5, 10, 15.5].map((z) => <CeilingLight key={`gallery-light-${z}`} position={[0, 7.55, z - 10]} width={3.8} />)}
      {[-19, -24, -29].map((z) => <CeilingLight key={`archive-light-${z}`} position={[0, 5.68, z]} width={2.5} />)}
      <pointLight position={[0, 4.1, 7]} intensity={5} distance={13} color="#ffc785" />
      <pointLight position={[-7, 3.2, -8]} intensity={3.2} distance={9} color="#f1b275" />
      <pointLight position={[18, 3.2, -6]} intensity={3.2} distance={10} color="#e9a56d" />
    </group>
  )
}

function RoomShell({ room }: { room: Room }) {
  const width = room.bounds.maxX - room.bounds.minX
  const depth = room.bounds.maxZ - room.bounds.minZ
  const centerX = (room.bounds.minX + room.bounds.maxX) / 2
  const centerZ = (room.bounds.minZ + room.bounds.maxZ) / 2
  return (
    <group>
      <mesh position={[centerX, -0.1, centerZ]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial color={room.floorColor} roughness={0.98} />
      </mesh>
      <mesh position={[centerX, room.ceilingHeight, centerZ]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial color="#e7e2d6" roughness={0.93} />
      </mesh>
      <mesh position={[centerX, 0.015, centerZ]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[width * 0.7, depth * 0.84]} />
        <meshStandardMaterial color={room.carpetColor} roughness={1} />
      </mesh>
    </group>
  )
}

function WallSurfaceMesh({ wall }: { wall: WallSurface }) {
  const rotationY = Math.atan2(wall.normal[0], wall.normal[2])
  return (
    <group position={wall.origin} rotation={[0, rotationY, 0]}>
      <mesh position={[0, wall.height / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[wall.width, wall.height, wall.thickness]} />
        <meshStandardMaterial color={wall.style.color} roughness={wall.style.roughness} />
      </mesh>
      <mesh position={[0, 0.24, wall.thickness / 2 + 0.015]}>
        <boxGeometry args={[wall.width - 0.12, 0.18, 0.055]} />
        <meshStandardMaterial color={wall.style.baseboardColor} roughness={0.7} />
      </mesh>
      <mesh position={[0, wall.height - 0.12, wall.thickness / 2 + 0.015]}>
        <boxGeometry args={[wall.width - 0.12, 0.08, 0.045]} />
        <meshBasicMaterial color={wall.style.trimColor} />
      </mesh>
      <mesh position={[0, wall.height * 0.56, wall.thickness / 2 + 0.03]}>
        <boxGeometry args={[wall.width * 0.72, 0.025, 0.025]} />
        <meshBasicMaterial color="#d38b54" transparent opacity={0.42} />
      </mesh>
    </group>
  )
}

function CeilingLight({ position, width }: { position: [number, number, number]; width: number }) {
  return (
    <group position={position}>
      <mesh>
        <boxGeometry args={[width, 0.06, 0.55]} />
        <meshStandardMaterial color="#f4f0df" emissive="#fff0bd" emissiveIntensity={1.4} />
      </mesh>
      <pointLight position={[0, -0.15, 0]} intensity={1.1} distance={7} color="#ffe2a8" />
    </group>
  )
}

function PictureFrame({
  exhibit,
  placement,
  texture,
}: {
  exhibit: Exhibit
  placement?: ResolvedHangingPoint
  texture?: THREE.HTMLTexture
}) {
  if (!placement) return null
  const { frame, position, rotationY } = placement
  const innerWidth = frame.width - frame.border * 2
  const innerHeight = frame.height - frame.border * 2

  return (
    <group
      name={`exhibit-frame:${exhibit.id}`}
      position={position}
      rotation={[0, rotationY, 0]}
      userData={{ exhibitId: exhibit.id }}
    >
      <mesh castShadow>
        <boxGeometry args={[frame.width, frame.height, frame.depth]} />
        <meshStandardMaterial color={frame.material} roughness={0.48} />
      </mesh>
      <mesh
        name={`exhibit-surface:${exhibit.id}`}
        position={[0, 0, frame.depth / 2 + 0.012]}
        userData={{ exhibitId: exhibit.id, interactiveExhibitId: exhibit.id }}
      >
        <planeGeometry args={[innerWidth, innerHeight]} />
        {texture ? (
          <meshBasicMaterial map={texture} toneMapped={false} />
        ) : (
          <meshStandardMaterial color={frame.matColor} roughness={0.75} />
        )}
      </mesh>
      <mesh position={[0, -frame.height / 2 - 0.15, 0.02]}>
        <boxGeometry args={[frame.width * 0.68, 0.05, 0.05]} />
        <meshBasicMaterial color={exhibit.accent} />
      </mesh>
      <mesh position={[0, frame.height / 2 + 0.14, 0.02]}>
        <boxGeometry args={[0.85, 0.06, 0.06]} />
        <meshBasicMaterial color={exhibit.accent} />
      </mesh>
    </group>
  )
}

function WalkController({
  active,
  input,
  githubRectRef,
  onTarget,
  onActivate,
}: {
  active: boolean
  input: React.MutableRefObject<ControlInput>
  githubRectRef: React.MutableRefObject<NormalizedRect | null>
  onTarget: (target: CrosshairTarget | null) => void
  onActivate: (target: CrosshairTarget) => void
}) {
  const { camera, gl, scene } = useThree()
  const keys = useRef(new Set<string>())
  const yaw = useRef(0)
  const pitch = useRef(-0.03)
  const targetRef = useRef<CrosshairTarget | null>(null)
  const suppressNextClick = useRef(false)

  const updateTarget = useCallback((target: CrosshairTarget | null) => {
    const current = targetRef.current
    if (current?.exhibitId === target?.exhibitId && current?.action === target?.action) return
    targetRef.current = target
    onTarget(target)
  }, [onTarget])

  useEffect(() => {
    const setKey = (event: KeyboardEvent, pressed: boolean) => {
      const key = event.key.toLowerCase()
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
        event.preventDefault()
        if (pressed) keys.current.add(key)
        else keys.current.delete(key)
      }
      if (!pressed) return
      const target = resolveCrosshairKeyboardTarget(active, key, event.repeat, targetRef.current)
      if (target) onActivate(target)
    }
    const handleKeyDown = (event: KeyboardEvent) => setKey(event, true)
    const handleKeyUp = (event: KeyboardEvent) => setKey(event, false)
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [active, onActivate])

  useEffect(() => {
    const handlePointerMove = (event: MouseEvent) => {
      if (!active || document.pointerLockElement !== gl.domElement) return
      yaw.current -= event.movementX * 0.0023
      pitch.current = THREE.MathUtils.clamp(pitch.current - event.movementY * 0.0018, -0.72, 0.58)
    }
    const handlePointerDown = (event: PointerEvent) => {
      suppressNextClick.current = false
      const intent = resolveCrosshairPointerIntent({
        active,
        pointerType: event.pointerType,
        button: event.button,
        finePointer: hasFinePointer(window),
        pointerLockElement: document.pointerLockElement,
        canvas: gl.domElement,
        target: targetRef.current,
      })
      if (intent === 'activate' && targetRef.current) {
        return
      }
      if (intent === 'request-pointer-lock') {
        suppressNextClick.current = true
        void gl.domElement.requestPointerLock()
      }
    }
    const handleClick = (event: MouseEvent) => {
      if (suppressNextClick.current) {
        suppressNextClick.current = false
        return
      }
      const intent = resolveCrosshairPointerIntent({
        active,
        pointerType: 'mouse',
        button: event.button,
        finePointer: hasFinePointer(window),
        pointerLockElement: document.pointerLockElement,
        canvas: gl.domElement,
        target: targetRef.current,
      })
      if (intent === 'activate' && targetRef.current) onActivate(targetRef.current)
    }
    window.addEventListener('mousemove', handlePointerMove)
    gl.domElement.addEventListener('pointerdown', handlePointerDown)
    gl.domElement.addEventListener('click', handleClick)
    return () => {
      window.removeEventListener('mousemove', handlePointerMove)
      gl.domElement.removeEventListener('pointerdown', handlePointerDown)
      gl.domElement.removeEventListener('click', handleClick)
    }
  }, [active, gl.domElement, onActivate])

  useEffect(() => {
    if (!active) {
      keys.current.clear()
      input.current.move = { x: 0, y: 0 }
      input.current.look = { x: 0, y: 0 }
      updateTarget(null)
    }
  }, [active, input, updateTarget])

  useFrame((_, delta) => {
    if (!active) return
    const keyX = Number(keys.current.has('d') || keys.current.has('arrowright')) - Number(keys.current.has('a') || keys.current.has('arrowleft'))
    const keyY = Number(keys.current.has('w') || keys.current.has('arrowup')) - Number(keys.current.has('s') || keys.current.has('arrowdown'))
    const moveX = keyX + input.current.move.x
    const moveY = keyY + input.current.move.y
    const lookX = input.current.look.x
    const lookY = input.current.look.y
    yaw.current -= lookX * delta * 1.8
    pitch.current = THREE.MathUtils.clamp(pitch.current - lookY * delta * 1.35, -0.72, 0.58)

    const movement = calculateMovementDelta(yaw.current, moveX, moveY, 4.4 * delta)
    const [nextX, nextZ] = resolveWalkMovement(
      camera.position.x,
      camera.position.z,
      camera.position.x + movement.x,
      camera.position.z + movement.z,
    )
    camera.position.x = nextX
    camera.position.z = nextZ
    camera.position.y = 2.2
    camera.rotation.order = 'YXZ'
    camera.rotation.y = yaw.current
    camera.rotation.x = pitch.current
    camera.updateMatrixWorld()
    updateTarget(getCrosshairTarget(camera, scene, { githubRect: githubRectRef.current }))
  })

  return null
}

createRoot(document.getElementById('app')!).render(<App />)
