"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { config } from "@/lib/config";
import { getAuthToken } from "@/lib/auth";
import { Loader2, FileText } from "lucide-react";
import { LeadStatusBadge } from "@/components/lead-status-badge";

type Props = {
	callId: string;
	initialLeadStatus: string | null;
	hasTranscript: boolean;
	hasLeadPayload: boolean;
	onRefresh?: () => void;
};

export function CallActions({
	callId,
	initialLeadStatus,
	hasTranscript,
	hasLeadPayload,
	onRefresh,
}: Props) {
	const router = useRouter();
	const [isPushing, setIsPushing] = useState(false);
	const [isExtracting, setIsExtracting] = useState(false);
	const [message, setMessage] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [leadStatus, setLeadStatus] = useState<string | null>(initialLeadStatus);
	const [payloadReady, setPayloadReady] = useState(hasLeadPayload);

	const handleExtractLead = async () => {
		setIsExtracting(true);
		setError(null);
		setMessage(null);

		try {
			const token = getAuthToken();
			const res = await fetch(
				`${config.apiUrl}/api/calls/${encodeURIComponent(callId)}/extract-lead`,
				{ method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : {} }
			);
			const data = await res.json().catch(() => ({}));

			if (!res.ok || data.error) {
				throw new Error(
					data.error || `Extract failed (${res.status} ${res.statusText})`
				);
			}

			setMessage("Lead extracted.");
			setPayloadReady(true);
			setLeadStatus(data.lead_status ?? "extracted");
			onRefresh?.();
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Failed to extract lead from transcript."
			);
		} finally {
			setIsExtracting(false);
		}
	};

	const handlePushAgencyZoom = async () => {
		setIsPushing(true);
		setError(null);
		setMessage(null);

		try {
			const token = getAuthToken();
			const res = await fetch(
				`${config.apiUrl}/api/calls/${encodeURIComponent(callId)}/push-agencyzoom`,
				{ method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : {} }
			);
			const data = await res.json().catch(() => ({}));

			if (!res.ok || data.error) {
				throw new Error(
					data.error ||
						`Failed to push lead (status ${res.status} ${res.statusText})`
				);
			}

			setMessage("Lead pushed to AgencyZoom.");
			setLeadStatus("pushed");
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Failed to push lead to AgencyZoom."
			);
		} finally {
			setIsPushing(false);
		}
	};

	const handleStartProposal = () => {
		// TODO: use real address from call's lead_payload once wired to backend
		// For now, use dummy test property: 9808 Coolidge Dr, McKinney TX 75070
		const params = new URLSearchParams({
			address: "9808 Coolidge Dr",
			city: "McKinney",
			state: "TX",
			zip: "75070",
		});
		router.push(`/research-agent?${params.toString()}`);
	};

	return (
		<div className="flex flex-col gap-2 items-start">
			<div className="flex items-center gap-2 flex-wrap">
				<Button
					onClick={handleExtractLead}
					disabled={!hasTranscript || isExtracting}
					variant="outline"
					className="border-[#37322F] text-[#37322F] hover:bg-[#37322F]/10"
				>
					{isExtracting ? (
						<>
							<Loader2 className="h-4 w-4 mr-2 animate-spin" />
							Extracting...
						</>
					) : (
						"Extract Lead"
					)}
				</Button>
				<Button
					onClick={handlePushAgencyZoom}
					disabled={isPushing || !payloadReady}
					className="bg-[#37322F] hover:bg-[#37322F]/90 text-white"
				>
					{isPushing ? (
						<>
							<Loader2 className="h-4 w-4 mr-2 animate-spin" />
							Sending to AgencyZoom...
						</>
					) : (
						"Send to AgencyZoom"
					)}
				</Button>
				<Button
					onClick={handleStartProposal}
					className="bg-[#6c70ba] hover:bg-[#5a5ea8] text-white"
				>
					<FileText className="h-4 w-4 mr-2" />
					Start Proposal
				</Button>
			</div>
			{message && (
				<p className="text-xs text-green-700 flex flex-wrap items-center gap-2">
					<span>{message}</span>
					{leadStatus != null && leadStatus !== "" && (
						<LeadStatusBadge status={leadStatus} />
					)}
				</p>
			)}
			{error && <p className="text-xs text-red-700">{error}</p>}
			{!hasTranscript && (
				<p className="text-xs text-[#605A57]">
					Call must be transcribed before extracting lead.
				</p>
			)}
		</div>
	);
}

