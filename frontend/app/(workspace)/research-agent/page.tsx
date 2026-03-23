"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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

// Demo data for 9808 Coolidge Dr., McKinney, TX 75072 (Collin CAD Property ID 2516503)
const DUMMY_ATTRIBUTES = [
	{ label: "Type", value: "Single-family home" },
	{ label: "Year built", value: "2003" },
	{ label: "Living area", value: "1,914 sq ft" },
	{ label: "Total building", value: "2,379 sq ft" },
	{ label: "Attached Garage", value: "465 sq ft" },
	{ label: "Covered Porch/Patio", value: "44 sq ft" },
	{ label: "County", value: "Collin County" },
	{ label: "Last sale", value: "$133,700 on 8/13/2003" },
	{ label: "Estimated value", value: "$355,921" },
	{ label: "2024 property tax", value: "Increased ~94% (up $3,510)" },
	{ label: "APN", value: "R-8113-00D-0190-1" },
];
const COLLIN_CAD_SOURCE_URL =
	"https://esearch.collincad.org/Property/View/2516503?year=2026&ownerId=558191";

function ResearchAgentInner() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const [step, setStep] = useState(STEPS.INPUT);

	const [address, setAddress] = useState("");

	// Pre-fill address from query params (e.g. navigated from call detail "Start Proposal")
	useEffect(() => {
		const parts = [
			searchParams.get("address"),
			searchParams.get("city"),
			searchParams.get("state"),
			searchParams.get("zip"),
		].filter(Boolean);
		if (parts.length > 0) setAddress(parts.join(", "));
	}, [searchParams]);
	const [groundStage, setGroundStage] = useState(0); // 0: loading, 1: inferring, 2: results
	const [birdsStage, setBirdsStage] = useState(0); // 0: loading, 1: inferring, 2: results
	const [zillowStage, setZillowStage] = useState(0); // 0: loading, 1: inferring, 2: results
	const [redfinStage, setRedfinStage] = useState(0); // 0: loading, 1: inferring, 2: results
	const [googleMapsViewPhase, setGoogleMapsViewPhase] = useState(0); // 0: "Viewing Google maps" loader, 1: show imagery + AI stages
	const [zillowRedfinViewPhase, setZillowRedfinViewPhase] = useState(0); // 0: "Viewing Zillow & Redfin" loader, 1: show images + AI stages

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
	// When entering Google Maps step, show "Viewing Google maps" first, then imagery
	useEffect(() => {
		if (step !== STEPS.GOOGLE_MAP_PROMPT) return;
		setGoogleMapsViewPhase(0);
	}, [step]);

	useEffect(() => {
		if (step !== STEPS.GOOGLE_MAP_PROMPT || googleMapsViewPhase !== 0) return;
		const t = setTimeout(() => setGoogleMapsViewPhase(1), 2200);
		return () => clearTimeout(t);
	}, [step, googleMapsViewPhase]);

	// Step 5 (phase 1): Google Maps imagery + AI animation → staged loading → ground results → birds results
	useEffect(() => {
		if (step !== STEPS.GOOGLE_MAP_PROMPT || googleMapsViewPhase !== 1) return;
		setGroundStage(0);
		setBirdsStage(0);

		const t1 = setTimeout(() => setGroundStage(1), 800); // start inferring ground
		const t2 = setTimeout(() => {
			setGroundStage(2); // show ground results
			setBirdsStage(1); // start inferring birds
		}, 2200);
		const t3 = setTimeout(() => setBirdsStage(2), 3600); // show birds results

		return () => {
			clearTimeout(t1);
			clearTimeout(t2);
			clearTimeout(t3);
		};
	}, [step, googleMapsViewPhase]);

	const defaultAddress = "9808 Coolidge Dr. Mckinney,Tx 75070";
	const effectiveAddress = address || defaultAddress;
	const analysisComplete = birdsStage === 2;
	const zillowRedfinComplete = redfinStage === 2;

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

	const handleResearch = () => {
		setAddress(effectiveAddress);
		setStep(STEPS.CAD_LOADER);
	};

	return (
		<div className="p-8">
			<div className="max-w-4xl mx-auto space-y-6">
				<h1 className="text-2xl font-semibold text-[#37322F]">
					Research Agent
				</h1>

				{step !== STEPS.INPUT && (
					<>
						<div className="flex items-center gap-2 text-sm text-[#605A57]">
							<MapPinHouse className="w-4 h-4 text-[#6C70BA]" />
							<span>{effectiveAddress}</span>
						</div>
						{/* Data stored pills – below address, left-aligned */}
						<div className="flex flex-wrap items-center gap-2">
							{step >= STEPS.DATA_PULLED && (
								<span className="inline-flex items-center gap-1.5 rounded-full bg-[#6C70BA]/10 px-3 py-1 text-xs font-medium text-[#6C70BA]">
									<CircleCheck className="w-3.5 h-3.5" />
									CAD data stored
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
									Collin County CAD Property Report
								</p>
							</div>
							<p className="text-xs text-[#605A57] min-w-0 break-words">
								Source:{" "}
								<a
									href={COLLIN_CAD_SOURCE_URL}
									target="_blank"
									rel="noreferrer"
									className="text-[#6C70BA] underline hover:no-underline break-words"
								>
									Collin CAD Property Search (Property ID 2516503)
								</a>
							</p>
						</div>
						<div className="overflow-x-auto rounded-md border border-[rgba(55,50,47,0.12)]">
							<table className="w-full text-sm">
								<tbody>
									{DUMMY_ATTRIBUTES.map(({ label, value }) => (
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
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							<div>
								<p className="text-xs font-medium text-[#605A57] mb-1">Property details (Collin CAD)</p>
								<img
									src="/propertydetails9808.png"
									alt="Collin CAD property details for 9808 Coolidge Dr"
									className="w-full max-w-sm rounded-md border border-[rgba(55,50,47,0.12)] object-contain"
								/>
							</div>
							<div>
								<p className="text-xs font-medium text-[#605A57] mb-1">Property improvement &amp; value history (Collin CAD)</p>
								<img
									src="/propertyimprovement9808.png"
									alt="Collin CAD property improvement and roll value history for 9808 Coolidge Dr"
									className="w-full max-w-sm rounded-md border border-[rgba(55,50,47,0.12)] object-contain"
								/>
							</div>
						</div>
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
									onClick={() => setStep(STEPS.GOOGLE_MAP_PROMPT)}
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
								onClick={() => setStep(STEPS.GOOGLE_MAP_PROMPT)}
								className="bg-[#6C70BA] hover:bg-[#6C70BA]/90 text-white"
							>
								Yes, continue
							</Button>
						</div>
					</div>
				)}

				{/* Google Maps step: first "Viewing Google maps" (skeleton/thinking), then imagery + AI */}
				{step === STEPS.GOOGLE_MAP_PROMPT && (
					<div className="rounded-lg border border-[rgba(55,50,47,0.12)] bg-white p-6 space-y-6">
						{googleMapsViewPhase === 0 ? (
							/* Loading / thinking state: logo + dots + "Viewing Google maps" */
							<div className="flex flex-col items-center justify-center py-12 gap-4">
								<img
									src="/logos/Google-Maps-Logo.jpg"
									alt="Google Maps"
									className="h-10 w-auto object-contain"
								/>
								<div className="flex items-center gap-2 text-sm text-[#605A57]">
									<span className="w-2 h-2 rounded-full bg-[#6C70BA] animate-bounce [animation-delay:0ms]" />
									<span className="w-2 h-2 rounded-full bg-[#6C70BA] animate-bounce [animation-delay:150ms]" />
									<span className="w-2 h-2 rounded-full bg-[#6C70BA] animate-bounce [animation-delay:300ms]" />
									<span className="ml-1">Viewing Google maps</span>
								</div>
							</div>
						) : (
							<>
						<div className="space-y-2">
							<div className="flex items-center justify-between gap-4">
								<div className="flex items-center gap-2">
									<img
										src="/logos/Google-Maps-Logo.jpg"
										alt="Google Maps"
										className="h-8 w-auto object-contain"
									/>
								</div>
								<div className="text-xs text-[#605A57] text-right">
									Using Google Maps bird&apos;s eye and street view imagery to enrich property attributes.
								</div>
							</div>
							<div className="flex items-center gap-1 text-xs text-[#605A57]">
								<span
									className={`w-2 h-2 rounded-full bg-[#6C70BA] ${
										analysisComplete ? "" : "animate-bounce"
									}`}
								/>
								<span>{analysisComplete ? "Analysis complete" : "AI is analyzing imagery…"}</span>
							</div>
						</div>
						<div className="grid gap-6 md:grid-cols-2">
							{/* Ground view analysis */}
							<div className="rounded-lg border border-[rgba(55,50,47,0.12)] bg-[#f9fafb] overflow-hidden flex flex-col gap-3">
								<div className="relative">
									<img
										src="/9808CoolidgeGoogleMapsGrounds.png"
										alt="9808 Coolidge Dr. ground view"
										className="w-full h-48 object-cover"
									/>
									<div
										className={`pointer-events-none absolute inset-0 bg-linear-to-r from-white/10 via-white/40 to-white/10 ${
											groundStage >= 2 ? "opacity-0 transition-opacity duration-500" : "animate-pulse"
										}`}
									/>
								</div>
								<div className="px-4 pb-4 space-y-2">
									{groundStage < 2 && (
										<div className="flex items-center gap-1 text-[11px] text-[#605A57]">
											<span className="w-2 h-2 rounded-full bg-[#6C70BA] animate-bounce [animation-delay:0ms]" />
											<span className="w-2 h-2 rounded-full bg-[#6C70BA] animate-bounce [animation-delay:150ms]" />
											<span className="w-2 h-2 rounded-full bg-[#6C70BA] animate-bounce [animation-delay:300ms]" />
											<span>AI inferring from ground view…</span>
										</div>
									)}
									<p className="text-xs font-semibold uppercase tracking-wide text-[#605A57]">
										Ground view (structure &amp; exterior walls)
									</p>
									{groundStage === 0 && (
										<ul className="text-xs text-[#9CA3AF] space-y-1">
											<li>Loading Google Maps street view…</li>
										</ul>
									)}
									{groundStage === 1 && (
										<ul className="text-xs text-[#9CA3AF] space-y-1">
											<li>Inferring stories (1 vs 2)…</li>
											<li>Inferring foundation type from visible slab/vents…</li>
											<li>Scanning exterior wall materials and coverage…</li>
										</ul>
									)}
									{groundStage === 2 && (
										<ul className="text-xs text-[#37322F] space-y-1">
											<li>
												<strong>Stories:</strong> 1-story
											</li>
											<li>
												<strong>Foundation type:</strong> Slab-on-grade (no visible pier &amp; beam vents)
											</li>
											<li>
												<strong>Exterior wall materials (approx.):</strong> ~90% brick veneer, ~10% siding/trim
											</li>
										</ul>
									)}
									<p className="text-[10px] text-[#9CA3AF]">
										Source:{" "}
										<a
											href="https://www.google.com/maps/@33.1860996,-96.7464814,3a,28y,7.79h,90.47t/data=!3m7!1e1!3m5!1sxE2sj-cJiEbvnzsTw1VNig!2e0!6shttps:%2F%2Fstreetviewpixels-pa.googleapis.com%2Fv1%2Fthumbnail%3Fcb_client%3Dmaps_sv.tactile%26w%3D900%26h%3D600%26pitch%3D-0.4686024982608643%26panoid%3DxE2sj-cJiEbvnzsTw1VNig%26yaw%3D7.788272456148571!7i16384!8i8192?entry=ttu&g_ep=EgoyMDI2MDMwNC4xIKXMDSoASAFQAw%3D%3D"
											target="_blank"
											rel="noreferrer"
											className="underline"
										>
											Google Maps street view
										</a>
									</p>
								</div>
							</div>

							{/* Bird&apos;s eye view analysis */}
							<div className="rounded-lg border border-[rgba(55,50,47,0.12)] bg-[#f9fafb] overflow-hidden flex flex-col gap-3">
								<div className="relative">
									<img
										src="/9808CoolidgeGooglemapsBirds.png"
										alt="9808 Coolidge Dr. bird's eye view"
										className="w-full h-48 object-cover"
									/>
									<div
										className={`pointer-events-none absolute inset-0 bg-linear-to-r from-white/10 via-white/40 to-white/10 ${
											birdsStage >= 2 ? "opacity-0 transition-opacity duration-500" : "animate-pulse"
										}`}
									/>
								</div>
								<div className="px-4 pb-4 space-y-2">
									{birdsStage < 2 && (
										<div className="flex items-center gap-1 text-[11px] text-[#605A57]">
											<span className="w-2 h-2 rounded-full bg-[#6C70BA] animate-bounce [animation-delay:0ms]" />
											<span className="w-2 h-2 rounded-full bg-[#6C70BA] animate-bounce [animation-delay:150ms]" />
											<span className="w-2 h-2 rounded-full bg-[#6C70BA] animate-bounce [animation-delay:300ms]" />
											<span>AI inferring from aerial view…</span>
										</div>
									)}
									<p className="text-xs font-semibold uppercase tracking-wide text-[#605A57]">
										Bird&apos;s eye view (roof &amp; site features)
									</p>
									{birdsStage === 0 && (
										<ul className="text-xs text-[#9CA3AF] space-y-1">
											<li>Loading Google Maps aerial view…</li>
										</ul>
									)}
									{birdsStage === 1 && (
										<ul className="text-xs text-[#9CA3AF] space-y-1">
											<li>Inferring roof covering type…</li>
											<li>Inferring roof style (hip vs gable)…</li>
											<li>Scanning for solar panels, pools, trampolines…</li>
										</ul>
									)}
									{birdsStage === 2 && (
										<ul className="text-xs text-[#37322F] space-y-1">
											<li>
												<strong>Roof covering type:</strong> Architectural asphalt shingle
											</li>
											<li>
												<strong>Roof style:</strong> Hip roof
											</li>
											<li>
												<strong>Solar panels:</strong> None visible
											</li>
											<li>
												<strong>Trampoline:</strong> None visible
											</li>
											<li>
												<strong>Swimming pool:</strong> None visible
											</li>
										</ul>
									)}
									<p className="text-[10px] text-[#9CA3AF]">
										Source:{" "}
										<a
											href="https://www.google.com/maps/place/9808+Coolidge+Dr,+McKinney,+TX+75072/@33.1863138,-96.746472,48m/data=!3m1!1e3!4m6!3m5!1s0x864c15f4fcb4428b:0x305d6fff4c8553a!8m2!3d33.1863192!4d-96.7464623!16s%2Fg%2F11c2f2ysp3?entry=ttu&g_ep=EgoyMDI2MDMwNC4xIKXMDSoASAFQAw%3D%3D"
											target="_blank"
											rel="noreferrer"
											className="underline"
										>
											Google Maps aerial view
										</a>
									</p>
								</div>
							</div>
						</div>

						<div className="pt-2 space-y-3">
							{analysisComplete && (
								<div className="space-y-2">
									<p className="text-sm font-medium text-[#37322F]">
										Are you ready to continue with Zillow &amp; Redfin?
									</p>
									<p className="text-sm text-[#605A57]">
										We&apos;ll use a powerful vision model to infer interior finishes, bathrooms, flooring
										types, overall interior quality, and more.
									</p>
									<div className="flex justify-end gap-3">
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
							</>
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
											{DUMMY_ATTRIBUTES.slice(0, 2).map(({ label, value }) => (
												<tr key={label} className="border-b border-[rgba(55,50,47,0.08)]">
													<td className="py-2 pl-3 text-[#605A57]">{label}</td>
													<td className="py-2 pr-3 text-right font-medium text-[#37322F]">{value}</td>
												</tr>
											))}
											<tr className="border-b border-[rgba(55,50,47,0.08)]">
												<td className="py-2 pl-3 text-[#605A57]">Living Area</td>
												<td className="py-2 pr-3 text-right font-medium text-[#37322F]">1,914 sq ft</td>
											</tr>
											<tr className="border-b border-[rgba(55,50,47,0.08)]">
												<td className="py-2 pl-3 text-[#605A57]">Attached Garage</td>
												<td className="py-2 pr-3 text-right font-medium text-[#37322F]">465 sq ft</td>
											</tr>
											<tr className="border-b border-[rgba(55,50,47,0.08)]">
												<td className="py-2 pl-3 text-[#605A57]">Covered Porch/Patio</td>
												<td className="py-2 pr-3 text-right font-medium text-[#37322F]">44 sq ft</td>
											</tr>
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
