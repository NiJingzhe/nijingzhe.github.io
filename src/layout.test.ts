import { describe, expect, it } from 'vitest'
import {
  constrainWalkPosition,
  museumLayout,
  resolveHangingPoint,
  resolveWalkMovement,
  validateMuseumLayout,
} from './layout'

describe('museum layout engine', () => {
  it('resolves a hanging point in front of its wall', () => {
    const resolved = resolveHangingPoint(museumLayout, 'entrance-about')

    expect(resolved.position[0]).toBeCloseTo(-7.61, 2)
    expect(resolved.position[1]).toBe(3.05)
    expect(resolved.position[2]).toBe(9)
    expect(resolved.rotationY).toBeCloseTo(Math.PI / 2)
  })

  it('validates every registered wall, hanging point, and placement', () => {
    expect(validateMuseumLayout(museumLayout)).toEqual([])
  })

  it('rejects a hanging point that would run outside a wall', () => {
    const invalidLayout = {
      ...museumLayout,
      hangingPoints: museumLayout.hangingPoints.map((point) =>
        point.id === 'entrance-about' ? { ...point, offset: 6 } : point,
      ),
    }

    expect(validateMuseumLayout(invalidLayout)).toContain('Hanging point entrance-about is outside wall entrance-west safe bounds')
  })

  it('rejects overlapping hanging points on the same wall', () => {
    const invalidLayout = {
      ...museumLayout,
      hangingPoints: [
        ...museumLayout.hangingPoints,
        { ...museumLayout.hangingPoints[0], id: 'entrance-about-copy', offset: 0.5 },
      ],
    }

    expect(validateMuseumLayout(invalidLayout)).toContain(
      'Hanging points entrance-about and entrance-about-copy overlap on entrance-west',
    )
  })

  it('keeps a visitor inside a room and prevents crossing a wall', () => {
    expect(constrainWalkPosition(30, 30)).toEqual([7.3, 15.3])
    const [x, z] = resolveWalkMovement(0, 12, 0, 18)
    expect(x).toBe(0)
    expect(z).toBeLessThan(16)
  })
})
