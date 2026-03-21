import { Router } from 'express';
import { randomUUID } from 'crypto';
import { proposalQueue } from '../lib/queue.js';
import { provideMfaCode } from '../agents/mfa.js';
import logger from '../lib/logger.js';
import type { ProposalInput } from '../types/proposal.js';

const router = Router();

// POST /api/proposals
// Accepts a pre-normalized ProposalInput and enqueues it directly.
// Useful for testing the pipeline without going through a trigger adapter.
router.post('/', async (req, res) => {
  try {
    const input: ProposalInput = req.body;

    if (!input?.triggeredBy || !input?.property?.address) {
      res.status(400).json({ error: 'triggeredBy and property.address are required' });
      return;
    }

    const proposalId = randomUUID();
    await proposalQueue.add(proposalId, { proposalId, input }, { jobId: proposalId });
    logger.info({ proposalId, trigger: input.triggeredBy, route: 'POST /api/proposals' });

    res.status(202).json({ proposalId });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error({ route: 'POST /api/proposals', err: message });
    res.status(500).json({ error: message });
  }
});

// GET /api/proposals/:id
// Returns the BullMQ job state for a given proposalId.
router.get('/:id', async (req, res) => {
  try {
    const job = await proposalQueue.getJob(req.params.id);

    if (!job) {
      res.status(404).json({ error: 'Proposal not found' });
      return;
    }

    const state = await job.getState();
    const result = job.returnvalue ?? null;

    res.json({
      proposalId: req.params.id,
      status: state,
      input: job.data.input,
      result,
      failedReason: job.failedReason ?? null,
      createdAt: new Date(job.timestamp).toISOString(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error({ route: 'GET /api/proposals/:id', err: message });
    res.status(500).json({ error: message });
  }
});

// POST /api/proposals/:id/mfa
// Called by the frontend when the human enters their Salesforce MFA code.
router.post('/:id/mfa', (req, res) => {
  const { code } = req.body;
  if (!code || typeof code !== 'string') {
    res.status(400).json({ error: 'code is required' });
    return;
  }
  provideMfaCode(req.params.id, code);
  logger.info({ proposalId: req.params.id, route: 'POST /api/proposals/:id/mfa', msg: 'MFA code received' });
  res.json({ ok: true });
});

export default router;
