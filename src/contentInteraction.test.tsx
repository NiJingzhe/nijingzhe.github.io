/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ExhibitArticle, getExhibit } from './content'
import {
  isolateHTMLTexturePointerEvent,
  isAboutWallInteractive,
  releasePointerLockForHTMLTextureInteraction,
  routeHTMLTextureClick,
  syncHTMLTextureAccessibility,
} from './ExhibitTextureContent'

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

  it('gates wall accessibility and removes focus when about is no longer reachable', () => {
    const source = document.createElement('div')
    const link = document.createElement('a')
    link.href = 'https://github.com/NiJingzhe'
    link.textContent = 'Explore GitHub'
    source.append(link)
    document.body.append(source)
    link.focus()

    syncHTMLTextureAccessibility(source, false)
    expect(source.inert).toBe(true)
    expect(source.getAttribute('aria-hidden')).toBe('true')
    expect(document.activeElement).not.toBe(link)
    expect(within(source).queryByRole('link')).toBeNull()

    syncHTMLTextureAccessibility(source, true)
    expect(source.inert).toBe(false)
    expect(source.getAttribute('aria-hidden')).toBe('false')
    expect(within(source).getByRole('link')).toBe(link)
    source.remove()
  })

  it.each([
    ['welcome', false, false, null, true, false],
    ['reachable about', true, false, 'about', true, true],
    ['left about', true, false, 'work', true, false],
    ['reading dialog', true, true, 'about', true, false],
    ['unsupported API', true, false, 'about', false, false],
  ] as const)('gates the wall CTA in the %s state', (_, started, reading, focusedId, supported, expected) => {
    expect(isAboutWallInteractive(started, reading, focusedId, supported)).toBe(expected)
  })

  it('releases pointer lock only when the reachable about surface owns it', () => {
    const canvas = document.createElement('canvas')
    const other = document.createElement('div')
    const exitPointerLock = vi.fn()

    releasePointerLockForHTMLTextureInteraction(canvas, false, canvas, exitPointerLock)
    expect(exitPointerLock).not.toHaveBeenCalled()

    releasePointerLockForHTMLTextureInteraction(canvas, true, other, exitPointerLock)
    expect(exitPointerLock).not.toHaveBeenCalled()

    releasePointerLockForHTMLTextureInteraction(canvas, true, canvas, exitPointerLock)
    expect(exitPointerLock).toHaveBeenCalledOnce()
  })

  it('stops CTA pointerdown before the canvas can reacquire pointer lock', () => {
    const canvas = document.createElement('canvas')
    const source = document.createElement('div')
    const link = document.createElement('a')
    canvas.append(source)
    source.append(link)
    const requestPointerLock = vi.fn()
    canvas.addEventListener('pointerdown', requestPointerLock)
    source.addEventListener('pointerdown', isolateHTMLTexturePointerEvent)

    link.dispatchEvent(new Event('pointerdown', { bubbles: true }))

    expect(requestPointerLock).not.toHaveBeenCalled()
  })
})
