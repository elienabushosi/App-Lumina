/**
 * Step 14 — Full APEX step orchestrator.
 *
 * Sequence:
 *   1. Get a browser context for this agent (restores session if saved)
 *   2. Attempt Salesforce login
 *   3. If MFA required: pause and wait for human to provide the code
 *   4. Persist session after successful login
 *   5. Navigate to the lead in Alta and fill the form
 *   6. Navigate to the lead in 360 and fill the form
 *   7. Close the context (browser stays open for reuse)
 */
import { getContextForAgent, persistSession } from './session.js';
import { loginToSalesforce } from './login.js';
import { waitForMfaCode, submitMfaCode } from './mfa.js';
import { fillAltaForm } from './alta.js';
import { fill360Form } from './360.js';
import logger from '../lib/logger.js';
import type { ResearchReport } from '../types/proposal.js';

export async function runApexStep(
  proposalId: string,
  agentId: string,
  report: ResearchReport
): Promise<void> {
  logger.info({ proposalId, step: 'apex', status: 'started', agentId });

  const context = await getContextForAgent(agentId);

  try {
    // ── Login ──────────────────────────────────────────────────────────────
    const loginResult = await loginToSalesforce(context, proposalId);

    if (loginResult === 'failed') {
      throw new Error('Salesforce login failed');
    }

    if (loginResult === 'mfa_required') {
      logger.info({ proposalId, step: 'apex', status: 'mfa_required' });
      // Pause here — frontend polls GET /api/proposals/:id and sees 'apex_needs_mfa'
      // Agent submits code via POST /api/proposals/:id/mfa
      const code = await waitForMfaCode(proposalId);
      const mfaOk = await submitMfaCode(context, proposalId, code);
      if (!mfaOk) throw new Error('MFA verification failed');
    }

    await persistSession(context, agentId);
    logger.info({ proposalId, step: 'apex', status: 'logged_in' });

    // ── Navigate to Alta and fill ──────────────────────────────────────────
    const altaPage = await context.newPage();
    try {
      await navigateToAlta(altaPage, report, proposalId);
      await fillAltaForm(altaPage, report, proposalId);
    } finally {
      await altaPage.close();
    }

    // ── Navigate to 360 and fill ───────────────────────────────────────────
    const page360 = await context.newPage();
    try {
      await navigateTo360(page360, report, proposalId);
      await fill360Form(page360, report, proposalId);
    } finally {
      await page360.close();
    }

    logger.info({ proposalId, step: 'apex', status: 'complete' });
  } finally {
    await context.close();
  }
}

// ── Navigation helpers ─────────────────────────────────────────────────────────
// These navigate to the Alta / 360 forms within Salesforce.
// Exact URLs depend on the org — placeholders here until codegen session with CG Insurance.

async function navigateToAlta(page: import('playwright').Page, report: ResearchReport, proposalId: string) {
  // TODO: replace with real Alta URL from Salesforce org (CG Insurance codegen session)
  const address = [report.property.address, report.property.city, report.property.state].join(' ');
  logger.info({ proposalId, step: 'apex_nav', target: 'alta', address });
  // e.g. await page.goto(`https://farmers.my.salesforce.com/apex/AltaQuote?...`);
}

async function navigateTo360(page: import('playwright').Page, report: ResearchReport, proposalId: string) {
  // TODO: replace with real 360 URL from Salesforce org (CG Insurance codegen session)
  const address = [report.property.address, report.property.city, report.property.state].join(' ');
  logger.info({ proposalId, step: 'apex_nav', target: '360', address });
  // e.g. await page.goto(`https://farmers.my.salesforce.com/apex/360Value?...`);
}
