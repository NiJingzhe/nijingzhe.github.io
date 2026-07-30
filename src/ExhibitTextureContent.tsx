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
