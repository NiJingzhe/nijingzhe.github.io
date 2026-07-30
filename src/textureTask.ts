export type DisposableTexture = {
  dispose: () => void
}

export type TextureTask<T extends DisposableTexture> = {
  run: () => Promise<T | null>
  cancel: () => void
  isCancelled: () => boolean
}

export function createTextureTask<T extends DisposableTexture>(
  produce: () => Promise<T>,
  publish: (texture: T) => void,
): TextureTask<T> {
  let cancelled = false
  let publishedTexture: T | null = null

  return {
    async run() {
      const texture = await produce()
      if (cancelled) {
        texture.dispose()
        return null
      }

      publishedTexture = texture
      publish(texture)
      return texture
    },
    cancel() {
      if (cancelled) return
      cancelled = true
      publishedTexture?.dispose()
      publishedTexture = null
    },
    isCancelled() {
      return cancelled
    },
  }
}
