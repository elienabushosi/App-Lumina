/**
 * Step 3 — RealtyAPI (Zillow data) + optional Gemini vision for interior photos.
 *
 * Fetches structured property data from zillow.realtyapi.io.
 * For active listings with photos, runs Gemini 2.5 Flash vision on interior images.
 * Off-market properties return structured data only (no interior analysis).
 */
import { GoogleGenAI } from '@google/genai';
import logger from '../lib/logger.js';
import { env } from '../config/env.js';
import type { RealtorData } from '../types/proposal.js';

const REALTY_API_BASE = 'https://zillow.realtyapi.io';
const VISION_MODEL = 'gemini-2.5-flash';
const MAX_PHOTOS = 8;

async function fetchRealtorProperty(address: string): Promise<Record<string, unknown>> {
  const url = new URL(`${REALTY_API_BASE}/pro/byaddress`);
  url.searchParams.set('propertyaddress', address);

  const res = await fetch(url.toString(), {
    headers: { 'x-realtyapi-key': env.REALTY_API_KEY! },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`RealtyAPI error: ${res.status} ${text.slice(0, 200)}`);
  }

  return res.json() as Promise<Record<string, unknown>>;
}

async function runGeminiVision(
  photoUrls: string[],
): Promise<RealtorData['interiorAnalysis']> {
  if (!env.GEMINI_API_KEY) return null;

  // Fetch all photos in parallel, skip failures
  const imageParts = (
    await Promise.all(
      photoUrls.map(async (url) => {
        try {
          const res = await fetch(url);
          if (!res.ok) return null;
          const buffer = await res.arrayBuffer();
          const data = Buffer.from(buffer).toString('base64');
          const mimeType = res.headers.get('content-type') ?? 'image/jpeg';
          return { inlineData: { data, mimeType } };
        } catch {
          return null;
        }
      }),
    )
  ).filter(Boolean) as { inlineData: { data: string; mimeType: string } }[];

  if (imageParts.length === 0) return null;

  const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });

  const prompt = `Analyze these interior property listing photos and return JSON only, no explanation:
{
  "flooringType": "hardwood | carpet | tile | vinyl | laminate | mixed | unknown",
  "flooringCondition": "excellent | good | fair | poor | unknown",
  "kitchenFinishes": "standard | upgraded | luxury | unknown",
  "interiorCondition": "excellent | good | fair | poor | unknown",
  "notableFeatures": ["array of notable features visible"]
}`;

  const response = await ai.models.generateContent({
    model: VISION_MODEL,
    contents: [{ role: 'user', parts: [{ text: prompt }, ...imageParts] }],
  });

  const raw = response.text?.trim() ?? '';
  const jsonText = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  return JSON.parse(jsonText) as RealtorData['interiorAnalysis'];
}

export async function runRealtorStep(
  proposalId: string,
  address: string,
): Promise<RealtorData | null> {
  logger.info({ proposalId, step: 'realtor', status: 'started', address });
  try {
    if (!env.REALTY_API_KEY) {
      logger.warn({ proposalId, step: 'realtor', msg: 'REALTY_API_KEY not set — skipping' });
      return null;
    }

    const json = await fetchRealtorProperty(address);
    const details = (json.propertyDetails ?? {}) as Record<string, unknown>;
    if (!details.homeStatus) {
      logger.warn({ proposalId, step: 'realtor', msg: 'RealtyAPI returned no property data after retries', apiMessage: json.message });
      return null;
    }
    const resoFacts = (details.resoFacts ?? {}) as Record<string, unknown>;
    const taxHistory = ((details.taxHistory as unknown[])?.[0] ?? {}) as Record<string, unknown>;
    const schools = (details.schools as unknown[]) ?? [];
    const originalPhotos = (details.originalPhotos as unknown[]) ?? [];

    const isForSale = details.homeStatus === 'FOR_SALE';
    const photoCount = Number(details.photoCount ?? 0);

    // Extract display photo URLs (all listings, up to MAX_PHOTOS)
    const displayPhotoUrls: string[] = [];
    for (const photo of originalPhotos) {
      const p = photo as Record<string, unknown>;
      const mixed = p.mixedSources as Record<string, unknown> | undefined;
      const jpegs = (mixed?.jpeg as Record<string, unknown>[]) ?? [];
      const large = jpegs.filter(
        (j) => Number(j.width) >= 1024 && !String(j.url).includes('maps.googleapis.com'),
      );
      if (large.length > 0) displayPhotoUrls.push(String(large[0].url));
      if (displayPhotoUrls.length >= MAX_PHOTOS) break;
    }

    // Interior vision — only for active listings with photos
    let interiorAnalysis: RealtorData['interiorAnalysis'] = null;
    let hasInteriorPhotos = false;

    if (displayPhotoUrls.length > 0) {
      hasInteriorPhotos = true;
      logger.info({ proposalId, step: 'realtor', msg: 'Running Gemini vision on interior photos', count: displayPhotoUrls.length });
      interiorAnalysis = await runGeminiVision(displayPhotoUrls);
    }

    const flooring = Array.isArray(resoFacts.flooring) ? (resoFacts.flooring as string[]) : [];
    const bathroomCount = Number(resoFacts.bathrooms ?? resoFacts.bathroomsFull ?? 0);

    const result: RealtorData = {
      // Legacy fields — use interiorAnalysis if available, fall back to structured data
      flooringType: interiorAnalysis?.flooringType ?? flooring[0] ?? 'unknown',
      bathroomCount,
      kitchenFinishes: interiorAnalysis?.kitchenFinishes ?? 'unknown',
      interiorCondition: interiorAnalysis?.interiorCondition ?? 'unknown',

      // Raw fields
      flooring,
      foundationDetails: Array.isArray(resoFacts.foundationDetails) ? (resoFacts.foundationDetails as string[]) : [],
      exteriorFeatures: Array.isArray(resoFacts.exteriorFeatures) ? (resoFacts.exteriorFeatures as string[]) : [],
      constructionMaterials: Array.isArray(resoFacts.constructionMaterials) ? (resoFacts.constructionMaterials as string[]) : [],
      roofType: (resoFacts.roofType as string) ?? null,
      parkingFeatures: Array.isArray(resoFacts.parkingFeatures) ? (resoFacts.parkingFeatures as string[]) : [],
      hasFireplace: resoFacts.hasFireplace != null ? Boolean(resoFacts.hasFireplace) : null,
      cooling: Array.isArray(resoFacts.cooling) ? (resoFacts.cooling as string[]) : [],
      heating: Array.isArray(resoFacts.heating) ? (resoFacts.heating as string[]) : [],

      // Valuation
      zestimate: details.zestimate != null ? Number(details.zestimate) : null,
      rentZestimate: details.rentZestimate != null ? Number(details.rentZestimate) : null,
      taxAssessedValue: taxHistory.value != null ? Number(taxHistory.value) : null,
      taxAnnualAmount: taxHistory.taxPaid != null ? Number(taxHistory.taxPaid) : null,
      propertyTaxRate: details.propertyTaxRate != null ? Number(details.propertyTaxRate) : null,

      // Schools
      schools: schools.map((s) => {
        const school = s as Record<string, unknown>;
        return {
          name: String(school.name ?? ''),
          rating: school.rating != null ? Number(school.rating) : null,
          level: String(school.level ?? ''),
          distance: Number(school.distance ?? 0),
          grades: String(school.grades ?? ''),
        };
      }),

      listingHistory: ((details.priceHistory as unknown[]) ?? []).map((entry) => {
        const e = entry as Record<string, unknown>;
        return {
          date: String(e.date ?? ''),
          price: e.price != null ? Number(e.price) : null,
          event: String(e.event ?? ''),
          pricePerSquareFoot: e.pricePerSquareFoot != null ? Number(e.pricePerSquareFoot) : null,
          source: e.source != null ? String(e.source) : null,
        };
      }),

      streetViewUrl: (details.streetViewImageUrl as string) ?? null,
      photoUrls: displayPhotoUrls,
      hasInteriorPhotos,
      homeStatus: (details.homeStatus as string) ?? null,
      interiorAnalysis,
    };

    logger.info({ proposalId, step: 'realtor', status: 'complete', hasInteriorPhotos, homeStatus: result.homeStatus, zestimate: result.zestimate });
    return result;
  } catch (err) {
    logger.error({ proposalId, step: 'realtor', status: 'failed', err });
    return null; // never throw
  }
}
