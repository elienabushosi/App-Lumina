"use client";

export default function ReportsPage() {
	return (
		<div className="p-8">
			<div className="max-w-5xl mx-auto space-y-4">
				<h1 className="text-2xl font-semibold text-[#37322F]">
					All Live Reports (placeholder)
				</h1>
				<p className="text-sm text-[#605A57]">
					This page is a scaffold for listing reports in your own application.
					The original implementation was tightly coupled to Clermont&apos;s
					database schema and APIs, so it has been replaced with this neutral
					placeholder.
				</p>
				<ul className="list-disc list-inside text-sm text-[#605A57] space-y-1">
					<li>Fetch reports from your backend or database.</li>
					<li>Render them in a table using Shadcn&apos;s table components.</li>
					<li>Add filters, sorting, and actions that match your product.</li>
				</ul>
			</div>
		</div>
	);
}

