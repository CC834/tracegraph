import { expect, test } from '@playwright/test'

test('replays the complete synthetic record journey', async ({ page }) => {
  await page.goto('/')

  await expect(page).toHaveTitle(/TraceGraph/)
  await expect(page.getByText('Synthetic public demo')).toBeVisible()
  await page.getByRole('button', { name: 'Pause replay' }).click()
  await page.getByRole('button', { name: 'Show Journey explained' }).click()
  await expect(page.getByRole('heading', { name: 'Journey explained' })).toBeVisible()
  await expect(page.getByText('9', { exact: true }).first()).toBeVisible()
})

