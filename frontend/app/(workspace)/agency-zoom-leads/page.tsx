"use client";

import { useEffect, useState, useCallback, Component, ReactNode } from "react";
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
import { RefreshCw, User, MapPin, Phone, Mail, ExternalLink, Download } from "lucide-react";

class LeadsErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
	constructor(props: { children: ReactNode }) {
		super(props);
		this.state = { hasError: false };
	}
	static getDerivedStateFromError() {
		return { hasError: true };
	}
	render() {
		if (this.state.hasError) {
			return (
				<div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
					Something went wrong displaying leads. Please refresh the page.
				</div>
			);
		}
		return this.props.children;
	}
}

// Normalized lead shape — backend maps all AZ field variants to these names.
type AZLead = {
	id: string;
	firstName?: string | null;
	lastName?: string | null;
	phone?: string | null;
	email?: string | null;
	streetAddress?: string | null;
	city?: string | null;
	state?: string | null;
	zip?: string | null;
	status?: string | null;
	lastStageDate?: string | null;
	leadSource?: string | null;
	assignedTo?: string | null;
	locationCode?: string | null;
	workflowId?: string | null;
};

function formatDate(dateStr?: string | null) {
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

function formatDateTime(dateStr?: string | null) {
	if (!dateStr) return "—";
	try {
		return new Date(dateStr).toLocaleString("en-US", {
			month: "short",
			day: "numeric",
			hour: "numeric",
			minute: "2-digit",
		});
	} catch {
		return dateStr;
	}
}

function statusColor(status?: string | number | null) {
	if (status == null || status === "") return "secondary";
	const s = String(status).toLowerCase();
	if (s.includes("new") || s.includes("active")) return "default";
	if (s.includes("closed") || s.includes("lost")) return "destructive";
	return "secondary";
}

export default function AgencyZoomLeadsPage() {
	const router = useRouter();
	const [leads, setLeads] = useState<AZLead[]>([]);
	const [loading, setLoading] = useState(false);
	const [pulling, setPulling] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [notConnected, setNotConnected] = useState(false);
	const [lastPulled, setLastPulled] = useState<string | null>(null);
	const [neverPulled, setNeverPulled] = useState(false);

	const headers = useCallback(() => {
		const token = getAuthToken();
		return token ? { Authorization: `Bearer ${token}` } : {};
	}, []);

	// Load stored leads from Supabase — no AZ call
	const loadLeads = useCallback(async () => {
		setLoading(true);
		setError(null);
		setNotConnected(false);
		try {
			const res = await fetch(`${config.apiUrl}/api/agencyzoom/leads`, {
				headers: headers(),
			});
			if (!res.ok) {
				const j = await res.json().catch(() => ({}));
				if (j.error === "not_connected") { setNotConnected(true); return; }
				throw new Error(j.error || `HTTP ${res.status}`);
			}
			const json = await res.json();
			const items: AZLead[] = json.leads ?? [];
			setLeads(items);
			setLastPulled(json.lastPulled ?? null);
			setNeverPulled(items.length === 0 && !json.lastPulled);
		} catch (err: unknown) {
			setError(err instanceof Error ? err.message : "Failed to load leads");
		} finally {
			setLoading(false);
		}
	}, [headers]);

	// Pull fresh leads from AZ → upsert to Supabase → reload
	const pullLeads = useCallback(async () => {
		setPulling(true);
		setError(null);
		try {
			const res = await fetch(`${config.apiUrl}/api/agencyzoom/leads/pull`, {
				method: "POST",
				headers: { "Content-Type": "application/json", ...headers() },
			});
			if (!res.ok) {
				const j = await res.json().catch(() => ({}));
				if (j.error === "not_connected") { setNotConnected(true); return; }
				throw new Error(j.error || `HTTP ${res.status}`);
			}
			// Reload from DB after pull
			await loadLeads();
		} catch (err: unknown) {
			setError(err instanceof Error ? err.message : "Failed to pull leads");
		} finally {
			setPulling(false);
		}
	}, [headers, loadLeads]);

	useEffect(() => {
		loadLeads();
	}, [loadLeads]);

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
						{lastPulled && (
							<span className="text-xs text-[#605A57]">
								Last pulled {formatDateTime(lastPulled)}
							</span>
						)}
						<Button
							variant="outline"
							size="sm"
							onClick={pullLeads}
							disabled={pulling || loading}
							className="gap-2"
						>
							<Download className={`h-4 w-4 ${pulling ? "animate-pulse" : ""}`} />
							{pulling ? "Pulling..." : "Pull Leads"}
						</Button>
					</div>
				</div>

				{error && (
					<div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
						{error}
					</div>
				)}

				{/* Empty state — not connected or never pulled */}
				{(notConnected || (neverPulled && !loading)) && (
					<div className="rounded-lg border border-[#E0DEDB] bg-white px-6 py-16 text-center shadow-sm">
						<img
							src="/AgencyZoom-removebg-preview.png"
							alt="AgencyZoom"
							className="h-10 mx-auto mb-4 opacity-80"
						/>
						{notConnected ? (
							<>
								<p className="text-sm font-medium text-[#37322F]">Connect to AgencyZoom</p>
								<p className="text-sm text-[#605A57] mt-1 mb-5">
									Connect your AgencyZoom account in Settings to start viewing and managing your leads.
								</p>
								<Button variant="outline" size="sm" onClick={() => router.push("/settings")}>
									Go to Settings
								</Button>
							</>
						) : (
							<>
								<p className="text-sm font-medium text-[#37322F]">No leads yet</p>
								<p className="text-sm text-[#605A57] mt-1 mb-5">
									Pull your leads from AgencyZoom to get started.
								</p>
								<Button onClick={pullLeads} disabled={pulling} className="gap-2">
									<Download className="h-4 w-4" />
									{pulling ? "Pulling leads..." : "Pull leads from AgencyZoom"}
								</Button>
							</>
						)}
					</div>
				)}

				{/* Leads table */}
				{!neverPulled && !notConnected && (
					<LeadsErrorBoundary>
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
									{loading ? (
										<TableRow>
											<TableCell colSpan={8} className="text-center py-10 text-sm text-[#605A57]">
												Loading leads...
											</TableCell>
										</TableRow>
									) : leads.length === 0 ? (
										<TableRow>
											<TableCell colSpan={8} className="text-center py-10 text-sm text-[#605A57]">
												No leads found. Pull latest leads from AgencyZoom.
											</TableCell>
										</TableRow>
									) : (
										leads.map((lead) => {
											const name =
												[lead.firstName, lead.lastName].filter(Boolean).join(" ") ||
												"Unknown";
											const address = [lead.streetAddress, lead.city, lead.state]
												.filter(Boolean)
												.join(", ");

											return (
												<TableRow
													key={lead.id}
													className="cursor-pointer hover:bg-[#F7F5F3]"
													onClick={() => handleRowClick(lead)}
												>
													<TableCell className="font-medium">{name}</TableCell>
													<TableCell className="text-sm text-[#605A57]">
														{lead.leadSource || "—"}
													</TableCell>
													<TableCell className="text-sm text-[#605A57]">
														{address || "—"}
													</TableCell>
													<TableCell className="text-sm">{lead.phone || "—"}</TableCell>
													<TableCell className="text-sm text-[#605A57] truncate max-w-[180px]">
														{lead.email || "—"}
													</TableCell>
													<TableCell>
														{lead.status ? (
															<Badge variant={statusColor(lead.status) as "default" | "secondary" | "destructive"}>
																{String(lead.status)}
															</Badge>
														) : "—"}
													</TableCell>
													<TableCell className="text-sm text-[#605A57]">
														{formatDate(lead.lastStageDate)}
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
								Showing {leads.length} lead{leads.length !== 1 ? "s" : ""}. Use Pull Leads to sync the latest from AgencyZoom.
							</p>
						)}
					</LeadsErrorBoundary>
				)}
			</div>
		</div>
	);
}
