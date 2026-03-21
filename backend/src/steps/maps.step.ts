import logger from '../lib/logger.js';
import dummyResearch from '../data/dummy-research.json' with { type: 'json' };
import type { GoogleMapsData } from '../types/proposal.js';

export async function runMapsStep(proposalId: string, address: string): Promise<GoogleMapsData | null> {
  logger.info({ proposalId, step: 'maps', status: 'started', address });
  try {
    // TODO: implement real Google Maps + Vision analysis
    await new Promise(r => setTimeout(r, 800)); // simulate delay, remove later
    const result = dummyResearch.googleMaps.data as GoogleMapsData;
    logger.info({ proposalId, step: 'maps', status: 'complete' });
    return result;
  } catch (err) {
    logger.error({ proposalId, step: 'maps', status: 'failed', err });
    return null; // never throw
  }
}
