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
	start_time: string | null;
	duration_sec: number | null;
	status: string;
	lead_status: string | null;
};

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
								<TableHead>Date / Time</TableHead>
								<TableHead>From</TableHead>
								<TableHead>To</TableHead>
								<TableHead>Duration (s)</TableHead>
								<TableHead>Call Status</TableHead>
								<TableHead>Lead Status</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{calls.length === 0 ? (
								<TableRow>
									<TableCell colSpan={6} className="text-center text-sm">
										No calls found yet.
									</TableCell>
								</TableRow>
							) : (
								calls.map((call) => (
									<TableRow key={call.id}>
										<TableCell>
											<Link
												href={`/calls/${call.id}`}
												className="text-[#1F2937] hover:underline"
											>
												{call.start_time
													? new Date(call.start_time).toLocaleString()
													: "—"}
											</Link>
										</TableCell>
										<TableCell>{call.from_number || "—"}</TableCell>
										<TableCell>{call.to_number || "—"}</TableCell>
										<TableCell>{call.duration_sec ?? "—"}</TableCell>
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

