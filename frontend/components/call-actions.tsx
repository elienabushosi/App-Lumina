"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { config } from "@/lib/config";
import { Loader2 } from "lucide-react";

type Props = {
	callId: string;
	initialLeadStatus: string | null;
};

export function CallActions({ callId, initialLeadStatus }: Props) {
	const [isPushing, setIsPushing] = useState(false);
	const [message, setMessage] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [leadStatus, setLeadStatus] = useState<string | null>(initialLeadStatus);

	const handlePushAgencyZoom = async () => {
		setIsPushing(true);
		setError(null);
		setMessage(null);

		try {
			const res = await fetch(
				`${config.apiUrl}/api/calls/${encodeURIComponent(
					callId
				)}/push-agencyzoom`,
				{
					method: "POST",
				}
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

	return (
		<div className="flex flex-col gap-2 items-start">
			<Button
				onClick={handlePushAgencyZoom}
				disabled={isPushing}
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
			{message && (
				<p className="text-xs text-green-700">
					{message} {leadStatus && `(lead status: ${leadStatus})`}
				</p>
			)}
			{error && <p className="text-xs text-red-700">{error}</p>}
		</div>
	);
}

