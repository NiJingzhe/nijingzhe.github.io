import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import * as THREE from 'three'
import { ExhibitArticle, exhibits, type Exhibit, type ExhibitId } from './content'
import { hasFinePointer, useTouchControls } from './inputCapabilities'
import { canActivateExhibit } from './interaction'
import { layoutErrors, museumLayout, resolveAllPlacements, resolveWalkMovement, type ResolvedHangingPoint, type Room, type WallSurface } from './layout'
import { calculateMovementDelta } from './movement'
import { ReadingDialog } from './ReadingDialog'
import { TouchControls, type ControlInput } from './TouchControls'
import { createTextureTask } from './textureTask'
import './style.css'

type TextureMap = Partial<Record<ExhibitId, THREE.CanvasTexture>>
type ActivateExhibit = (id: ExhibitId) => boolean

const initialInput: ControlInput = { move: { x: 0, y: 0 }, look: { x: 0, y: 0 } }
const resolvedPlacements = resolveAllPlacements(museumLayout)

function App() {
  const [started, setStarted] = useState(false)
  const [focusedId, setFocusedId] = useState<ExhibitId | null>(null)
  const [readingId, setReadingId] = useState<ExhibitId | null>(null)
  const [textures, setTextures] = useState<TextureMap>({})
  const input = useRef<ControlInput>(initialInput)
  const activationRef = useRef<ActivateExhibit>(() => false)
  const stageRef = useRef<HTMLDivElement>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)
  const supportsTouch = useTouchControls()

  const readingExhibit = readingId ? exhibits.find((exhibit) => exhibit.id === readingId) : null

  useEffect(() => {
    if (started) return
    setFocusedId(null)
  }, [started])

  useEffect(() => {
    if (layoutErrors.length > 0) console.error('Museum layout is invalid', layoutErrors)
  }, [])

  const handleTexture = useCallback((id: ExhibitId, texture: THREE.CanvasTexture) => {
    setTextures((current) => ({ ...current, [id]: texture }))
  }, [])

  const openReading = (id: ExhibitId, trigger?: HTMLElement | null) => {
    returnFocusRef.current = trigger ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null)
    setReadingId(id)
    document.exitPointerLock?.()
  }

  const requestReading = (id: ExhibitId, trigger?: HTMLElement | null) => {
    if (activationRef.current(id)) openReading(id, trigger)
  }

  const beginVisit = () => {
    setStarted(true)
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
          onPointerMissed={() => setFocusedId(null)}
          onCreated={({ camera }) => camera.lookAt(0, 2.1, 4)}
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
              focused={focusedId === exhibit.id}
              onRead={requestReading}
            />
          ))}
          <WalkController
            active={started && !readingId}
            focusedId={focusedId}
            input={input}
            onFocus={setFocusedId}
            onRead={requestReading}
            activationRef={activationRef}
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
          <span>WALK / LOOK / READ</span>
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
            <div className="crosshair" aria-hidden="true">
              <span />
            </div>
            <div className="visit-hud">
              <span className="hud-status"><i /> LIVE WALKTHROUGH</span>
              <span className="hud-controls">
                {supportsTouch ? 'LEFT PAD TO MOVE  •  RIGHT PAD TO LOOK' : 'WASD / ARROWS TO MOVE  •  MOUSE TO LOOK'}
              </span>
            </div>
            {focusedId && (
              <button className="read-prompt" type="button" onClick={(event) => requestReading(focusedId, event.currentTarget)}>
                <span className="prompt-key">{supportsTouch ? 'TAP' : 'F'}</span>
                <span>
                  <strong>Read exhibit</strong>
                  <small>{supportsTouch ? 'TAP TO READ' : exhibits.find((exhibit) => exhibit.id === focusedId)?.label}</small>
                </span>
                <span className="prompt-arrow">↗</span>
              </button>
            )}
            {supportsTouch && <TouchControls input={input} />}
          </>
        )}

        <div className="texture-sources" aria-hidden="true">
          {exhibits.map((exhibit) => (
            <TextureSource key={exhibit.id} exhibit={exhibit} onTexture={handleTexture} />
          ))}
        </div>
      </div>
      {readingExhibit && (
        <ReadingDialog
          exhibit={readingExhibit}
          backgroundRef={stageRef}
          returnFocus={returnFocusRef.current}
          onClose={() => setReadingId(null)}
        />
      )}
    </main>
  )
}

function TextureSource({
  exhibit,
  onTexture,
}: {
  exhibit: Exhibit
  onTexture: (id: ExhibitId, texture: THREE.CanvasTexture) => void
}) {
  const sourceRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const textureTask = createTextureTask(
      async () => {
        if (!sourceRef.current) throw new Error('Texture source did not mount')
        if (document.fonts) await document.fonts.ready
        const { default: html2canvas } = await import('html2canvas')
        const canvas = await html2canvas(sourceRef.current, {
          backgroundColor: '#fbfaf5',
          height: 650,
          scale: 1,
          logging: false,
          useCORS: true,
          width: 840,
        })
        const texture = new THREE.CanvasTexture(canvas)
        texture.colorSpace = THREE.SRGBColorSpace
        texture.minFilter = THREE.LinearFilter
        texture.magFilter = THREE.LinearFilter
        texture.needsUpdate = true
        return texture
      },
      (texture) => onTexture(exhibit.id, texture),
    )

    void textureTask.run().catch((error: unknown) => {
      if (!textureTask.isCancelled()) console.warn(`Could not rasterize ${exhibit.id} exhibit`, error)
    })

    return () => {
      textureTask.cancel()
    }
  }, [exhibit.id, onTexture])

  return (
    <div ref={sourceRef} className="texture-card">
      <ExhibitArticle exhibit={exhibit} />
    </div>
  )
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
  focused,
  onRead,
}: {
  exhibit: Exhibit
  placement?: ResolvedHangingPoint
  texture?: THREE.CanvasTexture
  focused: boolean
  onRead: (id: ExhibitId) => void
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
        <meshStandardMaterial color={focused ? '#f2bd78' : frame.material} roughness={0.48} />
      </mesh>
      <mesh
        name={`exhibit-surface:${exhibit.id}`}
        position={[0, 0, frame.depth / 2 + 0.012]}
        userData={{ exhibitId: exhibit.id, interactiveExhibitId: exhibit.id }}
        onClick={(event) => {
          event.stopPropagation()
          onRead(exhibit.id)
        }}
        onPointerDown={(event) => event.stopPropagation()}
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
      {focused && (
        <mesh position={[0, 0, frame.depth / 2 + 0.02]}>
          <planeGeometry args={[innerWidth + 0.08, innerHeight + 0.08]} />
          <meshBasicMaterial color={exhibit.accent} transparent opacity={0.12} />
        </mesh>
      )}
    </group>
  )
}

function WalkController({
  active,
  focusedId,
  input,
  onFocus,
  onRead,
  activationRef,
}: {
  active: boolean
  focusedId: ExhibitId | null
  input: React.MutableRefObject<ControlInput>
  onFocus: (id: ExhibitId | null) => void
  onRead: (id: ExhibitId) => void
  activationRef: React.MutableRefObject<ActivateExhibit>
}) {
  const { camera, gl, scene } = useThree()
  const keys = useRef(new Set<string>())
  const yaw = useRef(0)
  const pitch = useRef(-0.03)
  const scratch = useMemo(() => new THREE.Vector3(), [])

  useEffect(() => {
    const setKey = (event: KeyboardEvent, pressed: boolean) => {
      const key = event.key.toLowerCase()
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
        event.preventDefault()
        if (pressed) keys.current.add(key)
        else keys.current.delete(key)
      }
      if (active && pressed && !event.repeat && key === 'f' && focusedId) onRead(focusedId)
    }
    const handleKeyDown = (event: KeyboardEvent) => setKey(event, true)
    const handleKeyUp = (event: KeyboardEvent) => setKey(event, false)
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [active, focusedId, onRead])

  useEffect(() => {
    const handlePointerMove = (event: MouseEvent) => {
      if (!active || document.pointerLockElement !== gl.domElement) return
      yaw.current -= event.movementX * 0.0023
      pitch.current = THREE.MathUtils.clamp(pitch.current - event.movementY * 0.0018, -0.72, 0.58)
    }
    const handlePointerDown = (event: PointerEvent) => {
      if (active && event.pointerType === 'mouse' && hasFinePointer(window)) {
        void gl.domElement.requestPointerLock()
      }
    }
    window.addEventListener('mousemove', handlePointerMove)
    gl.domElement.addEventListener('pointerdown', handlePointerDown)
    return () => {
      window.removeEventListener('mousemove', handlePointerMove)
      gl.domElement.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [active, gl.domElement])

  useEffect(() => {
    if (!active) {
      keys.current.clear()
      input.current.move = { x: 0, y: 0 }
      input.current.look = { x: 0, y: 0 }
    }
  }, [active, input])

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

    let nearest: ExhibitId | null = null
    let nearestDistance = Number.POSITIVE_INFINITY
    for (const exhibit of exhibits) {
      const placement = resolvedPlacements.get(exhibit.id)
      if (!placement) continue
      const distance = scratch.set(...placement.position).distanceTo(camera.position)
      const frameObject = scene.getObjectByName(`exhibit-frame:${exhibit.id}`)
      const canFocus = frameObject ? canActivateExhibit(camera, frameObject, scene) : false
      if (canFocus && distance < nearestDistance) {
        nearest = exhibit.id
        nearestDistance = distance
      }
    }
    if (nearest !== focusedId) onFocus(nearest)

    activationRef.current = (id) => {
      const frameObject = scene.getObjectByName(`exhibit-frame:${id}`)
      return frameObject ? canActivateExhibit(camera, frameObject, scene) : false
    }
   })

  return null
}

createRoot(document.getElementById('app')!).render(<App />)
