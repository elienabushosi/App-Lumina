import logger from '../lib/logger.js';
import dummyResearch from '../data/dummy-research.json' with { type: 'json' };
import type { RealtorData } from '../types/proposal.js';

export async function runRealtorStep(proposalId: string, address: string): Promise<RealtorData | null> {
  logger.info({ proposalId, step: 'realtor', status: 'started', address });
  try {
    // TODO: implement real Realtor.com interior image scraper + Vision analysis
    await new Promise(r => setTimeout(r, 800)); // simulate delay, remove later
    const result = dummyResearch.realtor.data as RealtorData;
    logger.info({ proposalId, step: 'realtor', status: 'complete' });
    return result;
  } catch (err) {
    logger.error({ proposalId, step: 'realtor', status: 'failed', err });
    return null; // never throw
  }
}
