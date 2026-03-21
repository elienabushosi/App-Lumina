import { Router } from 'express';
import { triggerFromCall, triggerFromApexLead, triggerFromAgencyZoom } from '../triggers/index.js';
import logger from '../lib/logger.js';

const router = Router();

// POST /api/triggers/call
// Payload: a call_recordings row with lead_payload from Claude extraction.
router.post('/call', async (req, res) => {
  try {
    const proposalId = await triggerFromCall(req.body);
    res.status(202).json({ proposalId });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error({ route: 'POST /api/triggers/call', err: message });
    res.status(500).json({ error: message });
  }
});

// POST /api/triggers/apex-lead
// Payload: a Salesforce Lead object (standard API field names).
router.post('/apex-lead', async (req, res) => {
  try {
    const proposalId = await triggerFromApexLead(req.body);
    res.status(202).json({ proposalId });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error({ route: 'POST /api/triggers/apex-lead', err: message });
    res.status(500).json({ error: message });
  }
});

// POST /api/triggers/agency-zoom
// Payload: an Agency Zoom lead/webhook event.
router.post('/agency-zoom', async (req, res) => {
  try {
    const proposalId = await triggerFromAgencyZoom(req.body);
    res.status(202).json({ proposalId });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error({ route: 'POST /api/triggers/agency-zoom', err: message });
    res.status(500).json({ error: message });
  }
});

export default router;
