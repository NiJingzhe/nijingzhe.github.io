import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { createRoot } from 'react-dom/client'
import * as THREE from 'three'
import { ExhibitArticle, exhibits, type Exhibit, type ExhibitId } from './content'
import './style.css'

type TextureMap = Partial<Record<ExhibitId, THREE.CanvasTexture>>

type ControlInput = {
  move: { x: number; y: number }
  look: { x: number; y: number }
}

const initialInput: ControlInput = { move: { x: 0, y: 0 }, look: { x: 0, y: 0 } }

function App() {
  const [started, setStarted] = useState(false)
  const [focusedId, setFocusedId] = useState<ExhibitId | null>(null)
  const [readingId, setReadingId] = useState<ExhibitId | null>(null)
  const [textures, setTextures] = useState<TextureMap>({})
  const input = useRef<ControlInput>(initialInput)

  const readingExhibit = readingId ? exhibits.find((exhibit) => exhibit.id === readingId) : null

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setReadingId(null)
        document.exitPointerLock?.()
      }
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [])

  useEffect(() => {
    if (started) return
    setFocusedId(null)
  }, [started])

  const handleTexture = useCallback((id: ExhibitId, texture: THREE.CanvasTexture) => {
    setTextures((current) => ({ ...current, [id]: texture }))
  }, [])

  const openReading = (id: ExhibitId) => {
    setReadingId(id)
    document.exitPointerLock?.()
  }

  const beginVisit = () => {
    setStarted(true)
  }

  return (
    <main className={`museum-app ${started ? 'is-started' : ''}`}>
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ fov: 56, near: 0.1, far: 100, position: [0, 2.2, 13.5] }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        onPointerMissed={() => setFocusedId(null)}
        onCreated={({ camera }) => camera.lookAt(0, 2.1, 8)}
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
        <pointLight position={[0, 6.6, 2]} intensity={6} distance={18} color="#f4b26d" />
        <MuseumArchitecture />
        {exhibits.map((exhibit) => (
          <ExhibitPanel
            key={exhibit.id}
            exhibit={exhibit}
            texture={textures[exhibit.id]}
            focused={focusedId === exhibit.id}
            onRead={openReading}
          />
        ))}
        <WalkController
          active={started && !readingId}
          focusedId={focusedId}
          input={input}
          onFocus={setFocusedId}
          onRead={openReading}
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

      {started && !readingId && (
        <>
          <div className="crosshair" aria-hidden="true">
            <span />
          </div>
          <div className="visit-hud">
            <span className="hud-status"><i /> LIVE WALKTHROUGH</span>
            <span className="hud-controls">WASD / ARROWS TO MOVE&nbsp;&nbsp; • &nbsp;&nbsp;MOUSE TO LOOK</span>
          </div>
          {focusedId && (
            <button className="read-prompt" type="button" onClick={() => openReading(focusedId)}>
              <span className="prompt-key">F</span>
              <span>
                <strong>Read exhibit</strong>
                <small>{exhibits.find((exhibit) => exhibit.id === focusedId)?.label}</small>
              </span>
              <span className="prompt-arrow">↗</span>
            </button>
          )}
          <TouchControls input={input} />
        </>
      )}

      {readingExhibit && (
        <section className="reading-overlay" role="dialog" aria-modal="true" aria-label={readingExhibit.title}>
          <div className="reading-backdrop" onClick={() => setReadingId(null)} />
          <div className="reading-sheet">
            <div className="reading-toolbar">
              <span>{readingExhibit.order} / 03&nbsp;&nbsp; {readingExhibit.label}</span>
              <button type="button" onClick={() => setReadingId(null)}>
                Close <span>Esc</span>
              </button>
            </div>
            <div className="reading-scroll">
              <ExhibitArticle exhibit={readingExhibit} />
            </div>
          </div>
        </section>
      )}

      <div className="texture-sources" aria-hidden="true">
        {exhibits.map((exhibit) => (
          <TextureSource key={exhibit.id} exhibit={exhibit} onTexture={handleTexture} />
        ))}
      </div>
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
    let cancelled = false
    let texture: THREE.CanvasTexture | undefined

    const createTexture = async () => {
      if (!sourceRef.current) return
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
      if (cancelled) return
      texture = new THREE.CanvasTexture(canvas)
      texture.colorSpace = THREE.SRGBColorSpace
      texture.minFilter = THREE.LinearFilter
      texture.magFilter = THREE.LinearFilter
      texture.needsUpdate = true
      onTexture(exhibit.id, texture)
    }

    void createTexture().catch((error: unknown) => {
      if (!cancelled) console.warn(`Could not rasterize ${exhibit.id} exhibit`, error)
    })

    return () => {
      cancelled = true
      texture?.dispose()
    }
  }, [exhibit.id, onTexture])

  return (
    <div ref={sourceRef} className="texture-card">
      <ExhibitArticle exhibit={exhibit} />
    </div>
  )
}

function MuseumArchitecture() {
  const walls = [7, -4, -15, -26, -37].flatMap((z, index) => {
    const direction = index % 2 === 0 ? 1 : -1
    return [
      {
        side: 'left' as const,
        position: [-4.7, 0, z] as [number, number, number],
        angle: direction * -0.1,
        hue: index % 2 === 0 ? '#d7d0c3' : '#dad4c9',
      },
      {
        side: 'right' as const,
        position: [4.7, 0, z] as [number, number, number],
        angle: direction * 0.1,
        hue: index % 2 === 0 ? '#d1d5ca' : '#cfd4ca',
      },
    ]
  })

  return (
    <group>
      <mesh position={[0, -0.12, -12]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[24, 74]} />
        <meshStandardMaterial color="#c7c0b3" roughness={0.92} />
      </mesh>
      <mesh position={[0, 8.1, -12]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[24, 74]} />
        <meshStandardMaterial color="#f5f2e9" roughness={0.9} />
      </mesh>
      <mesh position={[0, 7.72, -12]} rotation={[0, 0, 0]}>
        <boxGeometry args={[0.12, 0.12, 74]} />
        <meshBasicMaterial color="#e5a866" />
      </mesh>
      {walls.map((wall, index) => (
        <PolygonWall key={`${wall.side}-${index}`} {...wall} />
      ))}
      {[5.5, -2.5, -10.5, -18.5, -26.5, -34.5].map((z, index) => (
        <group key={z}>
          <mesh position={[0, 0.015, z]} rotation={[-Math.PI / 2, 0, index % 2 ? 0.04 : -0.04]}>
            <planeGeometry args={[0.18, 4.5]} />
            <meshBasicMaterial color="#dc8a45" transparent opacity={0.78} />
          </mesh>
          <mesh position={[0, 7.55, z]}>
            <boxGeometry args={[2.5, 0.08, 2.8]} />
            <meshBasicMaterial color="#fff7dd" transparent opacity={0.62} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 4, -42]} rotation={[0, 0, 0]}>
        <boxGeometry args={[12, 8, 0.3]} />
        <meshStandardMaterial color="#e0d9cb" roughness={0.86} />
      </mesh>
      <mesh position={[-4.24, 3.6, -42]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[7, 5.2]} />
        <meshBasicMaterial color="#f5bd7e" transparent opacity={0.28} />
      </mesh>
    </group>
  )
}

function PolygonWall({
  side,
  position,
  angle,
  hue,
}: {
  side: 'left' | 'right'
  position: [number, number, number]
  angle: number
  hue: string
}) {
  const shape = useMemo(() => {
    const wallShape = new THREE.Shape()
    wallShape.moveTo(-5.6, 0)
    wallShape.lineTo(5.6, 0)
    wallShape.lineTo(5.6, 4.75)
    wallShape.lineTo(3.9, 5.9)
    wallShape.lineTo(1.3, 5.4)
    wallShape.lineTo(-1.2, 6.05)
    wallShape.lineTo(-3.9, 5.35)
    wallShape.lineTo(-5.6, 5.8)
    wallShape.closePath()
    return wallShape
  }, [])

  return (
    <group position={position} rotation={[0, (side === 'left' ? -Math.PI / 2 : Math.PI / 2) + angle, 0]}>
      <mesh castShadow receiveShadow>
        <extrudeGeometry args={[shape, { depth: 0.56, bevelEnabled: false }]} />
        <meshStandardMaterial color={hue} roughness={0.84} metalness={0.02} />
      </mesh>
      <mesh position={[0, 3.45, -0.31]} rotation={[0, 0, 0]}>
        <planeGeometry args={[10.5, 0.08]} />
        <meshBasicMaterial color="#f0c28c" transparent opacity={0.7} />
      </mesh>
    </group>
  )
}

function ExhibitPanel({
  exhibit,
  texture,
  focused,
  onRead,
}: {
  exhibit: Exhibit
  texture?: THREE.CanvasTexture
  focused: boolean
  onRead: (id: ExhibitId) => void
}) {
  return (
    <group position={exhibit.wallPosition} rotation={[0, exhibit.wallRotation, 0]}>
      <mesh position={[0, 0, -0.16]} castShadow>
        <boxGeometry args={[4.72, 3.72, 0.18]} />
        <meshStandardMaterial color={focused ? '#f5c47d' : '#eee8db'} roughness={0.55} />
      </mesh>
      <mesh
        position={[0, 0, 0.02]}
        onClick={(event) => {
          event.stopPropagation()
          onRead(exhibit.id)
        }}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <planeGeometry args={[4.42, 3.42]} />
        {texture ? (
          <meshBasicMaterial map={texture} toneMapped={false} />
        ) : (
          <meshStandardMaterial color="#fbfaf5" roughness={0.75} />
        )}
      </mesh>
      <mesh position={[0, -2.02, 0]}>
        <boxGeometry args={[3.2, 0.05, 0.05]} />
        <meshBasicMaterial color={exhibit.accent} />
      </mesh>
      <mesh position={[0, 2.02, 0]}>
        <boxGeometry args={[0.85, 0.06, 0.06]} />
        <meshBasicMaterial color={exhibit.accent} />
      </mesh>
      {focused && (
        <mesh position={[0, 0, 0.08]}>
          <planeGeometry args={[4.62, 3.62]} />
          <meshBasicMaterial color={exhibit.accent} transparent opacity={0.08} />
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
}: {
  active: boolean
  focusedId: ExhibitId | null
  input: React.MutableRefObject<ControlInput>
  onFocus: (id: ExhibitId | null) => void
  onRead: (id: ExhibitId) => void
}) {
  const { camera, gl } = useThree()
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
      if (pressed && !event.repeat && key === 'f' && focusedId) onRead(focusedId)
    }
    const handleKeyDown = (event: KeyboardEvent) => setKey(event, true)
    const handleKeyUp = (event: KeyboardEvent) => setKey(event, false)
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [focusedId, onRead])

  useEffect(() => {
    const handlePointerMove = (event: MouseEvent) => {
      if (!active || document.pointerLockElement !== gl.domElement) return
      yaw.current -= event.movementX * 0.0023
      pitch.current = THREE.MathUtils.clamp(pitch.current - event.movementY * 0.0018, -0.72, 0.58)
    }
    const handlePointerDown = () => {
      if (active && window.matchMedia('(pointer: fine)').matches) void gl.domElement.requestPointerLock()
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
    const moveX = keyX || input.current.move.x
    const moveY = keyY || input.current.move.y
    const lookX = input.current.look.x
    const lookY = input.current.look.y
    yaw.current -= lookX * delta * 1.8
    pitch.current = THREE.MathUtils.clamp(pitch.current - lookY * delta * 1.35, -0.72, 0.58)

    const length = Math.hypot(moveX, moveY)
    if (length > 0) {
      const normalizedX = moveX / Math.max(length, 1)
      const normalizedY = moveY / Math.max(length, 1)
      const speed = 4.4 * delta
      camera.position.x += Math.cos(yaw.current) * normalizedX * speed + Math.sin(yaw.current) * normalizedY * speed
      camera.position.z += Math.sin(yaw.current) * normalizedX * speed - Math.cos(yaw.current) * normalizedY * speed
    }
    camera.position.x = THREE.MathUtils.clamp(camera.position.x, -3.8, 3.8)
    camera.position.z = THREE.MathUtils.clamp(camera.position.z, -39, 13.5)
    camera.position.y = 2.2
    camera.rotation.order = 'YXZ'
    camera.rotation.y = yaw.current
    camera.rotation.x = pitch.current

    let nearest: ExhibitId | null = null
    let nearestDistance = 7.2
    for (const exhibit of exhibits) {
      const distance = scratch.set(...exhibit.wallPosition).distanceTo(camera.position)
      if (distance < nearestDistance) {
        nearest = exhibit.id
        nearestDistance = distance
      }
    }
    if (nearest !== focusedId) onFocus(nearest)
  })

  return null
}

function TouchControls({ input }: { input: React.MutableRefObject<ControlInput> }) {
  return (
    <div className="touch-controls" aria-label="Touch controls">
      <JoystickPad mode="move" input={input} label="Move" />
      <JoystickPad mode="look" input={input} label="Look" />
    </div>
  )
}

function JoystickPad({
  mode,
  input,
  label,
}: {
  mode: 'move' | 'look'
  input: React.MutableRefObject<ControlInput>
  label: string
}) {
  const [thumb, setThumb] = useState({ x: 0, y: 0 })
  const pointerId = useRef<number | null>(null)

  const update = (event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const radius = rect.width / 2
    const x = THREE.MathUtils.clamp((event.clientX - (rect.left + radius)) / radius, -1, 1)
    const y = THREE.MathUtils.clamp((event.clientY - (rect.top + radius)) / radius, -1, 1)
    setThumb({ x, y })
    if (mode === 'move') input.current.move = { x, y: -y }
    else input.current.look = { x, y }
  }

  const reset = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (pointerId.current !== event.pointerId) return
    pointerId.current = null
    setThumb({ x: 0, y: 0 })
    if (mode === 'move') input.current.move = { x: 0, y: 0 }
    else input.current.look = { x: 0, y: 0 }
  }

  return (
    <div
      className={`joystick ${mode}`}
      onPointerDown={(event) => {
        pointerId.current = event.pointerId
        event.currentTarget.setPointerCapture(event.pointerId)
        update(event)
      }}
      onPointerMove={(event) => pointerId.current === event.pointerId && update(event)}
      onPointerUp={reset}
      onPointerCancel={reset}
    >
      <span className="joystick-label">{label}</span>
      <span className="joystick-thumb" style={{ transform: `translate(${thumb.x * 24}px, ${thumb.y * 24}px)` }} />
    </div>
  )
}

createRoot(document.getElementById('app')!).render(<App />)
