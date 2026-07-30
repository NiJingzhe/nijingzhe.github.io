import { ExhibitArticle, type Exhibit, type ExhibitId } from './content'

export function ExhibitTextureContent({
  exhibit,
}: {
  exhibit: Exhibit
}) {
  return (
    <div className="texture-interaction-root">
      <ExhibitArticle exhibit={exhibit} />
    </div>
  )
}

export function routeHTMLTextureClick(
  event: Event,
  exhibitId: ExhibitId,
  onRead: (id: ExhibitId) => void,
) {
  event.stopPropagation()
  if (event.target instanceof Element && event.target.closest('[data-html-texture-control]')) return
  onRead(exhibitId)
}

export function isolateHTMLTexturePointerEvent(event: Event) {
  event.stopPropagation()
}

export function isAboutWallInteractive(
  started: boolean,
  reading: boolean,
  focusedId: ExhibitId | null,
  htmlInCanvasSupported: boolean,
) {
  return started && !reading && focusedId === 'about' && htmlInCanvasSupported
}

export function syncHTMLTextureAccessibility(element: HTMLElement, interactive: boolean) {
  element.inert = !interactive
  element.setAttribute('aria-hidden', String(!interactive))

  if (!interactive && element.contains(document.activeElement)) {
    const focusedElement = document.activeElement as HTMLElement
    focusedElement.blur()
  }
}

export function releasePointerLockForHTMLTextureInteraction(
  canvas: HTMLCanvasElement,
  interactive: boolean,
  pointerLockElement: Element | null,
  exitPointerLock: () => void,
) {
  if (interactive && pointerLockElement === canvas) exitPointerLock()
}
