import type { Metadata } from "next";

export async function generateMetadata({
	params,
}: {
	params: Promise<{ id: string }>;
}): Promise<Metadata> {
	await params; // satisfy dynamic route
	return {
		title: "Assemblage Report",
		openGraph: { title: "Assemblage Report" },
		twitter: { card: "summary", title: "Assemblage Report" },
	};
}

export default function ViewAssemblageReportPublicLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return children;
}
