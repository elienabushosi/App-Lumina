/**
 * Trigger B: Existing APEX lead from internet source → agent initiates proposal
 *
 * Accepts a Salesforce/APEX lead record and normalizes it into a ProposalInput.
 * Field names match standard Salesforce Lead object field API names.
 */
import { randomUUID } from 'crypto';
import { proposalQueue } from '../lib/queue.js';
import logger from '../lib/logger.js';
import type { ProposalInput } from '../types/proposal.js';

export interface ApexLeadPayload {
  Id: string;
  OwnerId: string;
  FirstName?: string | null;
  LastName?: string | null;
  Phone?: string | null;
  Email?: string | null;
  Street?: string | null;
  City?: string | null;
  State?: string | null;
  PostalCode?: string | null;
  [key: string]: unknown;
}

export async function triggerFromApexLead(payload: ApexLeadPayload): Promise<string> {
  const proposalId = randomUUID();

  const input: ProposalInput = {
    triggeredBy: 'apex_lead',
    leadId: payload.Id,
    agentId: payload.OwnerId,
    property: {
      address: payload.Street ?? '',
      city: payload.City ?? '',
      state: payload.State ?? '',
      zip: payload.PostalCode ?? '',
    },
    contact: {
      firstName: payload.FirstName ?? 'Unknown',
      lastName: payload.LastName ?? '',
      phone: payload.Phone ?? undefined,
      email: payload.Email ?? undefined,
    },
    rawPayload: payload as unknown as Record<string, unknown>,
  };

  await proposalQueue.add(proposalId, { proposalId, input }, { jobId: proposalId });
  logger.info({ proposalId, trigger: 'apex_lead', apexLeadId: payload.Id });

  return proposalId;
}
