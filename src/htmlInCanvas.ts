import { HTMLTexture, Texture } from 'three'

type WebGLContext = WebGLRenderingContext | WebGL2RenderingContext
type UnsupportedReason = 'browser-unsupported' | 'chromium-api-disabled' | 'incompatible-signature'

export type HTMLInCanvasSupport =
  | { supported: true; uploadArity: 3 | 6 }
  | { supported: false; reason: UnsupportedReason }

export type HTMLInCanvasNotice = {
  title: string
  message: string
  flag?: string
}

const chromiumPattern = /\b(?:Chrome|Chromium|Edg|OPR)\//

export function detectNativeHTMLInCanvas(
  canvas: HTMLCanvasElement,
  context: WebGLContext,
  userAgent = typeof navigator === 'undefined' ? '' : navigator.userAgent,
): HTMLInCanvasSupport {
  const requestPaint = Reflect.get(canvas, 'requestPaint')
  const uploadElement = Reflect.get(context, 'texElementImage2D')

  if (typeof requestPaint !== 'function' || typeof uploadElement !== 'function') {
    return {
      supported: false,
      reason: chromiumPattern.test(userAgent) ? 'chromium-api-disabled' : 'browser-unsupported',
    }
  }

  if (uploadElement.length !== 3 && uploadElement.length !== 6) {
    return { supported: false, reason: 'incompatible-signature' }
  }

  return { supported: true, uploadArity: uploadElement.length }
}

export function getHTMLInCanvasNotice(reason: UnsupportedReason): HTMLInCanvasNotice {
  if (reason === 'chromium-api-disabled') {
    return {
      title: 'HTML-IN-CANVAS IS DISABLED',
      message: 'This Chromium build does not expose the experimental API. You can still enter the museum and open every exhibit in reading mode.',
      flag: 'chrome://flags/#canvas-draw-element',
    }
  }

  if (reason === 'incompatible-signature') {
    return {
      title: 'HTML-IN-CANVAS API IS INCOMPATIBLE',
      message: 'This browser exposes an API version that Three.js 0.185 cannot upload. Update Chromium and verify the experimental flag. Reading mode remains available.',
    }
  }

  return {
    title: 'THIS BROWSER DOES NOT SUPPORT HTML-IN-CANVAS',
    message: 'Wall previews require experimental Chromium support. You can still enter the museum and open every exhibit in reading mode.',
  }
}

export class SharedCanvasHTMLTexture extends HTMLTexture {
  private static readonly liveTextures = new Set<SharedCanvasHTMLTexture>()
  private disposed = false

  constructor(element: HTMLElement) {
    super(element)
    SharedCanvasHTMLTexture.liveTextures.add(this)
  }

  override dispose() {
    if (this.disposed) return
    this.disposed = true

    const parent = this.image?.parentNode
    const hasLiveSibling = parent !== null && [...SharedCanvasHTMLTexture.liveTextures].some(
      (texture) => texture !== this && texture.image?.parentNode === parent,
    )
    SharedCanvasHTMLTexture.liveTextures.delete(this)

    if (hasLiveSibling) {
      // Three r185 clears canvas.onpaint here, but WebGLRenderer shares that callback across textures.
      Texture.prototype.dispose.call(this)
      return
    }

    super.dispose()
  }
}
