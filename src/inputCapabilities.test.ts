import { describe, expect, it } from 'vitest'
import { hasFinePointer, hasTouchControls } from './inputCapabilities'

function createEnvironment({
  coarse = false,
  fine = false,
  hoverNone = false,
  maxTouchPoints = 0,
}: {
  coarse?: boolean
  fine?: boolean
  hoverNone?: boolean
  maxTouchPoints?: number
}) {
  return {
    navigator: { maxTouchPoints },
    matchMedia(query: string) {
      return {
        matches:
          (query === '(any-pointer: coarse)' && coarse) ||
          (query === '(any-pointer: fine)' && fine) ||
          (query === '(hover: none)' && hoverNone),
      } as MediaQueryList
    },
  }
}

describe('input capabilities', () => {
  it('shows touch controls on wide coarse-pointer devices', () => {
    const tablet = createEnvironment({ coarse: true, hoverNone: true, maxTouchPoints: 5 })
    expect(hasTouchControls(tablet)).toBe(true)
    expect(hasFinePointer(tablet)).toBe(false)
  })

  it('keeps touch controls on hybrid devices with a fine pointer', () => {
    const hybrid = createEnvironment({ coarse: true, fine: true, maxTouchPoints: 10 })
    expect(hasTouchControls(hybrid)).toBe(true)
    expect(hasFinePointer(hybrid)).toBe(true)
  })

  it('does not show touch controls for a narrow fine-pointer-only desktop window', () => {
    const desktop = createEnvironment({ fine: true })
    expect(hasTouchControls(desktop)).toBe(false)
    expect(hasFinePointer(desktop)).toBe(true)
  })
})
