/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest'
import {
  detectNativeHTMLInCanvas,
  getHTMLInCanvasNotice,
  SharedCanvasHTMLTexture,
} from './htmlInCanvas'

const asCanvas = (value: object) => value as HTMLCanvasElement
const asContext = (value: object) => value as WebGLRenderingContext

describe('detectNativeHTMLInCanvas', () => {
  it.each([3, 6] as const)('accepts the supported %i-argument upload API', (arity) => {
    const canvas = asCanvas({ requestPaint() {} })
    const texElementImage2D = arity === 3
      ? function (_target: number, _format: number, _element: Element) {}
      : function (_target: number, _level: number, _internalFormat: number, _format: number, _type: number, _element: Element) {}
    const context = asContext({ texElementImage2D })

    expect(detectNativeHTMLInCanvas(canvas, context, 'Chromium/150.0')).toEqual({
      supported: true,
      uploadArity: arity,
    })
  })

  it('identifies Chromium with the experiment disabled', () => {
    const context = asContext({ texElementImage2D(_target: number, _format: number, _element: Element) {} })

    const support = detectNativeHTMLInCanvas(asCanvas({}), context, 'Chrome/149.0')
    expect(support).toEqual({
      supported: false,
      reason: 'chromium-api-disabled',
    })
    if (support.supported) throw new Error('Expected disabled Chromium API')
    expect(getHTMLInCanvasNotice(support.reason)).toMatchObject({
      flag: 'chrome://flags/#canvas-draw-element',
    })
  })

  it('does not send non-Chromium users to a Chrome flag', () => {
    const canvas = asCanvas({ requestPaint() {} })

    const support = detectNativeHTMLInCanvas(canvas, asContext({}), 'Firefox/141.0')
    expect(support).toEqual({ supported: false, reason: 'browser-unsupported' })
    if (support.supported) throw new Error('Expected unsupported browser')
    expect(getHTMLInCanvasNotice(support.reason).flag).toBeUndefined()
  })

  it('treats Chrome on iOS as unsupported instead of advertising a desktop Chromium flag', () => {
    const support = detectNativeHTMLInCanvas(asCanvas({}), asContext({}), 'CriOS/141.0 Mobile/15E148 Safari/604.1')

    expect(support).toEqual({ supported: false, reason: 'browser-unsupported' })
  })

  it('rejects upload signatures that Three.js 0.185 cannot call', () => {
    const canvas = asCanvas({ requestPaint() {} })
    const context = asContext({ texElementImage2D(_target: number, _element: Element) {} })

    expect(detectNativeHTMLInCanvas(canvas, context, 'Chromium/151.0')).toEqual({
      supported: false,
      reason: 'incompatible-signature',
    })
  })

  it('keeps the shared canvas paint callback when one of multiple textures is disposed', () => {
    const canvas = document.createElement('canvas')
    Reflect.set(canvas, 'requestPaint', () => undefined)
    const firstElement = document.createElement('div')
    const secondElement = document.createElement('div')
    canvas.append(firstElement, secondElement)
    const first = new SharedCanvasHTMLTexture(firstElement)
    const second = new SharedCanvasHTMLTexture(secondElement)
    const sharedPaint = (event: { changedElements: Element[] }) => {
      if (event.changedElements.includes(secondElement)) second.needsUpdate = true
    }
    const disposed = vi.fn()
    first.addEventListener('dispose', disposed)
    Reflect.set(canvas, 'onpaint', sharedPaint)
    const secondVersion = second.version

    first.dispose()
    Reflect.get(canvas, 'onpaint')({ changedElements: [secondElement] })

    expect(disposed).toHaveBeenCalledOnce()
    expect(Reflect.get(canvas, 'onpaint')).toBe(sharedPaint)
    expect(second.version).toBe(secondVersion + 1)

    second.dispose()
    expect(Reflect.get(canvas, 'onpaint')).toBeNull()
  })
})
