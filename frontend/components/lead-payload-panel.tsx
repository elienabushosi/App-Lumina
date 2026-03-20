"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { formatDisplayPhone } from "@/lib/format-phone";
import { ClipboardList, FileText } from "lucide-react";

type Props = {
	leadPayload: unknown;
};

function displayScalar(v: unknown): string {
	if (v == null || v === "") return "—";
	if (typeof v === "boolean") return v ? "Yes" : "No";
	if (typeof v === "number" && Number.isFinite(v)) return String(v);
	if (typeof v === "string") return v.trim() || "—";
	return "—";
}

function FormRow({
	label,
	value,
}: {
	label: string;
	value: React.ReactNode;
}) {
	return (
		<div className="grid grid-cols-1 sm:grid-cols-[minmax(10rem,32%)_1fr] gap-1 sm:gap-4 py-2.5 border-b border-[#E8E6E3] last:border-b-0">
			<div className="text-xs font-semibold text-[#605A57]">{label}</div>
			<div className="text-sm text-[#37322F] wrap-break-word min-h-5">
				{value ?? "—"}
			</div>
		</div>
	);
}

function LeadFormView({ payload }: { payload: any }) {
	const lead = payload?.lead;
	if (!lead || typeof lead !== "object") {
		return (
			<p className="text-sm text-[#605A57] leading-relaxed">
				No lead data yet. Run <strong>Extract Lead</strong> after transcription.
			</p>
		);
	}

	const name = lead.name || {};
	const contact = lead.contact || {};
	const address = lead.address || {};
	const property = lead.property || {};
	const insurance = lead.insurance || {};
	const intent = lead.intent || {};
	const meta = lead.meta || {};

	const vehicles = Array.isArray(insurance.vehicles) ? insurance.vehicles : [];
	const properties = Array.isArray(insurance.properties)
		? insurance.properties
		: [];
	const lob = Array.isArray(insurance.lines_of_business)
		? insurance.lines_of_business
		: [];

	const vehicleLines = vehicles
		.map((v: any) => {
			const parts = [v?.year, v?.make, v?.model].filter(
				(x) => x != null && x !== ""
			);
			return parts.length ? parts.join(" ") : null;
		})
		.filter(Boolean);

	const propertyLines = properties
		.map((p: any) => {
			const t = p?.type ? String(p.type) : "";
			const a = p?.address ? String(p.address) : "";
			if (t && a) return `${t}: ${a}`;
			return t || a || null;
		})
		.filter(Boolean);

	return (
		<div className="space-y-6 text-sm">
			<section>
				<h3 className="text-xs font-semibold uppercase tracking-wide text-[#37322F] mb-2">
					Lead
				</h3>
				<div className="rounded-md border border-[#E5E7EB] bg-white px-3">
					<FormRow label="Status" value={displayScalar(lead.status)} />
					<FormRow
						label="Date of birth"
						value={displayScalar(lead.date_of_birth)}
					/>
					<FormRow
						label="Marital status"
						value={displayScalar(lead.marital_status)}
					/>
					<FormRow
						label="Occupation / degree"
						value={displayScalar(lead.occupation_degree)}
					/>
				</div>
			</section>

			<section>
				<h3 className="text-xs font-semibold uppercase tracking-wide text-[#37322F] mb-2">
					Name
				</h3>
				<div className="rounded-md border border-[#E5E7EB] bg-white px-3">
					<FormRow label="Full name" value={displayScalar(name.full)} />
					<FormRow label="First name" value={displayScalar(name.first)} />
					<FormRow label="Last name" value={displayScalar(name.last)} />
				</div>
			</section>

			<section>
				<h3 className="text-xs font-semibold uppercase tracking-wide text-[#37322F] mb-2">
					Contact
				</h3>
				<div className="rounded-md border border-[#E5E7EB] bg-white px-3">
					<FormRow
						label="Primary phone"
						value={formatDisplayPhone(contact.primary_phone ?? null)}
					/>
					<FormRow
						label="Alternate phone"
						value={formatDisplayPhone(contact.alternate_phone ?? null)}
					/>
					<FormRow label="Email" value={displayScalar(contact.email)} />
					<FormRow
						label="Preferred channel"
						value={displayScalar(contact.preferred_channel)}
					/>
				</div>
			</section>

			<section>
				<h3 className="text-xs font-semibold uppercase tracking-wide text-[#37322F] mb-2">
					Address
				</h3>
				<div className="rounded-md border border-[#E5E7EB] bg-white px-3">
					<FormRow label="Street" value={displayScalar(address.street)} />
					<FormRow label="City" value={displayScalar(address.city)} />
					<FormRow label="State" value={displayScalar(address.state)} />
					<FormRow
						label="Postal code"
						value={displayScalar(address.postal_code)}
					/>
				</div>
			</section>

			<section>
				<h3 className="text-xs font-semibold uppercase tracking-wide text-[#37322F] mb-2">
					Property
				</h3>
				<div className="rounded-md border border-[#E5E7EB] bg-white px-3">
					<FormRow
						label="Roof year"
						value={displayScalar(property.roof_year)}
					/>
					<FormRow label="Roof type" value={displayScalar(property.roof_type)} />
					<FormRow
						label="Flooring types"
						value={displayScalar(property.flooring_types)}
					/>
					<FormRow
						label="Number of bathrooms"
						value={displayScalar(property.number_of_bathrooms)}
					/>
				</div>
			</section>

			<section>
				<h3 className="text-xs font-semibold uppercase tracking-wide text-[#37322F] mb-2">
					Insurance
				</h3>
				<div className="rounded-md border border-[#E5E7EB] bg-white px-3">
					<FormRow
						label="Lines of business"
						value={
							lob.length
								? lob.map(String).join(", ")
								: "—"
						}
					/>
					<FormRow
						label="Primary line"
						value={displayScalar(insurance.primary_line)}
					/>
					<FormRow
						label="Current carrier"
						value={displayScalar(insurance.current_carrier)}
					/>
					<FormRow
						label="Current premium"
						value={displayScalar(insurance.current_premium)}
					/>
					<FormRow
						label="Vehicles"
						value={
							vehicleLines.length ? (
								<ul className="list-disc pl-5 space-y-1">
									{vehicleLines.map((line, i) => (
										<li key={i}>{line}</li>
									))}
								</ul>
							) : (
								"—"
							)
						}
					/>
					<FormRow
						label="Insured properties"
						value={
							propertyLines.length ? (
								<ul className="list-disc pl-5 space-y-1">
									{propertyLines.map((line, i) => (
										<li key={i}>{line}</li>
									))}
								</ul>
							) : (
								"—"
							)
						}
					/>
				</div>
			</section>

			<section>
				<h3 className="text-xs font-semibold uppercase tracking-wide text-[#37322F] mb-2">
					Intent
				</h3>
				<div className="rounded-md border border-[#E5E7EB] bg-white px-3">
					<FormRow label="Urgency" value={displayScalar(intent.urgency)} />
					<FormRow
						label="Primary goal"
						value={displayScalar(intent.primary_goal)}
					/>
				</div>
			</section>

			<section>
				<h3 className="text-xs font-semibold uppercase tracking-wide text-[#37322F] mb-2">
					Call meta
				</h3>
				<div className="rounded-md border border-[#E5E7EB] bg-white px-3">
					<FormRow label="Call ID" value={displayScalar(meta.call_id)} />
					<FormRow
						label="Call direction"
						value={displayScalar(meta.call_direction)}
					/>
					<FormRow label="Call result" value={displayScalar(meta.call_result)} />
				</div>
			</section>
		</div>
	);
}

function NotesFromPayload({ payload }: { payload: any }) {
	const notes = payload?.lead?.notes;
	if (!notes || typeof notes !== "object") {
		return (
			<p className="text-sm text-[#605A57] leading-relaxed">
				No notes extracted yet. Use <strong>Extract Lead</strong> after transcription,
				or notes will appear here once the AI pipeline is wired up.
			</p>
		);
	}

	const summary = typeof notes.summary === "string" ? notes.summary.trim() : "";
	const keyQuotes = Array.isArray(notes.key_quotes) ? notes.key_quotes : [];
	const agentActions = Array.isArray(notes.agent_actions)
		? notes.agent_actions
		: [];

	const hasAny =
		summary ||
		keyQuotes.some((q: unknown) => typeof q === "string" && q.trim()) ||
		agentActions.some((a: unknown) => typeof a === "string" && a.trim());

	if (!hasAny) {
		return (
			<p className="text-sm text-[#605A57]">
				Notes are empty in the lead payload. Try extracting the lead again.
			</p>
		);
	}

	return (
		<div className="space-y-4 text-sm text-[#111827]">
			{summary ? (
				<div>
					<h3 className="text-xs font-semibold uppercase tracking-wide text-[#605A57] mb-1">
						Summary
					</h3>
					<p className="leading-relaxed whitespace-pre-wrap">{summary}</p>
				</div>
			) : null}
			{keyQuotes.length > 0 ? (
				<div>
					<h3 className="text-xs font-semibold uppercase tracking-wide text-[#605A57] mb-1">
						Key quotes
					</h3>
					<ul className="list-disc pl-5 space-y-1">
						{keyQuotes
							.filter((q: unknown) => typeof q === "string" && q.trim())
							.map((q: string, i: number) => (
								<li key={i} className="leading-relaxed">
									{q}
								</li>
							))}
					</ul>
				</div>
			) : null}
			{agentActions.length > 0 ? (
				<div>
					<h3 className="text-xs font-semibold uppercase tracking-wide text-[#605A57] mb-1">
						Agent actions
					</h3>
					<ul className="list-disc pl-5 space-y-1">
						{agentActions
							.filter((a: unknown) => typeof a === "string" && a.trim())
							.map((a: string, i: number) => (
								<li key={i} className="leading-relaxed">
									{a}
								</li>
							))}
					</ul>
				</div>
			) : null}
		</div>
	);
}

export function LeadPayloadPanel({ leadPayload }: Props) {
	const [debug, setDebug] = useState(false);

	const jsonText = leadPayload
		? JSON.stringify(leadPayload, null, 2)
		: "// No lead payload yet";

	return (
		<div className="rounded-lg border border-[#E0DEDB] bg-white p-4 shadow-sm">
			<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
				<h2 className="text-sm font-semibold text-[#37322F] leading-snug pr-2">
					AI Transcription For AgencyZoom
				</h2>
				<div className="flex items-center gap-2 shrink-0 sm:ml-auto">
					<Label
						htmlFor="agencyzoom-debug-switch"
						className="text-xs font-medium text-[#605A57] cursor-pointer"
					>
						Debug
					</Label>
					<Switch
						id="agencyzoom-debug-switch"
						checked={debug}
						onCheckedChange={setDebug}
						aria-label="Toggle JSON debug view"
					/>
				</div>
			</div>

			{debug ? (
				<div className="text-xs font-mono text-[#111827] bg-[#F9FAFB] border border-[#E5E7EB] rounded-md p-3 max-h-[480px] overflow-auto">
					<pre className="whitespace-pre-wrap break-all">{jsonText}</pre>
				</div>
			) : (
				<Tabs defaultValue="lead" className="w-full gap-3">
					<TabsList className="bg-[#F4F3F1] w-full sm:w-auto">
						<TabsTrigger value="lead" className="gap-1.5">
							<ClipboardList className="h-3.5 w-3.5" />
							Lead
						</TabsTrigger>
						<TabsTrigger value="notes" className="gap-1.5">
							<FileText className="h-3.5 w-3.5" />
							Notes
						</TabsTrigger>
					</TabsList>
					<TabsContent value="lead" className="mt-0">
						<div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-md p-3 max-h-[480px] overflow-auto">
							<LeadFormView payload={leadPayload as any} />
						</div>
					</TabsContent>
					<TabsContent value="notes" className="mt-0">
						<div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-md p-3 max-h-[480px] overflow-auto">
							<NotesFromPayload payload={leadPayload as any} />
						</div>
					</TabsContent>
				</Tabs>
			)}
		</div>
	);
}
