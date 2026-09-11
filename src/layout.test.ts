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
  type ExhibitLayoutInput,
} from './layout'

const realExhibitIds = exhibits.map((exhibit) => exhibit.id)

function syntheticExhibitIds(count: number): string[] {
  return Array.from({ length: count }, (_, index) => `exhibit-${index + 1}`)
}

function cyclingInputs(count: number): ExhibitLayoutInput[] {
  const categories = defaultMuseumConfig.categories
  return Array.from({ length: count }, (_, index) => ({
    id: `exhibit-${index + 1}`,
    category: categories[index % categories.length].id,
  }))
}

describe('museum layout engine', () => {
  it('builds a byte-identical layout for the same exhibits', () => {
    const exhibitsWithCategories = exhibits.map(({ id, category }) => ({ id, category }))
    expect(buildMuseumLayout(exhibitsWithCategories)).toEqual(buildMuseumLayout(exhibitsWithCategories))
    expect(buildMuseumLayout(syntheticExhibitIds(4))).toEqual(buildMuseumLayout(syntheticExhibitIds(4)))
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

  it('groups exhibits into one hall per category, in registry order', () => {
    const layout = buildMuseumLayout(exhibits.map(({ id, category }) => ({ id, category })))

    expect(layout.rooms.map((room) => [room.name, room.category])).toEqual([
      ['PROFILE', 'profile'],
      ['STUDIO', 'studio'],
      ['FIELD NOTES', 'field-notes'],
    ])
    expect(layout.rooms.map((room) => room.id)).toEqual([
      'hall-1-profile',
      'hall-2-studio',
      'hall-3-field-notes',
    ])
    expect(layout.placements.map((placement) => [placement.exhibitId, placement.category])).toEqual([
      ['about', 'profile'],
      ['work', 'studio'],
      ['writing', 'field-notes'],
    ])
    expect(layout.rooms[0].categoryAccent).toBe('#c5aa72')
    expect(validateMuseumLayout(layout)).toEqual([])
  })

  it('preserves input order inside a category regardless of global order', () => {
    const layout = buildMuseumLayout([
      { id: 's1', category: 'studio' },
      { id: 'p1', category: 'profile' },
      { id: 's2', category: 'studio' },
      { id: 'p2', category: 'profile' },
      { id: 'f1', category: 'field-notes' },
    ])

    expect(layout.placements.map((placement) => placement.exhibitId)).toEqual([
      'p1', 'p2', 's1', 's2', 'f1',
    ])
  })

  it('splits an overflowing category into numbered continuation halls', () => {
    const layout = buildMuseumLayout([
      { id: 'a', category: 'studio' },
      { id: 'b', category: 'studio' },
      { id: 'c', category: 'studio' },
      { id: 'd', category: 'studio' },
      { id: 'e', category: 'studio' },
    ])

    expect(layout.rooms.map((room) => room.name)).toEqual(['STUDIO', 'STUDIO / 02'])
    expect(layout.rooms.map((room) => room.section)).toEqual([1, 2])
    expect(layout.placements.map((placement) => placement.exhibitId)).toEqual(['a', 'b', 'c', 'd', 'e'])
    expect(validateMuseumLayout(layout)).toEqual([])
  })

  it('falls back to a neutral hall for unknown categories, strictly on demand', () => {
    const fallback = buildMuseumLayout([{ id: 'x', category: 'mystery' }])
    expect(fallback.rooms[0].category).toBe('unclassified')
    expect(fallback.rooms[0].name).toBe('UNCLASSIFIED')
    expect(validateMuseumLayout(fallback)).toEqual([])

    expect(() =>
      buildMuseumLayout([{ id: 'x', category: 'mystery' }], { ...defaultMuseumConfig, strictCategories: true }),
    ).toThrow('Unknown exhibit category: mystery')
  })

  it('grows along one axis as an enfilade of halls', () => {
    const layout = buildMuseumLayout(exhibits.map(({ id, category }) => ({ id, category })))

    expect(layout.rooms[0].bounds).toEqual({ minX: -8, maxX: 8, minZ: -15, maxZ: 0 })
    expect(layout.rooms[1].bounds.minZ).toBeCloseTo(-30.42, 5)
    expect(layout.rooms[1].bounds.maxZ).toBeCloseTo(-15.42, 5)

    const gate = layout.walls.find((wall) => wall.id === 'hall-1-profile-gate-west')
    expect(gate?.origin[2]).toBeCloseTo(-15.21, 5)
    const cap = layout.walls.find((wall) => wall.id === 'hall-3-field-notes-cap')
    expect(cap?.origin[2]).toBeCloseTo(-46.05, 5)

    expect(layout.spawn.position).toEqual([0, 2.2, -3])
    expect(layout.spawn.position[2]).toBeLessThan(layout.rooms[0].bounds.maxZ)
  })

  it('resolves a hanging point in front of its wall in visiting order', () => {
    const layout = buildMuseumLayout(exhibits.map(({ id, category }) => ({ id, category })))
    const resolved = resolveHangingPoint(layout, 'hang-1-west-1')

    expect(resolved.wall.id).toBe('hall-1-profile-west')
    expect(resolved.position[0]).toBeCloseTo(-7.82, 2)
    expect(resolved.position[1]).toBe(3)
    expect(resolved.position[2]).toBeCloseTo(-7.5, 2)
    expect(resolved.rotationY).toBeCloseTo(Math.PI / 2)
    expect(resolveAllPlacements(layout).get('about')?.id).toBe('hang-1-west-1')
  })

  it('rejects a hanging point that would run outside a wall', () => {
    const layout = buildMuseumLayout(exhibits.map(({ id, category }) => ({ id, category })))
    const invalidLayout = {
      ...layout,
      hangingPoints: layout.hangingPoints.map((point) =>
        point.id === 'hang-1-west-1' ? { ...point, offset: 6 } : point,
      ),
    }

    expect(validateMuseumLayout(invalidLayout)).toContain('Hanging point hang-1-west-1 is outside wall hall-1-profile-west safe bounds')
  })

  it('rejects overlapping hanging points on the same wall', () => {
    const layout = buildMuseumLayout(exhibits.map(({ id, category }) => ({ id, category })))
    const invalidLayout = {
      ...layout,
      hangingPoints: [
        ...layout.hangingPoints,
        { ...layout.hangingPoints[0], id: 'hang-1-west-copy', offset: 0.5 },
      ],
    }

    expect(validateMuseumLayout(invalidLayout)).toContain(
      'Hanging points hang-1-west-1 and hang-1-west-copy overlap on hall-1-profile-west',
    )
  })

  it('keeps a visitor inside the halls and lets them pass through doorways', () => {
    const layout = buildMuseumLayout(exhibits.map(({ id, category }) => ({ id, category })))

    expect(constrainWalkPosition(layout, 30, 30)).toEqual([7.3, -0.7])

    const [blockedX, blockedZ] = resolveWalkMovement(layout, 0, -7, -9, -7)
    expect(blockedX).toBeCloseTo(-7.3, 5)
    expect(blockedZ).toBeCloseTo(-7, 5)

    const [x, z] = resolveWalkMovement(layout, 0, -10, 0, -20)
    expect(x).toBe(0)
    expect(z).toBe(-20)
  })

  it('derives lighting, category-coded guides, and signage from the rooms', () => {
    const layout = buildMuseumLayout(exhibits.map(({ id, category }) => ({ id, category })))
    const bounds = getLayoutBounds(layout)

    expect(layout.lighting.ceiling.length).toBeGreaterThanOrEqual(layout.rooms.length)
    expect(layout.lighting.points.length).toBeGreaterThanOrEqual(layout.rooms.length)
    expect(layout.lighting.floorGuides).toHaveLength(layout.walkZones.length + 1)
    expect(layout.lighting.floorGuides[1].color).toBe('#8da5a8')
    for (const guide of layout.lighting.floorGuides) {
      expect(guide.position[2]).toBeLessThanOrEqual(bounds.maxZ)
      expect(guide.position[2]).toBeGreaterThanOrEqual(bounds.minZ)
    }

    expect(layout.signage.map((sign) => sign.text)).toEqual(['STUDIO', 'FIELD NOTES', 'FIN'])
    expect(layout.signage[0].accent).toBe('#8da5a8')
  })

  it('rejects configurations that ask a wall to hold too many frames', () => {
    expect(() =>
      buildMuseumLayout(exhibits.map(({ id, category }) => ({ id, category })), { ...defaultMuseumConfig, framesPerWall: 3 }),
    ).toThrow('exceeds what a wall can hold')
  })

  it('cycles presets for fallback rooms when no category provides one', () => {
    const layout = buildMuseumLayout(syntheticExhibitIds(2))
    expect(layout.rooms.map((room) => room.category)).toEqual(['unclassified', 'unclassified'])
    expect(validateMuseumLayout(layout)).toEqual([])
  })
})
