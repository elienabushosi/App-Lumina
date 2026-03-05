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
	SidebarProvider,
	SidebarInset,
	SidebarTrigger,
	useSidebar,
} from "@/components/ui/sidebar";
import {
	Home,
	Search,
	FileText,
	Settings,
	LogOut,
	User,
	FileCheck,
	Users,
	SquareStack,
	SquareDashed,
	Box,
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
			{/* Logo placeholder – replace with your logo image */}
			<div
				className={`flex items-center justify-center rounded border border-[rgba(55,50,47,0.12)] bg-[rgba(55,50,47,0.08)] ${
					isCollapsed ? "h-8 w-10" : "h-9 w-full max-w-[140px]"
				}`}
				aria-hidden
			>
				<span className="text-[9px] text-[#6b7280] text-center px-0.5">
					{isCollapsed ? "32×32" : "140×36"}
				</span>
			</div>
			{/* Company name - hidden when collapsed */}
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
	const isDevBypassAuth =
		process.env.NODE_ENV === "development" &&
		process.env.NEXT_PUBLIC_BYPASS_AUTH === "1";
	const pageTitle = getPageTitle(pathname);

	useEffect(() => {
		const checkAuth = async () => {
			// In development, when NEXT_PUBLIC_BYPASS_AUTH=1, skip real auth
			if (isDevBypassAuth) {
				setUserData({
					user: {
						IdUser: "dev-user-id",
						Name: "Dev User",
						Email: "dev@example.com",
						Role: "admin",
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
	}, [router, isDevBypassAuth]);

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
								<SidebarMenuItem>
									<SidebarMenuButton
										tooltip="Home"
										isActive={
											pathname === "/home" ||
											pathname === "/"
										}
										asChild
									>
										<Link href="/home">
											<Home className="size-4" />
											<span>Home</span>
										</Link>
									</SidebarMenuButton>
								</SidebarMenuItem>
								<SidebarMenuItem>
									<SidebarMenuButton
										tooltip="Main Page 1"
										isActive={
											pathname === "/main-page-1"
										}
										asChild
									>
										<Link href="/main-page-1">
											<SquareDashed className="size-4" />
											<span>Main Page 1</span>
										</Link>
									</SidebarMenuButton>
								</SidebarMenuItem>
								<SidebarMenuItem>
									<SidebarMenuButton
										tooltip="Main Page 2"
										isActive={pathname === "/reports"}
										asChild
									>
										<Link href="/reports">
											<FileText className="size-4" />
											<span>Main Page 2</span>
										</Link>
									</SidebarMenuButton>
								</SidebarMenuItem>
								<SidebarMenuItem>
									<SidebarMenuButton
										tooltip="Items"
										isActive={
											pathname === "/demo-report-list" ||
											pathname.startsWith("/demo-report")
										}
										asChild
									>
										<Link href="/demo-report-list">
											<FileCheck className="size-4" />
											<span>Items</span>
										</Link>
									</SidebarMenuButton>
								</SidebarMenuItem>
								<SidebarMenuItem>
									<SidebarMenuButton
										tooltip="Team"
										isActive={pathname === "/team"}
										asChild
									>
										<Link href="/team">
											<Users className="size-4" />
											<span>Team</span>
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
							</SidebarMenu>
						</SidebarGroupContent>
					</SidebarGroup>
				</SidebarContent>
				<SidebarFooter>
					<SidebarMenu>
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
