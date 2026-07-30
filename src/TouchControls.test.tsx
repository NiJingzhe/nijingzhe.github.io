/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TouchControls, type ControlInput } from './TouchControls'

function firePointerEvent(
  element: HTMLElement,
  type: string,
  { pointerId, clientX = 0, clientY = 0 }: { pointerId: number; clientX?: number; clientY?: number },
) {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperties(event, {
    pointerId: { value: pointerId },
    clientX: { value: clientX },
    clientY: { value: clientY },
  })
  fireEvent(element, event)
}

describe('TouchControls', () => {
  it('tracks move and look pointers concurrently and resets them independently', () => {
    const input: { current: ControlInput } = {
      current: { move: { x: 0, y: 0 }, look: { x: 0, y: 0 } },
    }
    render(<TouchControls input={input} />)

    const move = screen.getByText('Move').parentElement as HTMLDivElement
    const look = screen.getByText('Look').parentElement as HTMLDivElement
    const rect = { left: 0, top: 0, width: 100, height: 100, right: 100, bottom: 100, x: 0, y: 0, toJSON: () => ({}) }
    vi.spyOn(move, 'getBoundingClientRect').mockReturnValue(rect)
    vi.spyOn(look, 'getBoundingClientRect').mockReturnValue(rect)
    move.setPointerCapture = vi.fn()
    look.setPointerCapture = vi.fn()

    firePointerEvent(move, 'pointerdown', { pointerId: 1, clientX: 100, clientY: 50 })
    firePointerEvent(look, 'pointerdown', { pointerId: 2, clientX: 50, clientY: 0 })

    expect(move.setPointerCapture).toHaveBeenCalledWith(1)
    expect(look.setPointerCapture).toHaveBeenCalledWith(2)
    expect(input.current.move).toEqual({ x: 1, y: -0 })
    expect(input.current.look).toEqual({ x: 0, y: -1 })

    firePointerEvent(move, 'pointerup', { pointerId: 1 })
    expect(input.current.move).toEqual({ x: 0, y: 0 })
    expect(input.current.look).toEqual({ x: 0, y: -1 })

    firePointerEvent(look, 'pointercancel', { pointerId: 2 })
    expect(input.current.look).toEqual({ x: 0, y: 0 })
  })
})
