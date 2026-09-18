import { test, expect, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'

async function fixture(page: Page, logo = false) {
  const data = await page.evaluate((logo) => {
    const canvas = document.createElement('canvas')
    canvas.width = logo ? 40 : 200
    canvas.height = logo ? 20 : 120
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = logo ? '#ff0000' : '#0000ff'
    ctx.fillRect(0, 0, logo ? 20 : 200, logo ? 20 : 120)
    return canvas.toDataURL('image/png').split(',')[1]
  }, logo)
  return {
    name: logo ? 'brand-logo.png' : 'blue-photo.png',
    mimeType: 'image/png',
    buffer: Buffer.from(data, 'base64'),
  }
}
async function setup(page: Page, fallback = false) {
  if (fallback)
    await page.addInitScript(() =>
      Object.defineProperty(window, 'OffscreenCanvas', { value: undefined }),
    )
  await page.goto('/')
  await expect(page.getByRole('button', { name: /^Download image/ })).toBeEnabled()
  await page.getByLabel('Choose image file').setInputFiles(await fixture(page))
  await expect(page.locator('.file-title strong')).toHaveText('blue-photo.png')
  await page.getByRole('button', { name: 'PNG', exact: true }).click()
  await page.getByRole('tab', { name: 'Watermark', exact: true }).click()
}
async function slider(page: Page, name: string, value: string) {
  const control = page.getByRole('slider', { name, exact: true })
  await control.fill(value)
  await control.blur()
}
async function exported(page: Page) {
  const button = page.getByRole('button', { name: /^Download image/ })
  await expect(button).toBeEnabled()
  const downloaded = page.waitForEvent('download')
  await button.click()
  const bytes = await readFile((await (await downloaded).path())!)
  return page.evaluate(async (base64) => {
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
    const image = await createImageBitmap(new Blob([bytes]))
    const canvas = document.createElement('canvas')
    canvas.width = image.width
    canvas.height = image.height
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(image, 0, 0)
    const d = ctx.getImageData(0, 0, canvas.width, canvas.height).data
    const pixel = (x: number, y: number) =>
      Array.from(d.slice((y * canvas.width + x) * 4, (y * canvas.width + x) * 4 + 4))
    let changed = 0,
      maxRed = 0
    for (let i = 0; i < d.length; i += 4) {
      if (d[i] > 0 || d[i + 1] > 0 || d[i + 2] < 255) changed++
      maxRed = Math.max(maxRed, d[i])
    }
    const result = {
      width: canvas.width,
      height: canvas.height,
      left: pixel(Math.floor(canvas.width * 0.4), Math.floor(canvas.height / 2)),
      right: pixel(Math.floor(canvas.width * 0.6), Math.floor(canvas.height / 2)),
      changed,
      maxRed,
    }
    image.close()
    return result
  }, bytes.toString('base64'))
}

test('text watermark opacity, color, history, and reset affect the actual export', async ({
  page,
}) => {
  await setup(page)
  await page.getByRole('textbox', { name: 'Watermark text', exact: true }).fill('My brand')
  await page.getByLabel('Watermark text color').fill('#ff0000')
  await page.getByLabel('Position', { exact: true }).selectOption({ label: 'Center' })
  await slider(page, 'Watermark size', '75')
  let output = await exported(page)
  expect(output.changed).toBeGreaterThan(100)
  expect(output.maxRed).toBeGreaterThan(100)
  expect(output.maxRed).toBeLessThanOrEqual(129)
  await slider(page, 'Watermark opacity', '100')
  output = await exported(page)
  expect(output.maxRed).toBe(255)
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect(page.getByRole('slider', { name: 'Watermark opacity' })).toHaveValue('50')
  await page.getByRole('button', { name: 'Redo', exact: true }).click()
  await expect(page.getByRole('slider', { name: 'Watermark opacity' })).toHaveValue('100')
  await slider(page, 'Watermark opacity', '0')
  expect((await exported(page)).changed).toBe(0)
  await page.getByRole('button', { name: 'Restore original' }).click()
  await expect(page.getByRole('textbox', { name: 'Watermark text', exact: true })).toHaveValue('')
  await expect(page.getByRole('checkbox', { name: /Show watermark/ })).not.toBeChecked()
})

for (const fallback of [false, true]) {
  test(`transparent image watermark blends correctly, ${fallback ? 'Canvas fallback' : 'worker rendering'}`, async ({
    page,
  }) => {
    await setup(page, fallback)
    await page.getByRole('button', { name: 'Image', exact: true }).click()
    await page.getByLabel('Upload watermark image').setInputFiles(await fixture(page, true))
    await expect(page.getByAltText('Watermark logo')).toBeVisible()
    await page.getByLabel('Position', { exact: true }).selectOption({ label: 'Center' })
    await slider(page, 'Watermark size', '40')
    let output = await exported(page)
    expect(output.left[0]).toBeGreaterThanOrEqual(127)
    expect(output.left[0]).toBeLessThanOrEqual(129)
    expect(output.left[2]).toBeGreaterThanOrEqual(126)
    expect(output.left[2]).toBeLessThanOrEqual(128)
    expect(output.right).toEqual([0, 0, 255, 255])
    await page.getByRole('checkbox', { name: /Show watermark/ }).uncheck()
    expect((await exported(page)).changed).toBe(0)
    await page.getByRole('checkbox', { name: /Show watermark/ }).check()
    await page.getByRole('button', { name: 'Remove watermark image' }).click()
    expect((await exported(page)).changed).toBe(0)
    await page.getByRole('button', { name: 'Undo', exact: true }).click()
    output = await exported(page)
    expect(output.left[0]).toBeGreaterThanOrEqual(127)
    await page
      .getByLabel('Upload watermark image')
      .setInputFiles({ name: 'broken.png', mimeType: 'image/png', buffer: Buffer.from('invalid') })
    await expect(page.getByRole('alert')).toContainText('not a supported image')
    await expect(page.getByAltText('Watermark logo')).toBeVisible()
  })
}

test('crop keeps a watermark editable and never bakes it into the source', async ({ page }) => {
  await setup(page)
  await page.getByRole('button', { name: 'Image', exact: true }).click()
  await page.getByLabel('Upload watermark image').setInputFiles(await fixture(page, true))
  await page.getByLabel('Position', { exact: true }).selectOption({ label: 'Center' })
  await slider(page, 'Watermark size', '40')
  await page.getByRole('tab', { name: 'Crop', exact: true }).click()
  await page.getByRole('button', { name: 'Open crop editor' }).click()
  await expect(page.getByRole('button', { name: 'Apply crop' })).toBeEnabled()
  await page.getByRole('button', { name: 'Apply crop' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  let output = await exported(page)
  expect(output.width).toBeLessThan(200)
  expect(output.maxRed).toBeLessThanOrEqual(129)
  expect(output.changed).toBeGreaterThan(0)
  await page.getByRole('tab', { name: 'Watermark', exact: true }).click()
  await page.getByRole('checkbox', { name: /Show watermark/ }).uncheck()
  output = await exported(page)
  expect(output.changed).toBe(0)
})

test('watermark controls fit mobile, and dropping a logo preserves the main photo', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await setup(page)
  await page.getByRole('button', { name: 'Image', exact: true }).click()
  const file = await fixture(page, true)
  const data = await page.evaluateHandle((base64) => {
    const transfer = new DataTransfer()
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
    transfer.items.add(new File([bytes], 'dropped-logo.png', { type: 'image/png' }))
    return transfer
  }, file.buffer.toString('base64'))
  await page.locator('.watermark-image-section').dispatchEvent('drop', { dataTransfer: data })
  await data.dispose()
  await expect(page.getByAltText('Watermark logo')).toBeVisible()
  await expect(page.locator('.file-title strong')).toHaveText('blue-photo.png')
  await expect(page.locator('.drop-overlay')).toHaveCount(0)
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  ).toBeTruthy()
  await page.screenshot({
    path: `test-results/watermark-mobile-${test.info().project.name}.png`,
    fullPage: true,
  })
})
