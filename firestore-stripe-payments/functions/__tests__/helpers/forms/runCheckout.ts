import { chromium } from 'playwright';

export default async (url: string): Promise<void> => {
  console.info('Running checkout form in headless mode...');
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(url, {
      waitUntil: 'networkidle',
      timeout: 120000,
    });

    await page.focus('#cardNumber');
    await page.keyboard.type('4242424242424242', { delay: 100 });
    await page.keyboard.press('Enter');

    await page.focus('#cardExpiry');
    await page.keyboard.type('1224');

    await page.focus('#cardCvc');
    await page.keyboard.type('123');

    await page.focus('#billingName');
    await page.keyboard.type('testing');

    await page.focus('#billingAddressLine1');
    await page.keyboard.type('1600 Amphitheatre Parkwa');
    await page.keyboard.press('Enter');

    await page.focus('#billingLocality');
    await page.keyboard.type('Mountain View');

    await page.focus('#billingPostalCode');
    await page.keyboard.type('CA 94043');
    await page.keyboard.press('Enter');

    await page.waitForLoadState('networkidle');
    await browser.close();
  } catch (exception) {
    console.error('Error during checkout automation:', exception);
  } finally {
    await browser.close();
  }
};
