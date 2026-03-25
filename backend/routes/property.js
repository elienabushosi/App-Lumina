import express from "express";
import { runRealtorStep } from "../src/steps/realtor.step.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

const ATTOM_BASE_URL =
	"https://api.gateway.attomdata.com/propertyapi/v1.0.0/property/detail";

/**
 * GET /api/property/cad?address=9808+Coolidge+Dr&city=McKinney&state=TX
 * Returns CAD data from ATTOM Data API for the given address.
 */
router.get("/cad", requireAuth, async (req, res) => {
	const { address, city, state } = req.query;

	if (!address || !city || !state) {
		return res
			.status(400)
			.json({ error: "address, city, and state are required" });
	}

	const apiKey = process.env.ATTOM_API_KEY;
	if (!apiKey) {
		return res.status(500).json({ error: "ATTOM_API_KEY not configured" });
	}

	try {
		const params = new URLSearchParams({
			address1: address,
			address2: `${city}, ${state}`,
		});

		const attomRes = await fetch(`${ATTOM_BASE_URL}?${params}`, {
			headers: {
				apikey: apiKey,
				Accept: "application/json",
			},
		});

		if (!attomRes.ok) {
			const text = await attomRes.text().catch(() => "");
			return res
				.status(attomRes.status)
				.json({ error: `ATTOM API error: ${attomRes.status}`, detail: text });
		}

		const json = await attomRes.json();
		const property = json.property?.[0];

		if (!property) {
			return res.status(404).json({ error: "Property not found" });
		}

		const summary = property.summary ?? {};
		const building = property.building ?? {};
		const size = building.size ?? {};
		const parking = building.parking ?? {};
		const construction = building.construction ?? {};
		const bldgSummary = building.summary ?? {};
		const area = property.area ?? {};
		const identifier = property.identifier ?? {};
		const sale = property.sale ?? {};

		const stories = bldgSummary.levels ?? null;
		const firstFloorSqft = size.bldgsize ?? size.firstfloorsize ?? null;
		const upperFloorSqft = size.upperfloorsize ?? null;

		// Story classification logic
		let storyClassification = null;
		let storyRatioPercent = null;
		if (stories === 1) {
			storyClassification = "1 story";
		} else if (stories === 2) {
			if (firstFloorSqft && upperFloorSqft && firstFloorSqft > 0) {
				const ratio = upperFloorSqft / firstFloorSqft;
				storyRatioPercent = Math.round(ratio * 100);
				storyClassification = ratio >= 0.70 ? "2 stories" : "1.5 stories";
			} else {
				storyClassification = "2 stories";
			}
		} else if (stories != null) {
			storyClassification = `${stories} stories`;
		}

		const cad = {
			propertyType: summary.propclass ?? "Unknown",
			yearBuilt: summary.yearbuilt ?? null,
			livingAreaSqft: size.livingsize ?? null,
			totalBuildingSqft: size.grosssize ?? null,
			attachedGarageSqft: parking.prkgSize ?? null,
			stories,
			firstFloorSqft,
			upperFloorSqft,
			storyClassification,
			storyRatioPercent,
			foundationType: construction.foundationtype ?? null,
			exteriorWallType: construction.wallType ?? null,
			garageType: parking.garagetype ?? null,
			roofCover: construction.roofcover ?? null,
			county: area.countrysecsubd ?? null,
			apn: identifier.apn ?? null,
			lastSaleAmount: sale.amount?.saleamt ?? null,
			lastSaleDate: sale.salesearchdate ?? null,
		};

		return res.json({ cad });
	} catch (err) {
		console.error("[property/cad] Error:", err.message);
		return res.status(500).json({ error: "Failed to fetch property data" });
	}
});

/**
 * GET /api/property/autocomplete?input=9808+Coolidge
 * Returns address suggestions from Google Places Autocomplete (US only).
 */
router.get("/autocomplete", async (req, res) => {
	const { input } = req.query;
	if (!input || String(input).length < 2) {
		return res.json({ suggestions: [] });
	}

	const mapsKey = process.env.GOOGLE_MAPS_API_KEY;
	if (!mapsKey) {
		return res.json({ suggestions: [] });
	}

	try {
		const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(String(input))}&types=address&components=country:us&key=${mapsKey}`;
		const response = await fetch(url);
		const json = await response.json();
		const suggestions = (json.predictions ?? []).map((p) => p.description);
		return res.json({ suggestions });
	} catch {
		return res.json({ suggestions: [] });
	}
});

/**
 * GET /api/property/geocode?address=9808+Coolidge+Dr,+McKinney,+TX+75070
 * Validates an address via Google Geocoding API.
 * Returns parsed components: address, city, state, zip, formattedAddress.
 */
router.get("/geocode", async (req, res) => {
	const { address } = req.query;
	if (!address) {
		return res.status(400).json({ error: "address is required" });
	}

	const mapsKey = process.env.GOOGLE_MAPS_API_KEY;
	if (!mapsKey) {
		return res.status(500).json({ error: "GOOGLE_MAPS_API_KEY not configured" });
	}

	try {
		const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${mapsKey}`;
		const response = await fetch(url);
		const json = await response.json();

		if (json.status === "ZERO_RESULTS") {
			return res.status(404).json({ error: "Address not found — please check and try again.", googleStatus: json.status });
		}
		if (json.status !== "OK") {
			// REQUEST_DENIED, OVER_QUERY_LIMIT, etc. — return 502 so the frontend falls back.
			return res.status(502).json({ error: `Geocoding unavailable (${json.status})`, googleStatus: json.status });
		}

		const result = json.results[0];
		const components = result.address_components;

		const get = (type, nameType = "long_name") =>
			components.find(c => c.types.includes(type))?.[nameType] ?? "";

		const streetNumber = get("street_number");
		const route = get("route");
		const city = get("locality") || get("sublocality") || get("administrative_area_level_2");
		const state = get("administrative_area_level_1", "short_name");
		const zip = get("postal_code");

		if (!streetNumber || !route || !city || !state) {
			return res.status(422).json({ error: "Could not parse a complete US address from that input." });
		}

		return res.json({
			address: `${streetNumber} ${route}`,
			city,
			state,
			zip,
			formattedAddress: result.formatted_address,
		});
	} catch (err) {
		return res.status(500).json({ error: err.message });
	}
});

/**
 * GET /api/property/maps?address=9808+Coolidge+Dr,+McKinney,+TX+75070
 * Fetches satellite + street view images and runs Gemini vision analysis.
 * Returns roof style, pool visible, solar panels visible.
 */
router.get("/maps", requireAuth, async (req, res) => {
	const { address } = req.query;
	if (!address) {
		return res.status(400).json({ error: "address is required" });
	}

	const mapsKey = process.env.GOOGLE_MAPS_API_KEY;
	const geminiKey = process.env.GEMINI_API_KEY;
	if (!mapsKey || !geminiKey) {
		return res
			.status(500)
			.json({ error: "GOOGLE_MAPS_API_KEY or GEMINI_API_KEY not configured" });
	}

	try {
		const encoded = encodeURIComponent(address);
		const satelliteUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${encoded}&zoom=20&size=640x640&maptype=satellite&markers=color:red%7C${encoded}&key=${mapsKey}`;
		const streetviewUrl = `https://maps.googleapis.com/maps/api/streetview?location=${encoded}&size=640x480&fov=90&key=${mapsKey}`;

		// Fetch both images in parallel
		const [satRes, svRes] = await Promise.all([
			fetch(satelliteUrl),
			fetch(streetviewUrl),
		]);

		if (!satRes.ok) {
			return res
				.status(502)
				.json({ error: `Satellite image fetch failed (${satRes.status})` });
		}

		async function toBase64(r) {
			const buf = await r.arrayBuffer();
			return {
				data: Buffer.from(buf).toString("base64"),
				mimeType: r.headers.get("content-type") ?? "image/jpeg",
			};
		}

		const [satellite, streetview] = await Promise.all([
			toBase64(satRes),
			svRes.ok ? toBase64(svRes) : null,
		]);

		const { GoogleGenAI } = await import("@google/genai");
		const ai = new GoogleGenAI({ apiKey: geminiKey });

		const prompt = `You are analyzing satellite and street view images of a residential property.
The satellite image is zoomed in at maximum resolution and has a red pin marker indicating the exact property to analyze. Focus your analysis on the property at the red pin — ignore neighboring houses.
Return ONLY a JSON object with exactly these fields — no markdown, no explanation:

{
  "roofStyle": "<hip | gable | flat | mansard | shed | gambrel | unknown>",
  "poolVisible": <true | false>,
  "solarPanelsVisible": <true | false>,
  "trampolineVisible": <true | false>
}

- roofStyle: shape of the roof visible from satellite or street view on the pinned property
- poolVisible: true if a swimming pool is visible on or adjacent to the pinned property
- solarPanelsVisible: true if solar panels are visible on the roof of the pinned property
- trampolineVisible: true if a trampoline is visible anywhere on the pinned property's lot

Use "unknown" for roofStyle if not confident. Use false for booleans if not visible.`;

		const imageParts = [
			{ inlineData: { data: satellite.data, mimeType: satellite.mimeType } },
			...(streetview
				? [{ inlineData: { data: streetview.data, mimeType: streetview.mimeType } }]
				: []),
		];

		const response = await ai.models.generateContent({
			model: "gemini-2.5-flash",
			contents: [
				{
					role: "user",
					parts: [{ text: prompt }, ...imageParts],
				},
			],
		});

		const raw = response.text?.trim() ?? "";
		const jsonText = raw
			.replace(/^```(?:json)?\s*/i, "")
			.replace(/\s*```$/, "")
			.trim();
		const parsed = JSON.parse(jsonText);

		return res.json({
			maps: parsed,
			images: {
				satellite: `data:${satellite.mimeType};base64,${satellite.data}`,
				streetview: streetview
					? `data:${streetview.mimeType};base64,${streetview.data}`
					: null,
			},
		});
	} catch (err) {
		console.error("[property/maps] Error:", err.message);
		return res.status(500).json({ error: err.message });
	}
});

/**
 * GET /api/property/realtor?address=9808 Coolidge Dr, McKinney, TX 75070
 * Fetches structured property data from RealtyAPI (Zillow).
 * For active listings, also runs Gemini vision on interior photos.
 */
router.get("/realtor", requireAuth, async (req, res) => {
	const { address } = req.query;
	if (!address) {
		return res.status(400).json({ error: "address is required" });
	}

	try {
		const result = await runRealtorStep("route", String(address));
		if (!result) {
			return res.status(404).json({ error: "Property not found or REALTY_API_KEY not configured" });
		}
		return res.json(result);
	} catch (err) {
		console.error("[property/realtor] Error:", err.message);
		return res.status(500).json({ error: "Realtor lookup failed" });
	}
});

export default router;
