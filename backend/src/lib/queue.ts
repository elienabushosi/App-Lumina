import { Queue } from 'bullmq';
import { env } from '../config/env.js';
import type { ProposalInput } from '../types/proposal.js';

export interface ProposalJobData {
  proposalId: string;
  input: ProposalInput;
}

export interface ProposalJobResult {
  proposalId: string;
  status: 'complete' | 'failed';
}

const connection = { url: env.REDIS_URL };

export const proposalQueue = new Queue<ProposalJobData, ProposalJobResult>(
  'proposals',
  { connection }
);
