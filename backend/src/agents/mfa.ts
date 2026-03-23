/**
 * Step 9 — Okta SMS MFA human-in-the-loop gate.
 *
 * Farmers uses Okta for MFA (not Salesforce's built-in MFA).
 * The MFA screen is served at eagentsaml.farmersinsurance.com.
 *
 * Flow:
 *   1. Detect SMS Authentication screen
 *   2. Click "Sent" button to request the SMS code
 *   3. Pause and wait for a human to provide the code via POST /api/proposals/:id/mfa
 *   4. Type the full code, check "Do not challenge me for 30 days", click Verify via JS
 *   5. Wait for redirect to farmersagent.my.salesforce.com
 *
 * MFA is intentionally a human gate — never automate around it.
 */
import type { BrowserContext } from 'playwright';
import logger from '../lib/logger.js';

const MFA_POLL_INTERVAL_MS = 3_000;
const MFA_TIMEOUT_MS = 5 * 60 * 1_000; // 5 minutes

// In-memory store of pending MFA codes keyed by proposalId.
const pendingMfaCodes = new Map<string, string>();

export function provideMfaCode(proposalId: string, code: string): void {
  pendingMfaCodes.set(proposalId, code);
}

export async function waitForMfaCode(proposalId: string): Promise<string> {
  logger.info({ proposalId, step: 'mfa', status: 'waiting_for_human' });

  const deadline = Date.now() + MFA_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const code = pendingMfaCodes.get(proposalId);
    if (code) {
      pendingMfaCodes.delete(proposalId);
      logger.info({ proposalId, step: 'mfa', status: 'code_received' });
      return code;
    }
    await new Promise(r => setTimeout(r, MFA_POLL_INTERVAL_MS));
  }

  throw new Error(`MFA timeout: no code provided within ${MFA_TIMEOUT_MS / 1000}s`);
}

export async function submitMfaCode(
  context: BrowserContext,
  proposalId: string,
  code: string
): Promise<boolean> {
  const pages = context.pages();
  const page = pages[pages.length - 1];

  logger.info({ proposalId, step: 'mfa', status: 'submitting' });
  try {
    // Dismiss cookie banner if present
    const acceptBtn = page.locator('button:has-text("Accept")');
    if (await acceptBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await acceptBtn.click();
      await page.waitForTimeout(500);
    }

    // Fill the code atomically — keyboard.type() loses focus mid-sequence
    const codeInput = page.locator('input[type="text"], input[type="tel"], input[type="number"]')
      .filter({ hasNot: page.locator('[id*="vendor"], [id*="search"]') })
      .first();
    await codeInput.waitFor({ state: 'visible', timeout: 15_000 });
    await codeInput.fill(code);
    await page.waitForTimeout(500);
    logger.info({ proposalId, step: 'mfa', status: 'code_typed' });

    // Check "Do not challenge me on this device for the next 30 days"
    // Okta uses a label element wrapping the checkbox — click the label, not the input
    const rememberLabel = page.locator('label[data-se-for-name="rememberDevice"]').first();
    if (await rememberLabel.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await rememberLabel.click();
      await page.waitForTimeout(500);
      logger.info({ proposalId, step: 'mfa', status: 'remember_device_checked' });
    }

    // Click Verify via JS evaluate — Okta's widget intercepts standard Playwright clicks
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button, input[type="submit"]'));
      const verify = buttons.find(b =>
        b.textContent?.trim().toLowerCase().includes('verify') ||
        (b as HTMLInputElement).value?.toLowerCase().includes('verify')
      );
      if (verify) (verify as HTMLElement).click();
      else throw new Error('Verify button not found in DOM');
    });
    logger.info({ proposalId, step: 'mfa', status: 'verify_clicked' });

    // Wait for Salesforce redirect
    await page.waitForFunction(
      () => window.location.href.includes('salesforce.com') &&
            !window.location.href.includes('eagentsaml'),
      { timeout: 30_000 }
    );

    // Let Salesforce finish loading
    await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {});

    const succeeded = page.url().includes('salesforce.com');
    logger.info({ proposalId, step: 'mfa', status: succeeded ? 'success' : 'failed', url: page.url() });
    return succeeded;
  } catch (err) {
    logger.error({ proposalId, step: 'mfa', status: 'error', err });
    return false;
  }
}
