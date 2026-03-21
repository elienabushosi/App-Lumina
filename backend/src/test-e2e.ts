/**
 * Step 16 — End-to-end smoke test.
 *
 * Run with: npm run test:e2e
 *
 * What this tests:
 *   1. POST /api/proposals with the dummy test property (9808 Coolidge Dr)
 *   2. Poll GET /api/proposals/:id until terminal state
 *   3. Log the final result
 *
 * The APEX navigation stubs mean Playwright opens but does not navigate.
 * This confirms the full pipeline fires: queue → worker → research stubs →
 * aggregator → APEX orchestrator → login attempt.
 *
 * Prerequisites: proposal server running on port 3003 (npm run dev:proposals)
 */
import dummyResearch from './data/dummy-research.json' with { type: 'json' };

const BASE_URL = 'http://localhost:3003';
const POLL_INTERVAL_MS = 2_000;
const POLL_TIMEOUT_MS = 3 * 60 * 1_000; // 3 minutes

const testInput = {
  triggeredBy: 'call',
  leadId:  'test-lead-001',
  agentId: 'test-agent-001',
  property: {
    address: dummyResearch.property.address,
    city:    dummyResearch.property.city,
    state:   dummyResearch.property.state,
    zip:     dummyResearch.property.zip,
  },
  contact: {
    firstName: 'Alex',
    lastName:  'Ridley',
    phone:     '+12145550001',
    email:     'alex@example.com',
  },
  rawPayload: {},
};

async function run() {
  console.log('\n=== Lumina Proposal Pipeline — E2E Smoke Test ===\n');
  console.log('Property:', `${testInput.property.address}, ${testInput.property.city} ${testInput.property.state}`);

  // 1. Enqueue
  console.log('\n[1] POST /api/proposals ...');
  const createRes = await fetch(`${BASE_URL}/api/proposals`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(testInput),
  });

  if (!createRes.ok) {
    const text = await createRes.text();
    throw new Error(`POST /api/proposals failed ${createRes.status}: ${text}`);
  }

  const { proposalId } = await createRes.json() as { proposalId: string };
  console.log('   proposalId:', proposalId);

  // 2. Poll
  console.log('\n[2] Polling status ...');
  const deadline = Date.now() + POLL_TIMEOUT_MS;

  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL_MS);

    const statusRes = await fetch(`${BASE_URL}/api/proposals/${proposalId}`);
    const data = await statusRes.json() as {
      proposalId: string;
      status: string;
      result: unknown;
      failedReason: string | null;
    };

    console.log(`   status: ${data.status}`);

    if (data.status === 'completed') {
      console.log('\n✓ Pipeline completed successfully');
      console.log('  result:', JSON.stringify(data.result, null, 2));
      return;
    }

    if (data.status === 'failed') {
      console.error('\n✗ Pipeline failed');
      console.error('  reason:', data.failedReason);
      process.exit(1);
    }

    // MFA gate — in a real run the human would submit the code via the frontend.
    // For the smoke test, print a prompt so you can submit it manually.
    if (data.status === 'active') {
      console.log('   (job is active — running pipeline steps)');
    }
  }

  throw new Error(`Timed out after ${POLL_TIMEOUT_MS / 1000}s waiting for completion`);
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

run().catch(err => {
  console.error('\nFatal:', err.message);
  process.exit(1);
});
