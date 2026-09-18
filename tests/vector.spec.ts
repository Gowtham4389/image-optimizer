import { test, expect, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'

const svg =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 60"><defs><linearGradient id="red"><stop stop-color="red"/><stop offset="1" stop-color="red"/></linearGradient></defs><rect x="10" y="10" width="60" height="40" fill="url(#red)"/></svg>'
const eps =
  '%!PS-Adobe-3.0 EPSF-3.0\n%%BoundingBox: 10 20 110 80\n%%EndComments\n1 0 0 setrgbcolor\n20 30 60 40 rectfill\nshowpage\n%%EOF\n'
const fixture = (kind: string, text = kind === 'svg' ? svg : eps) => ({
  name: `artwork.${kind}`,
  mimeType: kind === 'svg' ? 'image/svg+xml' : 'application/postscript',
  buffer: Buffer.from(text),
})
async function ready(page: Page) {
  await page.goto('/')
  await expect(page.getByRole('button', { name: /^Download image/ })).toBeEnabled()
  await page.getByRole('tab', { name: 'Convert', exact: true }).click()
}
async function exported(page: Page) {
  await expect(page.getByRole('button', { name: /^Download image/ })).toBeEnabled()
  const event = page.waitForEvent('download')
  await page.getByRole('button', { name: /^Download image/ }).click()
  const download = await event
  const buffer = await readFile((await download.path())!)
  const pixels = await page.evaluate(async (base64) => {
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
    const image = await createImageBitmap(new Blob([bytes]))
    const canvas = document.createElement('canvas')
    canvas.width = image.width
    canvas.height = image.height
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(image, 0, 0)
    const result = {
      width: image.width,
      height: image.height,
      corner: Array.from(ctx.getImageData(0, 0, 1, 1).data),
      center: Array.from(ctx.getImageData(image.width / 2, image.height / 2, 1, 1).data),
    }
    image.close()
    return result
  }, buffer.toString('base64'))
  return { ...pixels, name: download.suggestedFilename(), bytes: buffer }
}

for (const kind of ['svg', 'eps']) {
  test(`${kind.toUpperCase()} conversion preserves artwork and transparency; crop, history, JPG and WebP exports work`, async ({
    page,
  }) => {
    const external: string[] = []
    page.on('request', (r) => {
      if (/^https?:/.test(r.url()) && !r.url().startsWith('http://127.0.0.1:5173/'))
        external.push(r.url())
    })
    await ready(page)
    await page.getByLabel('Choose vector file').setInputFiles(fixture(kind))
    await expect(page.locator('.file-title strong')).toHaveText(`artwork.${kind}`)
    await expect(page.locator('.vector-import-details')).toContainText('200 × 120 px')
    await page.getByRole('button', { name: 'PNG', exact: true }).click()
    let image = await exported(page)
    expect(image).toMatchObject({ width: 200, height: 120, center: [255, 0, 0, 255] })
    expect(image.corner[3]).toBe(0)
    expect(image.bytes.subarray(1, 4).toString()).toBe('PNG')
    await page.getByRole('button', { name: 'Crop before converting' }).click()
    await expect(page.getByRole('button', { name: 'Apply crop' })).toBeEnabled()
    await page.getByRole('button', { name: '1:1', exact: true }).click()
    await page.getByRole('button', { name: 'Apply crop' }).click()
    image = await exported(page)
    expect(image.width).toBe(image.height)
    expect(image.width).toBeLessThan(200)
    await page.getByRole('button', { name: 'Undo', exact: true }).click()
    await page.getByRole('button', { name: 'JPG', exact: true }).click()
    image = await exported(page)
    expect(image).toMatchObject({ width: 200, height: 120, name: 'artwork-optimized.jpg' })
    expect(image.corner[3]).toBe(255)
    expect(image.corner[0]).toBeGreaterThan(245)
    expect(image.bytes[0]).toBe(255)
    expect(image.bytes[1]).toBe(216)
    const webp = page.getByRole('button', { name: 'WebP', exact: true })
    if (await webp.isEnabled()) {
      await webp.click()
      image = await exported(page)
      expect(image.name).toBe('artwork-optimized.webp')
      expect(image.bytes.subarray(8, 12).toString()).toBe('WEBP')
    }
    expect(external).toEqual([])
  })
}

test('vector resolution, generic upload, invalid inputs and self-contained SVG validation', async ({
  page,
}) => {
  await ready(page)
  await page.getByLabel('Import resolution').selectOption('4')
  await page.getByLabel('Choose vector file').setInputFiles(fixture('svg'))
  await expect(page.locator('.vector-import-details')).toContainText('400 × 240 px')
  for (const invalid of [
    '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg"><image href="https://example.com/tracker.png"/></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg"><style>@import "https://example.com/a.css";</style></svg>',
    'not SVG',
  ]) {
    await page.getByLabel('Choose vector file').setInputFiles(fixture('svg', invalid))
    await expect(page.getByRole('alert')).toContainText('This SVG')
    await expect(page.locator('.vector-import-details')).toContainText('400 × 240 px')
  }
  await page.getByLabel('Choose vector file').setInputFiles(fixture('eps', 'not EPS'))
  await expect(page.getByRole('alert')).toContainText('not a valid EPS')
  await page.getByLabel('Choose image file').setInputFiles(fixture('eps'))
  await expect(page.locator('.file-title strong')).toHaveText('artwork.eps')
  await expect(page.locator('.vector-import-details')).toContainText('200 × 120 px')
})

test('binary EPS preview header and trailer bounding box are supported', async ({ page }) => {
  await ready(page)
  const ps = Buffer.from(
    eps
      .replace('%%BoundingBox: 10 20 110 80', '%%BoundingBox: (atend)')
      .replace('%%EOF', '%%Trailer\n%%BoundingBox: 10 20 110 80\n%%EOF'),
  )
  const header = Buffer.alloc(30)
  header.writeUInt32LE(0xc6d3d0c5, 0)
  header.writeUInt32LE(30, 4)
  header.writeUInt32LE(ps.length, 8)
  await page
    .getByLabel('Choose vector file')
    .setInputFiles({ ...fixture('eps'), buffer: Buffer.concat([header, ps]) })
  await expect(page.locator('.file-title strong')).toHaveText('artwork.eps')
  await page.getByRole('button', { name: 'PNG', exact: true }).click()
  expect(await exported(page)).toMatchObject({ width: 200, height: 120, center: [255, 0, 0, 255] })
})

test('EPS import can be cancelled without losing the current image; mobile converter fits', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await ready(page)
  await page
    .getByLabel('Choose vector file')
    .setInputFiles(fixture('eps', eps.replace('showpage', '{} loop\nshowpage')))
  await expect(page.getByRole('button', { name: 'Cancel import' })).toBeVisible()
  await page.getByRole('button', { name: 'Cancel import' }).click()
  await expect(page.locator('.file-title strong')).toHaveText('alpine-escape.jpg')
  await expect(page.getByRole('button', { name: /^Download image/ })).toBeEnabled()
  await page.getByLabel('Choose vector file').setInputFiles(fixture('svg'))
  await expect(page.locator('.file-title strong')).toHaveText('artwork.svg')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy()
  await page.screenshot({
    path: `test-results/vector-mobile-${test.info().project.name}.png`,
    fullPage: true,
  })
})

test('SVG authoring metadata and styled artboard size render at the chosen resolution', async ({
  page,
}) => {
  await ready(page)
  const artwork = svg
    .replace('viewBox="0 0 100 60"', 'viewBox="0 0 100 60" style="width:100px;height:60px"')
    .replace(
      '<defs>',
      '<metadata><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description>Design source</rdf:Description></rdf:RDF></metadata><defs>',
    )
  await page.getByLabel('Import resolution').selectOption('4')
  await page.getByLabel('Choose vector file').setInputFiles(fixture('svg', artwork))
  await expect(page.locator('.file-title strong')).toHaveText('artwork.svg')
  await page.getByRole('button', { name: 'PNG', exact: true }).click()
  expect(await exported(page)).toMatchObject({ width: 400, height: 240, center: [255, 0, 0, 255] })
  await page
    .getByLabel('Choose vector file')
    .setInputFiles(fixture('eps', eps.replace('rectfill', 'unknownPostscriptOperator')))
  await expect(page.getByRole('alert')).toContainText('This EPS could not be rendered')
  await expect(page.locator('.file-title strong')).toHaveText('artwork.svg')
})
