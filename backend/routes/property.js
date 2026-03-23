import express from "express";

const router = express.Router();

const ATTOM_BASE_URL =
	"https://api.gateway.attomdata.com/propertyapi/v1.0.0/property/detail";

/**
 * GET /api/property/cad?address=9808+Coolidge+Dr&city=McKinney&state=TX
 * Returns CAD data from ATTOM Data API for the given address.
 */
router.get("/cad", async (req, res) => {
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
		const area = property.area ?? {};
		const identifier = property.identifier ?? {};
		const sale = property.sale ?? {};

		const cad = {
			propertyType: summary.propclass ?? "Unknown",
			yearBuilt: summary.yearbuilt ?? null,
			livingAreaSqft: size.livingsize ?? null,
			totalBuildingSqft: size.grosssize ?? null,
			attachedGarageSqft: parking.prkgSize ?? null,
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

export default router;
