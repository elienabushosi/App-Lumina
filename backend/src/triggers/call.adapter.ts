/**
 * Trigger A: Post-call → RingCentral → Agency Zoom → proposal
 *
 * Accepts a call_recordings row (already has Claude-extracted lead_payload)
 * and normalizes it into a ProposalInput for the proposal pipeline.
 */
import { randomUUID } from 'crypto';
import { proposalQueue } from '../lib/queue.js';
import logger from '../lib/logger.js';
import type { ProposalInput } from '../types/proposal.js';

export interface CallRecordingRow {
  id: string;
  id_organization: string;
  ringcentral_call_id?: string | null;
  lead_payload: {
    lead: {
      name?: { first?: string | null; last?: string | null; full?: string | null };
      contact?: { primary_phone?: string | null; email?: string | null };
      address?: {
        street?: string | null;
        city?: string | null;
        state?: string | null;
        postal_code?: string | null;
      };
    };
  };
}

export async function triggerFromCall(row: CallRecordingRow): Promise<string> {
  const { lead } = row.lead_payload;
  const name = lead.name ?? {};
  const contact = lead.contact ?? {};
  const address = lead.address ?? {};

  const proposalId = randomUUID();

  const input: ProposalInput = {
    triggeredBy: 'call',
    leadId: row.id,
    agentId: row.id_organization,
    property: {
      address: address.street ?? '',
      city: address.city ?? '',
      state: address.state ?? '',
      zip: address.postal_code ?? '',
    },
    contact: {
      firstName: name.first ?? name.full?.split(' ')[0] ?? 'Unknown',
      lastName: name.last ?? name.full?.split(' ').slice(1).join(' ') ?? '',
      phone: contact.primary_phone ?? undefined,
      email: contact.email ?? undefined,
    },
    rawPayload: row as unknown as Record<string, unknown>,
  };

  await proposalQueue.add(proposalId, { proposalId, input }, { jobId: proposalId });
  logger.info({ proposalId, trigger: 'call', callId: row.id });

  return proposalId;
}
