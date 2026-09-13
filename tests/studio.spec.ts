import { test, expect } from '@playwright/test';
const details = {
  companyFullName: 'Example Properties LLC', companyAddress: 'Example Tower, Dubai, United Arab Emirates',
  clientName: 'Alex Example', clientDesignation: 'Director', providerAddress: 'Sample business address, United Arab Emirates',
  providerSignatory: 'Dev Example', providerDesignation: 'Founder & CEO',
};
test('create both agreements, preview entered data, and redownload from this session', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Make it official.' })).toBeVisible();
  await page.getByRole('button', { name: 'Generate agreements', exact: true }).click();
  await expect(page.locator('#companyFullName-error')).toHaveText('Client legal entity name is required');
  for (const [id, value] of Object.entries(details)) await page.locator(`#${id}`).fill(value);
  await page.locator('#effectiveDate').fill('2026-09-14');
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '8');
  await expect(page.locator('.paper-body')).toContainText('Example Properties LLC');
  await page.getByRole('tab', { name: 'MSA', exact: true }).click();
  await expect(page.locator('.paper h3')).toHaveText('Master Services Agreement');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Generate agreements', exact: true }).click();
  expect((await download).suggestedFilename()).toBe('vedryxTech-AGREEMENTS-Example-Properties-LLC-2026-09-14.zip');
  await page.getByRole('button', { name: /Session downloads/ }).click();
  await expect(page.getByRole('heading', { name: 'Example Properties LLC' })).toBeVisible();
  const again = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Download', exact: true }).click();
  expect((await again).suggestedFilename()).toMatch(/\.zip$/);
  expect(errors).toEqual([]);
});
test('single agreement, empty selection, network error, reset and help work', async ({ page }) => {
  await page.goto('/');
  await page.locator('#nda-choice').uncheck();
  await page.locator('#msa-choice').uncheck();
  await page.getByRole('button', { name: 'Generate agreement', exact: true }).click();
  await expect(page.locator('#agreement-error')).toHaveText('Select at least one agreement');
  for (const [id, value] of Object.entries(details)) await page.locator(`#${id}`).fill(value);
  await page.locator('#nda-choice').check();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Generate agreement', exact: true }).click();
  expect((await download).suggestedFilename()).toMatch(/NDA-.*\.docx$/);
  await page.route('/api/documents', route => route.fulfill({ status: 500, json: { error: 'Please try again.' } }));
  await page.getByRole('button', { name: 'Generate agreement', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Please try again.');
  await page.getByRole('button', { name: 'Clear client' }).click();
  await expect(page.locator('#companyFullName')).toHaveValue('');
  await expect(page.locator('#providerSignatory')).toHaveValue('Dev Example');
  await page.getByRole('button', { name: 'Help', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Got it' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
});
test('layout fits the viewport and preview remains scrollable', async ({ page }, testInfo) => {
  await page.goto('/');
  await page.screenshot({ path: `qa/${testInfo.project.name}.png`, fullPage: true });
  const width = await page.evaluate(() => ({ document: document.documentElement.scrollWidth, viewport: window.innerWidth }));
  expect(width.document).toBeLessThanOrEqual(width.viewport);
  expect(await page.locator('.paper-scroll').evaluate(el => el.scrollHeight > el.clientHeight)).toBe(true);
});

test('DDA preview, standalone download, and three-agreement ZIP', async ({ page }) => {
  await page.goto('/');
  await page.locator('#dda-choice').check();
  await expect(page.getByRole('tab', { name: 'DDA', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.paper h3')).toHaveText('Data Protection & Restricted Disclosure Agreement');
  await expect(page.locator('.paper-body')).toContainText('No routine human access to telephone numbers');
  await expect(page.getByText('3 agreements selected', { exact: true })).toBeVisible();
  for (const [id, value] of Object.entries(details)) await page.locator(`#${id}`).fill(value);
  const bundled = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Generate agreements', exact: true }).click();
  expect((await bundled).suggestedFilename()).toMatch(/AGREEMENTS-.*\.zip$/);
  await expect(page.getByRole('status')).toContainText('3 agreements are ready');
  await page.locator('#nda-choice').uncheck();
  await page.locator('#msa-choice').uncheck();
  const single = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Generate agreement', exact: true }).click();
  expect((await single).suggestedFilename()).toMatch(/DDA-.*\.docx$/);
});

test('theme follows system, toggles, persists, and keeps paper white', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('.paper')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(page.locator('.sidebar')).toHaveCSS('background-color', 'rgb(19, 29, 46)');
  await page.getByRole('button', { name: 'Switch to light mode' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('tab', { name: 'DDA', exact: true }).click();
  await page.getByRole('tab', { name: 'DDA', exact: true }).press('Home');
  await expect(page.getByRole('tab', { name: 'NDA', exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'Help', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCSS('background-color', 'rgb(19, 29, 46)');
  await page.getByRole('button', { name: 'Got it' }).click();
  expect(errors).toEqual([]);
});

test('theme toggle works when local storage is blocked', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => { throw new Error('Storage disabled'); };
    Storage.prototype.setItem = () => { throw new Error('Storage disabled'); };
  });
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: 'Switch to light mode' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test('dark workspace fits small phones, landscape, tablets and wide desktops', async ({ page }, testInfo) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await page.locator('#dda-choice').check();
  for (const [width, height] of [[320, 700], [375, 812], [640, 420], [768, 1024], [1024, 768], [1440, 1000], [1920, 1080]]) {
    await page.setViewportSize({ width, height });
    await expect(page.getByRole('button', { name: 'Switch to light mode' })).toBeVisible();
    const size = await page.evaluate(() => ({ content: document.documentElement.scrollWidth, viewport: innerWidth }));
    expect(size.content, `Overflow at ${width}px`).toBeLessThanOrEqual(size.viewport);
    const choice = await page.locator('#dda-choice').boundingBox();
    expect(choice!.width).toBeGreaterThan(100);
    if ((testInfo.project.name === 'desktop' && width === 1440) || (testInfo.project.name === 'mobile' && width === 375)) {
      await page.screenshot({ path: `qa/${testInfo.project.name}-dark-dda.png`, fullPage: true });
    }
  }
});
