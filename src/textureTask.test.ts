import { describe, expect, it, vi } from 'vitest'
import { createTextureTask } from './textureTask'

type TestTexture = { dispose: ReturnType<typeof vi.fn> }

const createTexture = (): TestTexture => ({ dispose: vi.fn() })

describe('createTextureTask', () => {
  it('publishes a completed texture and disposes it on cancellation', async () => {
    const texture = createTexture()
    const publish = vi.fn()
    const task = createTextureTask(async () => texture, publish)

    await expect(task.run()).resolves.toBe(texture)
    expect(publish).toHaveBeenCalledWith(texture)

    task.cancel()
    expect(texture.dispose).toHaveBeenCalledOnce()
  })

  it('disposes a texture that resolves after cancellation without publishing it', async () => {
    const texture = createTexture()
    const publish = vi.fn()
    let resolveTexture: ((texture: TestTexture) => void) | undefined
    const task = createTextureTask(
      () => new Promise((resolve) => {
        resolveTexture = resolve
      }),
      publish,
    )

    const result = task.run()
    task.cancel()
    resolveTexture?.(texture)

    await expect(result).resolves.toBeNull()
    expect(texture.dispose).toHaveBeenCalledOnce()
    expect(publish).not.toHaveBeenCalled()
  })

  it('propagates production failures without publishing', async () => {
    const publish = vi.fn()
    const error = new Error('rasterization failed')
    const task = createTextureTask(async () => Promise.reject(error), publish)

    await expect(task.run()).rejects.toBe(error)
    expect(publish).not.toHaveBeenCalled()
  })
})
