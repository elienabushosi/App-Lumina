"use client";

export default function SearchAddressPage() {
	return (
		<div className="p-8">
			<div className="max-w-4xl mx-auto space-y-4">
				<h1 className="text-2xl font-semibold text-[#37322F]">
					Single Parcel (placeholder)
				</h1>
				<p className="text-sm text-[#605A57]">
					This page is a template placeholder for your single-parcel workflow.
					The original Clermont implementation relied on backend APIs, Stripe,
					and NYC-specific zoning logic, which have been removed here.
				</p>
				<ul className="list-disc list-inside text-sm text-[#605A57] space-y-1">
					<li>Design the address input and search flow you want.</li>
					<li>Call your own APIs to generate reports or results.</li>
					<li>Use Shadcn UI components (forms, cards, tables) for the UI.</li>
				</ul>
			</div>
		</div>
	);
}

