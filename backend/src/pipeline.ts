import logger from './lib/logger.js';
import { startTimer } from './lib/timer.js';
import { runResearchAggregator } from './steps/aggregator.step.js';
import { runApexStep } from './agents/apex.step.js';
import type { ProposalInput } from './types/proposal.js';

export async function runPipeline(proposalId: string, input: ProposalInput): Promise<void> {
  const total = startTimer();
  logger.info({ proposalId, event: 'pipeline_started', triggeredBy: input.triggeredBy, address: input.property.address });

  // Steps 4 + 5 — research stubs → aggregated report
  const researchTimer = startTimer();
  const report = await runResearchAggregator(proposalId, input);
  logger.info({
    proposalId,
    event: 'research_complete',
    durationMs: researchTimer(),
    cad:        !!report.cad.data,
    googleMaps: !!report.googleMaps.data,
    realtor:    !!report.realtor.data,
  });

  // Step 14 — APEX browser agent
  const apexTimer = startTimer();
  await runApexStep(proposalId, input.agentId, report);
  logger.info({ proposalId, event: 'apex_complete', durationMs: apexTimer() });

  logger.info({ proposalId, event: 'pipeline_complete', totalMs: total() });
}
