/**
 * Step 9 — MFA detection + human-in-the-loop pause.
 *
 * When Salesforce presents an MFA challenge, the agent pauses and emits a
 * 'mfa_required' event. The frontend listens (via polling GET /api/proposals/:id)
 * and prompts the agent to enter the code. The agent then resumes by calling
 * submitMfaCode().
 *
 * MFA is intentionally a human gate — never automate around it.
 */
import type { BrowserContext } from 'playwright';
import logger from '../lib/logger.js';

const MFA_POLL_INTERVAL_MS = 3_000;
const MFA_TIMEOUT_MS = 5 * 60 * 1_000; // 5 minutes

// In-memory store of pending MFA codes keyed by proposalId.
// In production this could move to Redis so it survives restarts.
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
    // Salesforce MFA input — label text varies by org config but input is consistent
    const input = page.locator('input[type="text"], input[type="tel"]').first();
    await input.fill(code);
    await page.keyboard.press('Enter');
    await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15_000 });

    const succeeded = !page.url().includes('identity/verify') && !page.url().includes('mfa');
    logger.info({ proposalId, step: 'mfa', status: succeeded ? 'success' : 'failed' });
    return succeeded;
  } catch (err) {
    logger.error({ proposalId, step: 'mfa', status: 'error', err });
    return false;
  }
}
