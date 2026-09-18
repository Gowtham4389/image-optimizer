import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test('editor, resize, and privacy dialog meet core accessibility rules', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('button', { name: /^Download image/ })).toBeEnabled()
  for (const view of ['Optimize', 'Resize', 'Adjust', 'Watermark', 'Convert']) {
    await page.getByRole('tab', { name: view, exact: true }).click()
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze()
    expect(
      results.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => ({ target: n.target, summary: n.failureSummary })),
      })),
    ).toEqual([])
  }
  await page.getByRole('button', { name: 'Privacy', exact: true }).click()
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
  expect(
    results.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
  ).toEqual([])
})
