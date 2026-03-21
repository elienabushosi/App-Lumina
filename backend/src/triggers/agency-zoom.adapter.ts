/**
 * Trigger C: Direct Agency Zoom lead (no call) → proposal
 *
 * Accepts an Agency Zoom lead webhook payload and normalizes it into a ProposalInput.
 * Field names match the Agency Zoom LeadDataRequest / webhook event shape.
 */
import { randomUUID } from 'crypto';
import { proposalQueue } from '../lib/queue.js';
import logger from '../lib/logger.js';
import type { ProposalInput } from '../types/proposal.js';

export interface AgencyZoomLeadPayload {
  leadId: string | number;
  agencyId?: string | number;
  firstname?: string | null;
  lastname?: string | null;
  phone?: string | null;
  email?: string | null;
  streetAddress?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  [key: string]: unknown;
}

export async function triggerFromAgencyZoom(payload: AgencyZoomLeadPayload): Promise<string> {
  const proposalId = randomUUID();

  const input: ProposalInput = {
    triggeredBy: 'agency_zoom',
    leadId: String(payload.leadId),
    agentId: String(payload.agencyId ?? ''),
    property: {
      address: payload.streetAddress ?? '',
      city: payload.city ?? '',
      state: payload.state ?? '',
      zip: payload.zip ?? '',
    },
    contact: {
      firstName: payload.firstname ?? 'Unknown',
      lastName: payload.lastname ?? '',
      phone: payload.phone ?? undefined,
      email: payload.email ?? undefined,
    },
    rawPayload: payload as unknown as Record<string, unknown>,
  };

  await proposalQueue.add(proposalId, { proposalId, input }, { jobId: proposalId });
  logger.info({ proposalId, trigger: 'agency_zoom', azLeadId: payload.leadId });

  return proposalId;
}
