import { expect, test } from '@playwright/test'

test('replays the complete synthetic record journey', async ({ page }) => {
  await page.goto('/')

  await expect(page).toHaveTitle(/Relational Lineage Explorer/)
  await expect(page.getByText('Synthetic public demo')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Trace configuration' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Run Trace' })).toBeDisabled()
  await page.getByRole('button', { name: 'Play replay' }).click()
  await expect(page.getByRole('button', { name: 'Pause replay' })).toBeVisible()
  await page.getByRole('button', { name: 'Pause replay' }).click()
  await page.getByRole('button', { name: 'Show Journey explained' }).click()
  await expect(page.getByText('Journey explained', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('9', { exact: true }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Export JSON' })).toBeVisible()
})
