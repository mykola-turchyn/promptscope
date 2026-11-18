import { expect, test } from '@playwright/test';
import { TEST_OWNER } from './fixtures';

const uniqueEmail = () => TEST_OWNER.email.replace('@', `+${Date.now()}@`);

test('sign up, load demo data, open a trace and add it to a dataset', async ({ page }) => {
  await page.goto('/sign-up');
  await page.getByLabel('Name').fill(TEST_OWNER.name);
  await page.getByLabel('Email').fill(uniqueEmail());
  await page.getByLabel('Password').fill(TEST_OWNER.password);
  await page.getByRole('button', { name: 'Create account' }).click();

  await expect(page.getByRole('heading', { name: 'Send your first trace' })).toBeVisible();
  await page.getByRole('button', { name: 'Load demo data' }).click();
  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible({ timeout: 30_000 });

  await page.getByRole('link', { name: 'Traces', exact: true }).click();
  await page.getByLabel('Status').selectOption('error');
  await expect(page).toHaveURL(/status=error/);
  await page.locator('tbody a').first().click();

  await expect(page.getByRole('alert')).toContainText('failed');
  await page.getByRole('button', { name: 'Add to dataset' }).click();
  await page.getByLabel('Dataset', { exact: true }).selectOption({ label: 'support-golden' });
  await page.getByRole('button', { name: 'Add item' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();

  await page.getByRole('link', { name: 'Datasets' }).click();
  await expect(page.getByText('From trace').first()).toBeVisible();
});

test('a read-only demo visitor cannot open another organization', async ({ page }) => {
  await page.goto('/sign-in');
  await page.getByRole('button', { name: 'Open live demo' }).click();
  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add to dataset' })).toHaveCount(0);

  const response = await page.goto('/someone-else/secret-project/traces');
  expect(response?.status()).toBe(404);
});
