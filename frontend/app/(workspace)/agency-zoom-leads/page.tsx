"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, User, MapPin, Phone, Mail, ExternalLink } from "lucide-react";

type AZLead = {
	id: string | number;
	// AZ API returns lowercase field names
	firstname?: string;
	lastname?: string;
	// Some AZ responses use camelCase — handle both
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
	leadSourceName?: string; // AZ actual field name
};

function formatDate(dateStr?: string) {
	if (!dateStr) return "—";
	try {
		return new Date(dateStr).toLocaleDateString("en-US", {
			month: "short",
			day: "numeric",
			year: "numeric",
		});
	} catch {
		return dateStr;
	}
}

function statusColor(status?: string) {
	if (!status) return "secondary";
	const s = status.toLowerCase();
	if (s.includes("new") || s.includes("active")) return "default";
	if (s.includes("closed") || s.includes("lost")) return "destructive";
	return "secondary";
}

export default function AgencyZoomLeadsPage() {
	const router = useRouter();
	const [leads, setLeads] = useState<AZLead[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

	const fetchLeads = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const token = getAuthToken();
			const res = await fetch(`${config.apiUrl}/api/agencyzoom/leads/list`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					...(token ? { Authorization: `Bearer ${token}` } : {}),
				},
				body: JSON.stringify({ pageSize: 50, sort: "lastEnterStageDate", order: "desc" }),
			});
			if (!res.ok) {
				const j = await res.json().catch(() => ({}));
				throw new Error(j.error || `HTTP ${res.status}`);
			}
			const json = await res.json();
			// AZ returns { data: [...] } or { leads: [...] } depending on version
			const items: AZLead[] = json.data ?? json.leads ?? json ?? [];
			setLeads(Array.isArray(items) ? items : []);
			setLastRefreshed(new Date());
		} catch (err: unknown) {
			setError(err instanceof Error ? err.message : "Failed to load leads");
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchLeads();
	}, [fetchLeads]);

	const handleRowClick = (lead: AZLead) => {
		router.push(`/agency-zoom-leads/${lead.id}`);
	};

	return (
		<div className="p-8">
			<div className="max-w-6xl mx-auto space-y-4">
				<div className="flex items-start justify-between">
					<div>
						<h1 className="text-2xl font-semibold text-[#37322F]">
							Agency Zoom Leads
						</h1>
						<p className="text-sm text-[#605A57] mt-1">
							Internet leads that landed directly in Agency Zoom. Click a lead to view details and start a research report.
						</p>
					</div>
					<div className="flex items-center gap-3">
						{lastRefreshed && (
							<span className="text-xs text-[#605A57]">
								Last refreshed {lastRefreshed.toLocaleTimeString()}
							</span>
						)}
						<Button
							variant="outline"
							size="sm"
							onClick={fetchLeads}
							disabled={loading}
							className="gap-2"
						>
							<RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
							{loading ? "Refreshing..." : "Refresh"}
						</Button>
					</div>
				</div>

				{error && (
					<div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
						{error}
					</div>
				)}

				<div className="rounded-lg border border-[#E0DEDB] bg-white shadow-sm">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>
									<User className="h-4 w-4 inline-block mr-2" />
									Name
								</TableHead>
								<TableHead>Source</TableHead>
								<TableHead>
									<MapPin className="h-4 w-4 inline-block mr-2" />
									Address
								</TableHead>
								<TableHead>
									<Phone className="h-4 w-4 inline-block mr-2" />
									Phone
								</TableHead>
								<TableHead>
									<Mail className="h-4 w-4 inline-block mr-2" />
									Email
								</TableHead>
								<TableHead>Status</TableHead>
								<TableHead>Last Activity</TableHead>
								<TableHead />
							</TableRow>
						</TableHeader>
						<TableBody>
							{loading && leads.length === 0 ? (
								<TableRow>
									<TableCell colSpan={8} className="text-center py-10 text-sm text-[#605A57]">
										Loading leads...
									</TableCell>
								</TableRow>
							) : leads.length === 0 ? (
								<TableRow>
									<TableCell colSpan={8} className="text-center py-10 text-sm text-[#605A57]">
										No leads found. Check your Agency Zoom connection in Settings.
									</TableCell>
								</TableRow>
							) : (
								leads.map((lead) => {
									const first = lead.firstname || lead.firstName || "";
									const last = lead.lastname || lead.lastName || "";
									const name =
										lead.fullName ||
										[first, last].filter(Boolean).join(" ") ||
										"Unknown";
									const address = [lead.streetAddress, lead.city, lead.state]
										.filter(Boolean)
										.join(", ");
									const leadSourceLabel = lead.leadSourceName || "—";

									return (
										<TableRow
											key={lead.id}
											className="cursor-pointer hover:bg-[#F7F5F3]"
											onClick={() => handleRowClick(lead)}
										>
											<TableCell className="font-medium">{name}</TableCell>
											<TableCell className="text-sm text-[#605A57]">
												{leadSourceLabel}
											</TableCell>
											<TableCell className="text-sm text-[#605A57]">
												{address || "—"}
											</TableCell>
											<TableCell className="text-sm">{lead.phone || "—"}</TableCell>
											<TableCell className="text-sm text-[#605A57] truncate max-w-[180px]">
												{lead.email || "—"}
											</TableCell>
											<TableCell>
												{!!lead.status ? (
													<Badge variant={statusColor(lead.status) as "default" | "secondary" | "destructive"}>
														{lead.status}
													</Badge>
												) : "—"}
											</TableCell>
											<TableCell className="text-sm text-[#605A57]">
												{formatDate(lead.lastEnterStageDate)}
											</TableCell>
											<TableCell>
												<ExternalLink className="h-4 w-4 text-[#605A57]" />
											</TableCell>
										</TableRow>
									);
								})
							)}
						</TableBody>
					</Table>
				</div>

				{leads.length > 0 && (
					<p className="text-xs text-[#605A57]">
						Showing {leads.length} lead{leads.length !== 1 ? "s" : ""}. Agency Zoom does not support live webhooks — use Refresh to pull the latest.
					</p>
				)}
			</div>
		</div>
	);
}
