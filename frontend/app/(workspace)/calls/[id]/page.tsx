"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { config } from "@/lib/config";
import { getAuthToken } from "@/lib/auth";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { CallActions } from "@/components/call-actions";
import { LeadPayloadPanel } from "@/components/lead-payload-panel";
import { LeadStatusBadge } from "@/components/lead-status-badge";
import { formatDisplayPhone } from "@/lib/format-phone";
import {
	formatCallDate,
	formatCallTime,
	formatDuration,
} from "@/lib/format-call";
import {
	Captions,
	CalendarDays,
	CircleDollarSign,
	Clock4,
	PhoneCall,
	PhoneIncoming,
	PhoneOutgoing,
	Timer,
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

export default function CallDetailPage({
	params,
}: {
	params: { id: string };
}) {
	const { id } = params;
	const [call, setCall] = useState<CallDetail | null>(null);
	const [loading, setLoading] = useState(true);
	const [notFound, setNotFound] = useState(false);

	const fetchCall = async () => {
		try {
			const token = getAuthToken();
			const res = await fetch(`${config.apiUrl}/api/calls/${id}`, {
				headers: token ? { Authorization: `Bearer ${token}` } : {},
				cache: "no-store",
			});
			if (res.status === 404) { setNotFound(true); return; }
			if (!res.ok) { setNotFound(true); return; }
			const data = await res.json();
			setCall(data);
		} catch {
			setNotFound(true);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => { fetchCall(); }, [id]);

	if (loading) {
		return (
			<div className="p-8">
				<div className="max-w-5xl mx-auto">
					<p className="text-sm text-[#605A57]">Loading call details...</p>
				</div>
			</div>
		);
	}

	if (notFound || !call) {
		return (
			<div className="p-8">
				<div className="max-w-5xl mx-auto space-y-4">
					<Link href="/calls" className="text-sm text-[#37322F] hover:underline">
						← Back to Call Listener
					</Link>
					<p className="text-sm text-[#605A57]">Call not found.</p>
				</div>
			</div>
		);
	}

	return (
		<div className="p-8">
			<div className="max-w-5xl mx-auto space-y-6">
				<div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
					<div className="space-y-3 min-w-0">
						<Link
							href="/calls"
							className="text-sm text-[#37322F] hover:underline inline-block"
						>
							← Back to Call Listener
						</Link>
						<div>
							<h1 className="text-2xl font-semibold text-[#37322F]">
								Call Details
							</h1>
							<p className="text-sm text-[#605A57] mt-1">
								RingCentral call ID: {call.ringcentral_call_id}
							</p>
						</div>
					</div>
					<div className="shrink-0">
						<CallActions
							callId={call.id}
							initialLeadStatus={call.lead_status}
							hasTranscript={call.status === "transcribed"}
							hasLeadPayload={!!call.lead_payload?.lead}
							onRefresh={fetchCall}
						/>
					</div>
				</div>

				<div className="grid gap-4 md:grid-cols-2">
					<div className="rounded-lg border border-[#E0DEDB] bg-white shadow-sm md:col-span-2 overflow-hidden">
						<div className="p-4 overflow-x-auto">
							<Table>
								<TableHeader>
									<TableRow className="bg-[#F9F8F6] hover:bg-[#F9F8F6] border-b border-[#E0DEDB]">
										<TableHead className="text-xs font-semibold text-[#37322F] align-bottom whitespace-nowrap">
											<span className="inline-flex items-center gap-1.5">
												<PhoneOutgoing className="h-4 w-4 shrink-0 text-[#605A57]" />
												From
											</span>
										</TableHead>
										<TableHead className="text-xs font-semibold text-[#37322F] align-bottom whitespace-nowrap">
											<span className="inline-flex items-center gap-1.5">
												<PhoneIncoming className="h-4 w-4 shrink-0 text-[#605A57]" />
												To
											</span>
										</TableHead>
										<TableHead className="text-xs font-semibold text-[#37322F] align-bottom whitespace-nowrap">
											<span className="inline-flex items-center gap-1.5">
												<CalendarDays className="h-4 w-4 shrink-0 text-[#605A57]" />
												Date
											</span>
										</TableHead>
										<TableHead className="text-xs font-semibold text-[#37322F] align-bottom whitespace-nowrap">
											<span className="inline-flex items-center gap-1.5">
												<Clock4 className="h-4 w-4 shrink-0 text-[#605A57]" />
												Time
											</span>
										</TableHead>
										<TableHead className="text-xs font-semibold text-[#37322F] align-bottom whitespace-nowrap">
											<span className="inline-flex items-center gap-1.5">
												<Timer className="h-4 w-4 shrink-0 text-[#605A57]" />
												Duration
											</span>
										</TableHead>
										<TableHead className="text-xs font-semibold text-[#37322F] align-bottom whitespace-nowrap">
											<span className="inline-flex items-center gap-1.5">
												<PhoneCall className="h-4 w-4 shrink-0 text-[#605A57]" />
												Call Status
											</span>
										</TableHead>
										<TableHead className="text-xs font-semibold text-[#37322F] align-bottom whitespace-nowrap">
											<span className="inline-flex items-center gap-1.5">
												<CircleDollarSign className="h-4 w-4 shrink-0 text-[#605A57]" />
												Lead Status
											</span>
										</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									<TableRow className="hover:bg-transparent border-0">
										<TableCell className="text-sm text-[#37322F] align-top min-w-[140px]">
											<div className="flex flex-col gap-0.5">
												<span className="font-medium">
													{call.from_name || "—"}
												</span>
												<span className="text-xs text-[#605A57]">
													{formatDisplayPhone(call.from_number)}
												</span>
											</div>
										</TableCell>
										<TableCell className="text-sm text-[#37322F] align-top min-w-[140px]">
											<div className="flex flex-col gap-0.5">
												<span className="font-medium">
													{call.to_name || "—"}
												</span>
												<span className="text-xs text-[#605A57]">
													{formatDisplayPhone(call.to_number)}
												</span>
											</div>
										</TableCell>
										<TableCell className="text-sm text-[#37322F] align-top whitespace-nowrap">
											{formatCallDate(call.start_time)}
										</TableCell>
										<TableCell className="text-sm text-[#37322F] align-top whitespace-nowrap">
											{formatCallTime(call.start_time)}
										</TableCell>
										<TableCell className="text-sm text-[#37322F] align-top whitespace-nowrap">
											{formatDuration(call.duration_sec)}
										</TableCell>
										<TableCell className="text-sm text-[#37322F] align-top capitalize whitespace-nowrap">
											{call.status ?? "—"}
										</TableCell>
										<TableCell className="align-top">
											<LeadStatusBadge status={call.lead_status} />
										</TableCell>
									</TableRow>
								</TableBody>
							</Table>
						</div>
					</div>

					<div className="md:col-span-2">
						<LeadPayloadPanel leadPayload={call.lead_payload} />
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
