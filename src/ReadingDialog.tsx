import { useEffect, useRef, type KeyboardEvent, type RefObject } from 'react'
import { ExhibitArticle, type Exhibit } from './content'

const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

export function ReadingDialog({
  exhibit,
  backgroundRef,
  returnFocus,
  onClose,
}: {
  exhibit: Exhibit
  backgroundRef: RefObject<HTMLElement>
  returnFocus: HTMLElement | null
  onClose: () => void
}) {
  const dialogRef = useRef<HTMLElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const titleId = `reading-title-${exhibit.id}`

  useEffect(() => {
    const background = backgroundRef.current
    if (background) {
      background.inert = true
      background.setAttribute('aria-hidden', 'true')
    }
    closeRef.current?.focus()

    return () => {
      if (background) {
        background.inert = false
        background.removeAttribute('aria-hidden')
      }
      window.requestAnimationFrame(() => {
        if (returnFocus?.isConnected) returnFocus.focus()
        else document.querySelector<HTMLElement>('.museum-app canvas')?.focus()
      })
    }
  }, [backgroundRef, returnFocus])

  const keepFocusInside = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
      return
    }
    if (event.key !== 'Tab' || !dialogRef.current) return

    const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(focusableSelector))
    if (focusable.length === 0) {
      event.preventDefault()
      dialogRef.current.focus()
      return
    }

    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return (
    <section
      ref={dialogRef}
      className="reading-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      tabIndex={-1}
      onKeyDown={keepFocusInside}
    >
      <div className="reading-backdrop" onPointerDown={onClose} />
      <div className="reading-sheet">
        <div className="reading-toolbar">
          <span id={titleId}>{exhibit.order} / 03&nbsp;&nbsp; {exhibit.title}</span>
          <button ref={closeRef} type="button" onClick={onClose}>
            Close <span>Esc</span>
          </button>
        </div>
        <div className="reading-scroll">
          <ExhibitArticle exhibit={exhibit} />
        </div>
      </div>
    </section>
  )
}
