import Link from "next/link";
import { notFound } from "next/navigation";
import { config } from "@/lib/config";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { CallActions } from "@/components/call-actions";

type CallDetail = {
	id: string;
	id_organization: string;
	ringcentral_call_id: string;
	from_number: string | null;
	to_number: string | null;
	start_time: string | null;
	duration_sec: number | null;
	status: string;
	lead_status: string | null;
	transcript: string | null;
	lead_payload: any | null;
};

async function fetchCall(id: string): Promise<CallDetail | null> {
	const res = await fetch(`${config.apiUrl}/api/calls/${id}`, {
		cache: "no-store",
	});
	if (res.status === 404) return null;
	if (!res.ok) return null;
	return res.json();
}

export default async function CallDetailPage({
	params,
}: {
	params: { id: string };
}) {
	const call = await fetchCall(params.id);
	if (!call) {
		notFound();
	}

	return (
		<div className="p-8">
			<div className="max-w-5xl mx-auto space-y-6">
				<div className="flex items-center justify-between">
					<div>
						<h1 className="text-2xl font-semibold text-[#37322F]">
							Call Details
						</h1>
						<p className="text-sm text-[#605A57] mt-1">
							RingCentral call ID: {call.ringcentral_call_id}
						</p>
					</div>
					<div className="flex items-center gap-4">
						<CallActions
							callId={call.id}
							initialLeadStatus={call.lead_status}
							hasTranscript={call.status === "transcribed"}
							hasLeadPayload={!!call.lead_payload?.lead}
						/>
						<Link
							href="/calls"
							className="text-sm text-[#37322F] hover:underline"
						>
							← Back to Call Listener
						</Link>
					</div>
				</div>

				<div className="grid gap-4 md:grid-cols-2">
					<div className="rounded-lg border border-[#E0DEDB] bg-white p-4 shadow-sm">
						<h2 className="text-sm font-semibold text-[#37322F] mb-3">
							Call Info
						</h2>
						<Table>
							<TableBody>
								<TableRow>
									<TableHead>From</TableHead>
									<TableCell>{call.from_number || "—"}</TableCell>
								</TableRow>
								<TableRow>
									<TableHead>To</TableHead>
									<TableCell>{call.to_number || "—"}</TableCell>
								</TableRow>
								<TableRow>
									<TableHead>Date / Time</TableHead>
									<TableCell>
										{call.start_time
											? new Date(call.start_time).toLocaleString()
											: "—"}
									</TableCell>
								</TableRow>
								<TableRow>
									<TableHead>Duration (s)</TableHead>
									<TableCell>{call.duration_sec ?? "—"}</TableCell>
								</TableRow>
								<TableRow>
									<TableHead>Call Status</TableHead>
									<TableCell className="capitalize">
										{call.status ?? "—"}
									</TableCell>
								</TableRow>
								<TableRow>
									<TableHead>Lead Status</TableHead>
									<TableCell className="capitalize">
										{call.lead_status ?? "—"}
									</TableCell>
								</TableRow>
							</TableBody>
						</Table>
					</div>

					<div className="rounded-lg border border-[#E0DEDB] bg-white p-4 shadow-sm">
						<h2 className="text-sm font-semibold text-[#37322F] mb-3">
							Lead Payload (JSON)
						</h2>
						<div className="text-xs font-mono text-[#111827] bg-[#F9FAFB] border border-[#E5E7EB] rounded-md p-3 max-h-[360px] overflow-auto">
							<pre className="whitespace-pre-wrap break-all">
								{call.lead_payload
									? JSON.stringify(call.lead_payload, null, 2)
									: "// No lead payload yet"}
							</pre>
						</div>
					</div>
				</div>

				<div className="rounded-lg border border-[#E0DEDB] bg-white p-4 shadow-sm">
					<h2 className="text-sm font-semibold text-[#37322F] mb-3">
						Transcript
					</h2>
					<div className="text-sm text-[#111827] bg-[#F9FAFB] border border-[#E5E7EB] rounded-md p-3 max-h-[360px] overflow-auto whitespace-pre-wrap">
						{call.transcript || "No transcript available for this call."}
					</div>
				</div>
			</div>
		</div>
	);
}

