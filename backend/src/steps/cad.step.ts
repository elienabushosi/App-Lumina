import logger from '../lib/logger.js';
import { env } from '../config/env.js';
import type { CADData } from '../types/proposal.js';

const ATTOM_BASE_URL = 'https://api.gateway.attomdata.com/propertyapi/v1.0.0/property/detail';

export async function runCADStep(
  proposalId: string,
  address: string,
  city: string,
  state: string,
): Promise<CADData | null> {
  logger.info({ proposalId, step: 'cad', status: 'started', address });
  try {
    if (!env.ATTOM_API_KEY) {
      logger.warn({ proposalId, step: 'cad', msg: 'ATTOM_API_KEY not set — skipping' });
      return null;
    }

    const params = new URLSearchParams({
      address1: address,
      address2: `${city}, ${state}`,
    });

    const res = await fetch(`${ATTOM_BASE_URL}?${params}`, {
      headers: {
        apikey: env.ATTOM_API_KEY,
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      throw new Error(`ATTOM API error: ${res.status} ${res.statusText}`);
    }

    const json = await res.json() as Record<string, unknown>;
    const property = (json.property as Record<string, unknown>[])?.[0];
    if (!property) throw new Error('No property found in ATTOM response');

    const summary = property.summary as Record<string, unknown> | undefined;
    const building = property.building as Record<string, unknown> | undefined;
    const size = building?.size as Record<string, unknown> | undefined;
    const parking = building?.parking as Record<string, unknown> | undefined;

    const result: CADData = {
      propertyType: (summary?.propclass as string) ?? 'Unknown',
      yearBuilt: (summary?.yearbuilt as number) ?? 0,
      livingAreaSqft: (size?.livingsize as number) ?? 0,
      totalBuildingSqft: (size?.grosssize as number) ?? 0,
      attachedGarageSqft: (parking?.prkgSize as number) ?? 0,
    };

    logger.info({ proposalId, step: 'cad', status: 'complete', result });
    return result;
  } catch (err) {
    logger.error({ proposalId, step: 'cad', status: 'failed', err });
    return null; // never throw
  }
}
