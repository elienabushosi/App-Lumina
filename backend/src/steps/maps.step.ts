/**
 * Step 2 — Google Maps imagery + Gemini vision analysis.
 *
 * Fetches satellite and street view images for the property address,
 * then asks Gemini to extract roof style, pool visibility, and solar panels.
 * Foundation, wall type, stories, and garage are already covered by ATTOM.
 */
import { GoogleGenAI } from '@google/genai';
import logger from '../lib/logger.js';
import { env } from '../config/env.js';
import type { GoogleMapsData } from '../types/proposal.js';

const VISION_MODEL = 'gemini-2.5-flash';

const SATELLITE_URL = (address: string) =>
  `https://maps.googleapis.com/maps/api/staticmap?center=${encodeURIComponent(address)}&zoom=19&size=640x640&maptype=satellite&key=${env.GOOGLE_MAPS_API_KEY}`;

const STREETVIEW_URL = (address: string) =>
  `https://maps.googleapis.com/maps/api/streetview?location=${encodeURIComponent(address)}&size=640x480&fov=90&key=${env.GOOGLE_MAPS_API_KEY}`;

async function fetchImageAsBase64(url: string): Promise<{ data: string; mimeType: string } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buffer = await res.arrayBuffer();
    const data = Buffer.from(buffer).toString('base64');
    const mimeType = res.headers.get('content-type') ?? 'image/jpeg';
    return { data, mimeType };
  } catch {
    return null;
  }
}

const PROMPT = `You are analyzing satellite and street view images of a residential property.
Return ONLY a JSON object with exactly these fields — no markdown, no explanation:

{
  "roofStyle": "<hip | gable | flat | mansard | shed | gambrel | unknown>",
  "poolVisible": <true | false>,
  "solarPanelsVisible": <true | false>
}

Definitions:
- roofStyle: the shape of the roof as seen from above or the street
- poolVisible: true if a swimming pool is visible in the satellite image
- solarPanelsVisible: true if solar panels are visible on the roof

If you cannot determine a value with reasonable confidence, use "unknown" for strings and false for booleans.`;

export async function runMapsStep(
  proposalId: string,
  address: string,
): Promise<GoogleMapsData | null> {
  logger.info({ proposalId, step: 'maps', status: 'started', address });
  try {
    if (!env.GOOGLE_MAPS_API_KEY || !env.GEMINI_API_KEY) {
      logger.warn({ proposalId, step: 'maps', msg: 'GOOGLE_MAPS_API_KEY or GEMINI_API_KEY not set — skipping' });
      return null;
    }

    // Fetch both images in parallel
    const [satellite, streetview] = await Promise.all([
      fetchImageAsBase64(SATELLITE_URL(address)),
      fetchImageAsBase64(STREETVIEW_URL(address)),
    ]);

    if (!satellite) {
      logger.warn({ proposalId, step: 'maps', msg: 'Satellite image fetch failed' });
      return null;
    }

    const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });

    const imageParts = [
      { inlineData: { data: satellite.data, mimeType: satellite.mimeType } },
      ...(streetview ? [{ inlineData: { data: streetview.data, mimeType: streetview.mimeType } }] : []),
    ];

    const response = await ai.models.generateContent({
      model: VISION_MODEL,
      contents: [
        {
          role: 'user',
          parts: [
            { text: PROMPT },
            ...imageParts,
          ],
        },
      ],
    });

    const raw = response.text?.trim() ?? '';
    logger.info({ proposalId, step: 'maps', msg: 'Gemini raw response', raw });

    // Strip markdown code fences if present
    const jsonText = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    const parsed = JSON.parse(jsonText) as Record<string, unknown>;

    const result: GoogleMapsData = {
      structureType: 'single-family',
      stories: 0,           // covered by ATTOM
      exteriorMaterial: '', // covered by ATTOM
      roofStyle: (parsed.roofStyle as string) ?? 'unknown',
      roofCovering: '',     // covered by ATTOM (roofCover)
      foundationType: '',   // covered by ATTOM
      solarPanelsVisible: Boolean(parsed.solarPanelsVisible),
      poolVisible: Boolean(parsed.poolVisible),
    };

    logger.info({ proposalId, step: 'maps', status: 'complete', result });
    return result;
  } catch (err) {
    logger.error({ proposalId, step: 'maps', status: 'failed', err });
    return null; // never throw
  }
}
