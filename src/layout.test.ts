import { describe, expect, it } from 'vitest'
import { exhibits } from './content'
import {
  buildMuseumLayout,
  constrainWalkPosition,
  defaultMuseumConfig,
  getLayoutBounds,
  resolveAllPlacements,
  resolveHangingPoint,
  resolveWalkMovement,
  validateMuseumLayout,
} from './layout'

const realExhibitIds = exhibits.map((exhibit) => exhibit.id)

function syntheticExhibitIds(count: number): string[] {
  return Array.from({ length: count }, (_, index) => `exhibit-${index + 1}`)
}

describe('museum layout engine', () => {
  it('builds a byte-identical layout for the same exhibits', () => {
    expect(buildMuseumLayout(realExhibitIds)).toEqual(buildMuseumLayout(realExhibitIds))
  })

  it('produces a valid, fully placed museum for any exhibit count', () => {
    for (let count = 1; count <= 12; count += 1) {
      const exhibitIds = syntheticExhibitIds(count)
      const layout = buildMuseumLayout(exhibitIds)

      expect(validateMuseumLayout(layout)).toEqual([])
      expect(layout.placements.map((placement) => placement.exhibitId)).toEqual(exhibitIds)
      expect(layout.hangingPoints).toHaveLength(exhibitIds.length)
      expect(layout.walkZones).toHaveLength(layout.rooms.length - 1)
      for (const point of layout.hangingPoints) {
        expect(() => resolveHangingPoint(layout, point.id)).not.toThrow()
      }
    }
  })

  it('grows along one axis as an enfilade of halls', () => {
    const layout = buildMuseumLayout(syntheticExhibitIds(3))

    expect(layout.rooms.map((room) => room.name)).toEqual(['Arrival Hall', 'Low Archive'])
    expect(layout.rooms[0].bounds).toEqual({ minX: -8, maxX: 8, minZ: -15, maxZ: 0 })
    expect(layout.rooms[1].bounds.minZ).toBeCloseTo(-30.42, 5)
    expect(layout.rooms[1].bounds.maxZ).toBeCloseTo(-15.42, 5)

    const gate = layout.walls.find((wall) => wall.id === 'hall-1-gate-west')
    expect(gate?.origin[2]).toBeCloseTo(-15.21, 5)
    const cap = layout.walls.find((wall) => wall.id === 'hall-2-cap')
    expect(cap?.origin[2]).toBeCloseTo(-30.63, 5)
    expect(layout.walls.find((wall) => wall.id === 'hall-2-gate-west')).toBeUndefined()

    expect(layout.spawn.position).toEqual([0, 2.2, -3])
    expect(layout.spawn.position[2]).toBeLessThan(layout.rooms[0].bounds.maxZ)
  })

  it('resolves a hanging point in front of its wall in visiting order', () => {
    const layout = buildMuseumLayout(realExhibitIds)
    const resolved = resolveHangingPoint(layout, 'hang-1-west-1')

    expect(resolved.position[0]).toBeCloseTo(-7.82, 2)
    expect(resolved.position[1]).toBe(3)
    expect(resolved.position[2]).toBeCloseTo(-7.5, 2)
    expect(resolved.rotationY).toBeCloseTo(Math.PI / 2)
    expect(resolveAllPlacements(layout).get('about')?.id).toBe('hang-1-west-1')
  })

  it('rejects a hanging point that would run outside a wall', () => {
    const layout = buildMuseumLayout(realExhibitIds)
    const invalidLayout = {
      ...layout,
      hangingPoints: layout.hangingPoints.map((point) =>
        point.id === 'hang-1-west-1' ? { ...point, offset: 6 } : point,
      ),
    }

    expect(validateMuseumLayout(invalidLayout)).toContain('Hanging point hang-1-west-1 is outside wall hall-1-west safe bounds')
  })

  it('rejects overlapping hanging points on the same wall', () => {
    const layout = buildMuseumLayout(realExhibitIds)
    const invalidLayout = {
      ...layout,
      hangingPoints: [
        ...layout.hangingPoints,
        { ...layout.hangingPoints[0], id: 'hang-1-west-copy', offset: 0.5 },
      ],
    }

    expect(validateMuseumLayout(invalidLayout)).toContain(
      'Hanging points hang-1-west-1 and hang-1-west-copy overlap on hall-1-west',
    )
  })

  it('keeps a visitor inside the halls and lets them pass through doorways', () => {
    const layout = buildMuseumLayout(realExhibitIds)

    expect(constrainWalkPosition(layout, 30, 30)).toEqual([7.3, -0.7])

    const [blockedX, blockedZ] = resolveWalkMovement(layout, 0, -7, -9, -7)
    expect(blockedX).toBeCloseTo(-7.3, 5)
    expect(blockedZ).toBeCloseTo(-7, 5)

    const [x, z] = resolveWalkMovement(layout, 0, -10, 0, -20)
    expect(x).toBe(0)
    expect(z).toBe(-20)
  })

  it('derives lighting and guide geometry inside the built rooms', () => {
    const layout = buildMuseumLayout(realExhibitIds)
    const bounds = getLayoutBounds(layout)

    expect(layout.lighting.ceiling.length).toBeGreaterThanOrEqual(layout.rooms.length)
    expect(layout.lighting.points.length).toBeGreaterThanOrEqual(layout.rooms.length)
    expect(layout.lighting.floorGuides.length).toBe(layout.walkZones.length + 1)
    for (const guide of layout.lighting.floorGuides) {
      expect(guide.position[2]).toBeLessThanOrEqual(bounds.maxZ)
      expect(guide.position[2]).toBeGreaterThanOrEqual(bounds.minZ)
    }
  })

  it('rejects configurations that ask a wall to hold too many frames', () => {
    expect(() =>
      buildMuseumLayout(realExhibitIds, { ...defaultMuseumConfig, framesPerWall: 3 }),
    ).toThrow('exceeds what a wall can hold')
  })
})
