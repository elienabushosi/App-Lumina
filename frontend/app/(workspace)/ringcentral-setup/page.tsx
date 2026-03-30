"use client";

import { ClipboardCheck } from "lucide-react";

const CHECKLIST = [
	{
		title: "Third Party App Access is enabled on your account",
		description:
			"In the RingCentral Admin Portal, go to Users → select your user → Roles & Permissions. Confirm your assigned role has \"Third Party App Access\" enabled. If it doesn't, ask your RC admin to enable it.",
	},
	{
		title: "A Digital Line is assigned to your account",
		description:
			"In the RingCentral Admin Portal, go to Users → select your user → Devices & Numbers. Confirm at least one Digital Line is listed. If none appears, contact your RC admin to assign a Digital Line to your account.",
	},
	{
		title: "Your account is in an active state",
		description:
			"In the RingCentral Admin Portal, go to Users → select your user. Confirm the account status shows \"Enabled\". Suspended or disabled accounts cannot complete the authorization flow.",
	},
	{
		title: "Your RC admin has granted API access",
		description:
			"In the RingCentral Admin Portal, go to Users → Roles & Permissions → select the role assigned to your user → scroll to the 'Apps and Resources' section. Confirm that 'REST API' and 'WebHooks' permissions are enabled. If they are not, your RC admin will need to edit the role and enable them before Lumina can receive call data.",
	},
	{
		title: "Emergency address is registered in RingCentral",
		description:
			"Open the RingCentral app → click your profile or go to Settings → Emergency Address. Confirm an address is registered. RingCentral may prompt you to complete this during login — you must accept before the connection to Lumina can complete.",
	},
];

export default function RingCentralSetupPage() {
	return (
		<div className="p-8">
			<div className="max-w-2xl mx-auto space-y-6">
				<div>
					<img
						src="/RingCentral_logo.png"
						alt="RingCentral"
						className="h-10 w-auto object-contain mb-3"
					/>
					<h1 className="text-2xl font-semibold text-[#37322F]">
						RingCentral Setup
					</h1>
					<p className="text-sm text-[#605A57] mt-1">
						Before connecting RingCentral to Lumina, confirm each of the following in your RingCentral account. If any item is incomplete, your connection may fail or calls may not be received.
					</p>
				</div>

				<div className="space-y-3">
					{CHECKLIST.map((item, i) => (
						<div
							key={i}
							className="flex gap-4 rounded-lg border border-[#E0DEDB] bg-white px-5 py-4 shadow-sm"
						>
							<ClipboardCheck className="h-5 w-5 text-[#37322F] shrink-0 mt-0.5" />
							<div className="space-y-1">
								<p className="text-sm font-medium text-[#37322F]">{item.title}</p>
								<p className="text-sm text-[#605A57]">{item.description}</p>
							</div>
						</div>
					))}
				</div>

				<p className="text-xs text-[#605A57]">
					Once all items are confirmed, return to Settings and click Connect RingCentral.
				</p>
			</div>
		</div>
	);
}
