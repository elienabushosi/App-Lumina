/**
 * Standalone login test for eagent.farmersinsurance.com
 * Run: npx tsx src/test-login.ts
 *
 * Screenshots saved to screenshots/
 */
import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { config } from 'dotenv';

config({ path: '.env.development' });

const SF_LOGIN_URL = process.env.SF_LOGIN_URL ?? 'http://eagent.farmersinsurance.com';
const SF_USERNAME = process.env.SF_USERNAME ?? '';
const SF_PASSWORD = process.env.SF_PASSWORD ?? '';
const SCREENSHOTS_DIR = path.resolve('screenshots');

if (!fs.existsSync(SCREENSHOTS_DIR)) fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

async function saveScreenshot(page: any, name: string) {
  const file = path.join(SCREENSHOTS_DIR, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log(`📸 Screenshot saved: ${file}`);
}

async function run() {
  console.log(`\n→ Launching browser`);
  const browser = await chromium.launch({ headless: false, slowMo: 50 });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log(`→ Navigating to ${SF_LOGIN_URL}`);
  await page.goto(SF_LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await saveScreenshot(page, '01-login-page');

  // Fill username
  console.log(`→ Filling username: ${SF_USERNAME}`);
  const usernameInput = page.locator('input[name="username"], input[type="text"], #username').first();
  await usernameInput.waitFor({ timeout: 10_000 });
  await usernameInput.fill(SF_USERNAME);

  // Fill password
  console.log(`→ Filling password`);
  const passwordInput = page.locator('input[name="password"], input[type="password"], #password').first();
  await passwordInput.fill(SF_PASSWORD);

  await saveScreenshot(page, '02-credentials-filled');

  // Submit — Farmers login uses an "I AGREE" button (terms acceptance + submit)
  console.log(`→ Clicking I AGREE button`);
  const submitBtn = page.locator('button:has-text("I AGREE"), input[value="I AGREE"], button:has-text("I Agree")').first();
  await submitBtn.click();

  // Wait for navigation or MFA screen
  await page.waitForTimeout(4000);
  await saveScreenshot(page, '03-after-submit');
  console.log(`→ Current URL: ${page.url()}`);

  // Check for SMS/MFA button
  const sendCodeBtn = page.locator('button:has-text("Send"), button:has-text("SMS"), button:has-text("Text"), a:has-text("Send Code")').first();
  const hasSendCode = await sendCodeBtn.isVisible().catch(() => false);

  if (hasSendCode) {
    console.log(`→ MFA detected — clicking Send Code button`);
    await sendCodeBtn.click();
    await page.waitForTimeout(2000);
    await saveScreenshot(page, '04-mfa-code-entry');
    console.log(`→ Current URL: ${page.url()}`);
    // Wait for MFA code to be written to screenshots/mfa-code.txt
    const codeFile = path.join(SCREENSHOTS_DIR, 'mfa-code.txt');
    // Clean up any leftover file from a previous run
    if (fs.existsSync(codeFile)) fs.unlinkSync(codeFile);

    console.log(`\n⏳ Waiting for MFA code...`);
    console.log(`   Paste the code in Claude and it will write it to: ${codeFile}`);

    const code = await new Promise<string>((resolve) => {
      const interval = setInterval(() => {
        if (fs.existsSync(codeFile)) {
          const val = fs.readFileSync(codeFile, 'utf8').trim();
          if (val) {
            clearInterval(interval);
            fs.unlinkSync(codeFile);
            resolve(val);
          }
        }
      }, 1000);
    });

    console.log(`→ Entering code: ${code}`);
    // Dismiss cookie banner first so it doesn't interfere
    const acceptBtn = page.locator('button:has-text("Accept")');
    if (await acceptBtn.isVisible().catch(() => false)) {
      await acceptBtn.click();
      await page.waitForTimeout(500);
    }

    // Step 1: Wait for code input to appear, try multiple input types
    await page.waitForTimeout(1500);
    const codeInput = page.locator('input[type="text"], input[type="tel"], input[type="number"], input[type="password"]').filter({ hasNot: page.locator('[id*="vendor"], [id*="search"]') }).first();
    await codeInput.waitFor({ state: 'visible', timeout: 15_000 });
    await codeInput.click();
    await page.keyboard.type(code, { delay: 80 });
    // Wait to confirm all characters are typed
    await page.waitForTimeout(500);
    console.log(`→ Code typed`);

    // Step 2: Now check "Do not challenge me" — code input is already filled
    const rememberLabel = page.locator('label[data-se-for-name="rememberDevice"]').first();
    if (await rememberLabel.isVisible().catch(() => false)) {
      await rememberLabel.click();
      await page.waitForTimeout(500);
      console.log(`→ Checked "Do not challenge me for 30 days"`);
    }

    await saveScreenshot(page, '05-code-entered');

    // Step 3: Click Verify via JS evaluate
    console.log(`→ Clicking Verify`);
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button, input[type="submit"]'));
      const verify = buttons.find(b => b.textContent?.trim().toLowerCase().includes('verify') || (b as HTMLInputElement).value?.toLowerCase().includes('verify'));
      if (verify) (verify as HTMLElement).click();
      else throw new Error('Verify button not found in DOM');
    });
    console.log(`→ Verify clicked`);
    await page.waitForTimeout(4000);
    await saveScreenshot(page, '06-after-verification');
    console.log(`→ Current URL after MFA: ${page.url()}`);

    // Wait for Salesforce to fully load
    console.log(`→ Waiting for Salesforce to load...`);
    await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {});
    await page.waitForTimeout(3000);
    await saveScreenshot(page, '07-salesforce-loaded');
    console.log(`→ Final URL: ${page.url()}`);

    // Save session so the pipeline can reuse it without logging in for 30 days
    const sessionPath = 'sessions/cg-agent-001.json';
    await context.storageState({ path: sessionPath });
    console.log(`✅ Session saved to ${sessionPath}`);
  }

  console.log(`\n✅ Done. Open screenshots/ to see what the browser saw.`);
  console.log(`   Press Ctrl+C to close the browser, or wait 30s for auto-close.`);
  await page.waitForTimeout(30_000);
  await browser.close();
}

run().catch((err) => {
  console.error('❌ Login test failed:', err.message);
  process.exit(1);
});
