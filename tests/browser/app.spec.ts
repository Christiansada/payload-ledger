import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';
test.beforeEach(async ({ page }) => {
  await page.goto('/');
});
test('synthetic example, filtering, and complete export', async ({ page }) => {
  await page.getByRole('button', { name: 'Load synthetic example' }).click();
  await expect(page.locator('#count')).toHaveText('4 of 4 changes');
  await expect(page.locator('#notes')).toContainText(
    '2 matched records changed index',
  );
  await page.getByLabel('Change type').selectOption('type');
  await expect(page.locator('#count')).toHaveText('1 of 4 changes');
  await expect(page.locator('#results')).toContainText('/records/1/weightKg');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download review JSON' }).click();
  const download = await downloadPromise;
  const report = JSON.parse(await readFile((await download.path())!, 'utf8'));
  expect(report.changes).toHaveLength(4);
  expect(report.options.ignores).toEqual(['/generatedAt']);
  expect(report.version).toBe(1);
});
test('editing invalidates export; duplicate keys and malformed input produce errors', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Load synthetic example' }).click();
  await page.getByLabel('Baseline JSON', { exact: true }).fill('{"x":1,"x":2}');
  await expect(
    page.getByRole('button', { name: 'Download review JSON' }),
  ).toBeDisabled();
  await page.getByRole('button', { name: 'Compare fixtures' }).click();
  await expect(page.getByRole('alert')).toContainText('Duplicate');
  await expect(page.locator('.change')).toHaveCount(0);
});
test('file imports stay local and reject bad data without erasing prior input', async ({
  page,
}) => {
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  await page.getByLabel('Open baseline JSON file').setInputFiles({
    name: 'safe.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"value":1}'),
  });
  await expect(page.getByLabel('Baseline JSON', { exact: true })).toHaveValue(
    '{"value":1}',
  );
  await page.getByLabel('Open baseline JSON file').setInputFiles({
    name: 'bad.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{bad}'),
  });
  await expect(page.getByRole('alert')).toContainText(
    'Existing input was preserved',
  );
  await expect(page.getByLabel('Baseline JSON', { exact: true })).toHaveValue(
    '{"value":1}',
  );
  expect(requests).toEqual([]);
});
test('renders untrusted strings as text and supports keyboard comparison', async ({
  page,
}) => {
  await page
    .getByLabel('Baseline JSON', { exact: true })
    .fill('{"html":"before"}');
  await page
    .getByLabel('Candidate JSON', { exact: true })
    .fill(JSON.stringify({ html: '<img src=x onerror=alert(1)>' }));
  await page.getByRole('button', { name: 'Compare fixtures' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#results')).toContainText(
    '<img src=x onerror=alert(1)>',
  );
  await expect(page.locator('#results img')).toHaveCount(0);
  await page.getByRole('button', { name: 'Clear workspace' }).click();
  await expect(page.getByLabel('Baseline JSON', { exact: true })).toBeFocused();
  await expect(
    page.getByRole('button', { name: 'Download review JSON' }),
  ).toBeDisabled();
});
test('reordering by ID, no differences, and ignored-path warning', async ({
  page,
}) => {
  await page
    .getByLabel('Baseline JSON', { exact: true })
    .fill('{"records":[{"id":1},{"id":2}]}');
  await page
    .getByLabel('Candidate JSON', { exact: true })
    .fill('{"records":[{"id":2},{"id":1}]}');
  await page.getByLabel('Match one array by record ID').check();
  await page.getByLabel('Exclude JSON Pointers').fill('/missing');
  await page.getByRole('button', { name: 'Compare fixtures' }).click();
  await expect(page.locator('#results')).toContainText(
    'No differences under these rules',
  );
  await expect(page.locator('#notes')).toContainText(
    'Exclusions not visited: /missing',
  );
});
for (const width of [320, 390, 768, 1440])
  test(`responsive and basic accessibility at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.getByRole('button', { name: 'Load synthetic example' }).click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(results.violations).toEqual([]);
  });
test('200 percent text and screenshot evidence', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1080 });
  await page.getByRole('button', { name: 'Load synthetic example' }).click();
  await page.screenshot({
    path: 'test-results/desktop.png',
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: 'test-results/mobile.png',
    fullPage: true,
  });
  await page.evaluate(() => {
    const nodes = [...document.querySelectorAll<HTMLElement>('body *')];
    const sizes = nodes.map((node) =>
      parseFloat(getComputedStyle(node).fontSize),
    );
    nodes.forEach(
      (node, index) => (node.style.fontSize = `${sizes[index] * 2}px`),
    );
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
