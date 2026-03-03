"use client";

export default function HomePage() {
	return (
		<div className="p-8">
			<div className="max-w-4xl mx-auto space-y-4">
				<h1 className="text-2xl font-semibold text-[#37322F]">
					Home (placeholder)
				</h1>
				<p className="text-sm text-[#605A57]">
					This workspace home view is intentionally minimal. Replace this
					with your own dashboard once you connect real auth and data.
				</p>
				<ul className="list-disc list-inside text-sm text-[#605A57] space-y-1">
					<li>Add proper auth token handling.</li>
					<li>Fetch user and organization data from your backend/DB.</li>
					<li>Render your real dashboard using Shadcn UI components.</li>
				</ul>
			</div>
		</div>
	);
}

