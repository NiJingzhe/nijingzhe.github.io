/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ExhibitArticle, getExhibit } from './content'
import { ExhibitTextureContent } from './ExhibitTextureContent'

afterEach(cleanup)

describe('about article interactions', () => {
  it('renders a secure, clearly named GitHub CTA with crosshair metadata', () => {
    render(<ExhibitArticle exhibit={getExhibit('about')} />)

    const link = screen.getByRole('link', {
      name: 'Visit Nijinzhe on GitHub (opens in a new tab)',
    })
    expect(link.getAttribute('href')).toBe('https://github.com/NiJingzhe')
    expect(link.getAttribute('target')).toBe('_blank')
    expect(new Set(link.getAttribute('rel')?.split(/\s+/))).toEqual(new Set(['noopener', 'noreferrer']))
    expect(link.getAttribute('data-crosshair-action')).toBe('github')
  })

  it('uses the shared article component for the HTML texture source', () => {
    render(<ExhibitTextureContent exhibit={getExhibit('about')} />)
    expect(screen.getByText(/working at the boundary between intelligent systems/i)).toBeTruthy()
    expect(screen.getByRole('link', { name: /visit nijinzhe on github/i })).toBeTruthy()
  })
})
