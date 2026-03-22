import logger from '../lib/logger.js';
import { startTimer } from '../lib/timer.js';
import { runCADStep } from './cad.step.js';
import { runMapsStep } from './maps.step.js';
import { runRealtorStep } from './realtor.step.js';
import type { ProposalInput, ResearchReport } from '../types/proposal.js';

export async function runResearchAggregator(
  proposalId: string,
  input: ProposalInput
): Promise<ResearchReport> {
  const timer = startTimer();
  logger.info({ proposalId, step: 'aggregator', status: 'started' });

  const fullAddress = [
    input.property.address,
    input.property.city,
    input.property.state,
    input.property.zip,
  ]
    .filter(Boolean)
    .join(', ');

  // Run all three stubs in parallel. Each is try/caught internally — none can throw.
  const [cad, googleMaps, realtor] = await Promise.all([
    runCADStep(proposalId, fullAddress),
    runMapsStep(proposalId, fullAddress),
    runRealtorStep(proposalId, fullAddress),
  ]);

  const report: ResearchReport = {
    proposalId,
    property: input.property,
    cad: { data: cad },
    googleMaps: { data: googleMaps },
    realtor: { data: realtor },
  };

  const gathered = [cad, googleMaps, realtor].filter(Boolean).length;
  logger.info({ proposalId, step: 'aggregator', status: 'complete', gathered: `${gathered}/3`, durationMs: timer() });

  return report;
}
