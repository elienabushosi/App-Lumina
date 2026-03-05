"use client";

import Link from "next/link";

export default function ViewAssemblageReportPublicPlaceholderPage() {
	return (
		<div className="p-8 max-w-2xl mx-auto">
			<h1 className="text-xl font-semibold text-[#37322F] mb-2">
				Public assemblage report (template placeholder)
			</h1>
			<p className="text-sm text-[#605A57] mb-6">
				Assemblage report and public share have been removed from this template.
				Replace with your own product flow or remove this route.
			</p>
			<Link
				href="/"
				className="text-sm font-medium text-[#4090C2] hover:underline"
			>
				Back to home
			</Link>
		</div>
	);
}
