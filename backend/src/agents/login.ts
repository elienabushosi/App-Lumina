/**
 * Step 8 — Farmers Insurance / Okta login flow.
 * Mirrors test-login.ts exactly — same selectors, same flow, same timing.
 */
import type { BrowserContext } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { env } from '../config/env.js';
import logger from '../lib/logger.js';
import { startTimer } from '../lib/timer.js';

export type LoginResult = 'success' | 'mfa_required' | 'failed';

export async function loginToSalesforce(
  context: BrowserContext,
  proposalId: string
): Promise<LoginResult> {
  const timer = startTimer();
  const page = await context.newPage();
  logger.info({ proposalId, step: 'login', status: 'started' });

  try {
    // Same as test-login.ts: domcontentloaded is more reliable through Okta redirect chain
    await page.goto(env.SF_LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 30_000 }).catch(() => {
      logger.warn({ proposalId, step: 'login', msg: 'goto timeout — proceeding anyway' });
    });

    // If session is already valid, Okta skips login and lands on Salesforce directly
    if (page.url().includes('salesforce.com') && !page.url().includes('eagentsaml')) {
      logger.info({ proposalId, step: 'login', status: 'session_valid', durationMs: timer() });
      await page.close();
      return 'success';
    }

    logger.info({ proposalId, step: 'login', msg: 'on login form', url: page.url() });

    // Fill username — same selector as test-login.ts
    const usernameInput = page.locator('input[name="username"], input[type="text"], #username').first();
    await usernameInput.waitFor({ timeout: 10_000 });
    await usernameInput.fill(env.SF_USERNAME ?? '');

    // Fill password
    const passwordInput = page.locator('input[name="password"], input[type="password"], #password').first();
    await passwordInput.fill(env.SF_PASSWORD ?? '');

    // Click "I AGREE" — same selector as test-login.ts
    const submitBtn = page.locator('button:has-text("I AGREE"), input[value="I AGREE"], button:has-text("I Agree")').first();
    await submitBtn.click();

    // Wait for navigation or MFA screen
    await page.waitForTimeout(4000);
    logger.info({ proposalId, step: 'login', status: 'post_submit', url: page.url() });

    // Landed on Salesforce directly (no MFA needed)
    if (page.url().includes('salesforce.com') && !page.url().includes('eagentsaml')) {
      logger.info({ proposalId, step: 'login', status: 'success', durationMs: timer() });
      await page.close();
      return 'success';
    }

    // MFA screen — same selector as test-login.ts
    const sendCodeBtn = page.locator('button:has-text("Send"), button:has-text("SMS"), button:has-text("Text"), a:has-text("Send Code")').first();
    const hasSendCode = await sendCodeBtn.isVisible().catch(() => false);

    if (hasSendCode) {
      await sendCodeBtn.click();
      await page.waitForTimeout(2000);
      logger.info({ proposalId, step: 'login', status: 'mfa_required', durationMs: timer() });
      // Keep page open — mfa.ts uses context.pages() to find it and inject the code
      return 'mfa_required';
    }

    // Login failed — take screenshot so we can see what went wrong
    try {
      mkdirSync('./screenshots', { recursive: true });
      const buf = await page.screenshot({ type: 'png', fullPage: true });
      const path = join('./screenshots', `login-failed-${proposalId}.png`);
      writeFileSync(path, buf);
      logger.warn({ proposalId, step: 'login', status: 'failed', url: page.url(), screenshotPath: path, durationMs: timer() });
    } catch {
      logger.warn({ proposalId, step: 'login', status: 'failed', url: page.url(), durationMs: timer() });
    }
    await page.close();
    return 'failed';

  } catch (err) {
    logger.error({ proposalId, step: 'login', status: 'error', durationMs: timer(), err });
    await page.close().catch(() => {});
    return 'failed';
  }
}
