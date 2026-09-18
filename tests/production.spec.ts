import { test, expect } from '@playwright/test'
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'

// Exercise the built app through an ordinary static server under a non-root path.
test('production assets, worker, crop chunk, and downloads work under a subdirectory', async ({
  page,
}) => {
  test.skip(
    !existsSync('dist/index.html'),
    'Run npm run build to verify static production hosting.',
  )
  const root = path.resolve('dist')
  const server = createServer(async (request, response) => {
    try {
      const pathname = new URL(request.url!, 'http://localhost').pathname
      if (!pathname.startsWith('/tools/pixelwell/')) {
        response.writeHead(404)
        response.end()
        return
      }
      const relative = pathname.slice('/tools/pixelwell/'.length) || 'index.html'
      const resolved = path.resolve(root, relative)
      if (!resolved.startsWith(root + path.sep)) {
        response.writeHead(403)
        response.end()
        return
      }
      const mime =
        (
          {
            '.html': 'text/html',
            '.js': 'text/javascript',
            '.css': 'text/css',
            '.jpg': 'image/jpeg',
            '.svg': 'image/svg+xml',
            '.wasm': 'application/wasm',
          } as Record<string, string>
        )[path.extname(resolved)] || 'application/octet-stream'
      response.setHeader('Content-Type', mime)
      response.setHeader(
        'Content-Security-Policy',
        "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; worker-src 'self' blob:; connect-src 'self'; object-src 'none'; base-uri 'self'",
      )
      response.end(await readFile(resolved))
    } catch {
      response.writeHead(404)
      response.end()
    }
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  try {
    const address = server.address() as { port: number }
    const failed: string[] = []
    page.on('response', (r) => {
      if (r.status() >= 400) failed.push(r.url())
    })
    await page.goto(`http://127.0.0.1:${address.port}/tools/pixelwell/`)
    await expect(page.getByRole('button', { name: /^Download image/ })).toBeEnabled()
    await page.getByRole('tab', { name: 'Crop', exact: true }).click()
    await page.getByRole('button', { name: 'Open crop editor' }).click()
    await expect(page.getByRole('button', { name: 'Apply crop' })).toBeEnabled()
    await page.getByRole('button', { name: 'Cancel', exact: true }).click()
    const downloaded = page.waitForEvent('download')
    await page.getByRole('button', { name: /^Download image/ }).click()
    expect((await downloaded).suggestedFilename()).toContain('alpine-escape-optimized')
    await page.getByLabel('Choose image file').setInputFiles({
      name: 'production.eps',
      mimeType: 'application/postscript',
      buffer: Buffer.from(
        '%!PS-Adobe-3.0 EPSF-3.0\n%%BoundingBox: 0 0 100 60\n%%EndComments\n0 0 1 setrgbcolor 0 0 100 60 rectfill showpage\n%%EOF',
      ),
    })
    await expect(page.locator('.file-title strong')).toHaveText('production.eps')
    await expect(page.locator('.vector-import-details')).toContainText('200 × 120 px')
    await expect(page.getByRole('button', { name: /^Download image/ })).toBeEnabled()
    const converted = page.waitForEvent('download')
    await page.getByRole('button', { name: /^Download image/ }).click()
    expect((await converted).suggestedFilename()).toContain('production-optimized')
    expect(failed).toEqual([])
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    )
  }
})
