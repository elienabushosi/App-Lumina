"use client";

import { useRouter } from "next/navigation";
import { TableCell, TableRow } from "@/components/ui/table";
import { LeadStatusBadge } from "@/components/lead-status-badge";

export type ClickableCallRowProps = {
	callId: string;
	fromName: string;
	fromPhoneDisplay: string;
	toName: string;
	toPhoneDisplay: string;
	dateLabel: string;
	timeLabel: string;
	durationLabel: string;
	status: string;
	leadStatus: string | null;
};

export function ClickableCallRow({
	callId,
	fromName,
	fromPhoneDisplay,
	toName,
	toPhoneDisplay,
	dateLabel,
	timeLabel,
	durationLabel,
	status,
	leadStatus,
}: ClickableCallRowProps) {
	const router = useRouter();
	const href = `/calls/${callId}`;

	function go() {
		router.push(href);
	}

	return (
		<TableRow
			role="link"
			tabIndex={0}
			aria-label={`Open call details for ${dateLabel} ${timeLabel}`}
			className="cursor-pointer hover:bg-[#F9F8F6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#37322F]/20 focus-visible:ring-inset"
			onClick={go}
			onKeyDown={(e) => {
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					go();
				}
			}}
		>
			<TableCell>
				<div className="flex flex-col">
					<span>{fromName}</span>
					<span className="text-xs text-[#605A57]">{fromPhoneDisplay}</span>
				</div>
			</TableCell>
			<TableCell>
				<div className="flex flex-col">
					<span>{toName}</span>
					<span className="text-xs text-[#605A57]">{toPhoneDisplay}</span>
				</div>
			</TableCell>
			<TableCell className="text-[#1F2937]">{dateLabel}</TableCell>
			<TableCell className="text-[#1F2937]">{timeLabel}</TableCell>
			<TableCell>{durationLabel}</TableCell>
			<TableCell className="capitalize">{status}</TableCell>
			<TableCell>
				<LeadStatusBadge status={leadStatus} />
			</TableCell>
		</TableRow>
	);
}
