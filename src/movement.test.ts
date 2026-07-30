import { describe, expect, it } from 'vitest'
import { calculateMovementDelta } from './movement'

const expectDelta = (actual: { x: number; z: number }, x: number, z: number) => {
  expect(actual.x).toBeCloseTo(x, 10)
  expect(actual.z).toBeCloseTo(z, 10)
}

describe('calculateMovementDelta', () => {
  it.each([
    { yaw: 0, forward: [0, -2], right: [2, 0] },
    { yaw: Math.PI / 2, forward: [-2, 0], right: [0, -2] },
    { yaw: -Math.PI / 2, forward: [2, 0], right: [0, 2] },
  ])('uses camera-local forward and right vectors at yaw $yaw', ({ yaw, forward, right }) => {
    expectDelta(calculateMovementDelta(yaw, 0, 1, 2), forward[0], forward[1])
    expectDelta(calculateMovementDelta(yaw, 1, 0, 2), right[0], right[1])
  })

  it('normalizes diagonal input without amplifying speed', () => {
    const movement = calculateMovementDelta(0, 1, 1, 3)
    expect(Math.hypot(movement.x, movement.z)).toBeCloseTo(3, 10)
  })

  it('returns no movement for idle input', () => {
    expect(calculateMovementDelta(Math.PI / 3, 0, 0, 4)).toEqual({ x: 0, z: 0 })
  })
})
