/**
 * Step 8 — Salesforce login flow.
 *
 * Navigates to SF_LOGIN_URL, fills username + password, submits.
 * Returns 'success', 'mfa_required', or 'failed'.
 */
import type { BrowserContext } from 'playwright';
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
    await page.goto(env.SF_LOGIN_URL, { waitUntil: 'domcontentloaded' });

    // If already logged in (session restored), skip the form
    if (!page.url().includes('login')) {
      logger.info({ proposalId, step: 'login', status: 'session_valid' });
      await page.close();
      return 'success';
    }

    await page.fill('#username', env.SF_USERNAME ?? '');
    await page.fill('#password', env.SF_PASSWORD ?? '');
    await page.click('#Login');

    // Salesforce may do a full navigation OR a SPA transition to the MFA screen.
    // Wait for the URL to change away from the login page (up to 30s).
    await page.waitForFunction(
      () => !window.location.href.includes('login.salesforce.com/'),
      { timeout: 30_000 }
    );

    const url = page.url();
    logger.info({ proposalId, step: 'login', status: 'navigated', url });

    const result = detectPostLoginState(url);
    logger.info({ proposalId, step: 'login', status: result, durationMs: timer() });

    // Keep the page open if MFA is needed — mfa.ts uses context.pages() to find it
    if (result !== 'mfa_required') await page.close();
    return result;
  } catch (err) {
    logger.error({ proposalId, step: 'login', status: 'failed', durationMs: timer(), err });
    await page.close();
    return 'failed';
  }
}

function detectPostLoginState(url: string): LoginResult {
  if (url.includes('login.salesforce.com')) return 'failed';
  if (
    url.includes('identity/verify') ||
    url.includes('two-factor') ||
    url.includes('mfa') ||
    url.includes('verification')
  ) {
    return 'mfa_required';
  }
  return 'success';
}
