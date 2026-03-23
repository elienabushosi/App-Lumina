# Task: Realtor Step — Real Implementation + Frontend Wiring

## Context

This task has two parts:
1. Replace the stub in `backend/src/steps/realtor.step.ts` with a real
   RealtyAPI call
2. Wire the frontend research-agent page to call the real endpoint

Do not touch CAD or Maps steps — they are working. Do not add Supabase
persistence — data stays in React state only for now.

---

## Part 1: Single Backend

The project should run as one backend server. If there are currently two
servers (port 3002 and port 3003), consolidate before implementing the
Realtor step. All routes and pipeline steps should live under the same
Express server entry point.

If they are already consolidated, skip this and move to Part 2.

---

## Part 2: Implement realtor.step.ts

**File:** `backend/src/steps/realtor.step.ts`

**Current stub signature to replace:**
```typescript
export async function runRealtorStep(
  proposalId: string,
  address: string
): Promise<RealtorData | null>
```

**Current RealtorData type** (`backend/src/types/proposal.ts`):
```typescript
interface RealtorData {
  flooringType: string;
  bathroomCount: number;
  kitchenFinishes: string;
  interiorCondition: string;
}
```

### API Details

- Base URL: `https://zillow.realtyapi.io`
- Endpoint: `GET /pro/byaddress`
- Auth header: `x-realtyapi-key: <REALTYAPI_KEY>`
- Query param: `propertyaddress` — full address string passed as-is

### What the API Returns (confirmed from live test)

From `propertyDetails.resoFacts`:
```
flooring[]              e.g. ["Tile", "Carpet"]
foundationDetails[]     e.g. ["Slab"]
exteriorFeatures[]      e.g. ["Brick"]
constructionMaterials[] e.g. ["Wood"]
parkingFeatures[]       e.g. ["Garage - Attached"]
bathrooms               number
bathroomsFull           number
yearBuilt               number
roofType                string | null
hasFireplace            boolean | null
cooling[]               e.g. ["Central"]
heating[]               e.g. ["Other"]
```

From `propertyDetails` (top level):
```
zestimate               number
rentZestimate           number
county                  string
parcelId                string
photoCount              number
homeStatus              "FOR_SALE" | "OTHER"
streetViewImageUrl      string (Google Maps URL)
propertyTaxRate         number
```

From `propertyDetails.taxHistory[0]`:
```
taxPaid                 number
value                   number (assessed value)
```

From `propertyDetails.schools[]`:
```
name, rating, level, distance, grades
```

### Update RealtorData Type

Expand the existing `RealtorData` interface in
`backend/src/types/proposal.ts` to include all useful fields. Keep the
existing four fields — add to them:

```typescript
interface RealtorData {
  // Existing fields (keep)
  flooringType: string;
  bathroomCount: number;
  kitchenFinishes: string;
  interiorCondition: string;

  // New fields from RealtyAPI
  flooring: string[];           // raw array e.g. ["Tile", "Carpet"]
  foundationDetails: string[];
  exteriorFeatures: string[];
  constructionMaterials: string[];
  roofType: string | null;
  parkingFeatures: string[];
  hasFireplace: boolean | null;
  cooling: string[];
  heating: string[];
  zestimate: number | null;
  rentZestimate: number | null;
  taxAssessedValue: number | null;
  taxAnnualAmount: number | null;
  propertyTaxRate: number | null;
  schools: Array<{
    name: string;
    rating: number | null;
    level: string;
    distance: number;
    grades: string;
  }>;
  streetViewUrl: string | null;
  hasInteriorPhotos: boolean;
  homeStatus: string | null;

  // Interior vision analysis — only populated for active listings
  // with listing photos. null for off-market properties.
  interiorAnalysis: {
    flooringType: string | null;
    flooringCondition: string | null;
    kitchenFinishes: string | null;
    interiorCondition: string | null;
    notableFeatures: string[];
  } | null;
}
```

### Photo + Vision Logic

Off-market properties (`homeStatus !== "FOR_SALE"`) will have no interior
listing photos — `photoCount` will be 1 and the only image is a Street View
URL. This is expected and fine.

For active listings (`homeStatus === "FOR_SALE"` and `photoCount > 1`):
- Extract photo URLs from `originalPhotos[].mixedSources.jpeg[]`
  filtered to `width >= 1024`
- Filter out URLs containing `maps.googleapis.com` (those are Street View)
- Take first 8 photos max
- Send to Gemini 2.5 Flash vision with this prompt:

```
Analyze these interior property listing photos and return JSON only, 
no explanation:
{
  "flooringType": "hardwood | carpet | tile | vinyl | laminate | mixed | unknown",
  "flooringCondition": "excellent | good | fair | poor | unknown",
  "kitchenFinishes": "standard | upgraded | luxury | unknown",
  "interiorCondition": "excellent | good | fair | poor | unknown",
  "notableFeatures": ["array of notable features visible"]
}
```

For off-market: set `interiorAnalysis: null`, `hasInteriorPhotos: false`.

For the four legacy fields (`flooringType`, `bathroomCount`,
`kitchenFinishes`, `interiorCondition`) — populate them from the best
available source:
- If `interiorAnalysis` exists: use those values
- Otherwise: derive `flooringType` from `flooring[0]` or "unknown",
  `bathroomCount` from `bathrooms`, `kitchenFinishes` from "unknown",
  `interiorCondition` from "unknown"

### Env Config

In `backend/src/config/env.ts` (uses Zod):
- Add `REALTYAPI_KEY: z.string().optional()`

In `backend/.env.development`:
- Add `REALTYAPI_KEY=<your key>`

### Error Handling

```typescript
try {
  // implementation
} catch (err) {
  logger.error({ proposalId, step: 'realtor', status: 'failed', err });
  return null; // never throw
}
```

---

## Part 3: Add Express Route

**File:** `backend/routes/property.js`

Add alongside the existing `/cad` and `/maps` routes:

```javascript
// GET /api/property/realtor?address=9808 Coolidge Dr, McKinney, TX 75072
router.get('/realtor', async (req, res) => {
  const { address } = req.query;
  if (!address) return res.status(400).json({ error: 'address required' });

  try {
    const result = await runRealtorStep('route', address);
    if (!result) return res.status(404).json({ error: 'Property not found' });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Realtor lookup failed' });
  }
});
```

Import `runRealtorStep` from the TypeScript step. If the existing routes
import the other steps the same way, follow that same pattern.

---

## Part 4: Wire Frontend

**File:** `frontend/app/(workspace)/research-agent/page.tsx`

The page already has a Zillow/Redfin section that shows dummy data. Replace
that dummy data call with a real call to `/api/property/realtor`.

Follow the exact same pattern as the CAD and Maps sections already on this
page:

1. On "Yes, continue with Realtor.com" button click:
   - Set loading state
   - Call `GET /api/property/realtor?address=<full address string>`
     where address is built from the URL params: `${address}, ${city}, ${state} ${zip}`
   - On success: store result in React state, clear loading
   - On error: show error state with retry option

2. Display the result in the existing Realtor section card. Update the
   display to show the new fields. Suggested layout:

```
Realtor.com / Zillow Records
─────────────────────────────
Flooring          Tile, Carpet
Bathrooms         2
Foundation        Slab
Exterior          Brick
Fireplace         Yes
Cooling           Central
Heating           Other

Valuation
─────────────────────────────
Zestimate         $368,700
Rent Estimate     $2,197/mo
Tax Assessed      $355,921
Annual Tax        $2,874

Schools
─────────────────────────────
Sonntag Elementary (0.2mi)  ★9  PK-5
Roach Middle (0.5mi)         ★9  6-8
Heritage High (0.7mi)        ★8  9-12

Interior Photos
─────────────────────────────
[if hasInteriorPhotos = true]
  Show interiorAnalysis fields

[if hasInteriorPhotos = false]
  "Property is off-market — no listing photos available.
   Structured data from Zillow records."
```

Do not redesign the page. Match the existing card style used for CAD
and Maps sections.

---

## Test Checklist

After implementation, verify:

- [ ] `GET /api/property/realtor?address=9808 Coolidge Dr, McKinney, TX 75072`
  returns real data (not dummy)
- [ ] Response includes `flooring: ["Tile", "Carpet"]`
- [ ] Response includes `bathrooms: 2`
- [ ] Response includes `hasInteriorPhotos: false` (off-market property)
- [ ] Response includes `interiorAnalysis: null`
- [ ] Frontend Realtor card shows real data after clicking continue
- [ ] Loading skeleton shows while fetch is in progress
- [ ] Error state shows if API call fails
- [ ] CAD and Maps sections still work (do not regress)

---

## Do Not Touch

- `backend/src/steps/cad.step.ts` — working, leave it
- `backend/src/steps/maps.step.ts` — working, leave it
- CAD and Maps frontend cards — working, leave them
- No Supabase changes in this task — data stays in React state only
- No APEX agent changes in this task
