import logger from '../lib/logger.js';
import dummyResearch from '../data/dummy-research.json' with { type: 'json' };
import type { CADData } from '../types/proposal.js';

export async function runCADStep(proposalId: string, address: string): Promise<CADData | null> {
  logger.info({ proposalId, step: 'cad', status: 'started', address });
  try {
    // TODO: implement real CAD scraper (Playwright + Gemini vision)
    await new Promise(r => setTimeout(r, 800)); // simulate delay, remove later
    const result = dummyResearch.cad.data as CADData;
    logger.info({ proposalId, step: 'cad', status: 'complete' });
    return result;
  } catch (err) {
    logger.error({ proposalId, step: 'cad', status: 'failed', err });
    return null; // never throw
  }
}
