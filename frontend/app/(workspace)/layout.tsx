"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
	getAuthToken,
	verifyToken,
	removeAuthToken,
	getCurrentUser,
} from "@/lib/auth";
import { config } from "@/lib/config";
import {
	Sidebar,
	SidebarContent,
	SidebarGroup,
	SidebarGroupContent,
	SidebarHeader,
	SidebarFooter,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarMenuSub,
	SidebarMenuSubItem,
	SidebarMenuSubButton,
	SidebarProvider,
	SidebarInset,
	SidebarTrigger,
	useSidebar,
} from "@/components/ui/sidebar";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
	Settings,
	LogOut,
	User,
	ScanSearch,
	Phone,
	ContactRound,
	Bot,
	ChevronRight,
} from "lucide-react";

function SidebarHeaderContent({
	organizationName,
}: {
	organizationName: string | null;
}) {
	const { state } = useSidebar();
	const isCollapsed = state === "collapsed";
return (
		<div className="flex flex-col items-center gap-3 p-4">
			<img
				src="/logos/Lumina-logo-transparent.svg"
				alt="Lumina"
				className={`object-contain ${isCollapsed ? "h-8 w-10" : "h-9 w-full max-w-[140px]"}`}
			/>
			{!isCollapsed && (
				<div className="text-center">
					<h2 className="text-lg font-semibold text-[#37322F]">
						{organizationName || "Organization"}
					</h2>
</div>
			)}
		</div>
	);
}

function getPageTitle(pathname: string): string {
	if (pathname === "/research-agent") {
		return "Research Agent";
	}
	if (pathname === "/research-browser-run") {
		return "Browser Run";
	}
	if (pathname.startsWith("/agency-zoom-leads/")) {
		return "Lead Detail";
	}
	if (pathname === "/agency-zoom-leads") {
		return "Agency Zoom Leads";
	}
	if (pathname === "/home" || pathname === "/") {
		return "Home";
	} else if (pathname === "/main-page-1") {
		return "Main Page 1";
	} else if (pathname === "/reports") {
		return "Main Page 2";
	} else if (pathname === "/team") {
		return "Team";
	} else if (pathname === "/demo-report-list") {
		return "Sample Dashboard";
	} else if (pathname.startsWith("/demo-report")) {
		return "Item Details";
	} else if (pathname === "/settings") {
		return "Settings";
	}
	return "Home";
}

export default function WorkspaceLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const pathname = usePathname();
	const router = useRouter();
	const [isAuthenticated, setIsAuthenticated] = useState(false);
	const [isChecking, setIsChecking] = useState(true);
	const [userData, setUserData] = useState<{
		user: {
			IdUser: string;
			Name: string;
			Email: string;
			Role: string;
			IdOrganization: string | null;
		};
		organization: {
			IdOrganization: string;
			Name: string;
			Type: string | null;
		} | null;
	} | null>(null);

	const [ringCentralConnected, setRingCentralConnected] = useState<
		boolean | null
	>(null);
	const [agencyZoomConnected, setAgencyZoomConnected] = useState<
		boolean | null
	>(null);
	// When NEXT_PUBLIC_BYPASS_AUTH=1, skip real auth (local dev or Vercel demo)
	const isBypassAuth = process.env.NEXT_PUBLIC_BYPASS_AUTH === "1";
	const pageTitle = getPageTitle(pathname);

	useEffect(() => {
		const checkAuth = async () => {
			if (isBypassAuth) {
				// Set a dev token so API calls that require auth can send a Bearer header
				localStorage.setItem("auth_token", "dev-bypass-token");
				setUserData({
					user: {
						IdUser: "dev-user-id",
						Name: "Dev User",
						Email: "dev@example.com",
						Role: "Owner",
						IdOrganization: "dev-org-id",
					},
					organization: {
						IdOrganization: "dev-org-id",
						Name: "Dev Organization",
						Type: "sample",
					},
				});
				setIsAuthenticated(true);
				setIsChecking(false);
				return;
			}

			const token = getAuthToken();

			if (!token) {
				router.push("/login");
				return;
			}

			// Verify token with backend and get user data
			const isValid = await verifyToken(token);

			if (!isValid) {
				// Remove invalid token
				localStorage.removeItem("auth_token");
				router.push("/login");
				return;
			}

			// Fetch user data with organization
			const userInfo = await getCurrentUser();
			if (userInfo) {
				setUserData(userInfo);
			}

			setIsAuthenticated(true);
			setIsChecking(false);
		};

		checkAuth();
	}, [router, isBypassAuth]);

	// Poll connection status for the sidebar indicators.
	useEffect(() => {
		if (!isAuthenticated) return;

		let cancelled = false;
		async function loadStatuses() {
			try {
				const token = getAuthToken();
				const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};
				const [ringRes, agencyRes] = await Promise.all([
					fetch(`${config.apiUrl}/api/ringcentral/status`, {
						cache: "no-store",
						headers: authHeaders,
					}),
					fetch(`${config.apiUrl}/api/agencyzoom/status`, {
						cache: "no-store",
					}),
				]);

				const ringJson = await ringRes.json().catch(() => ({}));
				const agencyJson = await agencyRes.json().catch(() => ({}));

				if (cancelled) return;
				setRingCentralConnected(!!ringJson.connected);
				setAgencyZoomConnected(!!agencyJson.connected);
			} catch {
				if (cancelled) return;
				// If either request fails, mark as disconnected.
				setRingCentralConnected(false);
				setAgencyZoomConnected(false);
			}
		}

		loadStatuses();
		const t = window.setInterval(loadStatuses, 30_000);
		return () => {
			cancelled = true;
			window.clearInterval(t);
		};
	}, [isAuthenticated]);

	// Show loading state while checking authentication
	if (isChecking || !isAuthenticated) {
		return (
			<div className="w-full min-h-screen bg-[#F7F5F3] flex items-center justify-center">
				<div className="text-[#37322F]">Loading...</div>
			</div>
		);
	}

	return (
		<SidebarProvider>
			<Sidebar collapsible="icon" data-sidebar="sidebar">
				<SidebarHeader>
					<SidebarHeaderContent
						organizationName={userData?.organization?.Name || null}
					/>
				</SidebarHeader>
				<SidebarContent>
					<SidebarGroup>
						<SidebarGroupContent>
							<SidebarMenu>
								{/* Leads */}
								<SidebarMenuItem>
									<SidebarMenuButton
										tooltip="Leads"
										isActive={pathname.startsWith("/agency-zoom-leads")}
										asChild
									>
										<Link href="/agency-zoom-leads">
											<ContactRound className="size-4" />
											<span>Leads</span>
										</Link>
									</SidebarMenuButton>
								</SidebarMenuItem>

								{/* AI Agents — collapsible group */}
								<Collapsible
									defaultOpen={pathname === "/research-agent" || pathname === "/calls" || pathname === "/research-browser-run"}
									className="group/collapsible"
								>
									<SidebarMenuItem>
										<CollapsibleTrigger asChild>
											<SidebarMenuButton tooltip="AI Agents">
												<Bot className="size-4" />
												<span>AI Agents</span>
												<ChevronRight className="ml-auto size-4 transition-transform group-data-[state=open]/collapsible:rotate-90" />
											</SidebarMenuButton>
										</CollapsibleTrigger>
										<CollapsibleContent>
											<SidebarMenuSub>
												<SidebarMenuSubItem>
													<SidebarMenuSubButton
														asChild
														isActive={pathname === "/research-agent" || pathname === "/research-browser-run"}
													>
														<Link href="/research-agent">
															<ScanSearch className="size-4" />
															<span>Research Agent</span>
														</Link>
													</SidebarMenuSubButton>
												</SidebarMenuSubItem>
												<SidebarMenuSubItem>
													<SidebarMenuSubButton
														asChild
														isActive={pathname === "/calls"}
													>
														<Link href="/calls">
															<Phone className="size-4" />
															<span>Call Listener</span>
														</Link>
													</SidebarMenuSubButton>
												</SidebarMenuSubItem>
											</SidebarMenuSub>
										</CollapsibleContent>
									</SidebarMenuItem>
								</Collapsible>
							</SidebarMenu>
						</SidebarGroupContent>
					</SidebarGroup>
				</SidebarContent>
				<SidebarFooter>
					<SidebarMenu>
						<SidebarMenuItem>
							<SidebarMenuButton
								tooltip={`RingCentral: ${
									ringCentralConnected
										? "Connected"
										: "Disconnected"
								}`}
								asChild
								isActive={pathname === "/settings"}
							>
								<Link href="/settings" className="w-full">
									<img
										src="/RingCentral_logo.png"
										alt="RingCentral"
										className="h-5 w-auto object-contain shrink-0"
									/>
									<span
										className={`h-2 w-2 rounded-full ${
											ringCentralConnected === null
												? "bg-gray-400"
												: ringCentralConnected
													? "bg-green-500"
													: "bg-red-500"
										} ml-auto`}
									/>
								</Link>
							</SidebarMenuButton>
						</SidebarMenuItem>

						<SidebarMenuItem>
							<SidebarMenuButton
								tooltip={`AgencyZoom: ${
									agencyZoomConnected
										? "Connected"
										: "Disconnected"
								}`}
								asChild
								isActive={pathname === "/settings"}
							>
								<Link href="/settings" className="w-full">
									<img
										src="/AgencyZoom-removebg-preview.png"
										alt="AgencyZoom"
										className="h-5 w-auto object-contain shrink-0"
									/>
									<span
										className={`h-2 w-2 rounded-full ${
											agencyZoomConnected === null
												? "bg-gray-400"
												: agencyZoomConnected
													? "bg-green-500"
													: "bg-red-500"
										} ml-auto`}
									/>
								</Link>
							</SidebarMenuButton>
						</SidebarMenuItem>

						<SidebarMenuItem>
							<SidebarMenuButton
								tooltip="Settings"
								isActive={pathname === "/settings"}
								asChild
							>
								<Link href="/settings">
									<Settings className="size-4" />
									<span>Settings</span>
								</Link>
							</SidebarMenuButton>
						</SidebarMenuItem>
						{/* User info section */}
						{userData && (
							<SidebarMenuItem>
								<SidebarMenuButton
									tooltip={userData.user.Name}
									className="w-full cursor-default"
									disabled
								>
									<User className="size-4" />
									<span className="truncate">
										{userData.user.Name}
									</span>
								</SidebarMenuButton>
							</SidebarMenuItem>
						)}
						<SidebarMenuItem>
							<SidebarMenuButton
								tooltip="Sign out"
								onClick={() => {
									removeAuthToken();
									router.push("/login");
								}}
								className="w-full"
							>
								<LogOut className="size-4" />
								<span>Sign out</span>
							</SidebarMenuButton>
						</SidebarMenuItem>
					</SidebarMenu>
				</SidebarFooter>
			</Sidebar>
			<SidebarInset>
				{/* Header with sidebar toggle – visible on all workspace pages */}
				<header className="flex h-16 shrink-0 items-center gap-2 border-b px-4 workspace-page-header">
					<SidebarTrigger className="-ml-1" />
					<h1 className="text-lg font-semibold text-[#37322F]">
						{pageTitle}
					</h1>
				</header>
				{/* Main content area */}
				{children}
			</SidebarInset>
		</SidebarProvider>
	);
}
