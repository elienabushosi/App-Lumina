"use client";

import { useParams, useRouter } from "next/navigation";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
	MapPin,
	Ruler,
	Building,
	FileText,
	CheckCircle2,
	XCircle,
	AlertCircle,
	ArrowLeft,
	Send,
} from "lucide-react";

export default function DemoReportPage() {
	const params = useParams();
	const router = useRouter();
	const reportId = params.id as string;

	// Dummy data for demonstration (boilerplate values)
	const propertyData = {
		address: "Item 1",
		lotDetails: {
			block: "Sample value 1",
			lot: "Sample value 2",
			taxLot: "Sample value 3",
			lotArea: "Sample value 4",
			lotDepth: "Sample value 5",
			lotFrontage: "Sample value 6",
			lotType: "Sample value 7",
		},
		zoning: {
			classification: "Sample classification",
			description:
				"Short boilerplate description for this sample item.",
			floorAreaRatio: "Sample metric 1",
			maximumBuildingHeight: "Sample metric 2",
			requiredYards: "Sample metric 3",
		},
		zoningDetails: {
			maximumFAR: "Sample metric A",
			densityRequirements:
				"Sample density description for this item.",
			minimumBaseHeight: "Sample metric B",
			maximumBaseHeight: "Sample metric C",
			maximumBuildingHeight: "Sample metric D",
			yardRequirements: {
				front: "Sample yard value 1",
				side: "Sample yard value 2",
				rear: "Sample yard value 3",
			},
			parkingRequirements:
				"Sample parking requirement description.",
			streetTreeRequirements:
				"Sample street tree requirement description.",
		},
		buildingInfo: {
			yearBuilt: "Sample value 8",
			numberOfStories: "Sample value 9",
			numberOfUnits: "Sample value 10",
			buildingClass: "Sample value 11",
			totalBuildingArea: "Sample value 12",
			residentialUnits: "Sample value 13",
			commercialUnits: "Sample value 14",
		},
		landUse: {
			designation: "Sample designation",
			primaryUse: "Sample primary use",
			secondaryUse: "Sample secondary use",
			zoningMap: "Sample map reference",
		},
		allowedUses: [
			"Example allowed use 1",
			"Example allowed use 2",
			"Example allowed use 3",
			"Example allowed use 4",
		],
		restrictedUses: [
			"Example restricted use 1",
			"Example restricted use 2",
			"Example restricted use 3",
			"Example restricted use 4",
		],
		feasibleOptions: [
			{
				title: "Scenario 1",
				description:
					"Short boilerplate description for this sample scenario.",
				feasibility: "High",
				considerations: [
					"Example consideration 1",
					"Example consideration 2",
					"Example consideration 3",
				],
			},
			{
				title: "Scenario 2",
				description:
					"Short boilerplate description for a second sample scenario.",
				feasibility: "Moderate",
				considerations: [
					"Example consideration 4",
					"Example consideration 5",
				],
			},
			{
				title: "Scenario 3",
				description:
					"Short boilerplate description for a third sample scenario.",
				feasibility: "Low",
				considerations: [
					"Example consideration 6",
					"Example consideration 7",
				],
			},
		],
	};

	return (
		<div className="p-8 bg-[#F7F5F3] min-h-screen">
			<div className="max-w-5xl mx-auto space-y-6">
				{/* Header with Back Button and Share */}
				<div className="flex items-start justify-between mb-4">
					<div className="flex-1">
						<Button
							variant="ghost"
							onClick={() => router.push("/demo-report-list")}
							className="mb-4"
						>
							<ArrowLeft className="size-4 mr-2" />
							Back to Items
						</Button>
						<div>
							<h1 className="text-3xl font-semibold text-[#37322F] mb-2">
								Sample Item Report
							</h1>
							<div className="flex items-center gap-2 text-[#605A57]">
								<MapPin className="size-4" />
								<span className="text-lg">
									{propertyData.address}
								</span>
							</div>
							<Badge
								variant="outline"
								className="mt-3 bg-green-100 text-green-700 border-green-200"
							>
								Report Generated:{" "}
								{new Date().toLocaleDateString()}
							</Badge>
						</div>
					</div>
					<Button
						variant="outline"
						size="sm"
						onClick={() => {
							// Share functionality - can be enhanced later
							if (navigator.share) {
								navigator.share({
									title: "Property Zoning Report",
									text: `Zoning report for ${propertyData.address}`,
									url: window.location.href,
								});
							} else {
								// Fallback: copy to clipboard
								navigator.clipboard.writeText(
									window.location.href,
								);
								alert("Report link copied to clipboard!");
							}
						}}
						className="flex items-center gap-2"
					>
						<Send className="size-4" />
						Share
					</Button>
				</div>

				{/* Property Map/Location Image */}
				<Card>
					<CardHeader>
						<div className="flex items-center gap-2">
							<MapPin className="size-5 text-[#4090C2]" />
							<CardTitle>Item Overview</CardTitle>
						</div>
						<CardDescription>
							High-level overview for this sample item
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="w-full flex justify-center">
							<div className="w-full max-w-2xl rounded-lg overflow-hidden border border-[rgba(55,50,47,0.12)] bg-gray-100">
								<img
									src="/placeholder.png"
									alt="Placeholder image for this item"
									className="w-full h-auto object-contain"
									onError={(e) => {
										// Fallback if image doesn't exist
										const target =
											e.target as HTMLImageElement;
										target.style.display = "none";
										if (target.parentElement) {
											target.parentElement.innerHTML =
												'<div class="w-full h-64 flex items-center justify-center text-[#605A57] bg-gray-100">Map image not found</div>';
										}
									}}
								/>
							</div>
						</div>
					</CardContent>
				</Card>

				{/* Lot Details */}
				<Card>
					<CardHeader>
						<div className="flex items-center gap-2">
							<Ruler className="size-5 text-[#4090C2]" />
							<CardTitle>Item Details</CardTitle>
						</div>
						<CardDescription>
							Example identifying and descriptive fields
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="grid grid-cols-2 md:grid-cols-3 gap-4">
							<div>
								<p className="text-sm text-[#605A57] mb-1">
									Block
								</p>
								<p className="font-medium text-[#37322F]">
									{propertyData.lotDetails.block}
								</p>
							</div>
							<div>
								<p className="text-sm text-[#605A57] mb-1">
									Lot
								</p>
								<p className="font-medium text-[#37322F]">
									{propertyData.lotDetails.lot}
								</p>
							</div>
							<div>
								<p className="text-sm text-[#605A57] mb-1">
									Tax Lot
								</p>
								<p className="font-medium text-[#37322F]">
									{propertyData.lotDetails.taxLot}
								</p>
							</div>
							<div>
								<p className="text-sm text-[#605A57] mb-1">
									Lot Area
								</p>
								<p className="font-medium text-[#37322F]">
									{propertyData.lotDetails.lotArea}
								</p>
							</div>
							<div>
								<p className="text-sm text-[#605A57] mb-1">
									Lot Depth
								</p>
								<p className="font-medium text-[#37322F]">
									{propertyData.lotDetails.lotDepth}
								</p>
							</div>
							<div>
								<p className="text-sm text-[#605A57] mb-1">
									Lot Frontage
								</p>
								<p className="font-medium text-[#37322F]">
									{propertyData.lotDetails.lotFrontage}
								</p>
							</div>
							<div>
								<p className="text-sm text-[#605A57] mb-1">
									Lot Type
								</p>
								<p className="font-medium text-[#37322F]">
									{propertyData.lotDetails.lotType}
								</p>
							</div>
						</div>
					</CardContent>
				</Card>

				{/* Zoning Classification */}
				<Card>
					<CardHeader>
						<div className="flex items-center gap-2">
							<FileText className="size-5 text-[#4090C2]" />
							<CardTitle>Section A</CardTitle>
						</div>
						<CardDescription>
							Example section with sample metrics
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="space-y-4">
							<div>
								<Badge
									variant="outline"
									className="mb-3 bg-[#4090C2] text-white border-[#4090C2]"
								>
									{propertyData.zoning.classification}
								</Badge>
								<p className="text-[#37322F] mb-4">
									{propertyData.zoning.description}
								</p>
							</div>
							<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
								<div>
									<p className="text-sm text-[#605A57] mb-1">
										Floor Area Ratio (FAR)
									</p>
									<p className="font-medium text-[#37322F]">
										{propertyData.zoning.floorAreaRatio}
									</p>
								</div>
								<div>
									<p className="text-sm text-[#605A57] mb-1">
										Max Building Height
									</p>
									<p className="font-medium text-[#37322F]">
										{
											propertyData.zoning
												.maximumBuildingHeight
										}
									</p>
								</div>
								<div className="md:col-span-2">
									<p className="text-sm text-[#605A57] mb-1">
										Required Yards
									</p>
									<p className="font-medium text-[#37322F]">
										{propertyData.zoning.requiredYards}
									</p>
								</div>
							</div>
						</div>
					</CardContent>
				</Card>

				{/* Section B */}
				<Card>
					<CardHeader>
						<div className="flex items-center gap-2">
							<Building className="size-5 text-[#4090C2]" />
							<CardTitle>Section B</CardTitle>
						</div>
						<CardDescription>
							Example fields for this item
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="grid grid-cols-2 md:grid-cols-3 gap-4">
							<div>
								<p className="text-sm text-[#605A57] mb-1">
									Label 1
								</p>
								<p className="font-medium text-[#37322F]">
									{propertyData.buildingInfo.yearBuilt}
								</p>
							</div>
							<div>
								<p className="text-sm text-[#605A57] mb-1">
									Label 2
								</p>
								<p className="font-medium text-[#37322F]">
									{propertyData.buildingInfo.numberOfStories}
								</p>
							</div>
							<div>
								<p className="text-sm text-[#605A57] mb-1">
									Label 3
								</p>
								<p className="font-medium text-[#37322F]">
									{propertyData.buildingInfo.numberOfUnits}
								</p>
							</div>
							<div>
								<p className="text-sm text-[#605A57] mb-1">
									Label 4
								</p>
								<p className="font-medium text-[#37322F]">
									{propertyData.buildingInfo.buildingClass}
								</p>
							</div>
							<div>
								<p className="text-sm text-[#605A57] mb-1">
									Label 5
								</p>
								<p className="font-medium text-[#37322F]">
									{
										propertyData.buildingInfo
											.totalBuildingArea
									}
								</p>
							</div>
							<div>
								<p className="text-sm text-[#605A57] mb-1">
									Label 6
								</p>
								<p className="font-medium text-[#37322F]">
									{propertyData.buildingInfo.residentialUnits}
								</p>
							</div>
						</div>
					</CardContent>
				</Card>

				{/* Section C */}
				<Card>
					<CardHeader>
						<div className="flex items-center gap-2">
							<MapPin className="size-5 text-[#4090C2]" />
							<CardTitle>Section C</CardTitle>
						</div>
						<CardDescription>
							Example fields for this item
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
							<div>
								<p className="text-sm text-[#605A57] mb-1">
									Label 1
								</p>
								<p className="font-medium text-[#37322F]">
									{propertyData.landUse.designation}
								</p>
							</div>
							<div>
								<p className="text-sm text-[#605A57] mb-1">
									Label 2
								</p>
								<p className="font-medium text-[#37322F]">
									{propertyData.landUse.primaryUse}
								</p>
							</div>
							<div>
								<p className="text-sm text-[#605A57] mb-1">
									Label 3
								</p>
								<p className="font-medium text-[#37322F]">
									{propertyData.landUse.secondaryUse ||
										"None"}
								</p>
							</div>
							<div>
								<p className="text-sm text-[#605A57] mb-1">
									Label 4
								</p>
								<p className="font-medium text-[#37322F]">
									{propertyData.landUse.zoningMap}
								</p>
							</div>
						</div>
					</CardContent>
				</Card>

				{/* Section D */}
				<Card>
					<CardHeader>
						<div className="flex items-center gap-2">
							<FileText className="size-5 text-[#4090C2]" />
							<CardTitle>Section D</CardTitle>
						</div>
						<CardDescription>
							Example constraints and requirements
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="space-y-6">
							<div>
								<p className="text-sm font-medium text-[#605A57] mb-1">
									Label 1
								</p>
								<p className="text-base text-[#37322F] font-semibold">
									{propertyData.zoningDetails.maximumFAR}
								</p>
								<p className="text-xs text-[#605A57] mt-1">
									Sample description for this field.
								</p>
							</div>

							<Separator />

							<div>
								<p className="text-sm font-medium text-[#605A57] mb-1">
									Label 2
								</p>
								<p className="text-base text-[#37322F] font-semibold">
									{
										propertyData.zoningDetails
											.densityRequirements
									}
								</p>
								<p className="text-xs text-[#605A57] mt-1">
									Sample description for this field.
								</p>
							</div>

							<Separator />

							<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
								<div>
									<p className="text-sm font-medium text-[#605A57] mb-1">
										Label 3
									</p>
									<p className="text-base text-[#37322F] font-semibold">
										{
											propertyData.zoningDetails
												.minimumBaseHeight
										}
									</p>
									<p className="text-xs text-[#605A57] mt-1">
										Sample description for this field.
									</p>
								</div>
								<div>
									<p className="text-sm font-medium text-[#605A57] mb-1">
										Label 4
									</p>
									<p className="text-base text-[#37322F] font-semibold">
										{
											propertyData.zoningDetails
												.maximumBaseHeight
										}
									</p>
									<p className="text-xs text-[#605A57] mt-1">
										Sample description for this field.
									</p>
								</div>
								<div>
									<p className="text-sm font-medium text-[#605A57] mb-1">
										Label 5
									</p>
									<p className="text-base text-[#37322F] font-semibold">
										{
											propertyData.zoningDetails
												.maximumBuildingHeight
										}
									</p>
									<p className="text-xs text-[#605A57] mt-1">
										Sample description for this field.
									</p>
								</div>
							</div>

							<Separator />

							<div>
								<p className="text-sm font-medium text-[#605A57] mb-3">
									Label 6
								</p>
								<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
									<div>
										<p className="text-xs text-[#605A57] mb-1">
											Sub-label 1
										</p>
										<p className="text-base text-[#37322F] font-semibold">
											{
												propertyData.zoningDetails
													.yardRequirements.front
											}
										</p>
									</div>
									<div>
										<p className="text-xs text-[#605A57] mb-1">
											Sub-label 2
										</p>
										<p className="text-base text-[#37322F] font-semibold">
											{
												propertyData.zoningDetails
													.yardRequirements.side
											}
										</p>
									</div>
									<div>
										<p className="text-xs text-[#605A57] mb-1">
											Sub-label 3
										</p>
										<p className="text-base text-[#37322F] font-semibold">
											{
												propertyData.zoningDetails
													.yardRequirements.rear
											}
										</p>
									</div>
								</div>
								<p className="text-xs text-[#605A57] mt-3">
									Sample description for this field.
								</p>
							</div>

							<Separator />

							<div>
								<p className="text-sm font-medium text-[#605A57] mb-1">
									Label 7
								</p>
								<p className="text-base text-[#37322F] font-semibold">
									{
										propertyData.zoningDetails
											.parkingRequirements
									}
								</p>
								<p className="text-xs text-[#605A57] mt-1">
									Sample description for this field.
								</p>
							</div>

							<Separator />

							<div>
								<p className="text-sm font-medium text-[#605A57] mb-1">
									Label 8
								</p>
								<p className="text-base text-[#37322F] font-semibold">
									{
										propertyData.zoningDetails
											.streetTreeRequirements
									}
								</p>
								<p className="text-xs text-[#605A57] mt-1">
									Sample description for this field.
								</p>
							</div>
						</div>
					</CardContent>
				</Card>

				{/* Highlights vs. Limitations */}
				<div className="grid md:grid-cols-2 gap-6">
					<Card>
						<CardHeader>
							<div className="flex items-center gap-2">
								<CheckCircle2 className="size-5 text-green-600" />
								<CardTitle>Highlights</CardTitle>
							</div>
							<CardDescription>
								Example positive aspects for this item
							</CardDescription>
						</CardHeader>
						<CardContent>
							<ul className="space-y-2">
								{propertyData.allowedUses.map((use, index) => (
									<li
										key={index}
										className="flex items-start gap-2 text-[#37322F]"
									>
										<CheckCircle2 className="size-4 text-green-600 mt-0.5 flex-shrink-0" />
										<span>{use}</span>
									</li>
								))}
							</ul>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<div className="flex items-center gap-2">
								<XCircle className="size-5 text-red-600" />
								<CardTitle>Limitations</CardTitle>
							</div>
							<CardDescription>
								Example limitations or caveats
							</CardDescription>
						</CardHeader>
						<CardContent>
							<ul className="space-y-2">
								{propertyData.restrictedUses.map(
									(use, index) => (
										<li
											key={index}
											className="flex items-start gap-2 text-[#37322F]"
										>
											<XCircle className="size-4 text-red-600 mt-0.5 flex-shrink-0" />
											<span>{use}</span>
										</li>
									),
								)}
							</ul>
						</CardContent>
					</Card>
				</div>

				{/* Scenarios */}
				<Card>
					<CardHeader>
						<div className="flex items-center gap-2">
							<AlertCircle className="size-5 text-[#4090C2]" />
							<CardTitle>Scenarios</CardTitle>
						</div>
						<CardDescription>
							Example scenarios related to this sample item
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="space-y-6">
							{propertyData.feasibleOptions.map(
								(option, index) => (
									<div key={index}>
										<div className="flex items-start justify-between mb-2">
											<h3 className="text-lg font-semibold text-[#37322F]">
												{option.title}
											</h3>
											{option.feasibility !== "N/A" && (
												<Badge
													variant="outline"
													className={
														option.feasibility ===
														"High"
															? "bg-green-100 text-green-700 border-green-200"
															: option.feasibility ===
																  "Moderate"
																? "bg-yellow-100 text-yellow-700 border-yellow-200"
																: "bg-red-100 text-red-700 border-red-200"
													}
												>
													{option.feasibility}{" "}
													Feasibility
												</Badge>
											)}
										</div>
										<p className="text-[#605A57] mb-3">
											{option.description}
										</p>
										{option.considerations.length > 0 && (
											<div className="bg-[#F7F5F3] rounded-lg p-4 border border-[rgba(55,50,47,0.12)]">
												<p className="text-sm font-medium text-[#37322F] mb-2">
													Key Considerations:
												</p>
												<ul className="space-y-1">
													{option.considerations.map(
														(
															consideration,
															idx,
														) => (
															<li
																key={idx}
																className="text-sm text-[#605A57] flex items-start gap-2"
															>
																<span className="text-[#4090C2] mt-1">
																	•
																</span>
																<span>
																	{
																		consideration
																	}
																</span>
															</li>
														),
													)}
												</ul>
											</div>
										)}
										{index <
											propertyData.feasibleOptions
												.length -
												1 && (
											<Separator className="mt-6" />
										)}
									</div>
								),
							)}
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
