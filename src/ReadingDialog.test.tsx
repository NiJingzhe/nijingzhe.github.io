/**
 * @vitest-environment jsdom
 */
import { useRef, useState } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { exhibits } from './content'
import { ReadingDialog } from './ReadingDialog'

function DialogHarness() {
  const [open, setOpen] = useState(false)
  const backgroundRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  return (
    <>
      <div ref={backgroundRef}>
        <button ref={triggerRef} type="button" onClick={() => setOpen(true)}>Read exhibit</button>
        <a href="/hidden-background">Background link</a>
      </div>
      {open && (
        <ReadingDialog
          exhibit={exhibits[0]}
          backgroundRef={backgroundRef}
          returnFocus={triggerRef.current}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}

describe('ReadingDialog', () => {
  it('moves focus inside, traps Tab, closes on Escape, and restores focus', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      callback(0)
      return 1
    })
    render(<DialogHarness />)

    const trigger = screen.getByRole('button', { name: 'Read exhibit' })
    await user.click(trigger)

    const dialog = screen.getByRole('dialog')
    const close = screen.getByRole('button', { name: /close/i })
    const background = trigger.parentElement as HTMLDivElement
    expect(document.activeElement).toBe(close)
    expect(background.inert).toBe(true)
    expect(background.getAttribute('aria-hidden')).toBe('true')
    expect(dialog.getAttribute('aria-labelledby')).toBe('reading-title-about')

    await user.tab()
    expect(document.activeElement).toBe(close)
    await user.tab({ shift: true })
    expect(document.activeElement).toBe(close)

    fireEvent.keyDown(dialog, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(background.inert).toBe(false)
    expect(background.hasAttribute('aria-hidden')).toBe(false)
    expect(document.activeElement).toBe(trigger)
  })
})
