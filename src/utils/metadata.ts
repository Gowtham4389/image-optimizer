// Preserve only the EXIF APP1 block on request. Normalize orientation and pixel dimensions after rasterization.
export async function preserveExif(
  original: Blob,
  output: Blob,
  width: number,
  height: number,
): Promise<Blob> {
  const bytes = new Uint8Array(await original.arrayBuffer())
  const blocks: Uint8Array[] = []
  for (let offset = 2; offset + 4 <= bytes.length;) {
    if (bytes[offset] !== 0xff || bytes[offset + 1] === 0xda || bytes[offset + 1] === 0xd9) break
    const size = bytes[offset + 2] * 256 + bytes[offset + 3]
    if (size < 2 || offset + size + 2 > bytes.length) break
    if (
      bytes[offset + 1] === 0xe1 &&
      String.fromCharCode(...bytes.slice(offset + 4, offset + 10)) === 'Exif\0\0'
    ) {
      const block = bytes.slice(offset, offset + size + 2)
      try {
        const view = new DataView(block.buffer),
          base = 10
        const little = view.getUint16(base) === 0x4949
        if (view.getUint16(base + 2, little) !== 42) throw new Error('Invalid TIFF')
        const visited = new Set<number>()
        function patch(relative: number) {
          if (!relative || visited.has(relative) || visited.size > 16) return
          visited.add(relative)
          const start = base + relative,
            count = view.getUint16(start, little)
          for (let i = 0; i < count; i++) {
            const at = start + 2 + i * 12,
              tag = view.getUint16(at, little),
              type = view.getUint16(at + 2, little)
            if (tag === 0x8769) patch(view.getUint32(at + 8, little))
            const value =
              tag === 0x0112
                ? 1
                : tag === 0xa002 || tag === 0x0100
                  ? width
                  : tag === 0xa003 || tag === 0x0101
                    ? height
                    : undefined
            if (value !== undefined && view.getUint32(at + 4, little) === 1) {
              if (type === 3) view.setUint16(at + 8, value, little)
              if (type === 4) view.setUint32(at + 8, value, little)
            }
          }
          // Remove the link to the original embedded thumbnail; it no longer represents the edited photo.
          view.setUint32(start + 2 + count * 12, 0, little)
        }
        patch(view.getUint32(base + 4, little))
        blocks.push(block)
      } catch {
        throw new Error(
          'This image has malformed EXIF metadata. Turn on “Remove image metadata” to export safely.',
        )
      }
    }
    offset += size + 2
  }
  if (!blocks.length) return output
  return new Blob(
    [output.slice(0, 2), ...blocks.map((b) => b.buffer as ArrayBuffer), output.slice(2)],
    { type: 'image/jpeg' },
  )
}
