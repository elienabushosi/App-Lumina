/**
 * Step 15 — Pipeline orchestrator.
 *
 * Single entry point for a proposal job. The worker calls runPipeline and
 * knows nothing about the individual steps. All step sequencing lives here.
 */
import logger from './lib/logger.js';
import { runResearchAggregator } from './steps/aggregator.step.js';
import { runApexStep } from './agents/apex.step.js';
import type { ProposalInput } from './types/proposal.js';

export async function runPipeline(proposalId: string, input: ProposalInput): Promise<void> {
  logger.info({ proposalId, event: 'pipeline_started', triggeredBy: input.triggeredBy, address: input.property.address });

  // Steps 4 + 5 — research stubs → aggregated report
  const report = await runResearchAggregator(proposalId, input);

  logger.info({
    proposalId,
    event: 'research_complete',
    cad:       !!report.cad.data,
    googleMaps: !!report.googleMaps.data,
    realtor:   !!report.realtor.data,
  });

  // Step 14 — APEX browser agent
  await runApexStep(proposalId, input.agentId, report);

  logger.info({ proposalId, event: 'pipeline_complete' });
}
