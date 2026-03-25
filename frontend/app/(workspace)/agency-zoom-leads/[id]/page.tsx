"use client";

import { useEffect, useState } from "react";
import { getAuthToken } from "@/lib/auth";
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
	Home,
	Trees,
	Sofa,
} from "lucide-react";

type ResearchReport = {
	agencyZoomLeadId: string | null;
	address: string | null;
	city: string | null;
	state: string | null;
	zip: string | null;
	leadName: string | null;
	cad: {
		propertyType?: string;
		yearBuilt?: number;
		livingAreaSqft?: number;
		attachedGarageSqft?: number;
		stories?: number;
		storyClassification?: string;
		storyRatioPercent?: number;
		upperFloorSqft?: number;
		firstFloorSqft?: number;
		foundationType?: string;
		exteriorWallType?: string;
		roofCover?: string;
	} | null;
	maps: {
		roofStyle: string;
		poolVisible: boolean;
		solarPanelsVisible: boolean;
		trampolineVisible: boolean;
	} | null;
	realtor: {
		flooring?: string[];
		hasFireplace?: boolean;
		bathroomCount?: number;
		interiorAnalysis?: { kitchenFinishes?: string; interiorCondition?: string };
	} | null;
	status: "in_progress" | "research_complete";
};

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
			<span className="text-xs font-medium text-[#605A57] tracking-wide">{label}</span>
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
	const [researchReport, setResearchReport] = useState<ResearchReport | null>(null);

	// Load research report from backend
	useEffect(() => {
		if (!id) return;
		async function loadReport() {
			try {
				const res = await fetch(
					`${config.apiUrl}/api/research-reports?agencyZoomLeadId=${id}`,
					{ headers: { Authorization: `Bearer ${getAuthToken()}` } },
				);
				if (!res.ok) return;
				const data = await res.json();
				setResearchReport({
					agencyZoomLeadId: data.agency_zoom_lead_id,
					address: data.address,
					city: data.city,
					state: data.state,
					zip: data.zip,
					leadName: [data.lead_first_name, data.lead_last_name].filter(Boolean).join(" ") || null,
					cad: data.cad_data,
					maps: data.maps_data,
					realtor: data.realtor_data,
					status: data.status,
				});
			} catch {
				// non-blocking
			}
		}
		loadReport();
	}, [id]);

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
		if (lead.phone) params.set("leadPhone", lead.phone);
		if (lead.email) params.set("leadEmail", lead.email);
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
						{researchReport ? "Refresh Research" : "Start Research"}
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
							<span className="text-xs font-medium text-[#605A57] tracking-wide flex items-center gap-1">
								<Phone className="h-3 w-3" /> Phone
							</span>
							<span className="text-sm text-[#37322F]">{lead.phone || "—"}</span>
						</div>
						<div className="flex flex-col gap-0.5">
							<span className="text-xs font-medium text-[#605A57] tracking-wide flex items-center gap-1">
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
							<span className="text-xs font-medium text-[#605A57] tracking-wide flex items-center gap-1">
								<Calendar className="h-3 w-3" /> Last Activity
							</span>
							<span className="text-sm text-[#37322F]">
								{formatDate(lead.lastEnterStageDate) || "—"}
							</span>
						</div>
						<div className="flex flex-col gap-0.5">
							<span className="text-xs font-medium text-[#605A57] tracking-wide flex items-center gap-1">
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
							<span className="text-xs font-medium text-[#605A57] tracking-wide">Notes</span>
							<p className="text-sm text-[#37322F] whitespace-pre-wrap bg-[#F7F5F3] rounded px-3 py-2">
								{lead.notes}
							</p>
						</div>
					)}
				</div>

				{/* Research Report */}
				{researchReport && (
					<div className="rounded-lg border border-[#E0DEDB] bg-white shadow-sm p-5 space-y-5">
						<div className="flex items-center justify-between">
							<h2 className="text-sm font-semibold text-[#37322F] flex items-center gap-2">
								<ScanSearch className="h-4 w-4" />
								Research Report
							</h2>
							<span className={`text-xs px-2 py-0.5 rounded-full font-medium ${researchReport.status === "research_complete" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
								{researchReport.status === "research_complete" ? "Complete" : "In progress"}
							</span>
						</div>

						<div className="space-y-4 text-sm">
							{/* Property summary */}
							<div className="space-y-2 border border-[rgba(55,50,47,0.08)] rounded-lg p-4">
								<div className="flex items-center gap-2 mb-2">
									<div className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#6C70BA]/10 text-[#6C70BA]">
										<Home className="w-3.5 h-3.5" />
									</div>
									<h3 className="text-xs font-semibold uppercase tracking-wide text-[#605A57]">Property summary</h3>
								</div>
								<table className="w-full text-sm">
									<tbody>
										<tr className="border-b border-[rgba(55,50,47,0.08)]">
											<td className="py-2 pl-3 text-[#605A57]">Type</td>
											<td className="py-2 pr-3 text-right font-medium text-[#37322F]">{researchReport.cad?.propertyType ?? "—"}</td>
										</tr>
										<tr className="border-b border-[rgba(55,50,47,0.08)]">
											<td className="py-2 pl-3 text-[#605A57]">Year built</td>
											<td className="py-2 pr-3 text-right font-medium text-[#37322F]">{researchReport.cad?.yearBuilt ?? "—"}</td>
										</tr>
										<tr className="border-b border-[rgba(55,50,47,0.08)]">
											<td className="py-2 pl-3 text-[#605A57]">Living area</td>
											<td className="py-2 pr-3 text-right font-medium text-[#37322F]">{researchReport.cad?.livingAreaSqft ? `${researchReport.cad.livingAreaSqft.toLocaleString()} sq ft` : "—"}</td>
										</tr>
										<tr className="border-b border-[rgba(55,50,47,0.08)]">
											<td className="py-2 pl-3 text-[#605A57]">Attached garage</td>
											<td className="py-2 pr-3 text-right font-medium text-[#37322F]">{researchReport.cad?.attachedGarageSqft ? `${researchReport.cad.attachedGarageSqft.toLocaleString()} sq ft` : "—"}</td>
										</tr>
										{!!researchReport.realtor?.bathroomCount && (
											<tr>
												<td className="py-2 pl-3 text-[#605A57]">Bathrooms</td>
												<td className="py-2 pr-3 text-right font-medium text-[#37322F]">{researchReport.realtor.bathroomCount}</td>
											</tr>
										)}
									</tbody>
								</table>
							</div>

							{/* Exterior & site */}
							<div className="space-y-2 border border-[rgba(55,50,47,0.08)] rounded-lg p-4">
								<div className="flex items-center gap-2 mb-2">
									<div className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#6C70BA]/10 text-[#6C70BA]">
										<Trees className="w-3.5 h-3.5" />
									</div>
									<h3 className="text-xs font-semibold uppercase tracking-wide text-[#605A57]">Exterior &amp; site</h3>
								</div>
								<table className="w-full text-sm">
									<tbody>
										<tr className="border-b border-[rgba(55,50,47,0.08)]">
											<td className="py-2 pl-3 text-[#605A57]">Stories</td>
											<td className="py-2 pr-3 text-right font-medium text-[#37322F]">
												{researchReport.cad?.storyClassification ?? researchReport.cad?.stories ?? "—"}
												{researchReport.cad?.storyRatioPercent != null && researchReport.cad?.upperFloorSqft != null && researchReport.cad?.firstFloorSqft != null && (
													<div className="text-xs font-normal text-[#8A8480] mt-0.5">
														2nd floor is {researchReport.cad.storyRatioPercent}% of 1st floor ({researchReport.cad.upperFloorSqft.toLocaleString()} / {researchReport.cad.firstFloorSqft.toLocaleString()} sq ft)
													</div>
												)}
											</td>
										</tr>
										<tr className="border-b border-[rgba(55,50,47,0.08)]">
											<td className="py-2 pl-3 text-[#605A57]">Foundation</td>
											<td className="py-2 pr-3 text-right font-medium text-[#37322F]">{researchReport.cad?.foundationType ?? "—"}</td>
										</tr>
										<tr className="border-b border-[rgba(55,50,47,0.08)]">
											<td className="py-2 pl-3 text-[#605A57]">Exterior wall</td>
											<td className="py-2 pr-3 text-right font-medium text-[#37322F]">{researchReport.cad?.exteriorWallType ?? "—"}</td>
										</tr>
										<tr className="border-b border-[rgba(55,50,47,0.08)]">
											<td className="py-2 pl-3 text-[#605A57]">Roof cover</td>
											<td className="py-2 pr-3 text-right font-medium text-[#37322F]">{researchReport.cad?.roofCover ?? "—"}</td>
										</tr>
										<tr className="border-b border-[rgba(55,50,47,0.08)]">
											<td className="py-2 pl-3 text-[#605A57]">Roof style</td>
											<td className="py-2 pr-3 text-right font-medium text-[#37322F]">{researchReport.maps?.roofStyle ?? "—"}</td>
										</tr>
										<tr className="border-b border-[rgba(55,50,47,0.08)]">
											<td className="py-2 pl-3 text-[#605A57]">Solar panels</td>
											<td className="py-2 pr-3 text-right font-medium text-[#37322F]">{researchReport.maps ? (researchReport.maps.solarPanelsVisible ? "Visible" : "None visible") : "—"}</td>
										</tr>
										<tr className="border-b border-[rgba(55,50,47,0.08)]">
											<td className="py-2 pl-3 text-[#605A57]">Trampoline</td>
											<td className="py-2 pr-3 text-right font-medium text-[#37322F]">{researchReport.maps ? (researchReport.maps.trampolineVisible ? "Visible" : "None visible") : "—"}</td>
										</tr>
										<tr>
											<td className="py-2 pl-3 text-[#605A57]">Swimming pool</td>
											<td className="py-2 pr-3 text-right font-medium text-[#37322F]">{researchReport.maps ? (researchReport.maps.poolVisible ? "Visible" : "None visible") : "—"}</td>
										</tr>
									</tbody>
								</table>
							</div>

							{/* Interior */}
							<div className="space-y-2 border border-[rgba(55,50,47,0.08)] rounded-lg p-4">
								<div className="flex items-center gap-2 mb-2">
									<div className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#6C70BA]/10 text-[#6C70BA]">
										<Sofa className="w-3.5 h-3.5" />
									</div>
									<h3 className="text-xs font-semibold uppercase tracking-wide text-[#605A57]">Interior finishes &amp; quality</h3>
								</div>
								<table className="w-full text-sm">
									<tbody>
										<tr className="border-b border-[rgba(55,50,47,0.08)]">
											<td className="py-2 pl-3 text-[#605A57]">Flooring</td>
											<td className="py-2 pr-3 text-right font-medium text-[#37322F]">{researchReport.realtor?.flooring?.length ? researchReport.realtor.flooring.join(", ") : "—"}</td>
										</tr>
										<tr className="border-b border-[rgba(55,50,47,0.08)]">
											<td className="py-2 pl-3 text-[#605A57]">Fireplace</td>
											<td className="py-2 pr-3 text-right font-medium text-[#37322F]">{researchReport.realtor?.hasFireplace != null ? (researchReport.realtor.hasFireplace ? "Yes" : "None") : "—"}</td>
										</tr>
										<tr className="border-b border-[rgba(55,50,47,0.08)]">
											<td className="py-2 pl-3 text-[#605A57]">Kitchen finishes</td>
											<td className="py-2 pr-3 text-right font-medium text-[#37322F]">{researchReport.realtor?.interiorAnalysis?.kitchenFinishes ?? "—"}</td>
										</tr>
										<tr>
											<td className="py-2 pl-3 text-[#605A57]">Interior condition</td>
											<td className="py-2 pr-3 text-right font-medium text-[#37322F]">{researchReport.realtor?.interiorAnalysis?.interiorCondition ?? "—"}</td>
										</tr>
									</tbody>
								</table>
							</div>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
