"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { config } from "@/lib/config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CircleCheck, CircleX, Loader2 } from "lucide-react";

type ProposalStatus = {
	proposalId: string;
	status: "waiting" | "active" | "completed" | "failed" | "delayed" | "paused";
	failedReason: string | null;
	createdAt: string;
};

function ResearchBrowserRunInner() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const proposalId = searchParams.get("proposalId");

	const [proposal, setProposal] = useState<ProposalStatus | null>(null);
	const [mfaCode, setMfaCode] = useState("");
	const [mfaSubmitting, setMfaSubmitting] = useState(false);
	const [mfaSubmitted, setMfaSubmitted] = useState(false);
	const [mfaError, setMfaError] = useState<string | null>(null);
	const [elapsedSec, setElapsedSec] = useState(0);
	const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

	// Poll proposal status
	useEffect(() => {
		if (!proposalId) return;

		async function poll() {
			try {
				const res = await fetch(`${config.apiUrl}/api/proposals/${proposalId}`);
				if (res.ok) {
					const data = await res.json();
					setProposal(data);
					// Stop polling when done
					if (data.status === "completed" || data.status === "failed") {
						if (intervalRef.current) clearInterval(intervalRef.current);
					}
				}
			} catch {
				// Network error — keep polling
			}
		}

		poll();
		intervalRef.current = setInterval(poll, 3000);
		return () => {
			if (intervalRef.current) clearInterval(intervalRef.current);
		};
	}, [proposalId]);

	// Elapsed time counter while active
	useEffect(() => {
		if (proposal?.status !== "active" && proposal?.status !== "waiting") return;
		const t = setInterval(() => setElapsedSec((s) => s + 1), 1000);
		return () => clearInterval(t);
	}, [proposal?.status]);

	const handleSubmitMfa = async () => {
		if (!proposalId || !mfaCode.trim()) return;
		setMfaSubmitting(true);
		setMfaError(null);
		try {
			const res = await fetch(`${config.apiUrl}/api/proposals/${proposalId}/mfa`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ code: mfaCode.trim() }),
			});
			if (res.ok) {
				setMfaSubmitted(true);
				setMfaCode("");
			} else {
				setMfaError("Failed to submit code — try again.");
			}
		} catch {
			setMfaError("Network error — try again.");
		} finally {
			setMfaSubmitting(false);
		}
	};

	const isRunning = proposal?.status === "active" || proposal?.status === "waiting";
	const isDone = proposal?.status === "completed";
	const isFailed = proposal?.status === "failed";
	// Show MFA input after 8s of active state (login done, waiting for code)
	const showMfaInput = proposal?.status === "active" && elapsedSec >= 8 && !mfaSubmitted;

	return (
		<div className="p-8">
			<div className="max-w-4xl mx-auto space-y-6">
				<p className="text-sm text-[#605A57] flex items-center gap-2 justify-center">
					<span>You don&apos;t have to watch the whole time. You can close this tab — we&apos;ll keep working in the background.</span>
				</p>

				{/* Browser chrome */}
				<div className="flex justify-center">
					<div className="w-full max-w-3xl rounded-xl border-2 border-[rgba(55,50,47,0.15)] overflow-hidden bg-[#e8e8e8] shadow-lg">
						{/* Title bar */}
						<div className="flex items-center gap-2 px-3 py-2.5 border-b border-[rgba(55,50,47,0.12)] bg-[#e5e5e5]">
							<span className="w-3 h-3 rounded-full bg-[#ff5f57]" aria-hidden />
							<span className="w-3 h-3 rounded-full bg-[#febc2e]" aria-hidden />
							<span className="w-3 h-3 rounded-full bg-[#28c840]" aria-hidden />
							{proposalId && (
								<span className="ml-3 text-xs text-[#605A57] font-mono">
									{isDone ? "farmersagent.my.salesforce.com" : isRunning ? "eagentsaml.farmersinsurance.com" : ""}
								</span>
							)}
						</div>

						{/* Content area — replaces video */}
						<div className="aspect-video bg-[#1a1a2e] flex flex-col items-center justify-center gap-6">
							{!proposalId && (
								<p className="text-white/50 text-sm">No automation running.</p>
							)}

							{isRunning && (
								<>
									<Loader2 className="w-12 h-12 text-[#6C70BA] animate-spin" />
									<div className="text-center space-y-1">
										<p className="text-white text-sm font-medium">
											{proposal?.status === "waiting" ? "Starting browser…" : "Browser automation running"}
										</p>
										<p className="text-white/40 text-xs">
											{elapsedSec > 0 ? `${elapsedSec}s elapsed` : "Launching Chromium…"}
										</p>
									</div>
								</>
							)}

							{isDone && (
								<>
									<CircleCheck className="w-12 h-12 text-green-400" />
									<p className="text-white text-sm font-medium">All done! Forms filled successfully.</p>
								</>
							)}

							{isFailed && (
								<>
									<CircleX className="w-12 h-12 text-red-400" />
									<div className="text-center space-y-1">
										<p className="text-white text-sm font-medium">Automation failed</p>
										{proposal?.failedReason && (
											<p className="text-white/50 text-xs">{proposal.failedReason}</p>
										)}
									</div>
								</>
							)}
						</div>
					</div>
				</div>

				{/* MFA input — shown when browser is waiting for SMS code */}
				{showMfaInput && (
					<div className="rounded-lg border border-amber-200 bg-amber-50 p-5 space-y-3">
						<div>
							<p className="text-sm font-medium text-amber-900">SMS verification required</p>
							<p className="text-xs text-amber-700 mt-0.5">
								Farmers sent a code to Alex&apos;s phone. Enter it below to continue.
							</p>
						</div>
						<div className="flex gap-2">
							<Input
								type="text"
								inputMode="numeric"
								placeholder="Enter 6-digit code"
								value={mfaCode}
								onChange={(e) => setMfaCode(e.target.value)}
								className="max-w-[200px] font-mono text-center tracking-widest"
								maxLength={8}
								onKeyDown={(e) => e.key === "Enter" && handleSubmitMfa()}
							/>
							<Button
								onClick={handleSubmitMfa}
								disabled={mfaSubmitting || !mfaCode.trim()}
								className="bg-amber-700 hover:bg-amber-800 text-white"
							>
								{mfaSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Submit"}
							</Button>
						</div>
						{mfaError && <p className="text-xs text-red-600">{mfaError}</p>}
					</div>
				)}

				{mfaSubmitted && isRunning && (
					<div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
						Code submitted — waiting for Salesforce to load…
					</div>
				)}

				{isFailed && (
					<div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
						<span className="font-medium">Error:</span> {proposal?.failedReason ?? "Unknown error"}
					</div>
				)}

				{/* Actions */}
				<div className="pt-2 flex flex-wrap items-center gap-3">
					<Button type="button" onClick={() => router.push("/research-agent")}>
						Research a new address
					</Button>
				</div>
			</div>
		</div>
	);
}

export default function ResearchBrowserRunPage() {
	return (
		<Suspense>
			<ResearchBrowserRunInner />
		</Suspense>
	);
}
