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
import {
	Captions,
	CalendarDays,
	CircleDollarSign,
	Clock4,
	PhoneIncoming,
	PhoneOutgoing,
} from "lucide-react";

type CallDetail = {
	id: string;
	id_organization: string;
	ringcentral_call_id: string;
	from_number: string | null;
	to_number: string | null;
	from_name: string | null;
	to_name: string | null;
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

function formatCallDate(startTime: string | null): string {
	if (!startTime) return "—";
	const d = new Date(startTime);
	if (Number.isNaN(d.getTime())) return "—";
	return new Intl.DateTimeFormat("en-US", {
		timeZone: "America/New_York",
		month: "2-digit",
		day: "2-digit",
		year: "2-digit",
	}).format(d);
}

function formatCallTime(startTime: string | null): string {
	if (!startTime) return "—";
	const d = new Date(startTime);
	if (Number.isNaN(d.getTime())) return "—";
	return new Intl.DateTimeFormat("en-US", {
		timeZone: "America/New_York",
		hour: "numeric",
		minute: "2-digit",
		hour12: true,
	}).format(d);
}

function formatDuration(durationSec: number | null): string {
	if (typeof durationSec !== "number") return "—";
	const minutes = Math.floor(durationSec / 60);
	const seconds = Math.max(0, durationSec % 60);
	return `${minutes}:${String(seconds).padStart(2, "0")}`;
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
									<TableHead>
										<PhoneOutgoing className="h-4 w-4 inline-block mr-2" />
										From
									</TableHead>
									<TableCell>
										<div className="flex flex-col">
											<span>{call.from_name || "—"}</span>
											<span className="text-xs text-[#605A57]">
												{call.from_number || "—"}
											</span>
										</div>
									</TableCell>
								</TableRow>
								<TableRow>
									<TableHead>
										<PhoneIncoming className="h-4 w-4 inline-block mr-2" />
										To
									</TableHead>
									<TableCell>
										<div className="flex flex-col">
											<span>{call.to_name || "—"}</span>
											<span className="text-xs text-[#605A57]">
												{call.to_number || "—"}
											</span>
										</div>
									</TableCell>
								</TableRow>
								<TableRow>
									<TableHead>
										<CalendarDays className="h-4 w-4 inline-block mr-2" />
										Date
									</TableHead>
									<TableCell>{formatCallDate(call.start_time)}</TableCell>
								</TableRow>
								<TableRow>
									<TableHead>
										<Clock4 className="h-4 w-4 inline-block mr-2" />
										Time
									</TableHead>
									<TableCell>{formatCallTime(call.start_time)}</TableCell>
								</TableRow>
								<TableRow>
									<TableHead>Duration (mm:ss)</TableHead>
									<TableCell>
										{formatDuration(call.duration_sec)}
									</TableCell>
								</TableRow>
								<TableRow>
									<TableHead>Call Status</TableHead>
									<TableCell className="capitalize">
										{call.status ?? "—"}
									</TableCell>
								</TableRow>
								<TableRow>
									<TableHead>
										<CircleDollarSign className="h-4 w-4 inline-block mr-2" />
										Lead Status
									</TableHead>
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
					<h2 className="text-sm font-semibold text-[#37322F] mb-3 flex items-center gap-2">
						<Captions className="h-4 w-4" />
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

