"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { config } from "@/lib/config";
import { getAuthToken } from "@/lib/auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
	MapPinHouse,
	Sparkles,
	Home,
	Trees,
	Sofa,
	CircleCheck,
	ListRestart,
	CircleX,
} from "lucide-react";

type RealtorApiData = {
	flooring: string[];
	bathroomCount: number;
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
	listingHistory: Array<{
		date: string;
		price: number | null;
		event: string;
		pricePerSquareFoot: number | null;
		source: string | null;
	}>;
	photoUrls: string[];
	hasInteriorPhotos: boolean;
	homeStatus: string | null;
	interiorAnalysis: {
		flooringType: string | null;
		flooringCondition: string | null;
		kitchenFinishes: string | null;
		interiorCondition: string | null;
		notableFeatures: string[];
	} | null;
	flooringType: string;
	kitchenFinishes: string;
	interiorCondition: string;
};

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

type CadData = {
	propertyType: string | null;
	yearBuilt: number | null;
	livingAreaSqft: number | null;
	totalBuildingSqft: number | null;
	attachedGarageSqft: number | null;
	stories: number | null;
	firstFloorSqft: number | null;
	upperFloorSqft: number | null;
	storyClassification: string | null;
	storyRatioPercent: number | null;
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
	const [addrParts, setAddrParts] = useState<{
		address: string;
		city: string;
		state: string;
		zip: string;
	} | null>(null);

	function getCadImage(state: string | null | undefined): { src: string; alt: string } {
		if (state === "TX") return { src: "/texascad.png", alt: "Texas CAD" };
		if (state === "NY") return { src: "/nycad.png", alt: "New York CAD" };
		return { src: "/usacad.png", alt: "US Property Data" };
	}
	// Lead context from Agency Zoom (passed via URL params)
	const [leadName, setLeadName] = useState<string | null>(null);
	const [leadPhone, setLeadPhone] = useState<string | null>(null);
	const [leadEmail, setLeadEmail] = useState<string | null>(null);
	const [agencyZoomLeadId, setAgencyZoomLeadId] = useState<string | null>(
		null,
	);

	// Research report — built progressively as each step is confirmed
	const [researchReport, setResearchReport] = useState<{
		agencyZoomLeadId: string | null;
		address: string | null;
		city: string | null;
		state: string | null;
		zip: string | null;
		leadName: string | null;
		leadPhone: string | null;
		leadEmail: string | null;
		cad: CadData | null;
		maps: { roofStyle: string; poolVisible: boolean; solarPanelsVisible: boolean; trampolineVisible: boolean } | null;
		realtor: RealtorApiData | null;
		status: "in_progress" | "research_complete";
	} | null>(null);

	// Real CAD data from ATTOM API
	const [cadData, setCadData] = useState<CadData | null>(null);
	const [cadError, setCadError] = useState<string | null>(null);
	const [reportDbId, setReportDbId] = useState<string | null>(null);

	// Pre-fill address from query params (e.g. navigated from call detail or AZ leads page)
	useEffect(() => {
		const a = searchParams.get("address");
		const c = searchParams.get("city");
		const s = searchParams.get("state");
		const z = searchParams.get("zip");
		const ln = searchParams.get("leadName");
		const lp = searchParams.get("leadPhone");
		const le = searchParams.get("leadEmail");
		const azId = searchParams.get("agencyZoomLeadId");
		const parts = [a, c, s, z].filter(Boolean);
		if (parts.length > 0) {
			setAddress(parts.join(", "));
			if (a && c && s)
				setAddrParts({ address: a, city: c, state: s, zip: z ?? "" });
		}
		if (ln) setLeadName(ln);
		if (lp) setLeadPhone(lp);
		if (le) setLeadEmail(le);
		if (azId) setAgencyZoomLeadId(azId);
	}, [searchParams]);
	// Real realtor state
	const [realtorData, setRealtorData] = useState<RealtorApiData | null>(null);
	const [realtorLoading, setRealtorLoading] = useState(false);
	const [realtorError, setRealtorError] = useState<string | null>(null);
	// Real maps state
	const [mapsLoading, setMapsLoading] = useState(false);
	const [mapsData, setMapsData] = useState<{
		roofStyle: string;
		poolVisible: boolean;
		solarPanelsVisible: boolean;
		trampolineVisible: boolean;
		satelliteImage: string | null;
		streetviewImage: string | null;
	} | null>(null);
	const [mapsError, setMapsError] = useState<string | null>(null);
	const [geocodeValidating, setGeocodeValidating] = useState(false);
	const [geocodeError, setGeocodeError] = useState<string | null>(null);
	const [suggestions, setSuggestions] = useState<string[]>([]);
	const [showDropdown, setShowDropdown] = useState(false);
	const autocompleteRef = useRef<HTMLDivElement>(null);

	// Debounced autocomplete — fires 300ms after user stops typing
	useEffect(() => {
		if (step !== STEPS.INPUT || address.length < 3) {
			setSuggestions([]);
			setShowDropdown(false);
			return;
		}
		const t = setTimeout(async () => {
			try {
				const params = new URLSearchParams({ input: address });
				const res = await fetch(
					`${config.apiUrl}/api/property/autocomplete?${params}`,
				);
				const json = await res.json();
				const s = json.suggestions ?? [];
				setSuggestions(s);
				setShowDropdown(s.length > 0);
			} catch {
				// ignore — autocomplete is best-effort
			}
		}, 300);
		return () => clearTimeout(t);
	}, [address, step]);

	// Close dropdown when clicking outside
	useEffect(() => {
		function handleClick(e: MouseEvent) {
			if (
				autocompleteRef.current &&
				!autocompleteRef.current.contains(e.target as Node)
			) {
				setShowDropdown(false);
			}
		}
		document.addEventListener("mousedown", handleClick);
		return () => document.removeEventListener("mousedown", handleClick);
	}, []);

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
	const zillowRedfinComplete = realtorData !== null;

	// Build attributes from real ATTOM data only
	const displayAttributes = cadData
		? [
				{ label: "Type", value: cadData.propertyType ?? "—" },
				{
					label: "Year built",
					value: cadData.yearBuilt?.toString() ?? "—",
				},
				{
					label: "Stories",
					value: cadData.storyClassification ?? cadData.stories?.toString() ?? "—",
					note: (() => {
						if (cadData.storyClassification === "1.5 stories" && cadData.storyRatioPercent != null && cadData.upperFloorSqft != null && cadData.firstFloorSqft != null) {
							return `2nd floor is ${cadData.storyRatioPercent}% of 1st floor (${cadData.upperFloorSqft.toLocaleString()} / ${cadData.firstFloorSqft.toLocaleString()} sq ft) — classified as 1.5 stories`;
						}
						if (cadData.storyClassification === "2 stories" && cadData.storyRatioPercent != null && cadData.upperFloorSqft != null && cadData.firstFloorSqft != null) {
							return `2nd floor is ${cadData.storyRatioPercent}% of 1st floor (${cadData.upperFloorSqft.toLocaleString()} / ${cadData.firstFloorSqft.toLocaleString()} sq ft) — classified as 2 stories`;
						}
						return null;
					})(),
				},
				{
					label: "Living area",
					value: cadData.livingAreaSqft
						? `${cadData.livingAreaSqft.toLocaleString()} sq ft`
						: "—",
				},
				{
					label: "Total building",
					value: cadData.totalBuildingSqft
						? `${cadData.totalBuildingSqft.toLocaleString()} sq ft`
						: "—",
				},
				{
					label: "Attached garage",
					value: cadData.attachedGarageSqft
						? `${cadData.attachedGarageSqft.toLocaleString()} sq ft`
						: "—",
				},
				{ label: "Garage type", value: cadData.garageType ?? "—" },
				{ label: "Foundation", value: cadData.foundationType ?? "—" },
				{
					label: "Exterior wall",
					value: cadData.exteriorWallType ?? "—",
				},
				{ label: "Roof cover", value: cadData.roofCover ?? "—" },
				...(cadData.county
					? [{ label: "County", value: cadData.county }]
					: []),
				...(cadData.apn ? [{ label: "APN", value: cadData.apn }] : []),
				...(cadData.lastSaleAmount
					? [
							{
								label: "Last sale",
								value: `$${cadData.lastSaleAmount.toLocaleString()}${cadData.lastSaleDate ? ` on ${cadData.lastSaleDate}` : ""}`,
							},
						]
					: []),
			]
		: [];

	const handleStartRealtorAnalysis = async () => {
		setRealtorData(null);
		setRealtorError(null);
		setRealtorLoading(true);
		setStep(STEPS.DATA_GATHERED);

		try {
			const fullAddress = addrParts
				? `${addrParts.address}, ${addrParts.city}, ${addrParts.state} ${addrParts.zip}`
				: effectiveAddress;
			const params = new URLSearchParams({ address: fullAddress });
			const res = await fetch(
				`${config.apiUrl}/api/property/realtor?${params}`,
				{ headers: { Authorization: `Bearer ${getAuthToken()}` } },
			);
			const json = await res.json();
			if (!res.ok) {
				setRealtorError(json.error ?? `API error ${res.status}`);
			} else {
				const realtor = json as RealtorApiData;
				setRealtorData(realtor);
				setResearchReport(prev => prev ? { ...prev, realtor, status: "research_complete" } : prev);
				// Persist to backend
				if (reportDbId) {
					try {
						await fetch(`${config.apiUrl}/api/research-reports/${reportDbId}`, {
							method: "PATCH",
							headers: {
								"Content-Type": "application/json",
								Authorization: `Bearer ${getAuthToken()}`,
							},
							body: JSON.stringify({ realtor, status: "research_complete" }),
						});
					} catch {
						// non-blocking
					}
				}
			}
		} catch (err) {
			setRealtorError(
				err instanceof Error
					? err.message
					: "Failed to fetch Realtor data.",
			);
		} finally {
			setRealtorLoading(false);
		}
	};

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
			const res = await fetch(
				`${config.apiUrl}/api/property/maps?${params}`,
				{ headers: { Authorization: `Bearer ${getAuthToken()}` } },
			);
			const json = await res.json();
			if (!res.ok) {
				setMapsError(json.error ?? `API error ${res.status}`);
			} else {
				const maps = {
					roofStyle: json.maps?.roofStyle ?? "unknown",
					poolVisible: Boolean(json.maps?.poolVisible),
					solarPanelsVisible: Boolean(json.maps?.solarPanelsVisible),
					trampolineVisible: Boolean(json.maps?.trampolineVisible),
					satelliteImage: json.images?.satellite ?? null,
					streetviewImage: json.images?.streetview ?? null,
				};
				setMapsData(maps);
				const mapsForReport = {
					roofStyle: maps.roofStyle,
					poolVisible: maps.poolVisible,
					solarPanelsVisible: maps.solarPanelsVisible,
					trampolineVisible: maps.trampolineVisible,
				};
				setResearchReport(prev => prev ? { ...prev, maps: mapsForReport } : prev);
				// Persist to backend
				if (reportDbId) {
					try {
						await fetch(`${config.apiUrl}/api/research-reports/${reportDbId}`, {
							method: "PATCH",
							headers: {
								"Content-Type": "application/json",
								Authorization: `Bearer ${getAuthToken()}`,
							},
							body: JSON.stringify({ maps: mapsForReport }),
						});
					} catch {
						// non-blocking
					}
				}
			}
		} catch (err) {
			setMapsError(
				err instanceof Error
					? err.message
					: "Failed to fetch map analysis.",
			);
		} finally {
			setMapsLoading(false);
		}
	};

	const goBack = () => {
		if (step <= STEPS.DATA_PULLED) {
			setStep(STEPS.INPUT);
		} else if (
			step === STEPS.CONFIRM_LOOKS_RIGHT ||
			step === STEPS.GOOGLE_MAP_PROMPT
		) {
			setStep(STEPS.DATA_PULLED);
		} else if (step === STEPS.DATA_GATHERED) {
			setStep(mapsData ? STEPS.GOOGLE_MAP_PROMPT : STEPS.DATA_PULLED);
		} else if (step === STEPS.READY_360) {
			setStep(
				realtorData
					? STEPS.DATA_GATHERED
					: mapsData
						? STEPS.GOOGLE_MAP_PROMPT
						: STEPS.DATA_PULLED,
			);
		}
	};

	const handleResearch = async () => {
		setCadData(null);
		setCadError(null);
		setMapsData(null);
		setMapsError(null);
		setGeocodeError(null);
		setResearchReport(null);
		setReportDbId(null);

		// Step 1: Require address selected from autocomplete (addrParts already geocoded on selection).
		if (!addrParts) {
			setGeocodeError("Please select an address from the suggestions — start typing to see options.");
			return;
		}
		const parts = addrParts;


		// Step 2: Proceed to CAD lookup with geocoded components.
		setStep(STEPS.CAD_LOADER);
		try {
			const params = new URLSearchParams({
				address: parts.address,
				city: parts.city,
				state: parts.state,
			});
			const res = await fetch(
				`${config.apiUrl}/api/property/cad?${params}`,
				{ headers: { Authorization: `Bearer ${getAuthToken()}` } },
			);
			const json = await res.json();
			if (!res.ok) {
				// ATTOM 400/404 means no property record — send user back to INPUT with a friendly message.
				setStep(STEPS.INPUT);
				setGeocodeError(
					"No property record found for this address. Try a different address or check the spelling.",
				);
			} else if (json.cad) {
				const cad = json.cad as CadData;
				setCadData(cad);
				const report = {
					agencyZoomLeadId,
					address: parts.address,
					city: parts.city,
					state: parts.state,
					zip: parts.zip,
					leadName,
					leadPhone,
					leadEmail,
					cad,
					maps: null,
					realtor: null,
					status: "in_progress" as const,
				};
				setResearchReport(report);
				// Persist to backend
				try {
					const saveRes = await fetch(`${config.apiUrl}/api/research-reports`, {
						method: "POST",
						headers: {
							"Content-Type": "application/json",
							Authorization: `Bearer ${getAuthToken()}`,
						},
						body: JSON.stringify(report),
					});
					if (saveRes.ok) {
						const saved = await saveRes.json();
						setReportDbId(saved.id);
					}
				} catch {
					// non-blocking — report saves best-effort
				}
			} else {
				setStep(STEPS.INPUT);
				setGeocodeError(
					"No property record found for this address. Try a different address or check the spelling.",
				);
			}
		} catch (err) {
			setStep(STEPS.INPUT);
			setGeocodeError(
				"Could not reach the property database — check your connection and try again.",
			);
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
							Researching for:{" "}
							<span className="font-medium text-[#37322F]">
								{leadName}
							</span>
							{agencyZoomLeadId && (
								<span className="ml-2 text-xs text-[#605A57]">
									AZ #{agencyZoomLeadId}
								</span>
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
							{step >= STEPS.GOOGLE_MAP_PROMPT &&
								(step > STEPS.GOOGLE_MAP_PROMPT ||
									analysisComplete) && (
									<span className="inline-flex items-center gap-1.5 rounded-full bg-[#6C70BA]/10 px-3 py-1 text-xs font-medium text-[#6C70BA]">
										<CircleCheck className="w-3.5 h-3.5" />
										G-Maps analysis data stored
									</span>
								)}
							{zillowRedfinComplete && (
								<span className="inline-flex items-center gap-1.5 rounded-full bg-[#6C70BA]/10 px-3 py-1 text-xs font-medium text-[#6C70BA]">
									<CircleCheck className="w-3.5 h-3.5" />
									Zillow data stored
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
							<div className="relative flex-1" ref={autocompleteRef}>
								<Input
									type="text"
									placeholder="Enter a property address"
									className="h-10 w-full"
									value={address}
									onChange={(e) => {
										setAddress(e.target.value);
										setAddrParts(null);
										setGeocodeError(null);
									}}
									onKeyDown={(e) => {
										if (e.key === "Enter") {
											setShowDropdown(false);
											handleResearch();
										}
										if (e.key === "Escape")
											setShowDropdown(false);
									}}
								/>
								{showDropdown && suggestions.length > 0 && (
									<div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-md border border-[rgba(55,50,47,0.12)] bg-white shadow-lg overflow-hidden">
										{suggestions.map((s, i) => (
											<button
												key={i}
												type="button"
												className="w-full px-3 py-2.5 text-left text-sm text-[#37322F] hover:bg-[#f3f4f6] border-b border-[rgba(55,50,47,0.06)] last:border-b-0"
												onMouseDown={async (e) => {
													e.preventDefault();
													setAddress(s);
													setSuggestions([]);
													setShowDropdown(false);
													setGeocodeError(null);
													// Geocode immediately on selection — parse parts once, not on every Research click
													try {
														const params = new URLSearchParams({ address: s });
														const res = await fetch(`${config.apiUrl}/api/property/geocode?${params}`);
														const json = await res.json();
														if (res.ok) {
															setAddress(json.formattedAddress);
															setAddrParts({ address: json.address, city: json.city, state: json.state, zip: json.zip });
														} else {
															setGeocodeError(json.error ?? "Could not validate this address — please try another.");
														}
													} catch {
														setGeocodeError("Could not reach the address validation service.");
													}
												}}
											>
												{s}
											</button>
										))}
									</div>
								)}
							</div>
							<Button
								type="button"
								onClick={handleResearch}
								disabled={!addrParts}
								className="h-10 px-6 bg-[#6C70BA] hover:bg-[#6C70BA]/90 text-white shrink-0 disabled:opacity-60"
							>
								Research
								<Sparkles className="w-4 h-4 ml-2" />
							</Button>
						</div>
						{geocodeError && (
							<span className="inline-flex items-center gap-1.5 rounded-full bg-yellow-100 px-3 py-1 text-xs font-medium text-yellow-800 mt-1">
								<CircleX className="w-3.5 h-3.5 shrink-0" />
								{geocodeError}
							</span>
						)}
					</>
				)}

				{/* Step 1: Collin County CAD loader */}
				{step === STEPS.CAD_LOADER && (
					<div className="rounded-lg border border-[rgba(55,50,47,0.12)] bg-white p-6 flex flex-col items-center gap-4">
						<img
							{...getCadImage(addrParts?.state)}
							className="h-14 w-auto object-contain"
						/>
						<p className="text-sm text-[#605A57]">
							Searching{" "}
							{addrParts
								? `${addrParts.city}, ${addrParts.state}`
								: "local"}{" "}
							property data…
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
							{[70, 55, 65, 50, 45, 60, 75, 40, 55, 60, 65].map(
								(w, i) => (
									<div
										key={i}
										className="h-6 rounded bg-[#f3f4f6] animate-pulse"
										style={{ width: `${w}%` }}
									/>
								),
							)}
						</div>
					</div>
				)}

				{/* Step 3: Data pulled (show dummy data) + Google Maps question */}
				{step === STEPS.DATA_PULLED && (
					<div className="rounded-lg border border-[rgba(55,50,47,0.12)] bg-white p-6 space-y-4">
						<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
							<div className="flex items-center gap-2 min-w-0">
								<img
									{...getCadImage(addrParts?.state)}
									className="h-6 w-auto shrink-0 object-contain"
								/>
								<p className="text-sm font-medium text-[#37322F]">
									Property CAD Report
								</p>
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={handleResearch}
									title="Re-pull CAD data"
									className="h-7 px-2"
								>
									<ListRestart className="w-3.5 h-3.5" />
								</Button>
							</div>
							{cadData && (
								<p className="text-xs text-[#605A57]">
									Source:{" "}
									<span className="text-[#6C70BA] font-medium">
										{cadData.county
											? `${cadData.county} CAD database`
											: "CAD database"}
									</span>
								</p>
							)}
						</div>
						{cadError && (
							<div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
								<span className="font-medium">
									CAD fetch failed:
								</span>{" "}
								{cadError}
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
										{displayAttributes.map(
											({ label, value, note }: { label: string; value: string; note?: string | null }) => (
												<tr
													key={label}
													className="border-b border-[rgba(55,50,47,0.08)] last:border-b-0"
												>
													<td className="py-2 pl-3 pr-4 text-[#605A57] font-medium">
														{label}
													</td>
													<td className="py-2 pr-3 text-right font-medium text-[#37322F]">
														{value}
														{note && (
															<div className="text-xs font-normal text-[#8A8480] mt-0.5">
																{note}
															</div>
														)}
													</td>
												</tr>
											),
										)}
									</tbody>
								</table>
							</div>
						)}
						<div className="pt-4 border-t border-[rgba(55,50,47,0.08)] space-y-3">
							<p className="text-sm font-medium text-[#37322F]">
								Are you ready to continue with Google Maps and
								images?
							</p>
							<p className="text-xs text-[#605A57]">
								We&apos;ll use a powerful vision model to infer
								things like number of stories, foundation type
								(slab vs pier &amp; beam) from visible
								slab/vents, exterior wall materials, and more.
							</p>
							<div className="flex gap-3">
								<Button
									type="button"
									variant="outline"
									onClick={goBack}
								>
									Back
								</Button>
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
									onClick={() =>
										setStep(STEPS.ZILLOW_REDFIN_PROMPT)
									}
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
							Confirm the property data before we continue with
							Google Maps and images.
						</p>
						<div className="flex gap-3">
							<Button
								type="button"
								variant="outline"
								onClick={goBack}
							>
								Back
							</Button>
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
								{!mapsLoading && (
									<Button
										type="button"
										variant="outline"
										size="sm"
										onClick={handleStartMapsAnalysis}
										title="Re-pull Maps data"
										className="h-7 px-2"
									>
										<ListRestart className="w-3.5 h-3.5" />
									</Button>
								)}
							</div>
							<div className="flex items-center gap-2 text-xs text-[#605A57]">
								{mapsLoading && (
									<>
										<span className="w-2 h-2 rounded-full bg-[#6C70BA] animate-bounce [animation-delay:0ms]" />
										<span className="w-2 h-2 rounded-full bg-[#6C70BA] animate-bounce [animation-delay:150ms]" />
										<span className="w-2 h-2 rounded-full bg-[#6C70BA] animate-bounce [animation-delay:300ms]" />
										<span>
											Fetching imagery &amp; analyzing…
										</span>
									</>
								)}
								{mapsData && <span>Analysis complete</span>}
								{mapsError && (
									<span className="text-red-600">
										Analysis failed
									</span>
								)}
							</div>
						</div>

						{/* Error state */}
						{mapsError && (
							<div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
								<span className="font-medium">
									Maps analysis failed:
								</span>{" "}
								{mapsError}
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
										<p className="text-xs font-semibold uppercase tracking-wide text-[#605A57]">
											Street view (exterior)
										</p>
										{cadData ? (
											<ul className="text-xs text-[#37322F] space-y-1">
												{(cadData.storyClassification ?? cadData.stories) != null && (
													<li>
														<strong>Stories:</strong>{" "}
														{cadData.storyClassification ?? cadData.stories}
														{cadData.storyRatioPercent != null && cadData.upperFloorSqft != null && cadData.firstFloorSqft != null && (
															<span className="text-[#8A8480]"> (2nd floor {cadData.storyRatioPercent}% of 1st)</span>
														)}
													</li>
												)}
												{cadData.exteriorWallType && (
													<li>
														<strong>
															Exterior wall:
														</strong>{" "}
														{
															cadData.exteriorWallType
														}
													</li>
												)}
												{cadData.foundationType && (
													<li>
														<strong>
															Foundation:
														</strong>{" "}
														{cadData.foundationType}
													</li>
												)}
												{cadData.garageType && (
													<li>
														<strong>Garage:</strong>{" "}
														{cadData.garageType}
													</li>
												)}
											</ul>
										) : (
											<p className="text-xs text-[#9CA3AF]">
												No CAD data available.
											</p>
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
										<p className="text-xs font-semibold uppercase tracking-wide text-[#605A57]">
											Aerial view (roof &amp; site)
										</p>
										{mapsLoading && (
											<p className="text-xs text-[#9CA3AF]">
												Gemini is analyzing the roof and
												site…
											</p>
										)}
										{mapsData && (
											<ul className="text-xs text-[#37322F] space-y-1">
												<li>
													<strong>Roof style:</strong>{" "}
													{mapsData.roofStyle}
												</li>
												<li>
													<strong>Pool:</strong>{" "}
													{mapsData.poolVisible
														? "Visible"
														: "None visible"}
												</li>
												<li>
													<strong>
														Solar panels:
													</strong>{" "}
													{mapsData.solarPanelsVisible
														? "Visible"
														: "None visible"}
												</li>
												<li>
													<strong>Trampoline:</strong>{" "}
													{mapsData.trampolineVisible
														? "Visible"
														: "None visible"}
												</li>
											</ul>
										)}
									</div>
								</div>
							</div>
						)}

						{/* Continue — shown once analysis is done */}
						{mapsData && (
							<div className="pt-2 space-y-3">
								<p className="text-sm font-medium text-[#37322F]">
									Are you ready to continue with Realtor.com?
								</p>
								<p className="text-sm text-[#605A57]">
									We&apos;ll pull structured Zillow records —
									flooring, bathrooms, valuation, listing
									history, and interior condition.
								</p>
								<div className="flex gap-3">
									<Button
										type="button"
										variant="outline"
										onClick={goBack}
									>
										Back
									</Button>
									<Button
										type="button"
										onClick={handleStartRealtorAnalysis}
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

				{/* Realtor.com / Zillow data */}
				{step === STEPS.DATA_GATHERED && (
					<div className="rounded-lg border border-[rgba(55,50,47,0.12)] bg-white p-6 space-y-6">
						<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
							<div className="flex items-center gap-3 shrink-0">
								<img
									src="/logos/Zillow-Logo.png"
									alt="Zillow"
									className="h-9 w-auto object-contain"
								/>
								{!realtorLoading && (
									<Button
										type="button"
										variant="outline"
										size="sm"
										onClick={handleStartRealtorAnalysis}
										title="Re-pull Realtor data"
										className="h-7 px-2"
									>
										<ListRestart className="w-3.5 h-3.5" />
									</Button>
								)}
							</div>
							<p className="text-xs text-[#605A57] sm:text-right">
								{realtorLoading
									? "Fetching Zillow records…"
									: realtorData
										? "Realtor.com / Zillow Records"
										: ""}
							</p>
						</div>

						{/* Loading */}
						{realtorLoading && (
							<div className="space-y-2">
								{[60, 45, 70, 50, 55, 65].map((w, i) => (
									<div
										key={i}
										className="h-6 rounded bg-[#f3f4f6] animate-pulse"
										style={{ width: `${w}%` }}
									/>
								))}
							</div>
						)}

						{/* Error */}
						{realtorError && (
							<div className="space-y-3">
								<p className="text-sm text-red-600">
									{realtorError}
								</p>
								<Button
									variant="outline"
									size="sm"
									onClick={handleStartRealtorAnalysis}
								>
									Retry
								</Button>
							</div>
						)}

						{/* Real data */}
						{realtorData && (
							<div className="space-y-5">
								{/* Photo carousel */}
								{realtorData.photoUrls && realtorData.photoUrls.length > 0 && (
									<div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
										{realtorData.photoUrls.map((url, i) => (
											<img
												key={i}
												src={url}
												alt={`Property photo ${i + 1}`}
												className="h-40 w-auto shrink-0 rounded-md object-cover"
											/>
										))}
									</div>
								)}

								{/* Core property facts */}
								<div className="overflow-x-auto rounded-md border border-[rgba(55,50,47,0.08)]">
									<table className="w-full text-sm">
										<tbody>
											{realtorData.flooring.length >
												0 && (
												<tr className="border-b border-[rgba(55,50,47,0.08)]">
													<td className="py-2 pl-3 text-[#605A57]">
														Flooring
													</td>
													<td className="py-2 pr-3 text-right font-medium text-[#37322F]">
														{realtorData.flooring.join(
															", ",
														)}
													</td>
												</tr>
											)}
											{!!realtorData.bathroomCount && (
												<tr className="border-b border-[rgba(55,50,47,0.08)]">
													<td className="py-2 pl-3 text-[#605A57]">
														Bathrooms
													</td>
													<td className="py-2 pr-3 text-right font-medium text-[#37322F]">
														{
															realtorData.bathroomCount
														}
													</td>
												</tr>
											)}
											{realtorData.foundationDetails
												.length > 0 && (
												<tr className="border-b border-[rgba(55,50,47,0.08)]">
													<td className="py-2 pl-3 text-[#605A57]">
														Foundation
													</td>
													<td className="py-2 pr-3 text-right font-medium text-[#37322F]">
														{realtorData.foundationDetails.join(
															", ",
														)}
													</td>
												</tr>
											)}
											{realtorData.exteriorFeatures
												.length > 0 && (
												<tr className="border-b border-[rgba(55,50,47,0.08)]">
													<td className="py-2 pl-3 text-[#605A57]">
														Exterior
													</td>
													<td className="py-2 pr-3 text-right font-medium text-[#37322F]">
														{realtorData.exteriorFeatures.join(
															", ",
														)}
													</td>
												</tr>
											)}
											{realtorData.hasFireplace !==
												null && (
												<tr className="border-b border-[rgba(55,50,47,0.08)]">
													<td className="py-2 pl-3 text-[#605A57]">
														Fireplace
													</td>
													<td className="py-2 pr-3 text-right font-medium text-[#37322F]">
														{realtorData.hasFireplace
															? "Yes"
															: "None"}
													</td>
												</tr>
											)}
											{realtorData.cooling.length > 0 && (
												<tr className="border-b border-[rgba(55,50,47,0.08)]">
													<td className="py-2 pl-3 text-[#605A57]">
														Cooling
													</td>
													<td className="py-2 pr-3 text-right font-medium text-[#37322F]">
														{realtorData.cooling.join(
															", ",
														)}
													</td>
												</tr>
											)}
											{realtorData.heating.length > 0 && (
												<tr>
													<td className="py-2 pl-3 text-[#605A57]">
														Heating
													</td>
													<td className="py-2 pr-3 text-right font-medium text-[#37322F]">
														{realtorData.heating.join(
															", ",
														)}
													</td>
												</tr>
											)}
										</tbody>
									</table>
								</div>

								{/* Valuation */}
								{(realtorData.zestimate ||
									realtorData.rentZestimate ||
									realtorData.taxAssessedValue) && (
									<div>
										<p className="text-xs font-semibold uppercase tracking-wide text-[#605A57] mb-2">
											Valuation
										</p>
										<div className="overflow-x-auto rounded-md border border-[rgba(55,50,47,0.08)]">
											<table className="w-full text-sm">
												<tbody>
													{!!realtorData.zestimate && (
														<tr className="border-b border-[rgba(55,50,47,0.08)]">
															<td className="py-2 pl-3 text-[#605A57]">
																Zestimate
															</td>
															<td className="py-2 pr-3 text-right font-medium text-[#37322F]">
																$
																{realtorData.zestimate.toLocaleString()}
															</td>
														</tr>
													)}
													{!!realtorData.rentZestimate && (
														<tr className="border-b border-[rgba(55,50,47,0.08)]">
															<td className="py-2 pl-3 text-[#605A57]">
																Rent Estimate
															</td>
															<td className="py-2 pr-3 text-right font-medium text-[#37322F]">
																$
																{realtorData.rentZestimate.toLocaleString()}
																/mo
															</td>
														</tr>
													)}
													{!!realtorData.taxAssessedValue && (
														<tr className="border-b border-[rgba(55,50,47,0.08)]">
															<td className="py-2 pl-3 text-[#605A57]">
																Tax Assessed
															</td>
															<td className="py-2 pr-3 text-right font-medium text-[#37322F]">
																$
																{realtorData.taxAssessedValue.toLocaleString()}
															</td>
														</tr>
													)}
													{!!realtorData.taxAnnualAmount && (
														<tr>
															<td className="py-2 pl-3 text-[#605A57]">
																Annual Tax
															</td>
															<td className="py-2 pr-3 text-right font-medium text-[#37322F]">
																$
																{realtorData.taxAnnualAmount.toLocaleString()}
															</td>
														</tr>
													)}
												</tbody>
											</table>
										</div>
									</div>
								)}

								{/* Listing history */}
								{realtorData.listingHistory && realtorData.listingHistory.length > 0 && (
									<div>
										<p className="text-xs font-semibold uppercase tracking-wide text-[#605A57] mb-2">
											Listing History
										</p>
										<div className="overflow-x-auto rounded-md border border-[rgba(55,50,47,0.08)]">
											<table className="w-full text-sm">
												<tbody>
													{realtorData.listingHistory.map(
														(entry, i) => (
															<tr
																key={i}
																className={
																	i < realtorData.listingHistory.length - 1
																		? "border-b border-[rgba(55,50,47,0.08)]"
																		: ""
																}
															>
																<td className="py-2 pl-3 text-[#605A57]">
																	{entry.event}{" "}
																	<span className="text-[10px] text-[#9CA3AF]">
																		{entry.date}
																	</span>
																</td>
																<td className="py-2 pr-3 text-right font-medium text-[#37322F]">
																	{entry.price != null
																		? `$${entry.price.toLocaleString()}`
																		: "—"}
																	{entry.pricePerSquareFoot != null && (
																		<span className="ml-1 text-[10px] font-normal text-[#9CA3AF]">
																			(${entry.pricePerSquareFoot}/sqft)
																		</span>
																	)}
																</td>
															</tr>
														),
													)}
												</tbody>
											</table>
										</div>
									</div>
								)}

								{/* Interior analysis */}
								<div className="rounded-md border border-[rgba(55,50,47,0.08)] p-3 text-sm">
									{realtorData.hasInteriorPhotos &&
									realtorData.interiorAnalysis ? (
										<>
											<p className="text-xs font-semibold uppercase tracking-wide text-[#605A57] mb-2">
												Interior Photos Analysis
											</p>
											<ul className="space-y-1 text-[#37322F]">
												{realtorData.interiorAnalysis
													.flooringType && (
													<li>
														<strong>
															Flooring:
														</strong>{" "}
														{
															realtorData
																.interiorAnalysis
																.flooringType
														}{" "}
														(
														{
															realtorData
																.interiorAnalysis
																.flooringCondition
														}
														)
													</li>
												)}
												{realtorData.interiorAnalysis
													.kitchenFinishes && (
													<li>
														<strong>
															Kitchen:
														</strong>{" "}
														{
															realtorData
																.interiorAnalysis
																.kitchenFinishes
														}
													</li>
												)}
												{realtorData.interiorAnalysis
													.interiorCondition && (
													<li>
														<strong>
															Condition:
														</strong>{" "}
														{
															realtorData
																.interiorAnalysis
																.interiorCondition
														}
													</li>
												)}
												{realtorData.interiorAnalysis
													.notableFeatures.length >
													0 && (
													<li>
														<strong>
															Notable:
														</strong>{" "}
														{realtorData.interiorAnalysis.notableFeatures.join(
															", ",
														)}
													</li>
												)}
											</ul>
										</>
									) : (
										<p className="text-[#605A57] text-xs">
											Property is off-market — no listing
											photos available. Structured data
											from Zillow records.
										</p>
									)}
								</div>
							</div>
						)}

						{(realtorData || realtorError) && !realtorLoading && (
							<div className="flex items-center gap-3 pt-2">
								<Button
									type="button"
									variant="outline"
									onClick={goBack}
								>
									Back
								</Button>
								<Button
									type="button"
									onClick={() => setStep(STEPS.READY_360)}
									className="bg-[#6C70BA] hover:bg-[#6C70BA]/90 text-white"
								>
									Review Research
								</Button>
							</div>
						)}
					</div>
				)}

				{step === STEPS.READY_360 && (
					<div className="rounded-lg border border-[rgba(55,50,47,0.12)] bg-white p-6 space-y-6">
						<div className="space-y-1">
							<p className="text-xs text-[#605A57]">
								Here&apos;s a summary of what the Research Agent
								inferred for this property during the demo.
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
												<td className="py-2 pl-3 text-[#605A57]">
													Address
												</td>
												<td className="py-2 pr-3 text-right font-medium text-[#37322F]">
													{effectiveAddress}
												</td>
											</tr>
											{cadData ? (
												<>
													<tr className="border-b border-[rgba(55,50,47,0.08)]">
														<td className="py-2 pl-3 text-[#605A57]">
															Type
														</td>
														<td className="py-2 pr-3 text-right font-medium text-[#37322F]">
															{cadData.propertyType ??
																"—"}
														</td>
													</tr>
													<tr className="border-b border-[rgba(55,50,47,0.08)]">
														<td className="py-2 pl-3 text-[#605A57]">
															Year built
														</td>
														<td className="py-2 pr-3 text-right font-medium text-[#37322F]">
															{cadData.yearBuilt ??
																"—"}
														</td>
													</tr>
													<tr className="border-b border-[rgba(55,50,47,0.08)]">
														<td className="py-2 pl-3 text-[#605A57]">
															Living Area
														</td>
														<td className="py-2 pr-3 text-right font-medium text-[#37322F]">
															{cadData.livingAreaSqft
																? `${cadData.livingAreaSqft.toLocaleString()} sq ft`
																: "—"}
														</td>
													</tr>
													<tr className="border-b border-[rgba(55,50,47,0.08)]">
														<td className="py-2 pl-3 text-[#605A57]">
															Attached Garage
														</td>
														<td className="py-2 pr-3 text-right font-medium text-[#37322F]">
															{cadData.attachedGarageSqft
																? `${cadData.attachedGarageSqft.toLocaleString()} sq ft`
																: "—"}
														</td>
													</tr>
												</>
											) : (
												<tr className="border-b border-[rgba(55,50,47,0.08)]">
													<td
														colSpan={2}
														className="py-2 pl-3 text-sm text-[#605A57] italic"
													>
														CAD data not available
													</td>
												</tr>
											)}
											{!!realtorData?.bathroomCount && (
												<tr>
													<td className="py-2 pl-3 text-[#605A57]">Bathrooms</td>
													<td className="py-2 pr-3 text-right font-medium text-[#37322F]">{realtorData.bathroomCount}</td>
												</tr>
											)}
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
												<td className="py-2 pr-3 text-right font-medium text-[#37322F]">
													{cadData?.storyClassification ?? cadData?.stories ?? "—"}
													{cadData?.storyRatioPercent != null && cadData?.upperFloorSqft != null && cadData?.firstFloorSqft != null && (
														<div className="text-xs font-normal text-[#8A8480] mt-0.5">
															2nd floor is {cadData.storyRatioPercent}% of 1st floor ({cadData.upperFloorSqft.toLocaleString()} / {cadData.firstFloorSqft.toLocaleString()} sq ft)
														</div>
													)}
												</td>
											</tr>
											<tr className="border-b border-[rgba(55,50,47,0.08)]">
												<td className="py-2 pl-3 text-[#605A57]">Foundation</td>
												<td className="py-2 pr-3 text-right font-medium text-[#37322F]">{cadData?.foundationType ?? "—"}</td>
											</tr>
											<tr className="border-b border-[rgba(55,50,47,0.08)]">
												<td className="py-2 pl-3 text-[#605A57]">Exterior wall</td>
												<td className="py-2 pr-3 text-right font-medium text-[#37322F]">{cadData?.exteriorWallType ?? "—"}</td>
											</tr>
											<tr className="border-b border-[rgba(55,50,47,0.08)]">
												<td className="py-2 pl-3 text-[#605A57]">Roof cover</td>
												<td className="py-2 pr-3 text-right font-medium text-[#37322F]">{cadData?.roofCover ?? "—"}</td>
											</tr>
											<tr className="border-b border-[rgba(55,50,47,0.08)]">
												<td className="py-2 pl-3 text-[#605A57]">Roof style</td>
												<td className="py-2 pr-3 text-right font-medium text-[#37322F]">{mapsData?.roofStyle ?? "—"}</td>
											</tr>
											<tr className="border-b border-[rgba(55,50,47,0.08)]">
												<td className="py-2 pl-3 text-[#605A57]">Solar panels</td>
												<td className="py-2 pr-3 text-right font-medium text-[#37322F]">{mapsData ? (mapsData.solarPanelsVisible ? "Visible" : "None visible") : "—"}</td>
											</tr>
											<tr className="border-b border-[rgba(55,50,47,0.08)]">
												<td className="py-2 pl-3 text-[#605A57]">Trampoline</td>
												<td className="py-2 pr-3 text-right font-medium text-[#37322F]">{mapsData ? (mapsData.trampolineVisible ? "Visible" : "None visible") : "—"}</td>
											</tr>
											<tr>
												<td className="py-2 pl-3 text-[#605A57]">Swimming pool</td>
												<td className="py-2 pr-3 text-right font-medium text-[#37322F]">{mapsData ? (mapsData.poolVisible ? "Visible" : "None visible") : "—"}</td>
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
												<td className="py-2 pl-3 text-[#605A57]">Flooring</td>
												<td className="py-2 pr-3 text-right font-medium text-[#37322F]">{realtorData?.flooring.length ? realtorData.flooring.join(", ") : "—"}</td>
											</tr>
											<tr className="border-b border-[rgba(55,50,47,0.08)]">
												<td className="py-2 pl-3 text-[#605A57]">Fireplace</td>
												<td className="py-2 pr-3 text-right font-medium text-[#37322F]">{realtorData?.hasFireplace != null ? (realtorData.hasFireplace ? "Yes" : "None") : "—"}</td>
											</tr>
											<tr className="border-b border-[rgba(55,50,47,0.08)]">
												<td className="py-2 pl-3 text-[#605A57]">Kitchen finishes</td>
												<td className="py-2 pr-3 text-right font-medium text-[#37322F]">{realtorData?.interiorAnalysis?.kitchenFinishes ?? "—"}</td>
											</tr>
											<tr>
												<td className="py-2 pl-3 text-[#605A57]">Interior condition</td>
												<td className="py-2 pr-3 text-right font-medium text-[#37322F]">{realtorData?.interiorAnalysis?.interiorCondition ?? "—"}</td>
											</tr>
										</tbody>
									</table>
								</div>
							</div>
						</div>

						<div className="space-y-3">
							<p className="text-sm font-medium text-[#37322F]">
								Ready to go back to 360 to fill out replacement
								cost section?
							</p>
							<p className="text-sm text-[#605A57]">
								We can use this information to fill out the
								replacement cost section in 360 automatically.
							</p>
							<div className="flex items-start gap-3">
								<Button
									type="button"
									variant="outline"
									onClick={goBack}
								>
									Back
								</Button>
								<div className="flex flex-col items-end ml-auto">
									<Button
										type="button"
										className="bg-[#6C70BA] hover:bg-[#6C70BA]/90 text-white inline-flex items-center gap-2"
										onClick={async () => {
											try {
												const res = await fetch(
													`${config.apiUrl}/api/proposals`,
													{
														method: "POST",
														headers: {
															"Content-Type":
																"application/json",
															...(getAuthToken()
																? { Authorization: `Bearer ${getAuthToken()}` }
																: {}),
														},
														body: JSON.stringify({
															triggeredBy:
																agencyZoomLeadId
																	? "agency_zoom"
																	: "apex_lead",
															leadId:
																agencyZoomLeadId ??
																undefined,
															property:
																addrParts ?? {
																	address:
																		effectiveAddress,
																	city: "",
																	state: "",
																	zip: "",
																},
															contact: leadName
																? {
																		firstName:
																			leadName.split(
																				" ",
																			)[0] ??
																			"",
																		lastName:
																			leadName
																				.split(
																					" ",
																				)
																				.slice(
																					1,
																				)
																				.join(
																					" ",
																				) ??
																			"",
																	}
																: {
																		firstName:
																			"",
																		lastName:
																			"",
																	},
														}),
													},
												);
												const json = await res.json();
												if (json.proposalId) {
													router.push(
														`/research-browser-run?proposalId=${json.proposalId}`,
													);
												}
											} catch {
												router.push(
													"/research-browser-run",
												);
											}
										}}
									>
										<Sparkles className="w-4 h-4" />
										<span>Fill using AI</span>
									</Button>
									<p className="text-xs text-[#605A57] mt-2">
										Docs we&apos;ll fill out:
									</p>
									<div className="flex flex-wrap items-center gap-2 justify-end mt-1">
										<span className="inline-flex items-center gap-2 rounded-full border border-[rgba(55,50,47,0.12)] bg-[#F9FAFB] pl-1.5 pr-3 py-1.5 text-xs font-medium text-[#37322F]">
											<img
												src="/alta%20logo.png"
												alt=""
												className="h-5 w-auto object-contain"
												aria-hidden
											/>
											Alta
										</span>
										<span className="inline-flex items-center gap-2 rounded-full border border-[rgba(55,50,47,0.12)] bg-[#F9FAFB] pl-1.5 pr-3 py-1.5 text-xs font-medium text-[#37322F]">
											<img
												src="/verisk-removebg.png"
												alt=""
												className="h-5 w-auto object-contain"
												aria-hidden
											/>
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
