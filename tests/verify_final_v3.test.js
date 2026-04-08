
import { test, expect } from '@playwright/test';

test('verify evaluations page changes', async ({ page }) => {
  // Go to home page
  await page.goto('http://localhost:5173/');

  // Click on Gestão de Avaliações card
  await page.click('text=Gestão de Avaliações');

  // Wait for the page to load
  await page.waitForSelector('h4:has-text("Gestão de Avaliações")');

  // 1. Verify that processing mode radio buttons are GONE
  const individualMode = page.locator('text=Individual');
  const groupedMode = page.locator('text=Agrupado');
  await expect(individualMode).not.toBeVisible();
  // Note: "Agrupado" might still be in the text somewhere, but the radio button should be gone.
  // Actually, I removed the whole form control.

  // 2. Verify that "System Status" panel is GONE
  const systemStatus = page.locator('text=Status do Sistema');
  await expect(systemStatus).not.toBeVisible();

  // 3. Verify that "Extrair Transcrição" button exists
  const extractButton = page.locator('button:has-text("Extrair Transcrição")');
  await expect(extractButton).toBeVisible();

  // 4. Verify Briefing dropdown exists and check sorting
  const briefingSelect = page.locator('div[aria-labelledby="briefing-label"]');
  await expect(briefingSelect).toBeVisible();

  // Open the dropdown to see options
  await briefingSelect.click();

  // The options are rendered in a portal, usually in a listbox
  const options = page.locator('role=listbox >> role=option');
  const count = await options.count();
  console.log(`Found ${count} briefing options`);

  let texts = [];
  for (let i = 0; i < count; i++) {
    texts.push(await options.nth(i).innerText());
  }
  console.log('Briefing options:', texts);

  const sortedTexts = [...texts].sort((a, b) => a.localeCompare(b.name));
  // Since they are strings, just localeCompare
  const expectedSorted = [...texts].sort((a, b) => a.localeCompare(b));

  expect(texts).toEqual(expectedSorted);

  await page.screenshot({ path: 'evaluations_verified.png' });
});
