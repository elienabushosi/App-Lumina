/**
 * Step 13 — 360 Value form filler.
 *
 * Assumes the Playwright page is already on the 360 form inside Salesforce.
 * Builds a goal + context from the research report and hands off to the
 * Gemini loop to fill the fields visually.
 *
 * 360 fields: living area sqft, total building sqft, attached garage sqft,
 * year built, exterior wall type, foundation type, roof covering, roof style.
 */
import type { Page } from 'playwright';
import { runGeminiLoop } from './gemini.js';
import logger from '../lib/logger.js';
import { startTimer } from '../lib/timer.js';
import type { ResearchReport } from '../types/proposal.js';

export async function fill360Form(
  page: Page,
  report: ResearchReport,
  proposalId: string
): Promise<void> {
  const timer = startTimer();
  logger.info({ proposalId, step: '360', status: 'started' });

  const cad = report.cad.data;
  const maps = report.googleMaps.data;

  const fieldValues = {
    'Living Area (sq ft)':          cad?.livingAreaSqft        ?? null,
    'Total Building Area (sq ft)':  cad?.totalBuildingSqft     ?? null,
    'Attached Garage (sq ft)':      cad?.attachedGarageSqft    ?? null,
    'Year Built':                   cad?.yearBuilt             ?? null,
    'Exterior Wall Type':           maps?.exteriorMaterial     ?? null,
    'Foundation Type':              maps?.foundationType       ?? null,
    'Roof Covering':                maps?.roofCovering         ?? null,
    'Roof Style':                   maps?.roofStyle            ?? null,
  };

  const known = Object.entries(fieldValues)
    .filter(([, v]) => v !== null)
    .map(([k, v]) => `  ${k}: ${v}`)
    .join('\n');

  const unknown = Object.entries(fieldValues)
    .filter(([, v]) => v === null)
    .map(([k]) => `  ${k}`)
    .join('\n');

  const context = [
    'Research report values to fill:',
    known,
    unknown ? `\nSkip these fields (no data available):\n${unknown}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const goal =
    'Fill the 360 Value replacement-cost form with the provided research values. ' +
    'Find each labeled field and enter the corresponding value. ' +
    'Use dropdowns where present — select the closest matching option. ' +
    'Do not submit or save the form. Stop after the last field is filled.';

  await runGeminiLoop(page, goal, proposalId, { context });

  logger.info({ proposalId, step: '360', status: 'complete', durationMs: timer() });
}
