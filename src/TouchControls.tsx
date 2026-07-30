import { useRef, useState, type MutableRefObject, type PointerEvent } from 'react'
import * as THREE from 'three'

export type ControlInput = {
  move: { x: number; y: number }
  look: { x: number; y: number }
}

export function TouchControls({ input }: { input: MutableRefObject<ControlInput> }) {
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
  input: MutableRefObject<ControlInput>
  label: string
}) {
  const [thumb, setThumb] = useState({ x: 0, y: 0 })
  const pointerId = useRef<number | null>(null)

  const update = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const radius = rect.width / 2
    const x = THREE.MathUtils.clamp((event.clientX - (rect.left + radius)) / radius, -1, 1)
    const y = THREE.MathUtils.clamp((event.clientY - (rect.top + radius)) / radius, -1, 1)
    setThumb({ x, y })
    if (mode === 'move') input.current.move = { x, y: -y }
    else input.current.look = { x, y }
  }

  const reset = (event: PointerEvent<HTMLDivElement>) => {
    if (pointerId.current !== event.pointerId) return
    pointerId.current = null
    setThumb({ x: 0, y: 0 })
    if (mode === 'move') input.current.move = { x: 0, y: 0 }
    else input.current.look = { x: 0, y: 0 }
  }

  return (
    <div
      className={`joystick ${mode}`}
      data-control={mode}
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
