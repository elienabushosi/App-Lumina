/**
 * Step 12 — Alta form filler.
 *
 * Assumes the Playwright page is already on the Alta form inside Salesforce.
 * Builds a goal + context from the research report and hands off to the
 * Gemini loop to fill the fields visually.
 *
 * Alta fields: property type, year built, roof type, roof style, exterior
 * material, number of stories, garage type.
 */
import type { Page } from 'playwright';
import { runGeminiLoop } from './gemini.js';
import logger from '../lib/logger.js';
import { startTimer } from '../lib/timer.js';
import type { ResearchReport } from '../types/proposal.js';

export async function fillAltaForm(
  page: Page,
  report: ResearchReport,
  proposalId: string
): Promise<void> {
  const timer = startTimer();
  logger.info({ proposalId, step: 'alta', status: 'started' });

  const cad = report.cad.data;
  const maps = report.googleMaps.data;

  const fieldValues = {
    'Property Type':       cad?.propertyType        ?? 'Single-family home',
    'Year Built':          cad?.yearBuilt            ?? null,
    'Roof Type':           maps?.roofCovering        ?? null,
    'Roof Style':          maps?.roofStyle           ?? null,
    'Exterior Material':   maps?.exteriorMaterial    ?? null,
    'Number of Stories':   maps?.stories             ?? null,
    'Garage Type':         cad?.attachedGarageSqft
                             ? 'Attached'
                             : null,
  };

  // Drop null values so Gemini isn't told to fill fields we don't have data for
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
    'Fill the Alta proposal form with the provided research values. ' +
    'Find each labeled field and enter the corresponding value. ' +
    'Use dropdowns where present — select the closest matching option. ' +
    'Do not submit or save the form. Stop after the last field is filled.';

  await runGeminiLoop(page, goal, proposalId, { context });

  logger.info({ proposalId, step: 'alta', status: 'complete', durationMs: timer() });
}
