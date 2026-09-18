import type { GhostscriptModuleFactory } from '@bentopdf/gs-wasm'

self.onmessage = async ({ data }) => {
  try {
    const { default: factory } = (await import(/* @vite-ignore */ data.scriptUrl)) as {
      default: GhostscriptModuleFactory
    }
    const gs = await factory({
      noInitialRun: true,
      locateFile: () => data.wasmUrl,
      print: () => {},
      printErr: () => {},
    })
    gs.FS.writeFile('/input.eps', data.bytes)
    const status = gs.callMain([
      '-dSAFER',
      '-dBATCH',
      '-dNOPAUSE',
      '-dQUIET',
      '-dEPSCrop',
      '-dFIXEDMEDIA',
      '-dFirstPage=1',
      '-dLastPage=1',
      '-sDEVICE=pngalpha',
      '-dTextAlphaBits=4',
      '-dGraphicsAlphaBits=4',
      `-r${72 * data.scale}`,
      `-g${data.width}x${data.height}`,
      '-sOutputFile=/output.png',
      '/input.eps',
    ])
    if (status !== 0) throw new Error('EPS rendering failed')
    const bytes = gs.FS.readFile('/output.png') as Uint8Array<ArrayBuffer>
    self.postMessage({ blob: new Blob([bytes], { type: 'image/png' }) })
  } catch {
    self.postMessage({ error: true })
  }
}
