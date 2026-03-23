"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { config } from "@/lib/config";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
	MapPinHouse,
	Sparkles,
	Home,
	Trees,
	Sofa,
	CircleCheck,
} from "lucide-react";

// Demo steps (dummy data flow)
const STEPS = {
	INPUT: 0,
	CAD_LOADER: 1,
	ATTRIBUTES_PULLING: 2,
	DATA_PULLED: 3,
	CONFIRM_LOOKS_RIGHT: 4,
	GOOGLE_MAP_PROMPT: 5,
	AI_INFERRING: 6,
	ZILLOW_REDFIN_PROMPT: 7,
	DATA_GATHERED: 8,
	READY_360: 9,
} as const;


const COLLIN_CAD_SOURCE_URL =
	"https://esearch.collincad.org/Property/View/2516503?year=2026&ownerId=558191";

type CadData = {
	propertyType: string | null;
	yearBuilt: number | null;
	livingAreaSqft: number | null;
	totalBuildingSqft: number | null;
	attachedGarageSqft: number | null;
	stories: number | null;
	foundationType: string | null;
	exteriorWallType: string | null;
	garageType: string | null;
	roofCover: string | null;
	county: string | null;
	apn: string | null;
	lastSaleAmount: number | null;
	lastSaleDate: string | null;
};

function ResearchAgentInner() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const [step, setStep] = useState(STEPS.INPUT);

	const [address, setAddress] = useState("");
	// Individual address parts from query params (used for API call)
	const [addrParts, setAddrParts] = useState<{ address: string; city: string; state: string; zip: string } | null>(null);
	// Lead context from Agency Zoom (passed via URL params)
	const [leadName, setLeadName] = useState<string | null>(null);
	const [agencyZoomLeadId, setAgencyZoomLeadId] = useState<string | null>(null);
	// Real CAD data from ATTOM API
	const [cadData, setCadData] = useState<CadData | null>(null);
	const [cadError, setCadError] = useState<string | null>(null);

	// Pre-fill address from query params (e.g. navigated from call detail or AZ leads page)
	useEffect(() => {
		const a = searchParams.get("address");
		const c = searchParams.get("city");
		const s = searchParams.get("state");
		const z = searchParams.get("zip");
		const ln = searchParams.get("leadName");
		const azId = searchParams.get("agencyZoomLeadId");
		const parts = [a, c, s, z].filter(Boolean);
		if (parts.length > 0) {
			setAddress(parts.join(", "));
			if (a && c && s) setAddrParts({ address: a, city: c, state: s, zip: z ?? "" });
		}
		if (ln) setLeadName(ln);
		if (azId) setAgencyZoomLeadId(azId);
	}, [searchParams]);
	const [zillowStage, setZillowStage] = useState(0);
	const [redfinStage, setRedfinStage] = useState(0);
	const [zillowRedfinViewPhase, setZillowRedfinViewPhase] = useState(0);
	// Real maps state
	const [mapsLoading, setMapsLoading] = useState(false);
	const [mapsData, setMapsData] = useState<{
		roofStyle: string;
		poolVisible: boolean;
		solarPanelsVisible: boolean;
		satelliteImage: string | null;
		streetviewImage: string | null;
	} | null>(null);
	const [mapsError, setMapsError] = useState<string | null>(null);

	// Step 1: After Research click, show CAD loader then auto-advance to attributes
	useEffect(() => {
		if (step !== STEPS.CAD_LOADER) return;
		const t = setTimeout(() => setStep(STEPS.ATTRIBUTES_PULLING), 2500);
		return () => clearTimeout(t);
	}, [step]);

	// Step 2: "Attributes being pulled" → after a delay show "data pulled"
	useEffect(() => {
		if (step !== STEPS.ATTRIBUTES_PULLING) return;
		const t = setTimeout(() => setStep(STEPS.DATA_PULLED), 3000);
		return () => clearTimeout(t);
	}, [step]);
	const defaultAddress = "9808 Coolidge Dr. Mckinney,Tx 75070";
	const effectiveAddress = address || defaultAddress;
	const analysisComplete = mapsData !== null;
	const zillowRedfinComplete = redfinStage === 2;

	// Build attributes from real ATTOM data only
	const displayAttributes = cadData
		? [
			{ label: "Type", value: cadData.propertyType ?? "—" },
			{ label: "Year built", value: cadData.yearBuilt?.toString() ?? "—" },
			{ label: "Stories", value: cadData.stories?.toString() ?? "—" },
			{ label: "Living area", value: cadData.livingAreaSqft ? `${cadData.livingAreaSqft.toLocaleString()} sq ft` : "—" },
			{ label: "Total building", value: cadData.totalBuildingSqft ? `${cadData.totalBuildingSqft.toLocaleString()} sq ft` : "—" },
			{ label: "Attached garage", value: cadData.attachedGarageSqft ? `${cadData.attachedGarageSqft.toLocaleString()} sq ft` : "—" },
			{ label: "Garage type", value: cadData.garageType ?? "—" },
			{ label: "Foundation", value: cadData.foundationType ?? "—" },
			{ label: "Exterior wall", value: cadData.exteriorWallType ?? "—" },
			{ label: "Roof cover", value: cadData.roofCover ?? "—" },
			...(cadData.county ? [{ label: "County", value: cadData.county }] : []),
			...(cadData.apn ? [{ label: "APN", value: cadData.apn }] : []),
			...(cadData.lastSaleAmount ? [{ label: "Last sale", value: `$${cadData.lastSaleAmount.toLocaleString()}${cadData.lastSaleDate ? ` on ${cadData.lastSaleDate}` : ""}` }] : []),
		]
		: [];

	// When entering Zillow & Redfin step, show loader first, then imagery
	useEffect(() => {
		if (step !== STEPS.DATA_GATHERED) return;
		setZillowRedfinViewPhase(0);
	}, [step]);

	useEffect(() => {
		if (step !== STEPS.DATA_GATHERED || zillowRedfinViewPhase !== 0) return;
		const t = setTimeout(() => setZillowRedfinViewPhase(1), 2200);
		return () => clearTimeout(t);
	}, [step, zillowRedfinViewPhase]);

	// Zillow / Redfin interior photos – staged like Google Maps (only after view phase 1)
	useEffect(() => {
		if (step !== STEPS.DATA_GATHERED || zillowRedfinViewPhase !== 1) return;
		setZillowStage(0);
		setRedfinStage(0);

		const t1 = setTimeout(() => setZillowStage(1), 600);
		const t2 = setTimeout(() => {
			setZillowStage(2);
			setRedfinStage(1);
		}, 2000);
		const t3 = setTimeout(() => setRedfinStage(2), 3400);

		return () => {
			clearTimeout(t1);
			clearTimeout(t2);
			clearTimeout(t3);
		};
	}, [step, zillowRedfinViewPhase]);

	const handleStartMapsAnalysis = async () => {
		setMapsData(null);
		setMapsError(null);
		setMapsLoading(true);
		setStep(STEPS.GOOGLE_MAP_PROMPT);

		try {
			const fullAddress = addrParts
				? `${addrParts.address}, ${addrParts.city}, ${addrParts.state} ${addrParts.zip}`
				: effectiveAddress;
			const params = new URLSearchParams({ address: fullAddress });
			const res = await fetch(`${config.apiUrl}/api/property/maps?${params}`);
			const json = await res.json();
			if (!res.ok) {
				setMapsError(json.error ?? `API error ${res.status}`);
			} else {
				setMapsData({
					roofStyle: json.maps?.roofStyle ?? "unknown",
					poolVisible: Boolean(json.maps?.poolVisible),
					solarPanelsVisible: Boolean(json.maps?.solarPanelsVisible),
					satelliteImage: json.images?.satellite ?? null,
					streetviewImage: json.images?.streetview ?? null,
				});
			}
		} catch (err) {
			setMapsError(err instanceof Error ? err.message : "Failed to fetch map analysis.");
		} finally {
			setMapsLoading(false);
		}
	};

	const handleResearch = async () => {
		setAddress(effectiveAddress);
		setCadData(null);
		setCadError(null);
		setMapsData(null);
		setMapsError(null);
		setStep(STEPS.CAD_LOADER);

		if (!addrParts) {
			setCadError("No address components available — navigate here from a call detail page or enter a full address.");
			return;
		}

		try {
			const params = new URLSearchParams({
				address: addrParts.address,
				city: addrParts.city,
				state: addrParts.state,
			});
			const res = await fetch(`${config.apiUrl}/api/property/cad?${params}`);
			const json = await res.json();
			if (!res.ok) {
				setCadError(json.error ?? `API error ${res.status}`);
			} else if (json.cad) {
				setCadData(json.cad as CadData);
			} else {
				setCadError("Property not found in ATTOM database.");
			}
		} catch (err) {
			setCadError(err instanceof Error ? err.message : "Failed to fetch property data.");
		}
	};

	return (
		<div className="p-8">
			<div className="max-w-4xl mx-auto space-y-6">
				<div>
					<h1 className="text-2xl font-semibold text-[#37322F]">
						Research Agent
					</h1>
					{leadName && (
						<p className="text-sm text-[#605A57] mt-1">
							Researching for: <span className="font-medium text-[#37322F]">{leadName}</span>
							{agencyZoomLeadId && (
								<span className="ml-2 text-xs text-[#605A57]">AZ #{agencyZoomLeadId}</span>
							)}
						</p>
					)}
				</div>

				{step !== STEPS.INPUT && (
					<>
						<div className="flex items-center gap-2 text-sm text-[#605A57]">
							<MapPinHouse className="w-4 h-4 text-[#6C70BA]" />
							<span>{effectiveAddress}</span>
						</div>
						{/* Data stored pills – below address, left-aligned */}
						<div className="flex flex-wrap items-center gap-2">
							{step >= STEPS.DATA_PULLED && cadData && (
								<span className="inline-flex items-center gap-1.5 rounded-full bg-[#6C70BA]/10 px-3 py-1 text-xs font-medium text-[#6C70BA]">
									<CircleCheck className="w-3.5 h-3.5" />
									CAD data stored
								</span>
							)}
							{step >= STEPS.DATA_PULLED && cadError && (
								<span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-600">
									CAD fetch failed
								</span>
							)}
							{step >= STEPS.GOOGLE_MAP_PROMPT && (step > STEPS.GOOGLE_MAP_PROMPT || analysisComplete) && (
								<span className="inline-flex items-center gap-1.5 rounded-full bg-[#6C70BA]/10 px-3 py-1 text-xs font-medium text-[#6C70BA]">
									<CircleCheck className="w-3.5 h-3.5" />
									Google Map image analysis data stored
								</span>
							)}
							{step >= STEPS.DATA_GATHERED && (step > STEPS.DATA_GATHERED || zillowRedfinComplete) && (
								<span className="inline-flex items-center gap-1.5 rounded-full bg-[#6C70BA]/10 px-3 py-1 text-xs font-medium text-[#6C70BA]">
									<CircleCheck className="w-3.5 h-3.5" />
									Zillow &amp; Redfin data stored
								</span>
							)}
						</div>
					</>
				)}

				{/* Step 0: Address input */}
				{step === STEPS.INPUT && (
					<>
						<p className="text-sm text-[#605A57]">
							Enter an address to start.
						</p>
						<div className="flex justify-end gap-3">
							<Input
								type="text"
								placeholder="Input address you want to research"
								className="flex-1 h-10"
								value={address}
								onChange={(e) => setAddress(e.target.value)}
							/>
							<Button
								type="button"
								onClick={handleResearch}
								className="h-10 px-6 bg-[#6C70BA] hover:bg-[#6C70BA]/90 text-white shrink-0"
							>
								Research
								<Sparkles className="w-4 h-4 ml-2" />
							</Button>
						</div>
					</>
				)}

				{/* Step 1: Collin County CAD loader */}
				{step === STEPS.CAD_LOADER && (
					<div className="rounded-lg border border-[rgba(55,50,47,0.12)] bg-white p-6 flex flex-col items-center gap-4">
						<div className="rounded-lg bg-[#5c677d] p-4 flex items-center justify-center">
							<img
								src="/logos/collin-cad-logo.png"
								alt="Collin Central Appraisal District"
								className="h-12 w-auto object-contain"
							/>
						</div>
						<p className="text-sm text-[#605A57]">
							Pulling data from Collin County CAD…
						</p>
						<div className="flex gap-1">
							<span className="w-2 h-2 rounded-full bg-[#6C70BA] animate-bounce [animation-delay:0ms]" />
							<span className="w-2 h-2 rounded-full bg-[#6C70BA] animate-bounce [animation-delay:150ms]" />
							<span className="w-2 h-2 rounded-full bg-[#6C70BA] animate-bounce [animation-delay:300ms]" />
						</div>
					</div>
				)}

				{/* Step 2: Attributes being pulled (loading state) */}
				{step === STEPS.ATTRIBUTES_PULLING && (
					<div className="rounded-lg border border-[rgba(55,50,47,0.12)] bg-white p-6 space-y-4">
						<p className="text-sm font-medium text-[#37322F]">
							Pulling attributes for: {effectiveAddress}
						</p>
						<div className="space-y-2">
							{[70, 55, 65, 50, 45, 60, 75, 40, 55, 60, 65].map((w, i) => (
								<div
									key={i}
									className="h-6 rounded bg-[#f3f4f6] animate-pulse"
									style={{ width: `${w}%` }}
								/>
							))}
						</div>
					</div>
				)}

				{/* Step 3: Data pulled (show dummy data) + Google Maps question */}
				{step === STEPS.DATA_PULLED && (
					<div className="rounded-lg border border-[rgba(55,50,47,0.12)] bg-white p-6 space-y-4">
						<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
							<div className="flex items-center gap-2 min-w-0">
								<img
									src="/collin-cad%20simple%20logo.png"
									alt="Collin County CAD"
									className="h-6 w-auto shrink-0 object-contain"
								/>
								<p className="text-sm font-medium text-[#37322F]">
									Property CAD Report
								</p>
							</div>
							<p className="text-xs text-[#605A57] min-w-0 break-words">
								Source:{" "}
								{cadData ? (
									<span className="text-[#6C70BA] font-medium">ATTOM Data API</span>
								) : (
									<a
										href={COLLIN_CAD_SOURCE_URL}
										target="_blank"
										rel="noreferrer"
										className="text-[#6C70BA] underline hover:no-underline break-words"
									>
										Collin CAD Property Search (Property ID 2516503)
									</a>
								)}
							</p>
						</div>
						{cadError && (
							<div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
								<span className="font-medium">CAD fetch failed:</span> {cadError}
							</div>
						)}
						{!cadError && displayAttributes.length === 0 && (
							<div className="rounded-md border border-[rgba(55,50,47,0.12)] bg-[#fafafa] px-4 py-3 text-sm text-[#605A57]">
								No property data returned.
							</div>
						)}
						{displayAttributes.length > 0 && (
							<div className="overflow-x-auto rounded-md border border-[rgba(55,50,47,0.12)]">
								<table className="w-full text-sm">
									<tbody>
										{displayAttributes.map(({ label, value }) => (
											<tr
												key={label}
												className="border-b border-[rgba(55,50,47,0.08)] last:border-b-0"
											>
												<td className="py-2 pl-3 pr-4 text-[#605A57] font-medium">
													{label}
												</td>
												<td className="py-2 pr-3 text-right font-medium text-[#37322F]">
													{value}
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						)}
						<div className="pt-4 border-t border-[rgba(55,50,47,0.08)] space-y-3">
							<p className="text-sm font-medium text-[#37322F]">
								Are you ready to continue with Google Maps and images?
							</p>
							<p className="text-xs text-[#605A57]">
								We&apos;ll use a powerful vision model to infer things like number of stories, foundation type
								(slab vs pier &amp; beam) from visible slab/vents, exterior wall materials, and more.
							</p>
							<div className="flex gap-3">
								<Button
									type="button"
									onClick={handleStartMapsAnalysis}
									className="bg-[#6C70BA] hover:bg-[#6C70BA]/90 text-white"
								>
									Yes, continue
								</Button>
								<Button
									type="button"
									variant="outline"
									onClick={() => setStep(STEPS.ZILLOW_REDFIN_PROMPT)}
								>
									Skip
								</Button>
							</div>
						</div>
					</div>
				)}

				{/* Step 4: Confirm this looks right */}
				{step === STEPS.CONFIRM_LOOKS_RIGHT && (
					<div className="rounded-lg border border-[rgba(55,50,47,0.12)] bg-white p-6 space-y-4">
						<p className="text-sm font-medium text-[#37322F]">
							Does this look right?
						</p>
						<p className="text-sm text-[#605A57]">
							Confirm the property data before we continue with Google Maps and images.
						</p>
						<div className="flex justify-end gap-3">
							<Button
								type="button"
								onClick={handleStartMapsAnalysis}
								className="bg-[#6C70BA] hover:bg-[#6C70BA]/90 text-white"
							>
								Yes, continue
							</Button>
						</div>
					</div>
				)}

				{/* Google Maps step — real satellite + street view imagery + Gemini analysis */}
				{step === STEPS.GOOGLE_MAP_PROMPT && (
					<div className="rounded-lg border border-[rgba(55,50,47,0.12)] bg-white p-6 space-y-6">
						{/* Header */}
						<div className="flex items-center justify-between gap-4">
							<div className="flex items-center gap-2">
								<img
									src="/logos/Google-Maps-Logo.jpg"
									alt="Google Maps"
									className="h-8 w-auto object-contain"
								/>
							</div>
							<div className="flex items-center gap-2 text-xs text-[#605A57]">
								{mapsLoading && (
									<>
										<span className="w-2 h-2 rounded-full bg-[#6C70BA] animate-bounce [animation-delay:0ms]" />
										<span className="w-2 h-2 rounded-full bg-[#6C70BA] animate-bounce [animation-delay:150ms]" />
										<span className="w-2 h-2 rounded-full bg-[#6C70BA] animate-bounce [animation-delay:300ms]" />
										<span>Fetching imagery &amp; analyzing…</span>
									</>
								)}
								{mapsData && <span>Analysis complete</span>}
								{mapsError && <span className="text-red-600">Analysis failed</span>}
							</div>
						</div>

						{/* Error state */}
						{mapsError && (
							<div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
								<span className="font-medium">Maps analysis failed:</span> {mapsError}
							</div>
						)}

						{/* Images — skeleton while loading, real images when done */}
						{(mapsLoading || mapsData) && (
							<div className="grid gap-6 md:grid-cols-2">
								{/* Street view */}
								<div className="rounded-lg border border-[rgba(55,50,47,0.12)] bg-[#f9fafb] overflow-hidden flex flex-col gap-3">
									<div className="relative">
										{mapsData?.streetviewImage ? (
											<img
												src={mapsData.streetviewImage}
												alt="Street view"
												className="w-full h-48 object-cover"
											/>
										) : (
											<div className="w-full h-48 bg-[#f3f4f6] animate-pulse" />
										)}
									</div>
									<div className="px-4 pb-4 space-y-2">
										<p className="text-xs font-semibold uppercase tracking-wide text-[#605A57]">Street view (exterior)</p>
										{cadData ? (
											<ul className="text-xs text-[#37322F] space-y-1">
												{cadData.stories != null && <li><strong>Stories:</strong> {cadData.stories}</li>}
												{cadData.exteriorWallType && <li><strong>Exterior wall:</strong> {cadData.exteriorWallType}</li>}
												{cadData.foundationType && <li><strong>Foundation:</strong> {cadData.foundationType}</li>}
												{cadData.garageType && <li><strong>Garage:</strong> {cadData.garageType}</li>}
											</ul>
										) : (
											<p className="text-xs text-[#9CA3AF]">No CAD data available.</p>
										)}
									</div>
								</div>

								{/* Aerial / satellite */}
								<div className="rounded-lg border border-[rgba(55,50,47,0.12)] bg-[#f9fafb] overflow-hidden flex flex-col gap-3">
									<div className="relative">
										{mapsData?.satelliteImage ? (
											<img
												src={mapsData.satelliteImage}
												alt="Aerial view"
												className="w-full h-48 object-cover"
											/>
										) : (
											<div className="w-full h-48 bg-[#f3f4f6] animate-pulse" />
										)}
									</div>
									<div className="px-4 pb-4 space-y-2">
										<p className="text-xs font-semibold uppercase tracking-wide text-[#605A57]">Aerial view (roof &amp; site)</p>
										{mapsLoading && (
											<p className="text-xs text-[#9CA3AF]">Gemini is analyzing the roof and site…</p>
										)}
										{mapsData && (
											<ul className="text-xs text-[#37322F] space-y-1">
												<li><strong>Roof style:</strong> {mapsData.roofStyle}</li>
												<li><strong>Pool:</strong> {mapsData.poolVisible ? "Visible" : "None visible"}</li>
												<li><strong>Solar panels:</strong> {mapsData.solarPanelsVisible ? "Visible" : "None visible"}</li>
											</ul>
										)}
									</div>
								</div>
							</div>
						)}

						{/* Continue — shown once analysis is done */}
						{mapsData && (
							<div className="pt-2 space-y-3">
								<p className="text-sm font-medium text-[#37322F]">Are you ready to continue with Realtor.com?</p>
								<p className="text-sm text-[#605A57]">
									We&apos;ll use a vision model to infer interior finishes, bathrooms, flooring types, and overall interior quality.
								</p>
								<div className="flex gap-3">
									<Button
										type="button"
										onClick={() => setStep(STEPS.DATA_GATHERED)}
										className="bg-[#6C70BA] hover:bg-[#6C70BA]/90 text-white"
									>
										Yes, continue
									</Button>
									<Button
										type="button"
										variant="outline"
										onClick={() => setStep(STEPS.READY_360)}
									>
										Skip
									</Button>
								</div>
							</div>
						)}
					</div>
				)}

				{/* ZILLOW_REDFIN_PROMPT step is now unused; kept for future expansion */}

				{/* Zillow & Redfin interior analysis */}
				{step === STEPS.DATA_GATHERED && (
					<div className="rounded-lg border border-[rgba(55,50,47,0.12)] bg-white p-6 space-y-6">
						{zillowRedfinViewPhase === 0 ? (
							/* Loading state: logos + dots + "Viewing Zillow & Redfin listing photos" */
							<div className="flex flex-col items-center justify-center py-12 gap-4">
								<div className="flex items-center gap-3">
									<img
										src="/logos/Zillow-Logo.png"
										alt="Zillow"
										className="h-12 w-auto object-contain"
									/>
									<img
										src="/logos/Redin-Logo.png"
										alt="Redfin"
										className="h-8 w-auto object-contain"
									/>
								</div>
								<div className="flex items-center gap-2 text-sm text-[#605A57]">
									<span className="w-2 h-2 rounded-full bg-[#6C70BA] animate-bounce [animation-delay:0ms]" />
									<span className="w-2 h-2 rounded-full bg-[#6C70BA] animate-bounce [animation-delay:150ms]" />
									<span className="w-2 h-2 rounded-full bg-[#6C70BA] animate-bounce [animation-delay:300ms]" />
									<span className="ml-1">Viewing Zillow &amp; Redfin listing photos</span>
								</div>
							</div>
						) : (
							<>
						<div className="space-y-2">
							<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
								<div className="flex items-center gap-3 shrink-0">
									<img
										src="/logos/Zillow-Logo.png"
										alt="Zillow"
										className="h-9 w-auto object-contain"
									/>
									<img
										src="/logos/Redin-Logo.png"
										alt="Redfin"
										className="h-6 w-auto object-contain"
									/>
								</div>
								<p className="text-xs text-[#605A57] sm:text-right min-w-0">
									Using listing photos from Zillow &amp; Redfin to understand interior finishes and quality.
								</p>
							</div>
							<div className="flex items-center gap-1 text-xs text-[#605A57]">
								<span
									className={`w-2 h-2 rounded-full bg-[#6C70BA] ${
										zillowRedfinComplete ? "" : "animate-bounce"
									}`}
								/>
								<span>{zillowRedfinComplete ? "Analysis complete" : "AI is analyzing interior photos…"}</span>
							</div>
						</div>

						<div className="grid gap-6 md:grid-cols-2">
							{/* Zillow - Bathroom */}
							<div className="rounded-lg border border-[rgba(55,50,47,0.12)] bg-[#f9fafb] overflow-hidden flex flex-col gap-3">
								<div className="relative">
									<img
										src="/Bathroom.jpg"
										alt="Bathroom interior"
										className="w-full h-48 object-cover"
									/>
									<div
										className={`pointer-events-none absolute inset-0 bg-linear-to-r from-white/10 via-white/40 to-white/10 ${
											zillowStage >= 2 ? "opacity-0 transition-opacity duration-500" : "animate-pulse"
										}`}
									/>
								</div>
								<div className="px-4 pb-4 space-y-2">
									{zillowStage < 2 && (
										<div className="flex items-center gap-1 text-[11px] text-[#605A57]">
											<span className="w-2 h-2 rounded-full bg-[#6C70BA] animate-bounce [animation-delay:0ms]" />
											<span className="w-2 h-2 rounded-full bg-[#6C70BA] animate-bounce [animation-delay:150ms]" />
											<span className="w-2 h-2 rounded-full bg-[#6C70BA] animate-bounce [animation-delay:300ms]" />
											<span>
												{zillowStage === 0
													? "Loading Zillow bathroom photo…"
													: "AI inferring from Zillow bathroom photo…"}
											</span>
										</div>
									)}
									{zillowStage === 2 && (
										<>
											<ul className="text-xs text-[#37322F] space-y-1">
												<li>
													<strong>Bathroom count (visible):</strong> Full bath with walk-in shower and tub
												</li>
												<li>
													<strong>Finish level:</strong> Updated, modern fixtures and tile
												</li>
												<li>
													<strong>Flooring type:</strong> Large-format tile
												</li>
											</ul>
											<p className="text-[10px] text-[#9CA3AF]">
												Source:&nbsp;
												<a
													href="https://www.zillow.com/homedetails/9808-Coolidge-Dr-McKinney-TX-75072/62574174_zpid/"
													target="_blank"
													rel="noreferrer"
													className="underline"
												>
													Zillow listing
												</a>
											</p>
										</>
									)}
								</div>
							</div>

							{/* Redfin - Living room */}
							<div className="rounded-lg border border-[rgba(55,50,47,0.12)] bg-[#f9fafb] overflow-hidden flex flex-col gap-3">
								<div className="relative">
									<img
										src="/Livingroom.jpg"
										alt="Living room interior"
										className="w-full h-48 object-cover"
									/>
									<div
										className={`pointer-events-none absolute inset-0 bg-linear-to-r from-white/10 via-white/40 to-white/10 ${
											redfinStage >= 2 ? "opacity-0 transition-opacity duration-500" : "animate-pulse"
										}`}
									/>
								</div>
								<div className="px-4 pb-4 space-y-2">
									{redfinStage < 2 && (
										<div className="flex items-center gap-1 text-[11px] text-[#605A57]">
											<span className="w-2 h-2 rounded-full bg-[#6C70BA] animate-bounce [animation-delay:0ms]" />
											<span className="w-2 h-2 rounded-full bg-[#6C70BA] animate-bounce [animation-delay:150ms]" />
											<span className="w-2 h-2 rounded-full bg-[#6C70BA] animate-bounce [animation-delay:300ms]" />
											<span>
												{redfinStage === 0
													? "Loading Redfin living room photo…"
													: "AI inferring from Redfin living room photo…"}
											</span>
										</div>
									)}
									{redfinStage === 2 && (
										<>
											<ul className="text-xs text-[#37322F] space-y-1">
												<li>
													<strong>Flooring type:</strong> Site-finished hardwood
												</li>
												<li>
													<strong>Interior quality:</strong> Above average (staged, coordinated finishes)
												</li>
												<li>
													<strong>Fireplace:</strong> Built-in gas fireplace with mantel
												</li>
											</ul>
											<p className="text-[10px] text-[#9CA3AF]">
												Source:&nbsp;
												<a
													href="https://www.redfin.com/TX/McKinney/9809-Coolidge-Dr-75072/home/31533482"
													target="_blank"
													rel="noreferrer"
													className="underline"
												>
													Redfin listing
												</a>
											</p>
										</>
									)}
								</div>
							</div>
						</div>

						{redfinStage === 2 && (
							<div className="flex items-center justify-end pt-2">
								<Button
									type="button"
									onClick={() => setStep(STEPS.READY_360)}
									className="bg-[#6C70BA] hover:bg-[#6C70BA]/90 text-white"
								>
									Review Research
								</Button>
							</div>
						)}
							</>
						)}
					</div>
				)}

				{step === STEPS.READY_360 && (
					<div className="rounded-lg border border-[rgba(55,50,47,0.12)] bg-white p-6 space-y-6">
						<div className="space-y-1">
							<p className="text-xs text-[#605A57]">
								Here&apos;s a summary of what the Research Agent inferred for this property during the demo.
							</p>
						</div>

						<div className="space-y-5 text-sm">
							{/* Property summary */}
							<div className="space-y-3 border border-[rgba(55,50,47,0.08)] rounded-lg p-4">
								<div className="flex items-center gap-2">
									<div className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#6C70BA]/10 text-[#6C70BA]">
										<Home className="w-3.5 h-3.5" />
									</div>
									<h3 className="text-xs font-semibold uppercase tracking-wide text-[#605A57]">
										Property summary
									</h3>
								</div>
								<div className="overflow-x-auto rounded-md border border-[rgba(55,50,47,0.08)]">
									<table className="w-full text-sm">
										<tbody>
											<tr className="border-b border-[rgba(55,50,47,0.08)]">
												<td className="py-2 pl-3 text-[#605A57]">Address</td>
												<td className="py-2 pr-3 text-right font-medium text-[#37322F]">{effectiveAddress}</td>
											</tr>
											{cadData ? (
												<>
												<tr className="border-b border-[rgba(55,50,47,0.08)]">
													<td className="py-2 pl-3 text-[#605A57]">Type</td>
													<td className="py-2 pr-3 text-right font-medium text-[#37322F]">{cadData.propertyType ?? "—"}</td>
												</tr>
												<tr className="border-b border-[rgba(55,50,47,0.08)]">
													<td className="py-2 pl-3 text-[#605A57]">Year built</td>
													<td className="py-2 pr-3 text-right font-medium text-[#37322F]">{cadData.yearBuilt ?? "—"}</td>
												</tr>
												<tr className="border-b border-[rgba(55,50,47,0.08)]">
													<td className="py-2 pl-3 text-[#605A57]">Living Area</td>
													<td className="py-2 pr-3 text-right font-medium text-[#37322F]">{cadData.livingAreaSqft ? `${cadData.livingAreaSqft.toLocaleString()} sq ft` : "—"}</td>
												</tr>
												<tr className="border-b border-[rgba(55,50,47,0.08)]">
													<td className="py-2 pl-3 text-[#605A57]">Attached Garage</td>
													<td className="py-2 pr-3 text-right font-medium text-[#37322F]">{cadData.attachedGarageSqft ? `${cadData.attachedGarageSqft.toLocaleString()} sq ft` : "—"}</td>
												</tr>
												</>
											) : (
												<tr className="border-b border-[rgba(55,50,47,0.08)]">
													<td colSpan={2} className="py-2 pl-3 text-sm text-[#605A57] italic">CAD data not available</td>
												</tr>
											)}
											<tr className="border-b border-[rgba(55,50,47,0.08)]">
												<td className="py-2 pl-3 text-[#605A57]">Bedrooms</td>
												<td className="py-2 pr-3 text-right font-medium text-[#37322F]">4</td>
											</tr>
											<tr>
												<td className="py-2 pl-3 text-[#605A57]">Bathrooms</td>
												<td className="py-2 pr-3 text-right font-medium text-[#37322F]">2 full</td>
											</tr>
										</tbody>
									</table>
								</div>
							</div>

							{/* Exterior & site (from CAD + Google Maps) */}
							<div className="space-y-3 border border-[rgba(55,50,47,0.08)] rounded-lg p-4">
								<div className="flex items-center gap-2">
									<div className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#6C70BA]/10 text-[#6C70BA]">
										<Trees className="w-3.5 h-3.5" />
									</div>
									<h3 className="text-xs font-semibold uppercase tracking-wide text-[#605A57]">
										Exterior &amp; site
									</h3>
								</div>
								<div className="overflow-x-auto rounded-md border border-[rgba(55,50,47,0.08)]">
									<table className="w-full text-sm">
										<tbody>
											<tr className="border-b border-[rgba(55,50,47,0.08)]">
												<td className="py-2 pl-3 text-[#605A57]">Stories</td>
												<td className="py-2 pr-3 text-right font-medium text-[#37322F]">1-story</td>
											</tr>
											<tr className="border-b border-[rgba(55,50,47,0.08)]">
												<td className="py-2 pl-3 text-[#605A57]">Foundation type</td>
												<td className="py-2 pr-3 text-right font-medium text-[#37322F]">Slab-on-grade (no visible pier &amp; beam vents)</td>
											</tr>
											<tr className="border-b border-[rgba(55,50,47,0.08)]">
												<td className="py-2 pl-3 text-[#605A57]">Exterior wall materials</td>
												<td className="py-2 pr-3 text-right font-medium text-[#37322F]">~90% brick veneer, ~10% siding/trim</td>
											</tr>
											<tr className="border-b border-[rgba(55,50,47,0.08)]">
												<td className="py-2 pl-3 text-[#605A57]">Roof covering type</td>
												<td className="py-2 pr-3 text-right font-medium text-[#37322F]">Architectural asphalt shingle</td>
											</tr>
											<tr className="border-b border-[rgba(55,50,47,0.08)]">
												<td className="py-2 pl-3 text-[#605A57]">Roof style</td>
												<td className="py-2 pr-3 text-right font-medium text-[#37322F]">Hip roof</td>
											</tr>
											<tr className="border-b border-[rgba(55,50,47,0.08)]">
												<td className="py-2 pl-3 text-[#605A57]">Solar panels</td>
												<td className="py-2 pr-3 text-right font-medium text-[#37322F]">None visible</td>
											</tr>
											<tr className="border-b border-[rgba(55,50,47,0.08)]">
												<td className="py-2 pl-3 text-[#605A57]">Trampoline</td>
												<td className="py-2 pr-3 text-right font-medium text-[#37322F]">None visible</td>
											</tr>
											<tr>
												<td className="py-2 pl-3 text-[#605A57]">Swimming pool</td>
												<td className="py-2 pr-3 text-right font-medium text-[#37322F]">None visible</td>
											</tr>
										</tbody>
									</table>
								</div>
							</div>

							{/* Interior (from Zillow & Redfin photos) */}
							<div className="space-y-3 border border-[rgba(55,50,47,0.08)] rounded-lg p-4">
								<div className="flex items-center gap-2">
									<div className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#6C70BA]/10 text-[#6C70BA]">
										<Sofa className="w-3.5 h-3.5" />
									</div>
									<h3 className="text-xs font-semibold uppercase tracking-wide text-[#605A57]">
										Interior finishes &amp; quality
									</h3>
								</div>
								<div className="overflow-x-auto rounded-md border border-[rgba(55,50,47,0.08)]">
									<table className="w-full text-sm">
										<tbody>
											<tr className="border-b border-[rgba(55,50,47,0.08)]">
												<td className="py-2 pl-3 text-[#605A57]">Primary bathroom</td>
												<td className="py-2 pr-3 text-right font-medium text-[#37322F]">Full bath with walk-in shower and tub; updated fixtures and tile</td>
											</tr>
											<tr className="border-b border-[rgba(55,50,47,0.08)]">
												<td className="py-2 pl-3 text-[#605A57]">Bathroom flooring</td>
												<td className="py-2 pr-3 text-right font-medium text-[#37322F]">Large-format tile</td>
											</tr>
											<tr className="border-b border-[rgba(55,50,47,0.08)]">
												<td className="py-2 pl-3 text-[#605A57]">Main living flooring</td>
												<td className="py-2 pr-3 text-right font-medium text-[#37322F]">Site-finished hardwood</td>
											</tr>
											<tr className="border-b border-[rgba(55,50,47,0.08)]">
												<td className="py-2 pl-3 text-[#605A57]">Overall interior quality</td>
												<td className="py-2 pr-3 text-right font-medium text-[#37322F]">Above average; staged with coordinated finishes</td>
											</tr>
											<tr>
												<td className="py-2 pl-3 text-[#605A57]">Fireplace</td>
												<td className="py-2 pr-3 text-right font-medium text-[#37322F]">Built-in gas fireplace with mantel</td>
											</tr>
										</tbody>
									</table>
								</div>
							</div>
						</div>

						<div className="space-y-3">
							<p className="text-sm font-medium text-[#37322F]">
								Ready to go back to 360 to fill out replacement cost section?
							</p>
							<p className="text-sm text-[#605A57]">
								We can use this information to fill out the replacement cost section in 360 automatically.
							</p>
							<div className="flex justify-end items-start">
								<div className="flex flex-col items-end">
									<Button
										type="button"
										className="bg-[#6C70BA] hover:bg-[#6C70BA]/90 text-white inline-flex items-center gap-2"
										onClick={() => router.push("/research-browser-run")}
									>
										<Sparkles className="w-4 h-4" />
										<span>Fill using AI</span>
									</Button>
									<p className="text-xs text-[#605A57] mt-2">Docs we&apos;ll fill out:</p>
									<div className="flex flex-wrap items-center gap-2 justify-end mt-1">
										<span className="inline-flex items-center gap-2 rounded-full border border-[rgba(55,50,47,0.12)] bg-[#F9FAFB] pl-1.5 pr-3 py-1.5 text-xs font-medium text-[#37322F]">
											<img src="/alta%20logo.png" alt="" className="h-5 w-auto object-contain" aria-hidden />
											Alta
										</span>
										<span className="inline-flex items-center gap-2 rounded-full border border-[rgba(55,50,47,0.12)] bg-[#F9FAFB] pl-1.5 pr-3 py-1.5 text-xs font-medium text-[#37322F]">
											<img src="/verisk-removebg.png" alt="" className="h-5 w-auto object-contain" aria-hidden />
											360
										</span>
									</div>
								</div>
							</div>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}

export default function ResearchAgentPage() {
	return (
		<Suspense>
			<ResearchAgentInner />
		</Suspense>
	);
}
