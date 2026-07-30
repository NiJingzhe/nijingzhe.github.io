import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { ExhibitArticle, exhibits, getExhibit } from './content'
import { museumLayout, resolveAllPlacements } from './layout'

describe('museum content', () => {
  it('contains a complete three-stop route', () => {
    expect(exhibits).toHaveLength(3)
    expect(exhibits.map((exhibit) => exhibit.id)).toEqual(['about', 'work', 'writing'])
    const placements = resolveAllPlacements(museumLayout)
    expect(new Set(exhibits.map((exhibit) => placements.get(exhibit.id)?.wall.id))).toEqual(
      new Set(['entrance-west', 'gallery-west', 'side-north']),
    )
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
