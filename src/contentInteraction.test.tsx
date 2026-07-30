/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ExhibitArticle, getExhibit } from './content'
import { isolateHTMLTexturePointerEvent, routeHTMLTextureClick } from './ExhibitTextureContent'

afterEach(cleanup)

describe('about article interactions', () => {
  it('renders a secure, clearly named GitHub CTA', () => {
    render(<ExhibitArticle exhibit={getExhibit('about')} />)

    const link = screen.getByRole('link', {
      name: 'Visit Nijinzhe on GitHub (opens in a new tab)',
    })
    expect(link.getAttribute('href')).toBe('https://github.com/NiJingzhe')
    expect(link.getAttribute('target')).toBe('_blank')
    expect(new Set(link.getAttribute('rel')?.split(/\s+/))).toEqual(new Set(['noopener', 'noreferrer']))
    expect(link.textContent).toContain('Explore GitHub')
  })

  it('isolates the CTA while allowing the surrounding article to activate its exhibit', () => {
    const activateExhibit = vi.fn()
    render(<ExhibitArticle exhibit={getExhibit('about')} />)
    const link = screen.getByRole('link', {
      name: 'Visit Nijinzhe on GitHub (opens in a new tab)',
    })
    const controlClick = new MouseEvent('click', { bubbles: true })
    Object.defineProperty(controlClick, 'target', { value: link })
    const controlPropagation = vi.spyOn(controlClick, 'stopPropagation')

    routeHTMLTextureClick(controlClick, 'about', activateExhibit)
    expect(controlPropagation).toHaveBeenCalledOnce()
    expect(controlClick.defaultPrevented).toBe(false)
    expect(activateExhibit).not.toHaveBeenCalled()

    const articleCopy = screen.getByText(/working at the boundary between intelligent systems/i)
    const surfaceClick = new MouseEvent('click', { bubbles: true })
    Object.defineProperty(surfaceClick, 'target', { value: articleCopy })
    routeHTMLTextureClick(surfaceClick, 'about', activateExhibit)
    expect(activateExhibit).toHaveBeenCalledOnce()
    expect(activateExhibit).toHaveBeenCalledWith('about')
  })

  it('stops wall pointer events before they reach R3F pointer lock handlers', () => {
    const pointerDown = new Event('pointerdown', { bubbles: true })
    const stopPropagation = vi.spyOn(pointerDown, 'stopPropagation')

    isolateHTMLTexturePointerEvent(pointerDown)

    expect(stopPropagation).toHaveBeenCalledOnce()
  })
})
