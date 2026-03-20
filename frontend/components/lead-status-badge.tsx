import { cn } from "@/lib/utils";

type Props = {
	status: string | null;
	className?: string;
};

function humanizeStatus(status: string): string {
	return status
		.split("_")
		.map((w) => w.slice(0, 1).toUpperCase() + w.slice(1).toLowerCase())
		.join(" ");
}

/**
 * Lead status from API: pushed, not_a_lead, extracted, new, existing_customer, error, etc.
 */
export function LeadStatusBadge({ status, className }: Props) {
	if (status == null || status === "") {
		return (
			<span className={cn("text-[#605A57]", className)} title="No lead status yet">
				—
			</span>
		);
	}

	const key = status.toLowerCase();

	if (key === "pushed") {
		return (
			<span
				className={cn(
					"inline-flex items-center rounded-full border border-green-200 bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800",
					className
				)}
			>
				Lead Pushed
			</span>
		);
	}

	if (key === "not_a_lead") {
		return (
			<span
				className={cn(
					"inline-flex items-center rounded-full border border-red-200 bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800",
					className
				)}
			>
				Not a Lead
			</span>
		);
	}

	return (
		<span
			className={cn(
				"inline-flex items-center rounded-full border border-[#E0DEDB] bg-[#F4F3F1] px-2.5 py-0.5 text-xs font-medium text-[#37322F]",
				className
			)}
		>
			{humanizeStatus(status)}
		</span>
	);
}
