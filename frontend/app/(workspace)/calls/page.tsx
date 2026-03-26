"use client";

import { useEffect, useState } from "react";
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
import { ClickableCallRow } from "@/components/calls-table-row";
import { formatDisplayPhone } from "@/lib/format-phone";
import {
	formatCallDate,
	formatCallTime,
	formatDuration,
} from "@/lib/format-call";
import {
	CalendarDays,
	CircleDollarSign,
	Clock4,
	PhoneCall,
	PhoneIncoming,
	PhoneOutgoing,
	Timer,
} from "lucide-react";

type CallRow = {
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
};

export default function CallsPage() {
	const [calls, setCalls] = useState<CallRow[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		const fetchCalls = async () => {
			try {
				const token = getAuthToken();
				const res = await fetch(`${config.apiUrl}/api/calls`, {
					headers: token ? { Authorization: `Bearer ${token}` } : {},
					cache: "no-store",
				});
				if (!res.ok) {
					setCalls([]);
					return;
				}
				const json = await res.json();
				setCalls(json.items ?? []);
			} catch {
				setCalls([]);
			} finally {
				setLoading(false);
			}
		};

		fetchCalls();
	}, []);

	return (
		<div className="p-8">
			<div className="max-w-5xl mx-auto space-y-4">
				<div>
					<h1 className="text-2xl font-semibold text-[#37322F]">
						Call Listener
					</h1>
					<p className="text-sm text-[#605A57] mt-1">
						Recent RingCentral calls processed by Lumina, with transcription and
						lead extraction status.
					</p>
				</div>
				<div className="rounded-lg border border-[#E0DEDB] bg-white shadow-sm">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>
									<PhoneOutgoing className="h-4 w-4 inline-block mr-2" />
									From
								</TableHead>
								<TableHead>
									<PhoneIncoming className="h-4 w-4 inline-block mr-2" />
									To
								</TableHead>
								<TableHead>
									<CalendarDays className="h-4 w-4 inline-block mr-2" />
									Date
								</TableHead>
								<TableHead>
									<Clock4 className="h-4 w-4 inline-block mr-2" />
									Time
								</TableHead>
								<TableHead>
									<Timer className="h-4 w-4 inline-block mr-2" />
									Duration
								</TableHead>
								<TableHead>
									<PhoneCall className="h-4 w-4 inline-block mr-2" />
									Call Status
								</TableHead>
								<TableHead>
									<CircleDollarSign className="h-4 w-4 inline-block mr-2" />
									Lead Status
								</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{loading ? (
								<TableRow>
									<TableCell colSpan={7} className="text-center text-sm text-[#605A57]">
										Loading calls...
									</TableCell>
								</TableRow>
							) : calls.length === 0 ? (
								<TableRow>
									<TableCell colSpan={7} className="text-center text-sm">
										No calls found yet.
									</TableCell>
								</TableRow>
							) : (
								calls.map((call) => (
									<ClickableCallRow
										key={call.id}
										callId={call.id}
										fromName={call.from_name || "—"}
										fromPhoneDisplay={formatDisplayPhone(call.from_number)}
										toName={call.to_name || "—"}
										toPhoneDisplay={formatDisplayPhone(call.to_number)}
										dateLabel={formatCallDate(call.start_time)}
										timeLabel={formatCallTime(call.start_time)}
										durationLabel={formatDuration(call.duration_sec)}
										status={call.status ?? "—"}
										leadStatus={call.lead_status}
									/>
								))
							)}
						</TableBody>
					</Table>
				</div>
			</div>
		</div>
	);
}
