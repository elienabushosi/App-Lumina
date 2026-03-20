import Link from "next/link";
import { config } from "@/lib/config";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";

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

async function fetchCalls(): Promise<CallRow[]> {
	const res = await fetch(`${config.apiUrl}/api/calls`, {
		// Server-side fetch; no cache to keep it fresh.
		cache: "no-store",
	});
	if (!res.ok) {
		return [];
	}
	const json = await res.json();
	return json.items ?? [];
}

export default async function CallsPage() {
	const calls = await fetchCalls();

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
								<TableHead>From</TableHead>
								<TableHead>To</TableHead>
								<TableHead>Date</TableHead>
								<TableHead>Time</TableHead>
								<TableHead>Duration (mm:ss)</TableHead>
								<TableHead>Call Status</TableHead>
								<TableHead>Lead Status</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{calls.length === 0 ? (
								<TableRow>
									<TableCell colSpan={7} className="text-center text-sm">
										No calls found yet.
									</TableCell>
								</TableRow>
							) : (
								calls.map((call) => (
									<TableRow key={call.id}>
										<TableCell>
											<div className="flex flex-col">
												<span>{call.from_name || "—"}</span>
												<span className="text-xs text-[#605A57]">
													{call.from_number || "—"}
												</span>
											</div>
										</TableCell>
										<TableCell>
											<div className="flex flex-col">
												<span>{call.to_name || "—"}</span>
												<span className="text-xs text-[#605A57]">
													{call.to_number || "—"}
												</span>
											</div>
										</TableCell>
										<TableCell>
											<Link
												href={`/calls/${call.id}`}
												className="text-[#1F2937] hover:underline"
											>
												{formatCallDate(call.start_time)}
											</Link>
										</TableCell>
										<TableCell>
											<Link
												href={`/calls/${call.id}`}
												className="text-[#1F2937] hover:underline"
											>
												{formatCallTime(call.start_time)}
											</Link>
										</TableCell>
										<TableCell>
											{formatDuration(call.duration_sec)}
										</TableCell>
										<TableCell className="capitalize">
											{call.status ?? "—"}
										</TableCell>
										<TableCell className="capitalize">
											{call.lead_status ?? "—"}
										</TableCell>
									</TableRow>
								))
							)}
						</TableBody>
					</Table>
				</div>
			</div>
		</div>
	);
}

