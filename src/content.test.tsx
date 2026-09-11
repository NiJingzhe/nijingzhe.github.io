import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { ExhibitArticle, exhibits, getExhibit } from './content'
import { buildMuseumLayout, defaultMuseumConfig, resolveAllPlacements } from './layout'

describe('museum content', () => {
  it('contains a complete three-stop route', () => {
    expect(exhibits).toHaveLength(3)
    expect(exhibits.map((exhibit) => exhibit.id)).toEqual(['about', 'work', 'writing'])
    const museumLayout = buildMuseumLayout(exhibits.map(({ id, category }) => ({ id, category })))
    const placements = resolveAllPlacements(museumLayout)
    expect(new Set(exhibits.map((exhibit) => placements.get(exhibit.id)?.wall.id))).toEqual(
      new Set(['hall-1-profile-west', 'hall-2-studio-west', 'hall-3-field-notes-west']),
    )
  })

  it('declares an extensible category for every exhibit', () => {
    const known = new Set(defaultMuseumConfig.categories.map((category) => category.id))
    for (const exhibit of exhibits) {
      expect(known.has(exhibit.category)).toBe(true)
    }
  })

  it('returns a known exhibit and rejects invalid identifiers', () => {
    expect(getExhibit('work').title).toContain('3D assets')
    expect(() => getExhibit('missing' as never)).toThrow('Unknown exhibit')
  })

  it.each(exhibits)('renders complete rich text for $id', (exhibit) => {
    const markup = renderToStaticMarkup(<ExhibitArticle exhibit={exhibit} />)

    expect(markup).toContain(exhibit.title)
    expect(markup).toContain(exhibit.meta)
    expect(markup).toContain('<h2>')
    expect(markup).toContain('article-callout')
    expect(markup.length).toBeGreaterThan(900)
  })
})
