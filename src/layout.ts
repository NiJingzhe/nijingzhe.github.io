export type Vec3 = readonly [number, number, number]

export type RoomBounds = {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

export type Room = {
  id: string
  name: string
  bounds: RoomBounds
  ceilingHeight: number
  floorColor: string
  wallColor: string
  carpetColor: string
}

export type WallStyle = {
  color: string
  roughness: number
  trimColor: string
  baseboardColor: string
}

export type WallSurface = {
  id: string
  roomId: string
  origin: Vec3
  tangent: Vec3
  normal: Vec3
  width: number
  height: number
  thickness: number
  style: WallStyle
}

export type FrameSpec = {
  width: number
  height: number
  border: number
  depth: number
  material: string
  matColor: string
}

export type HangingPoint = {
  id: string
  wallId: string
  offset: number
  elevation: number
  frame: FrameSpec
}

export type ExhibitPlacement = {
  exhibitId: string
  hangingPointId: string
}

export type MuseumLayout = {
  rooms: Room[]
  walls: WallSurface[]
  hangingPoints: HangingPoint[]
  placements: ExhibitPlacement[]
}

export type ResolvedHangingPoint = HangingPoint & {
  wall: WallSurface
  position: Vec3
  rotationY: number
}

const plasterStyle: WallStyle = {
  color: '#d9d3c6',
  roughness: 0.9,
  trimColor: '#b8af9e',
  baseboardColor: '#8f897f',
}

const fadedStyle: WallStyle = {
  color: '#cfcdbf',
  roughness: 0.94,
  trimColor: '#aaa89d',
  baseboardColor: '#817f78',
}

const archiveStyle: WallStyle = {
  color: '#c6c2b4',
  roughness: 0.96,
  trimColor: '#99968b',
  baseboardColor: '#706f6a',
}

export const museumLayout: MuseumLayout = {
  rooms: [
    {
      id: 'entrance',
      name: 'Arrival Hall',
      bounds: { minX: -8, maxX: 8, minZ: 2, maxZ: 16 },
      ceilingHeight: 7.4,
      floorColor: '#b7ae9f',
      wallColor: '#dcd6c9',
      carpetColor: '#a29b8f',
    },
    {
      id: 'gallery',
      name: 'Main Gallery',
      bounds: { minX: -11, maxX: 11, minZ: -16, maxZ: 4 },
      ceilingHeight: 7.8,
      floorColor: '#aaa398',
      wallColor: '#dad4c8',
      carpetColor: '#9a9489',
    },
    {
      id: 'side-room',
      name: 'Side Room',
      bounds: { minX: 11, maxX: 23, minZ: -14, maxZ: 2 },
      ceilingHeight: 7.1,
      floorColor: '#aaa79b',
      wallColor: '#d1cbbf',
      carpetColor: '#918f87',
    },
    {
      id: 'archive',
      name: 'Low Archive',
      bounds: { minX: -8, maxX: 8, minZ: -33, maxZ: -16 },
      ceilingHeight: 5.9,
      floorColor: '#928e84',
      wallColor: '#c7c2b4',
      carpetColor: '#7d7972',
    },
  ],
  walls: [
    // Arrival Hall: open toward the gallery, with two long, calm planes.
    { id: 'entrance-west', roomId: 'entrance', origin: [-8, 0, 9], tangent: [0, 0, 1], normal: [1, 0, 0], width: 14, height: 5.6, thickness: 0.42, style: plasterStyle },
    { id: 'entrance-east', roomId: 'entrance', origin: [8, 0, 9], tangent: [0, 0, 1], normal: [-1, 0, 0], width: 14, height: 5.6, thickness: 0.42, style: plasterStyle },
    { id: 'entrance-north', roomId: 'entrance', origin: [0, 0, 16], tangent: [1, 0, 0], normal: [0, 0, -1], width: 16, height: 5.6, thickness: 0.42, style: fadedStyle },

    // Main Gallery: the east wall is split to leave a generous side-room opening.
    { id: 'gallery-west', roomId: 'gallery', origin: [-11, 0, -6], tangent: [0, 0, 1], normal: [1, 0, 0], width: 20, height: 5.6, thickness: 0.42, style: plasterStyle },
    { id: 'gallery-east-north', roomId: 'gallery', origin: [11, 0, 0], tangent: [0, 0, 1], normal: [-1, 0, 0], width: 8, height: 5.6, thickness: 0.42, style: plasterStyle },
    { id: 'gallery-east-south', roomId: 'gallery', origin: [11, 0, -14], tangent: [0, 0, 1], normal: [-1, 0, 0], width: 4, height: 5.6, thickness: 0.42, style: plasterStyle },
     { id: 'gallery-back-west', roomId: 'gallery', origin: [-4.7, 0, -16], tangent: [1, 0, 0], normal: [0, 0, 1], width: 4.6, height: 5.6, thickness: 0.42, style: fadedStyle },
     { id: 'gallery-back-east', roomId: 'gallery', origin: [4.7, 0, -16], tangent: [1, 0, 0], normal: [0, 0, 1], width: 4.6, height: 5.6, thickness: 0.42, style: fadedStyle },
    { id: 'gallery-island', roomId: 'gallery', origin: [-1, 0, -6], tangent: [0, 0, 1], normal: [1, 0, 0], width: 7, height: 5.2, thickness: 0.38, style: fadedStyle },

    // Side Room: a branch with a different ceiling rhythm and a blind back wall.
    { id: 'side-east', roomId: 'side-room', origin: [23, 0, -6], tangent: [0, 0, 1], normal: [-1, 0, 0], width: 16, height: 5.4, thickness: 0.42, style: plasterStyle },
    { id: 'side-north', roomId: 'side-room', origin: [17, 0, 2], tangent: [1, 0, 0], normal: [0, 0, -1], width: 12, height: 5.4, thickness: 0.42, style: fadedStyle },
    { id: 'side-south', roomId: 'side-room', origin: [17, 0, -14], tangent: [1, 0, 0], normal: [0, 0, 1], width: 12, height: 5.4, thickness: 0.42, style: fadedStyle },

    // Low Archive: the back room is deliberately compressed and quiet.
    { id: 'archive-west', roomId: 'archive', origin: [-8, 0, -24.5], tangent: [0, 0, 1], normal: [1, 0, 0], width: 17, height: 4.8, thickness: 0.42, style: archiveStyle },
    { id: 'archive-east', roomId: 'archive', origin: [8, 0, -24.5], tangent: [0, 0, 1], normal: [-1, 0, 0], width: 17, height: 4.8, thickness: 0.42, style: archiveStyle },
    { id: 'archive-back', roomId: 'archive', origin: [0, 0, -33], tangent: [1, 0, 0], normal: [0, 0, 1], width: 16, height: 4.8, thickness: 0.42, style: archiveStyle },
  ],
  hangingPoints: [
    {
      id: 'entrance-about',
      wallId: 'entrance-west',
      offset: 0,
      elevation: 3.05,
      frame: { width: 4.9, height: 3.9, border: 0.2, depth: 0.2, material: '#8f4c32', matColor: '#f5eee0' },
    },
    {
      id: 'gallery-work',
      wallId: 'gallery-west',
      offset: 1.5,
      elevation: 3.05,
      frame: { width: 4.9, height: 3.9, border: 0.2, depth: 0.2, material: '#3f6257', matColor: '#f0eee5' },
    },
    {
      id: 'side-writing',
      wallId: 'side-north',
      offset: -1.3,
      elevation: 2.85,
      frame: { width: 4.9, height: 3.9, border: 0.2, depth: 0.2, material: '#824548', matColor: '#f4ece2' },
    },
  ],
  placements: [
    { exhibitId: 'about', hangingPointId: 'entrance-about' },
    { exhibitId: 'work', hangingPointId: 'gallery-work' },
    { exhibitId: 'writing', hangingPointId: 'side-writing' },
  ],
}

function vectorLength([x, y, z]: Vec3): number {
  return Math.hypot(x, y, z)
}

function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

export function resolveHangingPoint(layout: MuseumLayout, pointId: string): ResolvedHangingPoint {
  const point = layout.hangingPoints.find((item) => item.id === pointId)
  if (!point) throw new Error(`Unknown hanging point: ${pointId}`)
  const wall = layout.walls.find((item) => item.id === point.wallId)
  if (!wall) throw new Error(`Hanging point ${pointId} references unknown wall ${point.wallId}`)

  const tangentLength = vectorLength(wall.tangent)
  const normalLength = vectorLength(wall.normal)
  if (Math.abs(tangentLength - 1) > 0.001 || Math.abs(normalLength - 1) > 0.001) {
    throw new Error(`Wall ${wall.id} tangent and normal must be normalized`)
  }

  const frontOffset = wall.thickness / 2 + point.frame.depth / 2 + 0.08
  return {
    ...point,
    wall,
    position: [
      wall.origin[0] + wall.tangent[0] * point.offset + wall.normal[0] * frontOffset,
      point.elevation,
      wall.origin[2] + wall.tangent[2] * point.offset + wall.normal[2] * frontOffset,
    ],
    rotationY: Math.atan2(wall.normal[0], wall.normal[2]),
  }
}

export function validateMuseumLayout(layout: MuseumLayout): string[] {
  const errors: string[] = []
  const wallIds = new Set<string>()
  const pointIds = new Set<string>()
  const roomIds = new Set(layout.rooms.map((room) => room.id))

  for (const wall of layout.walls) {
    if (wallIds.has(wall.id)) errors.push(`Duplicate wall id: ${wall.id}`)
    wallIds.add(wall.id)
    if (!roomIds.has(wall.roomId)) errors.push(`Wall ${wall.id} references unknown room ${wall.roomId}`)
    if (Math.abs(vectorLength(wall.tangent) - 1) > 0.001) errors.push(`Wall ${wall.id} tangent is not normalized`)
    if (Math.abs(vectorLength(wall.normal) - 1) > 0.001) errors.push(`Wall ${wall.id} normal is not normalized`)
    if (Math.abs(dot(wall.tangent, wall.normal)) > 0.001) errors.push(`Wall ${wall.id} tangent and normal are not perpendicular`)
  }

  for (const point of layout.hangingPoints) {
    if (pointIds.has(point.id)) errors.push(`Duplicate hanging point id: ${point.id}`)
    pointIds.add(point.id)
    const wall = layout.walls.find((item) => item.id === point.wallId)
    if (!wall) continue
    const safeHalfWidth = wall.width / 2 - point.frame.width / 2 - 0.45
    if (Math.abs(point.offset) > safeHalfWidth) errors.push(`Hanging point ${point.id} is outside wall ${wall.id} safe bounds`)
    if (point.elevation - point.frame.height / 2 < 0.6) errors.push(`Hanging point ${point.id} is too low`)
    if (point.elevation + point.frame.height / 2 > wall.height - 0.45) errors.push(`Hanging point ${point.id} is too high`)
  }

  for (let index = 0; index < layout.hangingPoints.length; index += 1) {
    const first = layout.hangingPoints[index]
    for (const second of layout.hangingPoints.slice(index + 1)) {
      if (first.wallId !== second.wallId) continue
      const firstWall = layout.walls.find((wall) => wall.id === first.wallId)
      if (!firstWall) continue
      const firstMin = first.offset - first.frame.width / 2
      const firstMax = first.offset + first.frame.width / 2
      const secondMin = second.offset - second.frame.width / 2
      const secondMax = second.offset + second.frame.width / 2
      if (firstMin < secondMax && secondMin < firstMax) errors.push(`Hanging points ${first.id} and ${second.id} overlap on ${firstWall.id}`)
    }
  }

  for (const placement of layout.placements) {
    if (!pointIds.has(placement.hangingPointId)) errors.push(`Placement ${placement.exhibitId} references unknown point ${placement.hangingPointId}`)
  }

  return errors
}

export const layoutErrors = validateMuseumLayout(museumLayout)

export function resolveAllPlacements(layout: MuseumLayout): Map<string, ResolvedHangingPoint> {
  return new Map(layout.placements.map((placement) => [placement.exhibitId, resolveHangingPoint(layout, placement.hangingPointId)]))
}

type WalkZone = RoomBounds

const walkConnections: WalkZone[] = [
  { minX: 9.6, maxX: 12.4, minZ: -12.4, maxZ: -4.4 },
  { minX: -2.2, maxX: 2.2, minZ: -17.5, maxZ: -14.3 },
]

export function constrainWalkPosition(x: number, z: number, radius = 0.7): [number, number] {
  const zones = [
    ...museumLayout.rooms.map(({ bounds }) => ({
      minX: bounds.minX + radius,
      maxX: bounds.maxX - radius,
      minZ: bounds.minZ + radius,
      maxZ: bounds.maxZ - radius,
    })),
    ...walkConnections.map((zone) => ({
      minX: zone.minX + radius,
      maxX: zone.maxX - radius,
      minZ: zone.minZ + radius,
      maxZ: zone.maxZ - radius,
    })),
  ]
  const inside = zones.find((zone) => x >= zone.minX && x <= zone.maxX && z >= zone.minZ && z <= zone.maxZ)
  if (inside) return [x, z]

  const nearest = zones.reduce((best, zone) => {
    const candidateX = Math.max(zone.minX, Math.min(zone.maxX, x))
    const candidateZ = Math.max(zone.minZ, Math.min(zone.maxZ, z))
    const distance = Math.hypot(candidateX - x, candidateZ - z)
    return distance < best.distance ? { x: candidateX, z: candidateZ, distance } : best
  }, { x, z, distance: Number.POSITIVE_INFINITY })
  return [nearest.x, nearest.z]
}

export function resolveWalkMovement(
  currentX: number,
  currentZ: number,
  nextX: number,
  nextZ: number,
  radius = 0.7,
): [number, number] {
  let [x, z] = constrainWalkPosition(nextX, nextZ, radius)

  for (let pass = 0; pass < 2; pass += 1) {
    for (const wall of museumLayout.walls) {
      const isVertical = Math.abs(wall.tangent[2]) > 0.5
      const line = isVertical ? wall.origin[0] : wall.origin[2]
      const halfLength = wall.width / 2 + radius
      const halfThickness = wall.thickness / 2 + radius

      if (isVertical) {
        const withinWallLength = z >= wall.origin[2] - halfLength && z <= wall.origin[2] + halfLength
        const crossed = (currentX < line - halfThickness && x >= line - halfThickness) ||
          (currentX > line + halfThickness && x <= line + halfThickness)
        if (withinWallLength && crossed) x = currentX < line ? line - halfThickness : line + halfThickness
      } else {
        const withinWallLength = x >= wall.origin[0] - halfLength && x <= wall.origin[0] + halfLength
        const crossed = (currentZ < line - halfThickness && z >= line - halfThickness) ||
          (currentZ > line + halfThickness && z <= line + halfThickness)
        if (withinWallLength && crossed) z = currentZ < line ? line - halfThickness : line + halfThickness
      }
    }
  }

  return constrainWalkPosition(x, z, radius)
}
