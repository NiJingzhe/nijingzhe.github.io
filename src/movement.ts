export type MovementDelta = {
  x: number
  z: number
}

export function calculateMovementDelta(
  yaw: number,
  right: number,
  forward: number,
  distance: number,
): MovementDelta {
  const inputLength = Math.hypot(right, forward)
  if (inputLength === 0) return { x: 0, z: 0 }

  const normalization = Math.max(inputLength, 1)
  const normalizedRight = right / normalization
  const normalizedForward = forward / normalization

  return {
    x: (Math.cos(yaw) * normalizedRight - Math.sin(yaw) * normalizedForward) * distance,
    z: (-Math.sin(yaw) * normalizedRight - Math.cos(yaw) * normalizedForward) * distance,
  }
}
