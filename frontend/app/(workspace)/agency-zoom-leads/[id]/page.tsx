"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { config } from "@/lib/config";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
	ArrowLeft,
	ScanSearch,
	User,
	MapPin,
	Phone,
	Mail,
	Calendar,
	Tag,
} from "lucide-react";

type AZLeadDetail = {
	id: string | number;
	// AZ API uses lowercase field names
	firstname?: string;
	lastname?: string;
	// Handle both casings
	firstName?: string;
	lastName?: string;
	fullName?: string;
	phone?: string;
	email?: string;
	streetAddress?: string;
	city?: string;
	state?: string;
	zip?: string;
	status?: string;
	lastEnterStageDate?: string;
	createdDate?: string;
	leadSourceName?: string; // AZ actual field name
	assignedTo?: { firstName?: string; lastName?: string; firstname?: string; lastname?: string; name?: string };
	notes?: string;
	[key: string]: unknown;
};

function Field({ label, value }: { label: string; value?: string | null }) {
	return (
		<div className="flex flex-col gap-0.5">
			<span className="text-xs font-medium text-[#605A57] uppercase tracking-wide">{label}</span>
			<span className="text-sm text-[#37322F]">{value || "—"}</span>
		</div>
	);
}

function formatDate(dateStr?: string) {
	if (!dateStr) return undefined;
	try {
		return new Date(dateStr).toLocaleDateString("en-US", {
			month: "long",
			day: "numeric",
			year: "numeric",
		});
	} catch {
		return dateStr;
	}
}

export default function AgencyZoomLeadDetailPage() {
	const { id } = useParams<{ id: string }>();
	const router = useRouter();
	const [lead, setLead] = useState<AZLeadDetail | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!id) return;
		async function load() {
			setLoading(true);
			setError(null);
			try {
				const res = await fetch(`${config.apiUrl}/api/agencyzoom/leads/${id}`);
				if (!res.ok) {
					const j = await res.json().catch(() => ({}));
					throw new Error(j.error || `HTTP ${res.status}`);
				}
				const json = await res.json();
				// AZ may return the lead directly or nested under `data`
				setLead((json.data ?? json) as AZLeadDetail);
			} catch (err: unknown) {
				setError(err instanceof Error ? err.message : "Failed to load lead");
			} finally {
				setLoading(false);
			}
		}
		load();
	}, [id]);

	const handleStartResearch = () => {
		if (!lead) return;
		const resFirst = lead.firstname || lead.firstName || "";
		const resLast = lead.lastname || lead.lastName || "";
		const name =
			lead.fullName ||
			[resFirst, resLast].filter(Boolean).join(" ") ||
			"";

		const params = new URLSearchParams();
		if (lead.streetAddress) params.set("address", lead.streetAddress);
		if (lead.city) params.set("city", lead.city);
		if (lead.state) params.set("state", lead.state);
		if (lead.zip) params.set("zip", lead.zip);
		if (name) params.set("leadName", name);
		params.set("agencyZoomLeadId", String(lead.id));

		router.push(`/research-agent?${params.toString()}`);
	};

	if (loading) {
		return (
			<div className="p-8 flex items-center justify-center text-sm text-[#605A57]">
				Loading lead...
			</div>
		);
	}

	if (error || !lead) {
		return (
			<div className="p-8">
				<div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
					{error || "Lead not found"}
				</div>
				<Button
					variant="ghost"
					className="mt-4 gap-2"
					onClick={() => router.push("/agency-zoom-leads")}
				>
					<ArrowLeft className="h-4 w-4" />
					Back to Leads
				</Button>
			</div>
		);
	}

	const first = lead.firstname || lead.firstName || "";
	const last = lead.lastname || lead.lastName || "";
	const name =
		lead.fullName ||
		[first, last].filter(Boolean).join(" ") ||
		"Unknown";

	const address = [lead.streetAddress, lead.city, lead.state, lead.zip]
		.filter(Boolean)
		.join(", ");

	const hasAddress = !!(lead.streetAddress && lead.city && lead.state);

	const leadSourceLabel = lead.leadSourceName || undefined;

	const assignedName =
		lead.assignedTo?.name ||
		[
			lead.assignedTo?.firstname || lead.assignedTo?.firstName,
			lead.assignedTo?.lastname || lead.assignedTo?.lastName,
		]
			.filter(Boolean)
			.join(" ") ||
		undefined;

	return (
		<div className="p-8">
			<div className="max-w-3xl mx-auto space-y-6">
				{/* Back + header */}
				<div className="flex items-start justify-between gap-4">
					<div className="flex items-start gap-3">
						<Button
							variant="ghost"
							size="sm"
							onClick={() => router.push("/agency-zoom-leads")}
							className="gap-1 -ml-2 mt-0.5"
						>
							<ArrowLeft className="h-4 w-4" />
							Leads
						</Button>
					</div>
				</div>

				<div className="flex items-start justify-between gap-4">
					<div>
						<h1 className="text-2xl font-semibold text-[#37322F]">{name}</h1>
						{!!lead.status && (
							<Badge variant="secondary" className="mt-1">
								{lead.status}
							</Badge>
						)}
					</div>
					<Button
						onClick={handleStartResearch}
						disabled={!hasAddress}
						className="gap-2 bg-[#37322F] hover:bg-[#605A57] text-white"
					>
						<ScanSearch className="h-4 w-4" />
						Start Research
					</Button>
				</div>

				{!hasAddress && (
					<div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
						This lead is missing address information. Research requires a full address.
					</div>
				)}

				{/* Contact info */}
				<div className="rounded-lg border border-[#E0DEDB] bg-white shadow-sm p-5 space-y-4">
					<h2 className="text-sm font-semibold text-[#37322F] flex items-center gap-2">
						<User className="h-4 w-4" />
						Contact Information
					</h2>
					<div className="grid grid-cols-2 gap-4">
						<Field label="First Name" value={first || undefined} />
						<Field label="Last Name" value={last || undefined} />
						<div className="flex flex-col gap-0.5">
							<span className="text-xs font-medium text-[#605A57] uppercase tracking-wide flex items-center gap-1">
								<Phone className="h-3 w-3" /> Phone
							</span>
							<span className="text-sm text-[#37322F]">{lead.phone || "—"}</span>
						</div>
						<div className="flex flex-col gap-0.5">
							<span className="text-xs font-medium text-[#605A57] uppercase tracking-wide flex items-center gap-1">
								<Mail className="h-3 w-3" /> Email
							</span>
							<span className="text-sm text-[#37322F]">{lead.email || "—"}</span>
						</div>
					</div>
				</div>

				{/* Property address */}
				<div className="rounded-lg border border-[#E0DEDB] bg-white shadow-sm p-5 space-y-4">
					<h2 className="text-sm font-semibold text-[#37322F] flex items-center gap-2">
						<MapPin className="h-4 w-4" />
						Property Address
					</h2>
					<div className="grid grid-cols-2 gap-4">
						<div className="col-span-2">
							<Field label="Street" value={lead.streetAddress} />
						</div>
						<Field label="City" value={lead.city} />
						<Field label="State" value={lead.state} />
						<Field label="ZIP" value={lead.zip} />
					</div>
					{address && (
						<p className="text-sm text-[#605A57] bg-[#F7F5F3] rounded px-3 py-2">
							{address}
						</p>
					)}
				</div>

				{/* Lead details */}
				<div className="rounded-lg border border-[#E0DEDB] bg-white shadow-sm p-5 space-y-4">
					<h2 className="text-sm font-semibold text-[#37322F] flex items-center gap-2">
						<Tag className="h-4 w-4" />
						Lead Details
					</h2>
					<div className="grid grid-cols-2 gap-4">
						<Field label="Lead Source" value={leadSourceLabel} />
						<Field label="Status" value={lead.status} />
						<div className="flex flex-col gap-0.5">
							<span className="text-xs font-medium text-[#605A57] uppercase tracking-wide flex items-center gap-1">
								<Calendar className="h-3 w-3" /> Last Activity
							</span>
							<span className="text-sm text-[#37322F]">
								{formatDate(lead.lastEnterStageDate) || "—"}
							</span>
						</div>
						<div className="flex flex-col gap-0.5">
							<span className="text-xs font-medium text-[#605A57] uppercase tracking-wide flex items-center gap-1">
								<Calendar className="h-3 w-3" /> Created
							</span>
							<span className="text-sm text-[#37322F]">
								{formatDate(lead.createdDate) || "—"}
							</span>
						</div>
						<Field label="Assigned To" value={assignedName} />
						<Field label="Lead ID" value={String(lead.id)} />
					</div>
					{lead.notes && (
						<div className="flex flex-col gap-0.5">
							<span className="text-xs font-medium text-[#605A57] uppercase tracking-wide">Notes</span>
							<p className="text-sm text-[#37322F] whitespace-pre-wrap bg-[#F7F5F3] rounded px-3 py-2">
								{lead.notes}
							</p>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
