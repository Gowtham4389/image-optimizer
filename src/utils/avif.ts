import createEncoder from '@jsquash/avif/codec/enc/avif_enc.js'
import { defaultOptions } from '@jsquash/avif/meta.js'
import wasmUrl from '@jsquash/avif/codec/enc/avif_enc.wasm?url'

// Use the single-thread codec inside our render worker: no shared-memory headers required.
let encoder: ReturnType<typeof createEncoder> | undefined

export async function encodeAvif(pixels: ImageData, quality: number): Promise<Blob> {
  encoder ??= createEncoder({ locateFile: () => wasmUrl }).catch((error: unknown) => {
    encoder = undefined
    throw error
  })
  const module = await encoder
  const output = module.encode(pixels.data, pixels.width, pixels.height, {
    ...defaultOptions,
    quality: Math.round(quality * 100),
    qualityAlpha: 100,
    speed: 8,
  })
  if (!output) throw new Error('AVIF encoding failed. Try smaller image dimensions.')
  return new Blob([new Uint8Array(output)], { type: 'image/avif' })
}
