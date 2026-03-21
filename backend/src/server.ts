import express from 'express';
import { env } from './config/env.js';
import logger from './lib/logger.js';
import { startProposalWorker } from './workers/proposal.worker.js';
import { closeBrowser } from './agents/browser.js';
import proposalRoutes from './routes/proposals.js';
import triggerRoutes from './routes/triggers.js';

const app = express();
app.use(express.json());

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'proposals' });
});

app.use('/api/proposals', proposalRoutes);
app.use('/api/triggers', triggerRoutes);

const PORT = Number(env.PORT) + 1; // 3003 alongside main server on 3002
app.listen(PORT, () => {
  logger.info({ msg: 'Proposal pipeline server started', port: PORT, env: env.NODE_ENV });
  startProposalWorker();
});

async function shutdown() {
  logger.info({ msg: 'Shutting down' });
  await closeBrowser();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

export { app };
