/**
 * Step 8 — Farmers Insurance / Okta login flow.
 *
 * Farmers uses Okta SAML SSO (not standard Salesforce login):
 *   eagent.farmersinsurance.com → eagentsaml.farmersinsurance.com (Okta)
 *   → farmersagent.my.salesforce.com/secur/frontdoor.jsp (SAML handoff)
 *
 * Login quirks discovered during testing:
 *   - Submit button is "I AGREE" (legal terms + submit combined)
 *   - MFA page stays at the same URL as login — can't waitForNavigation
 *   - MFA screen is Okta SMS Authentication widget
 *   - After MFA, Okta redirects to frontdoor.jsp then Salesforce Lightning
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
    // Use 'load' but catch timeout — some Okta redirect chains don't fire load events cleanly
    await page.goto(env.SF_LOGIN_URL, { waitUntil: 'load', timeout: 15_000 }).catch(() => {
      logger.warn({ proposalId, step: 'login', msg: 'goto load timeout — proceeding anyway' });
    });

    // If session is already valid, Okta skips login and sends us straight to Salesforce
    if (page.url().includes('salesforce.com') && !page.url().includes('eagentsaml')) {
      logger.info({ proposalId, step: 'login', status: 'session_valid', durationMs: timer() });
      await page.close();
      return 'success';
    }

    logger.info({ proposalId, step: 'login', msg: 'waiting for username input', url: page.url() });

    // Wait for Okta login form — use specific name attributes to avoid matching cookie banner inputs
    await page.waitForTimeout(2000); // let page settle after goto
    const usernameInput = page.locator('input[name="username"]').first();
    await usernameInput.waitFor({ state: 'visible', timeout: 30_000 });
    await usernameInput.fill(env.SF_USERNAME ?? '');

    const passwordInput = page.locator('input[name="password"]').first();
    await passwordInput.fill(env.SF_PASSWORD ?? '');

    // Click "I AGREE" — Farmers' submit button (legal terms + login combined)
    await page.locator('button:has-text("I AGREE")').click();

    // Wait for the page to respond — MFA stays at same URL, Salesforce redirects away
    await page.waitForTimeout(4000);

    const url = page.url();
    logger.info({ proposalId, step: 'login', status: 'navigated', url });

    // Check if we landed on Salesforce directly (no MFA needed)
    if (url.includes('salesforce.com') && !url.includes('eagentsaml')) {
      logger.info({ proposalId, step: 'login', status: 'success', durationMs: timer() });
      await page.close();
      return 'success';
    }

    // Still on Okta — check if MFA widget is visible
    const mfaVisible = await page.locator('text=SMS Authentication').isVisible({ timeout: 3_000 }).catch(() => false);
    if (mfaVisible) {
      // Click "Sent" to trigger the SMS code
      const sentBtn = page.locator('input[value="Send Code"], a:has-text("Send"), button:has-text("Send")').first();
      if (await sentBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await sentBtn.click();
        await page.waitForTimeout(2000);
      }
      logger.info({ proposalId, step: 'login', status: 'mfa_required', durationMs: timer() });
      // Keep page open — mfa.ts uses context.pages() to find it
      return 'mfa_required';
    }

    logger.warn({ proposalId, step: 'login', status: 'failed', url, durationMs: timer() });
    await page.close();
    return 'failed';
  } catch (err) {
    logger.error({ proposalId, step: 'login', status: 'failed', durationMs: timer(), err });
    await page.close().catch(() => {});
    return 'failed';
  }
}
