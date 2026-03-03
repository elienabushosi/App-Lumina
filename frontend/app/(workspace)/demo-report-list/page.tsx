"use client";

import { useRouter } from "next/navigation";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { FileText, Eye, TrendingUp, AlertCircle, XCircle } from "lucide-react";

// Dummy data for demo items
const demoReports = [
	{
		id: "demo-1",
		address: "Item 1",
		clientName: "Person 1",
		status: "ready",
		createdAt: "2024-01-15T10:30:00Z",
	},
	{
		id: "demo-2",
		address: "Item 2",
		clientName: "Person 2",
		status: "ready",
		createdAt: "2024-01-14T14:20:00Z",
	},
	{
		id: "demo-3",
		address: "Item 3",
		clientName: "Person 3",
		status: "ready",
		createdAt: "2024-01-13T09:15:00Z",
	},
	{
		id: "demo-4",
		address: "Item 4",
		clientName: "Person 4",
		status: "pending",
		createdAt: "2024-01-12T16:45:00Z",
	},
	{
		id: "demo-5",
		address: "Item 5",
		clientName: "Person 5",
		status: "ready",
		createdAt: "2024-01-11T11:00:00Z",
	},
	{
		id: "demo-6",
		address: "Item 6",
		clientName: "Person 6",
		status: "ready",
		createdAt: "2024-01-10T13:30:00Z",
	},
];

function getStatusColor(status: string) {
	switch (status) {
		case "ready":
			return "bg-green-100 text-green-700 border-green-200";
		case "pending":
			return "bg-yellow-100 text-yellow-700 border-yellow-200";
		case "failed":
			return "bg-red-100 text-red-700 border-red-200";
		default:
			return "bg-gray-100 text-gray-700 border-gray-200";
	}
}

export default function DemoReportListPage() {
	const router = useRouter();

	return (
		<div className="p-8">
			<div className="max-w-6xl mx-auto">
				<div className="mb-6">
					<h1 className="text-2xl font-semibold text-[#37322F]">
						Sample Dashboard
					</h1>
				</div>

				<div className="mb-6">
					<h2 className="text-lg font-semibold text-[#37322F] mb-4">
						Metrics
					</h2>
					<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
						<Card className="bg-[#FEE2A9]/20 border-[#4090C2]/30">
							<CardHeader className="pb-0 pt-1.5 px-4">
								<CardTitle className="text-xs font-medium text-[#605A57] flex items-center gap-1.5">
									<TrendingUp className="size-3 text-[#4090C2]" />
									Metric 1
								</CardTitle>
							</CardHeader>
							<CardContent className="pt-0 pb-1.5 px-4">
								<p className="text-xl font-semibold text-[#37322F]">
									—
								</p>
								<p className="text-xs text-[#605A57] mt-0">
									Placeholder value
								</p>
							</CardContent>
						</Card>
						<Card className="bg-[#FEE2A9]/20 border-[#D59285]/30">
							<CardHeader className="pb-0 pt-1.5 px-4">
								<CardTitle className="text-xs font-medium text-[#605A57] flex items-center gap-1.5">
									<AlertCircle className="size-3 text-[#D59285]" />
									Metric 2
								</CardTitle>
							</CardHeader>
							<CardContent className="pt-0 pb-1.5 px-4">
								<p className="text-xl font-semibold text-[#37322F]">
									—
								</p>
								<p className="text-xs text-[#605A57] mt-0">
									Placeholder value
								</p>
							</CardContent>
						</Card>
						<Card className="bg-[#FEE2A9]/20 border-[#D59285]/40">
							<CardHeader className="pb-0 pt-1.5 px-4">
								<CardTitle className="text-xs font-medium text-[#605A57] flex items-center gap-1.5">
									<XCircle className="size-3 text-[#D59285]" />
									Metric 3
								</CardTitle>
							</CardHeader>
							<CardContent className="pt-0 pb-1.5 px-4">
								<p className="text-xl font-semibold text-[#37322F]">
									—
								</p>
								<p className="text-xs text-[#605A57] mt-0">
									Placeholder value
								</p>
							</CardContent>
						</Card>
					</div>
				</div>

				<div className="flex items-center gap-2 mb-6">
					<FileText className="size-6 text-[#4090C2]" />
					<h2 className="text-xl font-semibold text-[#37322F]">
						Items
					</h2>
				</div>

				{demoReports.length === 0 ? (
					<div className="bg-white rounded-lg border border-[rgba(55,50,47,0.12)] p-8 text-center">
						<p className="text-[#605A57]">No demo reports found</p>
					</div>
				) : (
					<div className="bg-white rounded-lg border border-[rgba(55,50,47,0.12)] overflow-hidden">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead className="text-[#37322F]">
										List
									</TableHead>
									<TableHead className="text-[#37322F]">
										Client
									</TableHead>
									<TableHead className="text-[#37322F]">
										Created At
									</TableHead>
									<TableHead className="text-[#37322F]">
										Status
									</TableHead>
									<TableHead className="text-[#37322F]">
										Actions
									</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{demoReports.map((report) => (
									<TableRow key={report.id}>
										<TableCell className="text-[#37322F]">
											{report.address}
										</TableCell>
										<TableCell className="text-[#37322F]">
											{report.clientName}
										</TableCell>
										<TableCell className="text-[#37322F]">
											{format(
												new Date(report.createdAt),
												"MMM d, yyyy 'at' h:mm a",
											)}
										</TableCell>
										<TableCell>
											<Badge
												variant="outline"
												className={`text-xs ${getStatusColor(
													report.status,
												)}`}
											>
												{report.status}
											</Badge>
										</TableCell>
										<TableCell>
											<Button
												variant="outline"
												size="sm"
												onClick={() =>
													router.push(
														`/demo-report/${report.id}`,
													)
												}
												className="flex items-center gap-2"
											>
												<Eye className="size-4" />
												View Report
											</Button>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</div>
				)}
			</div>
		</div>
	);
}
