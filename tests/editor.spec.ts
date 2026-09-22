import { test, expect, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

async function ready(page: Page) {
  await page.goto('/')
  await expect(page.getByRole('button', { name: /^Download image/ })).toBeEnabled()
}
async function save(page: Page) {
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: /^Download image/ }).click()
  return download
}
async function pixels(page: Page, filePath: string) {
  const data = await readFile(filePath)
  return page.evaluate(async (base64) => {
    const binary = atob(base64),
      bytes = new Uint8Array(binary.length)
    for (let i = 0; i < bytes.length; i++) bytes[i] = binary.charCodeAt(i)
    const bitmap = await createImageBitmap(new Blob([bytes]))
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(bitmap, 0, 0)
    const color = Array.from(ctx.getImageData(0, 0, 1, 1).data)
    const result = { width: bitmap.width, height: bitmap.height, color }
    bitmap.close()
    return result
  }, data.toString('base64'))
}
async function uploadTransparent(page: Page) {
  const data = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 120
    canvas.height = 80
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#ff0000'
    ctx.fillRect(40, 20, 40, 40)
    return canvas.toDataURL('image/png').split(',')[1]
  })
  await page.locator('input[type=file]').setInputFiles({
    name: 'transparent.png',
    mimeType: 'image/png',
    buffer: Buffer.from(data, 'base64'),
  })
  await expect(page.locator('.file-title strong')).toHaveText('transparent.png')
  await expect(page.getByRole('button', { name: /^Download image/ })).toBeEnabled()
}

test('sample, real export, format detection, and private processing', async ({ page }) => {
  const imageUploads: string[] = []
  const errors: string[] = []
  page.on('request', (r) => {
    if (
      r.method() === 'POST' ||
      (!r.url().startsWith('http://127.0.0.1') &&
        !r.url().startsWith('blob:') &&
        !r.url().startsWith('data:'))
    )
      imageUploads.push(r.url())
  })
  page.on('pageerror', (e) => errors.push(e.message))
  await ready(page)
  await expect(page.getByRole('heading', { level: 1 })).toContainText('A little lighter.')
  await expect(page.getByRole('button', { name: 'AVIF', exact: true })).toBeEnabled()
  const download = await save(page)
  expect(download.suggestedFilename()).toMatch(/alpine-escape-optimized\.(webp|png|jpg)$/)
  const decoded = await pixels(page, (await download.path())!)
  expect(decoded.width).toBe(1920)
  expect(decoded.height).toBeGreaterThan(1000)
  expect(imageUploads).toEqual([])
  expect(errors).toEqual([])
})

for (const fallback of [false, true]) {
  test(`AVIF export preserves dimensions and transparency (${fallback ? 'fallback' : 'worker'})`, async ({
    page,
  }) => {
    if (fallback) {
      await page.addInitScript(() => {
        Object.defineProperty(window, 'OffscreenCanvas', { value: undefined })
      })
    }
    await ready(page)
    await uploadTransparent(page)
    await page.getByRole('tab', { name: 'Convert', exact: true }).click()
    await page.getByRole('button', { name: 'AVIF', exact: true }).click()
    await expect(page.getByRole('button', { name: /^Download image/ })).toBeEnabled()
    const downloaded = await save(page)
    expect(downloaded.suggestedFilename()).toBe('transparent-optimized.avif')
    const filePath = (await downloaded.path())!
    const bytes = await readFile(filePath)
    expect(bytes.toString('ascii', 4, 12)).toBe('ftypavif')
    const decoded = await pixels(page, filePath)
    expect(decoded).toMatchObject({ width: 120, height: 80 })
    expect(decoded.color[3]).toBe(0)
    await expect(page.getByRole('alert')).toHaveCount(0)
  })
}

test('resize preserves proportions, undo/redo and customizable filename', async ({ page }) => {
  await ready(page)
  await page.getByRole('tab', { name: 'Resize', exact: true }).click()
  const width = page.getByRole('spinbutton', { name: 'Width', exact: true })
  const height = page.getByRole('spinbutton', { name: 'Height', exact: true })
  const initialHeight = Number(await height.inputValue())
  await width.fill('960')
  await width.press('Tab')
  await expect(height).toHaveValue(String(Math.round(initialHeight / 2)))
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect(width).toHaveValue('1920')
  await page.getByRole('button', { name: 'Redo', exact: true }).click()
  await expect(width).toHaveValue('960')
  await page.getByRole('button', { name: 'Unlock aspect ratio' }).click()
  await height.fill('400')
  await height.press('Tab')
  await expect(width).toHaveValue('960')
  await page.getByRole('textbox', { name: 'Download filename' }).fill('my-banner')
  await expect(page.getByRole('button', { name: /^Download image/ })).toBeEnabled()
  const download = await save(page)
  expect(download.suggestedFilename()).toMatch(/^my-banner\./)
  expect(await pixels(page, (await download.path())!)).toMatchObject({ width: 960, height: 400 })
  await page.getByRole('button', { name: 'Restore original' }).click()
  await expect(width).toHaveValue('1920')
})

test('transparency, JPG background, adjust and PNG lossless', async ({ page }) => {
  await ready(page)
  await uploadTransparent(page)
  await page.getByRole('button', { name: 'PNG', exact: true }).click()
  await expect(page.getByRole('slider', { name: 'Image quality' })).toBeDisabled()
  await expect(page.getByRole('button', { name: /^Download image/ })).toBeEnabled()
  let result = await save(page)
  expect((await pixels(page, (await result.path())!)).color[3]).toBe(0)
  await page.getByRole('button', { name: /Smart optimization/ }).click()
  await expect(page.getByRole('button', { name: /^Download image/ })).toBeEnabled()
  result = await save(page)
  expect((await pixels(page, (await result.path())!)).color[3]).toBe(0)
  await page.getByRole('button', { name: 'JPG', exact: true }).click()
  await page.getByLabel('JPEG background color').fill('#00ff00')
  await expect(page.getByRole('button', { name: /^Download image/ })).toBeEnabled()
  result = await save(page)
  expect(result.suggestedFilename()).toBe('transparent-optimized.jpg')
  const p = await pixels(page, (await result.path())!)
  expect(p.color[1]).toBeGreaterThan(245)
  expect(p.color[0]).toBeLessThan(10)
  expect(p.color[3]).toBe(255)
  await page.getByRole('tab', { name: 'Adjust', exact: true }).click()
  await page.getByRole('button', { name: 'Rotate right', exact: true }).click()
  await expect(page.getByRole('button', { name: /^Download image/ })).toBeEnabled()
  result = await save(page)
  expect(await pixels(page, (await result.path())!)).toMatchObject({ width: 80, height: 120 })
})

test('crop handles, ratio, numeric keyboard control, apply and undo', async ({ page }) => {
  await ready(page)
  await page.getByRole('tab', { name: 'Crop', exact: true }).click()
  await page.getByRole('button', { name: 'Open crop editor' }).click()
  await expect(page.getByRole('button', { name: 'Apply crop' })).toBeEnabled()
  await page.getByRole('button', { name: '1:1', exact: true }).click()
  await page.getByRole('spinbutton', { name: 'Crop width', exact: true }).fill('500')
  await page.getByRole('button', { name: 'Apply crop' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^Download image/ })).toBeEnabled()
  const result = await save(page)
  const decoded = await pixels(page, (await result.path())!)
  expect(decoded.width).toBeCloseTo(decoded.height, -1)
  expect(decoded.width).toBeLessThan(1920)
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await page.getByRole('tab', { name: 'Resize', exact: true }).click()
  await expect(page.getByRole('spinbutton', { name: 'Width', exact: true })).toHaveValue('1920')
})

test('batch outputs and ZIP with duplicate filenames', async ({ page }) => {
  await ready(page)
  await page.getByRole('button', { name: /Batch optimizer/ }).click()
  await page
    .locator('input[multiple]')
    .setInputFiles([
      path.resolve('public/sample-landscape.jpg'),
      path.resolve('public/sample-landscape.jpg'),
    ])
  await expect(page.locator('.batch-item')).toHaveCount(2)
  await page.getByRole('spinbutton', { name: 'Max width' }).fill('400')
  await page.getByRole('button', { name: 'AVIF', exact: true }).click()
  await page.getByRole('button', { name: 'Optimize all images' }).click()
  await expect(page.getByText('2 of 2 images optimized')).toBeVisible()
  const dl = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download all as ZIP' }).click()
  const downloaded = await dl
  expect(downloaded.suggestedFilename()).toBe('pixelwell-optimized.zip')
  const { unzipSync } = await import('fflate')
  const zip = unzipSync(new Uint8Array(await readFile((await downloaded.path())!)))
  expect(Object.keys(zip)).toHaveLength(2)
  expect(Object.keys(zip).some((key) => key.includes('-2.'))).toBeTruthy()
  for (const [name, data] of Object.entries(zip)) {
    expect(name).toMatch(/\.avif$/)
    expect(Buffer.from(data).toString('ascii', 4, 12)).toBe('ftypavif')
  }
  await page.getByRole('button', { name: 'Clear all' }).click()
  await expect(page.locator('.batch-item')).toHaveCount(0)
})

test('invalid files show friendly errors and editor remains usable', async ({ page }) => {
  await ready(page)
  await page.locator('input[type=file]').setInputFiles({
    name: 'broken.png',
    mimeType: 'image/png',
    buffer: Buffer.from('not really a png'),
  })
  await expect(page.getByRole('alert')).toContainText('not a supported image')
  await page.getByRole('button', { name: 'Dismiss error' }).click()
  await uploadTransparent(page)
  await expect(page.getByRole('alert')).toHaveCount(0)
})

test('responsive layout and keyboard accessible dialogs', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await ready(page)
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  ).toBeTruthy()
  await page.getByRole('button', { name: 'Help & shortcuts' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByRole('tab', { name: 'Optimize', exact: true }).focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('tab', { name: 'Convert', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  await page.getByRole('button', { name: 'Compare', exact: true }).click()
  await expect(page.getByRole('slider', { name: 'Before and after comparison' })).toBeVisible()
  await page.screenshot({
    path: `test-results/mobile-${test.info().project.name}.png`,
    fullPage: true,
  })
  await page.setViewportSize({ width: 1440, height: 1080 })
  await page.getByRole('button', { name: 'Optimized', exact: true }).click()
  await page.screenshot({
    path: `test-results/desktop-${test.info().project.name}.png`,
    fullPage: true,
  })
})

test('optional JPEG EXIF preservation normalizes orientation', async ({ page }) => {
  await ready(page)
  const jpeg = await readFile(path.resolve('public/sample-landscape.jpg'))
  const note = Buffer.from('Private camera metadata\0')
  const tiff = Buffer.alloc(8 + 2 + 24 + 4 + note.length)
  tiff.write('II')
  tiff.writeUInt16LE(42, 2)
  tiff.writeUInt32LE(8, 4)
  tiff.writeUInt16LE(2, 8)
  tiff.writeUInt16LE(0x112, 10)
  tiff.writeUInt16LE(3, 12)
  tiff.writeUInt32LE(1, 14)
  tiff.writeUInt16LE(6, 18)
  tiff.writeUInt16LE(0x10e, 22)
  tiff.writeUInt16LE(2, 24)
  tiff.writeUInt32LE(note.length, 26)
  tiff.writeUInt32LE(38, 30)
  note.copy(tiff, 38)
  const header = Buffer.alloc(4)
  header[0] = 255
  header[1] = 225
  header.writeUInt16BE(8 + tiff.length, 2)
  const file = Buffer.concat([
    jpeg.subarray(0, 2),
    header,
    Buffer.from('Exif\0\0'),
    tiff,
    jpeg.subarray(2),
  ])
  await page
    .locator('input[type=file]')
    .setInputFiles({ name: 'camera.jpg', mimeType: 'image/jpeg', buffer: file })
  await expect(page.locator('.file-title strong')).toHaveText('camera.jpg')
  await page.getByRole('button', { name: 'JPG', exact: true }).click()
  await expect(page.getByRole('button', { name: /^Download image/ })).toBeEnabled()
  let downloaded = await save(page)
  expect((await readFile((await downloaded.path())!)).includes(note)).toBeFalsy()
  await page.getByRole('checkbox', { name: /Remove image metadata/ }).uncheck()
  await expect(page.getByRole('button', { name: /^Download image/ })).toBeEnabled()
  downloaded = await save(page)
  const output = await readFile((await downloaded.path())!)
  expect(output.includes(note)).toBeTruthy()
  const exif = output.indexOf(Buffer.from('Exif\0\0'))
  expect(output.readUInt16LE(exif + 6 + 18)).toBe(1)
  expect(await pixels(page, (await downloaded.path())!)).toMatchObject({
    width: 1280,
    height: 1920,
  })
})

test('main-thread fallback, paste, adjustments, and safe resize limits', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'OffscreenCanvas', { value: undefined })
  })
  await ready(page)
  await page.evaluate(async () => {
    const canvas = document.createElement('canvas')
    canvas.width = 64
    canvas.height = 32
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#ff0000'
    ctx.fillRect(0, 0, 64, 32)
    const blob = await new Promise<Blob>((resolve) =>
      canvas.toBlob((b) => resolve(b!), 'image/png'),
    )
    const data = new DataTransfer()
    data.items.add(new File([blob], 'pasted.png', { type: 'image/png' }))
    // Firefox ignores clipboardData in constructed ClipboardEvents. Supply the file payload explicitly.
    const event = new Event('paste', { bubbles: true, cancelable: true })
    Object.defineProperty(event, 'clipboardData', { value: data })
    document.body.dispatchEvent(event)
  })
  await expect(page.locator('.file-title strong')).toHaveText('pasted.png')
  await page.getByRole('button', { name: 'PNG', exact: true }).click()
  await page.getByRole('tab', { name: 'Adjust', exact: true }).click()
  await page.getByRole('checkbox', { name: /Grayscale/ }).check()
  await expect(page.getByRole('button', { name: /^Download image/ })).toBeEnabled()
  const downloaded = await save(page)
  const result = await pixels(page, (await downloaded.path())!)
  expect(result.color[0]).toBeGreaterThan(40)
  expect(result.color[0]).toBe(result.color[1])
  expect(result.color[1]).toBe(result.color[2])
  await page.getByRole('tab', { name: 'Resize', exact: true }).click()
  const width = page.getByRole('spinbutton', { name: 'Width', exact: true })
  await width.fill('9000')
  await width.press('Tab')
  await expect(page.getByRole('alert')).toContainText('24 megapixels')
  await page.getByRole('button', { name: '50%', exact: true }).click()
  await expect(width).toHaveValue('32')
  await expect(page.getByRole('alert')).toHaveCount(0)
})
