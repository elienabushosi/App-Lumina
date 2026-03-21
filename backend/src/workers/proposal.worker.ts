import { Worker } from 'bullmq';
import { env } from '../config/env.js';
import logger from '../lib/logger.js';
import { runPipeline } from '../pipeline.js';
import type { ProposalJobData, ProposalJobResult } from '../lib/queue.js';

const connection = { url: env.REDIS_URL };

export function startProposalWorker() {
  const worker = new Worker<ProposalJobData, ProposalJobResult>(
    'proposals',
    async (job) => {
      const { proposalId, input } = job.data;
      await runPipeline(proposalId, input);
      return { proposalId, status: 'complete' };
    },
    { connection }
  );

  worker.on('completed', (job) => {
    logger.info({ proposalId: job.data.proposalId, event: 'job_completed' });
  });

  worker.on('failed', (job, err) => {
    logger.error({ proposalId: job?.data.proposalId, event: 'job_failed', err: err.message });
  });

  logger.info({ msg: 'Proposal worker started' });
  return worker;
}
