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

export type WalkZone = RoomBounds

export type CeilingLightSpec = { position: Vec3; width: number }

export type PointLightSpec = {
  position: Vec3
  intensity: number
  distance: number
  color: string
}

export type FloorGuideSpec = {
  position: Vec3
  width: number
  depth: number
  opacity: number
}

export type MuseumLighting = {
  ceiling: CeilingLightSpec[]
  points: PointLightSpec[]
  floorGuides: FloorGuideSpec[]
}

export type MuseumSpawn = {
  position: Vec3
  yaw: number
}

export type ResolvedHangingPoint = HangingPoint & {
  wall: WallSurface
  position: Vec3
  rotationY: number
}

export type MuseumLayout = {
  rooms: Room[]
  walls: WallSurface[]
  hangingPoints: HangingPoint[]
  placements: ExhibitPlacement[]
  walkZones: WalkZone[]
  spawn: MuseumSpawn
  lighting: MuseumLighting
}

export type RoomPreset = {
  id: string
  wallStyle: WallStyle
  floorColor: string
  wallColor: string
  carpetColor: string
}

export type MuseumConfig = {
  roomWidth: number
  roomDepth: number
  wallThickness: number
  wallHeight: number
  doorWidth: number
  framesPerWall: number
  frameGap: number
  frameEndMargin: number
  frame: FrameSpec
  frameElevation: number
  minRooms: number
  eyeHeight: number
  ceilingBase: number
  ceilingDecay: number
  ceilingMin: number
  cyclePresets: RoomPreset[]
  terminalPreset: RoomPreset
}

const plasterPreset: RoomPreset = {
  id: 'plaster',
  wallStyle: { color: '#d9d3c6', roughness: 0.9, trimColor: '#b8af9e', baseboardColor: '#8f897f' },
  floorColor: '#b7ae9f',
  wallColor: '#dcd6c9',
  carpetColor: '#a29b8f',
}

const fadedPreset: RoomPreset = {
  id: 'faded',
  wallStyle: { color: '#cfcdbf', roughness: 0.94, trimColor: '#aaa89d', baseboardColor: '#817f78' },
  floorColor: '#aaa398',
  wallColor: '#dad4c8',
  carpetColor: '#9a9489',
}

const archivePreset: RoomPreset = {
  id: 'archive',
  wallStyle: { color: '#c6c2b4', roughness: 0.96, trimColor: '#99968b', baseboardColor: '#706f6a' },
  floorColor: '#928e84',
  wallColor: '#c7c2b4',
  carpetColor: '#7d7972',
}

export const defaultMuseumConfig: MuseumConfig = {
  roomWidth: 16,
  roomDepth: 15,
  wallThickness: 0.42,
  wallHeight: 5.6,
  doorWidth: 4.6,
  framesPerWall: 2,
  frameGap: 1.2,
  frameEndMargin: 1,
  frame: { width: 4.9, height: 3.9, border: 0.2, depth: 0.2, material: '#8f4c32', matColor: '#f5eee0' },
  frameElevation: 3,
  minRooms: 2,
  eyeHeight: 2.2,
  ceilingBase: 7.8,
  ceilingDecay: 0.5,
  ceilingMin: 5.9,
  cyclePresets: [plasterPreset, fadedPreset],
  terminalPreset: archivePreset,
}

function formatOrdinal(value: number): string {
  return String(value).padStart(2, '0')
}

/**
 * Builds the whole museum from the ordered exhibit list. Rooms are laid out as an
 * enfilade along -Z: the first hall opens toward the spawn point, every later hall is
 * reached through a centered doorway, and the last hall closes with a blind back wall.
 * Exhibits fill the halls in visiting order, west wall before east wall, entrance side
 * first. The result is a pure function of the input: same exhibits and config in,
 * byte-identical layout out.
 */
export function buildMuseumLayout(
  exhibitIds: readonly string[],
  config: MuseumConfig = defaultMuseumConfig,
): MuseumLayout {
  const { roomWidth, roomDepth, wallThickness, wallHeight, doorWidth } = config
  const halfWidth = roomWidth / 2
  const framesPerRoom = config.framesPerWall * 2
  const roomCount = Math.max(config.minRooms, Math.ceil(exhibitIds.length / framesPerRoom))

  const rooms: Room[] = []
  const roomPresets: RoomPreset[] = []
  for (let index = 0; index < roomCount; index += 1) {
    const isTerminal = roomCount > 1 && index === roomCount - 1
    const preset = isTerminal
      ? config.terminalPreset
      : config.cyclePresets[index % config.cyclePresets.length]
    roomPresets.push(preset)
    const minZ = -(index + 1) * roomDepth - index * wallThickness
    rooms.push({
      id: `hall-${index + 1}`,
      name: index === 0 ? 'Arrival Hall' : isTerminal ? 'Low Archive' : `Gallery ${formatOrdinal(index + 1)}`,
      bounds: { minX: -halfWidth, maxX: halfWidth, minZ, maxZ: minZ + roomDepth },
      ceilingHeight: Math.max(config.ceilingMin, config.ceilingBase - config.ceilingDecay * index),
      floorColor: preset.floorColor,
      wallColor: preset.wallColor,
      carpetColor: preset.carpetColor,
    })
  }

  const walls: WallSurface[] = []
  const sideWallLength = roomDepth + wallThickness
  for (const [index, room] of rooms.entries()) {
    const centerZ = (room.bounds.minZ + room.bounds.maxZ) / 2
    const style = roomPresets[index].wallStyle
    walls.push({
      id: `${room.id}-west`,
      roomId: room.id,
      origin: [-halfWidth - wallThickness / 2, 0, centerZ],
      tangent: [0, 0, 1],
      normal: [1, 0, 0],
      width: sideWallLength,
      height: wallHeight,
      thickness: wallThickness,
      style,
    })
    walls.push({
      id: `${room.id}-east`,
      roomId: room.id,
      origin: [halfWidth + wallThickness / 2, 0, centerZ],
      tangent: [0, 0, 1],
      normal: [-1, 0, 0],
      width: sideWallLength,
      height: wallHeight,
      thickness: wallThickness,
      style,
    })
  }

  const gateSegmentWidth = halfWidth + wallThickness - doorWidth / 2
  if (gateSegmentWidth <= 0) throw new Error('doorWidth leaves no room for gate wall segments')
  for (let index = 0; index < rooms.length; index += 1) {
    const room = rooms[index]
    const isCap = index === rooms.length - 1
    const style = roomPresets[index].wallStyle
    // Every room closes at its far end: gate segments with a centered doorway, or a
    // blind cap wall behind the last hall.
    const gateZ = room.bounds.minZ - wallThickness / 2
    if (isCap) {
      walls.push({
        id: `${room.id}-cap`,
        roomId: room.id,
        origin: [0, 0, gateZ],
        tangent: [1, 0, 0],
        normal: [0, 0, 1],
        width: roomWidth + wallThickness * 2,
        height: wallHeight,
        thickness: wallThickness,
        style,
      })
        continue
      }
      const gateCenterX = doorWidth / 2 + gateSegmentWidth / 2
    for (const side of ['west', 'east'] as const) {
      walls.push({
        id: `${room.id}-gate-${side}`,
        roomId: room.id,
        origin: [side === 'west' ? -gateCenterX : gateCenterX, 0, gateZ],
        tangent: [1, 0, 0],
        normal: [0, 0, 1],
        width: gateSegmentWidth,
        height: wallHeight,
        thickness: wallThickness,
        style,
      })
    }
  }

  const usableWallLength = sideWallLength - config.frameEndMargin * 2
  const maxFramesPerWall = Math.floor(usableWallLength / (config.frame.width + config.frameGap))
  if (config.framesPerWall > maxFramesPerWall) {
    throw new Error(
      `framesPerWall ${config.framesPerWall} exceeds what a wall can hold (${maxFramesPerWall})`,
    )
  }

  const hangingPoints: HangingPoint[] = []
  const placements: ExhibitPlacement[] = []
  // Spread exhibits evenly across halls so no trailing hall sits empty; earlier halls
  // absorb the remainder, matching visiting order.
  const basePerRoom = Math.floor(exhibitIds.length / roomCount)
  const remainderRooms = exhibitIds.length % roomCount
  let exhibitIndex = 0
  for (const [index, room] of rooms.entries()) {
    const frameCount = basePerRoom + (index < remainderRooms ? 1 : 0)
    const westCount = Math.ceil(frameCount / 2)
    for (const [side, countOnWall] of [
      ['west', westCount],
      ['east', frameCount - westCount],
    ] as const) {
      for (let slot = 0; slot < countOnWall; slot += 1) {
        // Slots run from the entrance side toward the far end, matching visiting order.
        const offset = ((countOnWall - 1 - 2 * slot) * usableWallLength) / (2 * countOnWall)
        const pointId = `hang-${index + 1}-${side}-${slot + 1}`
        hangingPoints.push({
          id: pointId,
          wallId: `${room.id}-${side}`,
          offset,
          elevation: config.frameElevation,
          frame: config.frame,
        })
        const exhibitId = exhibitIds[exhibitIndex]
        if (exhibitId !== undefined) placements.push({ exhibitId, hangingPointId: pointId })
        exhibitIndex += 1
      }
    }
  }

  const walkZones: WalkZone[] = []
  for (let index = 1; index < rooms.length; index += 1) {
    const gateZ = rooms[index - 1].bounds.minZ - wallThickness / 2
    walkZones.push({
      minX: -doorWidth / 2 + 0.2,
      maxX: doorWidth / 2 - 0.2,
      minZ: gateZ - 1.6,
      maxZ: gateZ + 1.6,
    })
  }

  const spawnPosition: Vec3 = [0, config.eyeHeight, rooms[0].bounds.maxZ - 3]

  const ceiling: CeilingLightSpec[] = []
  const points: PointLightSpec[] = []
  for (const room of rooms) {
    const lightCount = Math.max(1, Math.round(roomDepth / 5.5))
    for (let slot = 0; slot < lightCount; slot += 1) {
      const z = room.bounds.maxZ - ((slot + 0.5) * roomDepth) / lightCount
      ceiling.push({ position: [0, room.ceilingHeight - 0.25, z], width: 3.2 })
    }
    points.push({
      position: [0, 3.2, (room.bounds.minZ + room.bounds.maxZ) / 2],
      intensity: 3.2,
      distance: roomDepth + 4,
      color: '#f1b275',
    })
  }
  points.unshift({
    position: [0, 4.1, spawnPosition[2] - 2],
    intensity: 5,
    distance: 13,
    color: '#ffc785',
  })

  const spineStart = spawnPosition[2] - 1
  const spineEnd = rooms[rooms.length - 1].bounds.minZ + 2
  const floorGuides: FloorGuideSpec[] = [
    {
      position: [0, 0.02, (spineStart + spineEnd) / 2],
      width: 1.5,
      depth: spineStart - spineEnd,
      opacity: 0.45,
    },
  ]
  for (const zone of walkZones) {
    floorGuides.push({
      position: [0, 0.022, (zone.minZ + zone.maxZ) / 2],
      width: zone.maxX - zone.minX,
      depth: 0.9,
      opacity: 0.28,
    })
  }

  return {
    rooms,
    walls,
    hangingPoints,
    placements,
    walkZones,
    spawn: { position: spawnPosition, yaw: 0 },
    lighting: { ceiling, points, floorGuides },
  }
}

export function getLayoutBounds(layout: MuseumLayout): RoomBounds {
  return layout.rooms.reduce(
    (bounds, room) => ({
      minX: Math.min(bounds.minX, room.bounds.minX),
      maxX: Math.max(bounds.maxX, room.bounds.maxX),
      minZ: Math.min(bounds.minZ, room.bounds.minZ),
      maxZ: Math.max(bounds.maxZ, room.bounds.maxZ),
    }),
    { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity },
  )
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

function isInsideBounds(bounds: RoomBounds, x: number, z: number, margin = 0): boolean {
  return (
    x >= bounds.minX + margin &&
    x <= bounds.maxX - margin &&
    z >= bounds.minZ + margin &&
    z <= bounds.maxZ - margin
  )
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

  const placedExhibits = new Set<string>()
  for (const placement of layout.placements) {
    if (!pointIds.has(placement.hangingPointId)) errors.push(`Placement ${placement.exhibitId} references unknown point ${placement.hangingPointId}`)
    if (placedExhibits.has(placement.exhibitId)) errors.push(`Exhibit ${placement.exhibitId} is placed more than once`)
    placedExhibits.add(placement.exhibitId)
  }

  const firstRoom = layout.rooms[0]
  if (firstRoom && !isInsideBounds(firstRoom.bounds, layout.spawn.position[0], layout.spawn.position[2], 0.5)) {
    errors.push('Spawn point is outside the first room')
  }

  for (const [index, light] of layout.lighting.ceiling.entries()) {
    const room = layout.rooms.find((item) => isInsideBounds(item.bounds, light.position[0], light.position[2]))
    if (!room) {
      errors.push(`Ceiling light ${index} is outside every room`)
    } else if (light.position[1] >= room.ceilingHeight) {
      errors.push(`Ceiling light ${index} hangs below the ceiling of ${room.id}`)
    }
  }

  for (const [index, light] of layout.lighting.points.entries()) {
    const room = layout.rooms.find((item) => isInsideBounds(item.bounds, light.position[0], light.position[2]))
    if (!room) errors.push(`Point light ${index} is outside every room`)
  }

  return errors
}

export function resolveAllPlacements(layout: MuseumLayout): Map<string, ResolvedHangingPoint> {
  return new Map(layout.placements.map((placement) => [placement.exhibitId, resolveHangingPoint(layout, placement.hangingPointId)]))
}

export function constrainWalkPosition(
  layout: MuseumLayout,
  x: number,
  z: number,
  radius = 0.7,
): [number, number] {
  const zones = [
    ...layout.rooms.map(({ bounds }) => ({
      minX: bounds.minX + radius,
      maxX: bounds.maxX - radius,
      minZ: bounds.minZ + radius,
      maxZ: bounds.maxZ - radius,
    })),
    ...layout.walkZones.map((zone) => ({
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
  layout: MuseumLayout,
  currentX: number,
  currentZ: number,
  nextX: number,
  nextZ: number,
  radius = 0.7,
): [number, number] {
  let [x, z] = constrainWalkPosition(layout, nextX, nextZ, radius)

  for (let pass = 0; pass < 2; pass += 1) {
    for (const wall of layout.walls) {
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

  return constrainWalkPosition(layout, x, z, radius)
}
