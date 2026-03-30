"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
	getCurrentUser,
	getAuthToken,
	requestPasswordReset,
	resetPassword,
} from "@/lib/auth";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Lock,
	CreditCard,
	Mail,
	CheckCircle2,
	Loader2,
	X,
	Check,
	Gem,
} from "lucide-react";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { config } from "@/lib/config";
import {
	getSubscriptionStatus,
	getProducts,
	createCheckoutSession,
	processCheckoutSession,
	cancelSubscription,
	previewUpgrade,
	upgradeSubscription,
	formatPrice,
	type SubscriptionStatus,
	type StripeProduct,
} from "@/lib/billing";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

const STRIPE_PRODUCT_ID = process.env.NEXT_PUBLIC_STRIPE_PRODUCT_ID ?? "";
const STRIPE_ANNUAL_PRICE_ID =
	process.env.NEXT_PUBLIC_STRIPE_ANNUAL_PRICE_ID ?? "";
const STRIPE_MONTHLY_PRICE_ID =
	process.env.NEXT_PUBLIC_STRIPE_MONTHLY_PRICE_ID ?? "";

const passwordResetSchema = z
	.object({
		code: z
			.string()
			.min(6, "Code must be at least 6 characters")
			.max(10, "Code must be 10 characters or less"),
		newPassword: z
			.string()
			.min(6, "Password must be at least 6 characters"),
		confirmPassword: z.string(),
	})
	.refine((data) => data.newPassword === data.confirmPassword, {
		message: "Passwords do not match",
		path: ["confirmPassword"],
	});

type PasswordResetFormValues = z.infer<typeof passwordResetSchema>;


export default function SettingsPage() {
	const searchParams = useSearchParams();
	const [currentUser, setCurrentUser] = useState<{
		user: {
			IdUser: string;
			Name: string;
			Email: string;
			Role: string;
		};
	} | null>(null);
	const [isLoading, setIsLoading] = useState(true);
const [isRequestingCode, setIsRequestingCode] = useState(false);
	const [isResetting, setIsResetting] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);
	const [codeSent, setCodeSent] = useState(false);
	const [subscriptionStatus, setSubscriptionStatus] =
		useState<SubscriptionStatus | null>(null);
	const [products, setProducts] = useState<StripeProduct[]>([]);
	const [isLoadingBilling, setIsLoadingBilling] = useState(false);
	const [isCreatingCheckout, setIsCreatingCheckout] = useState(false);
	const [isCanceling, setIsCanceling] = useState(false);
	const [showCancelDialog, setShowCancelDialog] = useState(false);
	const [selectedBillingInterval, setSelectedBillingInterval] = useState<
		"month" | "year"
	>("year");
	const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
	const [isPreviewingUpgrade, setIsPreviewingUpgrade] = useState(false);
	const [isUpgrading, setIsUpgrading] = useState(false);
	const [proratedAmount, setProratedAmount] = useState<{
		amount: number;
		currency: string;
		formatted: string;
	} | null>(null);
	const [ringCentralConnected, setRingCentralConnected] = useState<
		boolean | null
	>(null);
	const [rcConnecting, setRcConnecting] = useState(false);
	const [agencyZoomConnected, setAgencyZoomConnected] = useState<
		boolean | null
	>(null);
	const [agencyZoomConnectedEmail, setAgencyZoomConnectedEmail] = useState<string | null>(null);
	const [agencyZoomEmail, setAgencyZoomEmail] = useState("");
	const [agencyZoomPassword, setAgencyZoomPassword] = useState("");
	const [isConnectingAgencyZoom, setIsConnectingAgencyZoom] = useState(false);
	const [agencyZoomError, setAgencyZoomError] = useState<string | null>(null);
	const [agencyZoomSuccess, setAgencyZoomSuccess] = useState<string | null>(
		null,
	);

	type RcExtension = {
		id: string;
		extensionNumber: string | null;
		name: string | null;
		email: string | null;
		status: string | null;
		mapped_user_id: string | null;
	};
	type OrgUser = { IdUser: string; Name: string; Email: string };
	const [rcExtensions, setRcExtensions] = useState<RcExtension[]>([]);
	const [rcExtensionsLoading, setRcExtensionsLoading] = useState(false);
	const [rcExtensionsError, setRcExtensionsError] = useState<string | null>(null);
	const [orgUsers, setOrgUsers] = useState<OrgUser[]>([]);
	const [savingExtMap, setSavingExtMap] = useState<Record<string, boolean>>({});

	// Farmers APEX credentials
	const [sfUsername, setSfUsername] = useState("");
	const [sfPassword, setSfPassword] = useState("");
	const [sfShowPassword, setSfShowPassword] = useState(false);
	const [sfSaving, setSfSaving] = useState(false);
	const [sfSaved, setSfSaved] = useState<{ username: string; updatedAt: string } | null>(null);
	const [sfError, setSfError] = useState<string | null>(null);

	// AgencyZoom config wizard
	type AzCustomField = { fieldName: string; fieldLabel: string; entityType?: string };
	type AzPipeline = { id: number | string; name: string; stages?: { id: number | string; name: string }[] };
	type AzEmployee = { id: number | string; name?: string; firstName?: string; lastName?: string; email?: string };
	type AzLeadSource = { id: number | string; name: string };
	type AzLocation = { agencyNumber?: string; name?: string; locationCode?: string };
	type AzConfig = {
		lead_source_id: string; pipeline_id: string; stage_id: string;
		primary_producer_id: string; primary_csr_id: string; location_code: string; country: string;
		cf_roof_year: string; cf_roof_type: string; cf_flooring_types: string;
		cf_bathrooms: string; cf_occupation_degree: string;
	};
	const EMPTY_AZ_CONFIG: AzConfig = {
		lead_source_id: "", pipeline_id: "", stage_id: "", primary_producer_id: "",
		primary_csr_id: "", location_code: "", country: "US",
		cf_roof_year: "", cf_roof_type: "", cf_flooring_types: "", cf_bathrooms: "", cf_occupation_degree: "",
	};
	const [azConfigLoading, setAzConfigLoading] = useState(false);
	const [azConfigError, setAzConfigError] = useState<string | null>(null);
	const [azConfigSaving, setAzConfigSaving] = useState(false);
	const [azConfigSaved, setAzConfigSaved] = useState(false);
	const [azCustomFields, setAzCustomFields] = useState<AzCustomField[]>([]);
	const [azPipelines, setAzPipelines] = useState<AzPipeline[]>([]);
	const [azEmployees, setAzEmployees] = useState<AzEmployee[]>([]);
	const [azLeadSources, setAzLeadSources] = useState<AzLeadSource[]>([]);
	const [azLocations, setAzLocations] = useState<AzLocation[]>([]);
	const [azConfig, setAzConfig] = useState<AzConfig>(EMPTY_AZ_CONFIG);

	const isOwner = currentUser?.user.Role === "Owner";

	const form = useForm<PasswordResetFormValues>({
		resolver: zodResolver(passwordResetSchema),
		defaultValues: {
			code: "",
			newPassword: "",
			confirmPassword: "",
		},
	});

	useEffect(() => {
		const ringcentral = searchParams.get("ringcentral");
		if (ringcentral === "connected") {
			setRcConnecting(false);
			setSuccess("RingCentral connected successfully.");
			setRingCentralConnected(true);
			window.history.replaceState({}, "", "/settings");
		} else if (ringcentral === "error") {
			setRcConnecting(false);
			const msg = searchParams.get("message") || "Connection failed.";
			const friendlyMsg = msg === "no_code" || msg === "exchange_failed"
				? "RingCentral authorization did not complete. Ask your RC admin to enable Third Party App Access on your account and ensure a Digital Line is assigned, then try again."
				: `RingCentral: ${msg}`;
			setError(friendlyMsg);
			window.history.replaceState({}, "", "/settings");
		}
	}, [searchParams]);

	useEffect(() => {
		const fetchRingCentralStatus = async () => {
			try {
				const token = getAuthToken();
				const res = await fetch(
					`${config.apiUrl}/api/ringcentral/status`,
					{ headers: token ? { Authorization: `Bearer ${token}` } : {} },
				);
				const data = await res.json();
				setRingCentralConnected(data.connected ?? false);
			} catch {
				setRingCentralConnected(false);
			}
		};
		const fetchAgencyZoomStatus = async () => {
			try {
				const token = getAuthToken();
				const res = await fetch(
					`${config.apiUrl}/api/agencyzoom/status`,
					{ headers: token ? { Authorization: `Bearer ${token}` } : {} },
				);
				const data = await res.json();
				setAgencyZoomConnected(data.connected ?? false);
				setAgencyZoomConnectedEmail(data.az_email ?? null);
			} catch {
				setAgencyZoomConnected(false);
				setAgencyZoomConnectedEmail(null);
			}
		};
		fetchRingCentralStatus();
		fetchAgencyZoomStatus();
	}, []);

useEffect(() => {
		const fetchUser = async () => {
			try {
				const user = await getCurrentUser();
				setCurrentUser(user);
			} catch (err) {
				console.error("Error fetching user:", err);
			} finally {
				setIsLoading(false);
			}
		};

		fetchUser();

		// Check if code is in URL (from email link)
		const codeFromUrl = searchParams.get("resetCode");
		if (codeFromUrl) {
			form.setValue("code", codeFromUrl);
			setCodeSent(true); // Auto-show form if code is in URL
		}

		// Check for Stripe checkout session_id in URL
		const sessionId = searchParams.get("session_id");
		if (sessionId) {
			// Process checkout session manually (fallback if webhook didn't fire)
			const processSession = async () => {
				try {
					console.log("Processing checkout session:", sessionId);
					await processCheckoutSession(sessionId);
					setSuccess("Subscription activated successfully!");
					// Refresh subscription status
					await fetchSubscriptionStatus();
				} catch (err) {
					console.error("Error processing checkout session:", err);
					// Still try to refresh in case webhook processed it
					setTimeout(() => {
						fetchSubscriptionStatus();
					}, 2000);
				}
			};
			processSession();
		}
	}, [searchParams, form]);

	// Fetch subscription status and products
	const fetchSubscriptionStatus = async () => {
		try {
			setIsLoadingBilling(true);
			const status = await getSubscriptionStatus();
			setSubscriptionStatus(status);
		} catch (err) {
			console.error("Error fetching subscription status:", err);
		} finally {
			setIsLoadingBilling(false);
		}
	};

	const fetchProducts = async () => {
		try {
			const productsList = await getProducts();
			setProducts(productsList);
		} catch (err) {
			console.error("Error fetching products:", err);
			setError(
				err instanceof Error
					? err.message
					: "Failed to load pricing plans",
			);
		}
	};

	useEffect(() => {
		// Fetch subscription status for all users
		fetchSubscriptionStatus();

		// Fetch products only for owners
		if (isOwner) {
			fetchProducts();
		}
	}, [isOwner]);

	// Set toggle to match current subscription interval (only if subscription is active)
	useEffect(() => {
		if (
			subscriptionStatus?.status === "active" &&
			subscriptionStatus.plan &&
			products.length > 0
		) {
			const currentProduct = products.find(
				(p) => p.priceId === subscriptionStatus.plan,
			);
			if (currentProduct) {
				const interval =
					currentProduct.interval === "month" ? "month" : "year";
				setSelectedBillingInterval(interval);
			}
		} else {
			// Default to annual if no active subscription
			setSelectedBillingInterval("year");
		}
	}, [subscriptionStatus, products]);

	const handleRequestCode = async () => {
		setIsRequestingCode(true);
		setError(null);
		setSuccess(null);
		setCodeSent(false);

		try {
			const response = await fetch(
				`${config.apiUrl}/api/auth/password/request-reset`,
				{
					method: "POST",
					headers: {
						Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
						"Content-Type": "application/json",
					},
				},
			);

			const result = await response.json();

			if (!response.ok) {
				throw new Error(
					result.message || "Failed to send password reset code",
				);
			}

			setCodeSent(true);
			setSuccess("Password reset code sent to your email");
		} catch (err) {
			setError(
				err instanceof Error
					? err.message
					: "Failed to request password reset code",
			);
		} finally {
			setIsRequestingCode(false);
		}
	};

	const onSubmit = async (data: PasswordResetFormValues) => {
		setIsResetting(true);
		setError(null);
		setSuccess(null);

		try {
			await resetPassword(data.code, data.newPassword);
			setSuccess("Password updated successfully!");
			form.reset();
			setCodeSent(false);
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Failed to reset password",
			);
		} finally {
			setIsResetting(false);
		}
	};

	const handleSelectPlan = async (priceId: string) => {
		if (!priceId) return;

		setIsCreatingCheckout(true);
		setError(null);

		try {
			const { url } = await createCheckoutSession(priceId);
			// Redirect to Stripe Checkout
			window.location.href = url;
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Failed to start checkout",
			);
			setIsCreatingCheckout(false);
		}
	};

	const handleCancelSubscription = async () => {
		setIsCanceling(true);
		setError(null);
		setShowCancelDialog(false);

		try {
			await cancelSubscription();
			setSuccess(
				"Subscription will be canceled at the end of the current period",
			);
			// Refresh subscription status to show updated cancelAtPeriodEnd
			await fetchSubscriptionStatus();
		} catch (err) {
			setError(
				err instanceof Error
					? err.message
					: "Failed to cancel subscription",
			);
		} finally {
			setIsCanceling(false);
		}
	};

	const handleConnectAgencyZoom = async () => {
		setIsConnectingAgencyZoom(true);
		setAgencyZoomError(null);
		setAgencyZoomSuccess(null);

		try {
			const azToken = getAuthToken();
			const res = await fetch(`${config.apiUrl}/api/agencyzoom/connect`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					...(azToken ? { Authorization: `Bearer ${azToken}` } : {}),
				},
				body: JSON.stringify({
					email: agencyZoomEmail,
					password: agencyZoomPassword,
				}),
			});

			const data = await res.json();

			if (!res.ok || !data.success) {
				throw new Error(
					data.error || "Failed to connect to AgencyZoom",
				);
			}

			setAgencyZoomSuccess("AgencyZoom connected successfully.");
			setAgencyZoomConnected(true);
			setAgencyZoomConnectedEmail(data.az_email ?? agencyZoomEmail);
		} catch (err) {
			setAgencyZoomError(
				err instanceof Error
					? err.message
					: "Failed to connect to AgencyZoom",
			);
			setAgencyZoomConnected(false);
		} finally {
			setIsConnectingAgencyZoom(false);
		}
	};

	const handleRcConnect = async () => {
		try {
			const token = getAuthToken();
			const res = await fetch(`${config.apiUrl}/api/ringcentral/auth-url`, {
				headers: token ? { Authorization: `Bearer ${token}` } : {},
			});
			const data = await res.json();
			if (data.url) {
				setRcConnecting(true);
				setTimeout(() => {
					setRcConnecting(false);
					setError("RingCentral connection timed out. If you're stuck on a screen in RingCentral, your account may need additional setup — ask your RC admin to enable Third Party App Access and ensure a Digital Line is assigned to your account. Then try connecting again.");
				}, 45000);
				window.location.href = data.url;
			}
		} catch {
			setError("Failed to initiate RingCentral connection.");
		}
	};

	const fetchRcExtensions = async () => {
		setRcExtensionsLoading(true);
		setRcExtensionsError(null);
		try {
			const token = getAuthToken();
			const [extRes, usersRes] = await Promise.all([
				fetch(`${config.apiUrl}/api/ringcentral/extensions`, {
					headers: token ? { Authorization: `Bearer ${token}` } : {},
				}),
				fetch(`${config.apiUrl}/api/auth/org-users`, {
					headers: token ? { Authorization: `Bearer ${token}` } : {},
				}),
			]);
			const extData = await extRes.json();
			if (!extRes.ok) throw new Error(extData.error || "Failed to load extensions");
			setRcExtensions(extData.extensions ?? []);
			if (usersRes.ok) {
				const uData = await usersRes.json();
				setOrgUsers(uData.users ?? []);
			}
		} catch (e) {
			setRcExtensionsError(e instanceof Error ? e.message : "Failed to load extensions");
		} finally {
			setRcExtensionsLoading(false);
		}
	};

	const handleMapExtension = async (ext: RcExtension, userId: string) => {
		setSavingExtMap((prev) => ({ ...prev, [ext.id]: true }));
		try {
			const token = getAuthToken();
			await fetch(`${config.apiUrl}/api/ringcentral/extensions/map`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					...(token ? { Authorization: `Bearer ${token}` } : {}),
				},
				body: JSON.stringify({
					rc_extension_id: ext.id,
					rc_extension_number: ext.extensionNumber,
					rc_display_name: ext.name,
					id_user: userId || null,
				}),
			});
			setRcExtensions((prev) =>
				prev.map((e) => (e.id === ext.id ? { ...e, mapped_user_id: userId || null } : e))
			);
		} finally {
			setSavingExtMap((prev) => ({ ...prev, [ext.id]: false }));
		}
	};

	useEffect(() => {
		const fetchSfCredentials = async () => {
			try {
				const token = getAuthToken();
				const res = await fetch(`${config.apiUrl}/api/auth/sf-credentials`, {
					headers: token ? { Authorization: `Bearer ${token}` } : {},
				});
				if (res.ok) {
					const data = await res.json();
					if (data.set) {
						setSfSaved({ username: data.sf_username, updatedAt: data.updated_at });
					}
				}
			} catch {
				// ignore — non-critical
			}
		};
		fetchSfCredentials();
	}, []);

	const handleSaveSfCredentials = async () => {
		if (!sfUsername || !sfPassword) return;
		setSfSaving(true);
		setSfError(null);
		try {
			const token = getAuthToken();
			const res = await fetch(`${config.apiUrl}/api/auth/sf-credentials`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					...(token ? { Authorization: `Bearer ${token}` } : {}),
				},
				body: JSON.stringify({ sf_username: sfUsername, sf_password: sfPassword }),
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || "Failed to save credentials");
			setSfSaved({ username: sfUsername, updatedAt: new Date().toISOString() });
			setSfUsername("");
			setSfPassword("");
		} catch (e) {
			setSfError(e instanceof Error ? e.message : "Failed to save credentials");
		} finally {
			setSfSaving(false);
		}
	};

	// Fuzzy match: given a list of AZ custom fields, find the best match for a Lumina concept
	function fuzzyMatchField(fields: AzCustomField[], keywords: string[]): string {
		for (const field of fields) {
			const label = (field.fieldLabel ?? field.fieldName ?? "").toLowerCase();
			if (keywords.some((kw) => label.includes(kw))) return field.fieldName;
		}
		return "";
	}

	const fetchAzConfig = async () => {
		setAzConfigLoading(true);
		setAzConfigError(null);
		try {
			const token = getAuthToken();
			const res = await fetch(`${config.apiUrl}/api/agencyzoom/config/all`, {
				headers: token ? { Authorization: `Bearer ${token}` } : {},
			});
			if (!res.ok) throw new Error("Could not load AgencyZoom config. Try again. If the issue persists, try reconnecting with an admin account — you can request admin access from your AgencyZoom account owner, or ask them to configure your organization's settings directly in Lumina.");
			const data = await res.json();

			// Normalize custom fields — filter to entityType "lead" if present
			const allFields: AzCustomField[] = Array.isArray(data.customFields)
				? data.customFields
				: (data.customFields?.data ?? []);
			const leadFields = allFields.filter((f) => !f.entityType || f.entityType === "lead");
			setAzCustomFields(leadFields);

			const pipelines: AzPipeline[] = Array.isArray(data.pipelinesAndStages)
				? data.pipelinesAndStages
				: (data.pipelinesAndStages?.data ?? []);
			setAzPipelines(pipelines);

			const employees: AzEmployee[] = Array.isArray(data.employees)
				? data.employees
				: (data.employees?.data ?? []);
			setAzEmployees(employees);

			const leadSources: AzLeadSource[] = Array.isArray(data.leadSources)
				? data.leadSources
				: (data.leadSources?.data ?? []);
			setAzLeadSources(leadSources);

			const locations: AzLocation[] = Array.isArray(data.locations)
				? data.locations
				: (data.locations?.data ?? []);
			setAzLocations(locations);

			// Pre-populate from saved config or fuzzy auto-match
			const saved = data.savedConfig;
			setAzConfig({
				lead_source_id:      saved?.lead_source_id      ?? String(leadSources[0]?.id ?? ""),
				pipeline_id:         saved?.pipeline_id         ?? String(pipelines[0]?.id ?? ""),
				stage_id:            saved?.stage_id            ?? String(pipelines[0]?.stages?.[0]?.id ?? ""),
				primary_producer_id: saved?.primary_producer_id ?? String(employees[0]?.id ?? ""),
				primary_csr_id:      saved?.primary_csr_id      ?? "",
				location_code:       saved?.location_code       ?? (locations[0]?.agencyNumber ?? locations[0]?.locationCode ?? ""),
				country:             saved?.country             ?? "US",
				cf_roof_year:        saved?.cf_roof_year        ?? fuzzyMatchField(leadFields, ["roof year", "year roof", "year of roof"]),
				cf_roof_type:        saved?.cf_roof_type        ?? fuzzyMatchField(leadFields, ["roof type", "type of roof", "roof material", "roof style"]),
				cf_flooring_types:   saved?.cf_flooring_types   ?? fuzzyMatchField(leadFields, ["flooring", "floor type", "floor material"]),
				cf_bathrooms:        saved?.cf_bathrooms        ?? fuzzyMatchField(leadFields, ["bathroom", "bath", "number of bath"]),
				cf_occupation_degree: saved?.cf_occupation_degree ?? fuzzyMatchField(leadFields, ["occupation", "occupation degree"]),
			});
		} catch (e) {
			setAzConfigError(e instanceof Error ? e.message : "Failed to load config");
		} finally {
			setAzConfigLoading(false);
		}
	};

	const handleSaveAzConfig = async () => {
		setAzConfigSaving(true);
		setAzConfigError(null);
		try {
			const token = getAuthToken();
			const res = await fetch(`${config.apiUrl}/api/agencyzoom/config`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					...(token ? { Authorization: `Bearer ${token}` } : {}),
				},
				body: JSON.stringify(azConfig),
			});
			if (!res.ok) throw new Error("Failed to save config");
			setAzConfigSaved(true);
			setTimeout(() => setAzConfigSaved(false), 3000);
		} catch (e) {
			setAzConfigError(e instanceof Error ? e.message : "Failed to save config");
		} finally {
			setAzConfigSaving(false);
		}
	};

	const handleUpgradeClick = async () => {
		// Find annual price ID
		const annualPriceId = products.find(
			(p) =>
				p.id === STRIPE_PRODUCT_ID &&
				p.priceId === STRIPE_ANNUAL_PRICE_ID,
		)?.priceId;

		if (!annualPriceId) {
			setError("Annual plan not found");
			return;
		}

		setIsPreviewingUpgrade(true);
		setError(null);
		setProratedAmount(null);

		try {
			const preview = await previewUpgrade(annualPriceId);
			setProratedAmount({
				amount: preview.proratedAmount,
				currency: preview.currency,
				formatted: preview.formattedAmount,
			});
			setShowUpgradeDialog(true);
		} catch (err) {
			setError(
				err instanceof Error
					? err.message
					: "Failed to preview upgrade",
			);
		} finally {
			setIsPreviewingUpgrade(false);
		}
	};

	const handleConfirmUpgrade = async () => {
		// Find annual price ID
		const annualPriceId = products.find(
			(p) =>
				p.id === STRIPE_PRODUCT_ID &&
				p.priceId === STRIPE_ANNUAL_PRICE_ID,
		)?.priceId;

		if (!annualPriceId) {
			setError("Annual plan not found");
			return;
		}

		setIsUpgrading(true);
		setError(null);

		try {
			await upgradeSubscription(annualPriceId);
			setSuccess("Subscription upgraded successfully!");
			setShowUpgradeDialog(false);
			setProratedAmount(null);
			// Refresh subscription status
			await fetchSubscriptionStatus();
		} catch (err) {
			setError(
				err instanceof Error
					? err.message
					: "Failed to upgrade subscription",
			);
		} finally {
			setIsUpgrading(false);
		}
	};

	const getStatusBadgeColor = (status: string) => {
		switch (status) {
			case "active":
				return "bg-green-100 text-green-700 border-green-200";
			case "past_due":
				return "bg-yellow-100 text-yellow-700 border-yellow-200";
			case "canceled":
				return "bg-gray-100 text-gray-700 border-gray-200";
			default:
				return "bg-gray-100 text-gray-700 border-gray-200";
		}
	};

	const getStatusLabel = (status: string) => {
		switch (status) {
			case "active":
				return "Active";
			case "past_due":
				return "Payment Failed";
			case "canceled":
				return "Canceled";
			case "none":
				return "No Subscription";
			default:
				return status;
		}
	};

	if (isLoading) {
		return (
			<div className="p-8">
				<div className="max-w-2xl mx-auto">
					<h1 className="text-2xl font-semibold text-[#37322F] mb-6">
						Settings
					</h1>
					<div className="space-y-6">
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<Lock className="h-5 w-5" />
									Change Password
								</CardTitle>
							</CardHeader>
							<CardContent className="space-y-4">
								<Skeleton className="h-4 w-full" />
								<Skeleton className="h-4 w-3/4" />
								<Skeleton className="h-10 w-48" />
							</CardContent>
						</Card>
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<CreditCard className="h-5 w-5" />
									Billing
								</CardTitle>
							</CardHeader>
							<CardContent>
								<Skeleton className="h-4 w-full" />
								<Skeleton className="h-4 w-2/3 mt-2" />
							</CardContent>
						</Card>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="p-8">
			<div className="max-w-2xl mx-auto">
				<h1 className="text-2xl font-semibold text-[#37322F] mb-6">
					Settings
				</h1>

				<div className="space-y-6">
	{/* Change Password Section */}
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<Lock className="h-5 w-5" />
								Change Password
							</CardTitle>
						</CardHeader>
						<CardContent className="space-y-4">
							{!codeSent ? (
								<div className="space-y-4">
									<p className="text-sm text-[#605A57]">
										Click the button below to receive a
										password reset code via email. The code
										will expire in 15 minutes.
									</p>
									<Button
										onClick={handleRequestCode}
										disabled={isRequestingCode}
										className="bg-[#37322F] hover:bg-[#37322F]/90 text-white"
									>
										{isRequestingCode ? (
											"Sending..."
										) : (
											<>
												<Mail className="h-4 w-4 mr-2" />
												Send Password Reset Code
											</>
										)}
									</Button>
								</div>
							) : (
								<Form {...form}>
									<form
										onSubmit={form.handleSubmit(onSubmit)}
										className="space-y-4"
									>
										{success && (
											<div className="p-3 bg-green-50 border border-green-200 rounded-md flex items-center gap-2 text-green-700 text-sm">
												<CheckCircle2 className="h-4 w-4" />
												{success}
											</div>
										)}
										{error && (
											<div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
												{error}
											</div>
										)}
										<FormField
											control={form.control}
											name="code"
											render={({ field }) => (
												<FormItem>
													<FormLabel className="text-[#37322F]">
														Reset Code
													</FormLabel>
													<FormControl>
														<Input
															type="text"
															placeholder="Enter reset code"
															maxLength={10}
															{...field}
														/>
													</FormControl>
													<FormMessage />
												</FormItem>
											)}
										/>
										<FormField
											control={form.control}
											name="newPassword"
											render={({ field }) => (
												<FormItem>
													<FormLabel className="text-[#37322F]">
														New Password
													</FormLabel>
													<FormControl>
														<Input
															type="password"
															placeholder="Enter new password"
															{...field}
														/>
													</FormControl>
													<FormMessage />
												</FormItem>
											)}
										/>
										<FormField
											control={form.control}
											name="confirmPassword"
											render={({ field }) => (
												<FormItem>
													<FormLabel className="text-[#37322F]">
														Confirm New Password
													</FormLabel>
													<FormControl>
														<Input
															type="password"
															placeholder="Confirm new password"
															{...field}
														/>
													</FormControl>
													<FormMessage />
												</FormItem>
											)}
										/>
										<div className="flex gap-3">
											<Button
												type="submit"
												disabled={isResetting}
												className="bg-[#37322F] hover:bg-[#37322F]/90 text-white"
											>
												{isResetting
													? "Updating..."
													: "Update Password"}
											</Button>
											<Button
												type="button"
												variant="outline"
												onClick={() => {
													setCodeSent(false);
													form.reset();
													setError(null);
													setSuccess(null);
												}}
											>
												Cancel
											</Button>
										</div>
									</form>
								</Form>
							)}
						</CardContent>
					</Card>

					{/* RingCentral */}
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<img
									src="/RingCentral_logo.png"
									alt="RingCentral"
									className="h-8 w-auto object-contain shrink-0"
								/>
							</CardTitle>
						</CardHeader>
						<CardContent className="space-y-4">
							<p className="text-sm text-[#605A57]">
								Connect your RingCentral account so Lumina can
								process calls and create leads.
							</p>
							{ringCentralConnected === null ? (
								<div className="flex items-center gap-2 text-sm text-[#605A57]">
									<Loader2 className="h-4 w-4 animate-spin" />
									Checking connection...
								</div>
							) : ringCentralConnected ? (
								<div className="space-y-4">
									<div className="flex items-center justify-between gap-3">
										<div className="flex items-center gap-2 text-sm text-green-700">
											<CheckCircle2 className="h-4 w-4" />
											Connected
										</div>
										<Button
											variant="outline"
											size="sm"
											className="text-xs border-[#E0DEDB] text-[#37322F]"
											onClick={handleRcConnect}
										>
											Reconnect
										</Button>
									</div>
									{isOwner && (
										<div className="space-y-3">
											<div className="flex items-center justify-between">
												<p className="text-sm font-medium text-[#37322F]">
													Map Extensions to Agents
												</p>
												<Button
													variant="outline"
													size="sm"
													className="text-xs border-[#E0DEDB] text-[#37322F]"
													onClick={fetchRcExtensions}
													disabled={rcExtensionsLoading}
												>
													{rcExtensionsLoading ? (
														<><Loader2 className="h-3 w-3 mr-1.5 animate-spin" />Loading...</>
													) : rcExtensions.length > 0 ? "Refresh" : "Load Extensions"}
												</Button>
											</div>
											{rcExtensionsError && (
												<p className="text-xs text-red-700">{rcExtensionsError}</p>
											)}
											{rcExtensions.length > 0 && (
												<div className="border border-[#E0DEDB] rounded-md divide-y divide-[#E0DEDB]">
													{rcExtensions.map((ext) => (
														<div key={ext.id} className="flex items-center justify-between gap-3 p-2.5">
															<div className="min-w-0">
																<p className="text-sm font-medium text-[#37322F] truncate">
																	{ext.name ?? "Unnamed"}{ext.extensionNumber ? ` (ext. ${ext.extensionNumber})` : ""}
																</p>
																{ext.email && <p className="text-xs text-[#605A57] truncate">{ext.email}</p>}
															</div>
															<select
																className="text-sm border border-[#E0DEDB] rounded px-2 py-1 bg-white text-[#37322F] shrink-0 disabled:opacity-50"
																value={ext.mapped_user_id ?? ""}
																disabled={!!savingExtMap[ext.id]}
																onChange={(e) => handleMapExtension(ext, e.target.value)}
															>
																<option value="">— unassigned —</option>
																{orgUsers.map((u) => (
																	<option key={u.IdUser} value={u.IdUser}>{u.Name}</option>
																))}
															</select>
														</div>
													))}
												</div>
											)}
										</div>
									)}
								</div>
							) : (
								<div className="flex items-center justify-between gap-3">
									<div className="flex items-center gap-2 text-sm text-red-700">
										<X className="h-4 w-4" />
										Disconnected
									</div>
									<Button
										className="bg-[#37322F] hover:bg-[#37322F]/90 text-white"
										onClick={handleRcConnect}
									>
										Reconnect
									</Button>
								</div>
							)}
						</CardContent>
					</Card>

					{/* AgencyZoom */}
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<img
									src="/AgencyZoom-removebg-preview.png"
									alt="AgencyZoom"
									className="h-8 w-auto object-contain shrink-0"
								/>
							</CardTitle>
						</CardHeader>
						<CardContent className="space-y-4">
							<p className="text-sm text-[#605A57]">
								Connect your AgencyZoom account so Lumina can
								sync leads and activity.
							</p>
							{agencyZoomConnected ? (
								<div className="space-y-4">
									<div className="flex items-center justify-between gap-3">
										<div className="flex items-center gap-2 text-sm text-green-700">
											<CheckCircle2 className="h-4 w-4" />
											{agencyZoomConnectedEmail ? `Connected as ${agencyZoomConnectedEmail}` : "Connected"}
										</div>
										{isOwner && (
											<button
												type="button"
												onClick={fetchAzConfig}
												disabled={azConfigLoading}
												className="text-xs border border-[#E0DEDB] rounded px-2 py-1 bg-white text-[#37322F] hover:bg-gray-50 disabled:opacity-50"
											>
												{azConfigLoading ? (
													<span className="flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" />Loading...</span>
												) : "Configure AgencyZoom"}
											</button>
										)}
									</div>
									{azConfigError && (
										<div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
											{azConfigError}
										</div>
									)}
									{azCustomFields.length > 0 && (
										<div className="space-y-3 border-t border-[#E0DEDB] pt-3">
											<div>
												<label className="block text-xs font-medium text-[#605A57] mb-1">Pipeline</label>
												<select
													className="w-full text-sm border border-[#E0DEDB] rounded px-2 py-1 bg-white text-[#37322F]"
													value={azConfig.pipeline_id}
													onChange={(e) => setAzConfig((prev) => ({ ...prev, pipeline_id: e.target.value, stage_id: "" }))}
												>
													<option value="">— select —</option>
													{azPipelines.map((p) => (
														<option key={p.id} value={String(p.id)}>{p.name}</option>
													))}
												</select>
											</div>
											<div>
												<label className="block text-xs font-medium text-[#605A57] mb-1">Stage</label>
												<select
													className="w-full text-sm border border-[#E0DEDB] rounded px-2 py-1 bg-white text-[#37322F]"
													value={azConfig.stage_id}
													onChange={(e) => setAzConfig((prev) => ({ ...prev, stage_id: e.target.value }))}
												>
													<option value="">— select —</option>
													{(azPipelines.find((p) => String(p.id) === azConfig.pipeline_id)?.stages ?? []).map((s) => (
														<option key={s.id} value={String(s.id)}>{s.name}</option>
													))}
												</select>
											</div>
											<div>
												<label className="block text-xs font-medium text-[#605A57] mb-1">Lead Source</label>
												<select
													className="w-full text-sm border border-[#E0DEDB] rounded px-2 py-1 bg-white text-[#37322F]"
													value={azConfig.lead_source_id}
													onChange={(e) => setAzConfig((prev) => ({ ...prev, lead_source_id: e.target.value }))}
												>
													<option value="">— select —</option>
													{azLeadSources.map((ls) => (
														<option key={ls.id} value={String(ls.id)}>{ls.name}</option>
													))}
												</select>
											</div>
											<div>
												<label className="block text-xs font-medium text-[#605A57] mb-1">Primary Producer</label>
												<select
													className="w-full text-sm border border-[#E0DEDB] rounded px-2 py-1 bg-white text-[#37322F]"
													value={azConfig.primary_producer_id}
													onChange={(e) => setAzConfig((prev) => ({ ...prev, primary_producer_id: e.target.value }))}
												>
													<option value="">— select —</option>
													{azEmployees.map((emp) => (
														<option key={emp.id} value={String(emp.id)}>
															{emp.name ?? `${emp.firstName ?? ""} ${emp.lastName ?? ""}`.trim()}
														</option>
													))}
												</select>
											</div>
											<div>
												<label className="block text-xs font-medium text-[#605A57] mb-1">
													Primary CSR <span className="text-[#A0998F] font-normal">(optional)</span>
												</label>
												<select
													className="w-full text-sm border border-[#E0DEDB] rounded px-2 py-1 bg-white text-[#37322F]"
													value={azConfig.primary_csr_id}
													onChange={(e) => setAzConfig((prev) => ({ ...prev, primary_csr_id: e.target.value }))}
												>
													<option value="">— none —</option>
													{azEmployees.map((emp) => (
														<option key={emp.id} value={String(emp.id)}>
															{emp.name ?? `${emp.firstName ?? ""} ${emp.lastName ?? ""}`.trim()}
														</option>
													))}
												</select>
											</div>
											<div>
												<label className="block text-xs font-medium text-[#605A57] mb-1">Location / Agency Number</label>
												<select
													className="w-full text-sm border border-[#E0DEDB] rounded px-2 py-1 bg-white text-[#37322F]"
													value={azConfig.location_code}
													onChange={(e) => setAzConfig((prev) => ({ ...prev, location_code: e.target.value }))}
												>
													<option value="">— select —</option>
													{azLocations.map((loc, i) => {
														const val = loc.agencyNumber ?? loc.locationCode ?? "";
														const label = loc.agencyNumber ?? loc.locationCode ?? loc.name ?? val;
														return <option key={i} value={val}>{label}</option>;
													})}
												</select>
											</div>
											<div className="border-t border-[#E0DEDB] pt-3 space-y-2">
												<p className="text-xs font-medium text-[#605A57]">Custom Field Mapping</p>
												<div>
													<label className="block text-xs text-[#605A57] mb-1">Roof Year field</label>
													<select
														className="w-full text-sm border border-[#E0DEDB] rounded px-2 py-1 bg-white text-[#37322F]"
														value={azConfig.cf_roof_year}
														onChange={(e) => setAzConfig((prev) => ({ ...prev, cf_roof_year: e.target.value }))}
													>
														<option value="">— select —</option>
														{azCustomFields.map((f) => (
															<option key={f.fieldName} value={f.fieldName}>{f.fieldLabel}</option>
														))}
													</select>
												</div>
												<div>
													<label className="block text-xs text-[#605A57] mb-1">Roof Type field</label>
													<select
														className="w-full text-sm border border-[#E0DEDB] rounded px-2 py-1 bg-white text-[#37322F]"
														value={azConfig.cf_roof_type}
														onChange={(e) => setAzConfig((prev) => ({ ...prev, cf_roof_type: e.target.value }))}
													>
														<option value="">— select —</option>
														{azCustomFields.map((f) => (
															<option key={f.fieldName} value={f.fieldName}>{f.fieldLabel}</option>
														))}
													</select>
												</div>
												<div>
													<label className="block text-xs text-[#605A57] mb-1">Flooring Types field</label>
													<select
														className="w-full text-sm border border-[#E0DEDB] rounded px-2 py-1 bg-white text-[#37322F]"
														value={azConfig.cf_flooring_types}
														onChange={(e) => setAzConfig((prev) => ({ ...prev, cf_flooring_types: e.target.value }))}
													>
														<option value="">— select —</option>
														{azCustomFields.map((f) => (
															<option key={f.fieldName} value={f.fieldName}>{f.fieldLabel}</option>
														))}
													</select>
												</div>
												<div>
													<label className="block text-xs text-[#605A57] mb-1">Bathrooms field</label>
													<select
														className="w-full text-sm border border-[#E0DEDB] rounded px-2 py-1 bg-white text-[#37322F]"
														value={azConfig.cf_bathrooms}
														onChange={(e) => setAzConfig((prev) => ({ ...prev, cf_bathrooms: e.target.value }))}
													>
														<option value="">— select —</option>
														{azCustomFields.map((f) => (
															<option key={f.fieldName} value={f.fieldName}>{f.fieldLabel}</option>
														))}
													</select>
												</div>
												<div>
													<label className="block text-xs text-[#605A57] mb-1">Occupation Degree field</label>
													<select
														className="w-full text-sm border border-[#E0DEDB] rounded px-2 py-1 bg-white text-[#37322F]"
														value={azConfig.cf_occupation_degree}
														onChange={(e) => setAzConfig((prev) => ({ ...prev, cf_occupation_degree: e.target.value }))}
													>
														<option value="">— select —</option>
														{azCustomFields.map((f) => (
															<option key={f.fieldName} value={f.fieldName}>{f.fieldLabel}</option>
														))}
													</select>
												</div>
											</div>
											<div className="flex items-center gap-2 pt-1">
												<button
													type="button"
													onClick={handleSaveAzConfig}
													disabled={azConfigSaving}
													className="flex items-center gap-1.5 text-sm bg-[#37322F] hover:bg-[#37322F]/90 text-white rounded px-3 py-1.5 disabled:opacity-50"
												>
													{azConfigSaving ? (
														<><Loader2 className="h-3 w-3 animate-spin" />Saving...</>
													) : azConfigSaved ? (
														<><CheckCircle2 className="h-3 w-3" />Saved</>
													) : "Save"}
												</button>
											</div>
										</div>
									)}
								</div>
							) : (
								<>
									{agencyZoomError && (
										<div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
											{agencyZoomError}
										</div>
									)}
									{agencyZoomSuccess && (
										<div className="p-3 bg-green-50 border border-green-200 rounded-md flex items-center gap-2 text-green-700 text-sm">
											<CheckCircle2 className="h-4 w-4" />
											{agencyZoomSuccess}
										</div>
									)}
									<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
										<div>
											<label className="block text-sm font-medium text-[#37322F] mb-1">
												AgencyZoom Email
											</label>
											<Input
												type="email"
												value={agencyZoomEmail}
												onChange={(e) =>
													setAgencyZoomEmail(
														e.target.value,
													)
												}
												placeholder="Enter your AgencyZoom login email"
											/>
										</div>
										<div>
											<label className="block text-sm font-medium text-[#37322F] mb-1">
												AgencyZoom Password
											</label>
											<Input
												type="password"
												value={agencyZoomPassword}
												onChange={(e) =>
													setAgencyZoomPassword(
														e.target.value,
													)
												}
												placeholder="Enter your AgencyZoom password"
											/>
										</div>
									</div>
									<Button
										onClick={handleConnectAgencyZoom}
										disabled={
											isConnectingAgencyZoom ||
											!agencyZoomEmail ||
											!agencyZoomPassword
										}
										className="bg-[#37322F] hover:bg-[#37322F]/90 text-white"
									>
										{isConnectingAgencyZoom ? (
											<>
												<Loader2 className="h-4 w-4 mr-2 animate-spin" />
												Connecting...
											</>
										) : (
											"Connect AgencyZoom"
										)}
									</Button>
								</>
							)}
						</CardContent>
					</Card>

					{/* Farmers APEX Login */}
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2 text-base">
								<img
									src="/salesforce-farmers.png"
									alt="Farmers APEX"
									className="h-14 w-auto object-contain shrink-0"
								/>
							</CardTitle>
							<p className="text-sm text-[#605A57]">
								Your Salesforce/APEX credentials for browser automation. Stored securely and used only for proposal creation.
							</p>
						</CardHeader>
						<CardContent className="space-y-4">
							{sfSaved && (
								<div className="flex items-center gap-2 text-sm text-green-700">
									<CheckCircle2 className="h-4 w-4 shrink-0" />
									<span>
										Credentials saved for <strong>{sfSaved.username}</strong>
										{" "}· last updated {format(new Date(sfSaved.updatedAt), "MMM d, yyyy")}
									</span>
								</div>
							)}
							{sfError && (
								<div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
									{sfError}
								</div>
							)}
							<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
								<div>
									<label className="block text-sm font-medium text-[#37322F] mb-1">
										Username
									</label>
									<Input
										type="text"
										value={sfUsername}
										onChange={(e) => setSfUsername(e.target.value)}
										placeholder={sfSaved ? sfSaved.username : "Enter Salesforce username"}
									/>
								</div>
								<div>
									<label className="block text-sm font-medium text-[#37322F] mb-1">
										Password
									</label>
									<div className="relative">
										<Input
											type={sfShowPassword ? "text" : "password"}
											value={sfPassword}
											onChange={(e) => setSfPassword(e.target.value)}
											placeholder={sfSaved ? "••••••••" : "Enter Salesforce password"}
											className="pr-10"
										/>
										<button
											type="button"
											onClick={() => setSfShowPassword((v) => !v)}
											className="absolute right-2 top-1/2 -translate-y-1/2 text-[#605A57] hover:text-[#37322F] text-xs"
										>
											{sfShowPassword ? "Hide" : "Show"}
										</button>
									</div>
								</div>
							</div>
							<Button
								onClick={handleSaveSfCredentials}
								disabled={sfSaving || !sfUsername || !sfPassword}
								className="bg-[#37322F] hover:bg-[#37322F]/90 text-white"
							>
								{sfSaving ? (
									<><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</>
								) : sfSaved ? "Update Credentials" : "Save Credentials"}
							</Button>
						</CardContent>
					</Card>

					{/* Billing Section */}
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<CreditCard className="h-5 w-5" />
								Billing
							</CardTitle>
						</CardHeader>
						<CardContent className="space-y-6">
							{/* Current Subscription Status - All users can see */}
							{isLoadingBilling ? (
								<div className="flex items-center gap-2 text-sm text-[#605A57]">
									<Loader2 className="h-4 w-4 animate-spin" />
									Loading subscription status...
								</div>
							) : subscriptionStatus ? (
								<div className="space-y-3">
									<div className="flex items-center justify-between">
										<div>
											<p className="text-sm text-[#605A57] mb-1">
												Current Status
											</p>
											<Badge
												variant="outline"
												className={getStatusBadgeColor(
													subscriptionStatus.status,
												)}
											>
												{getStatusLabel(
													subscriptionStatus.status,
												)}
											</Badge>
										</div>
										{subscriptionStatus.status ===
											"active" &&
											subscriptionStatus.currentPeriodEnd && (
												<div className="text-right">
													<p className="text-xs text-[#605A57]">
														{subscriptionStatus.cancelAtPeriodEnd
															? "Active till"
															: "Renews on"}
													</p>
													<p className="text-sm font-medium text-[#37322F]">
														{format(
															new Date(
																subscriptionStatus.currentPeriodEnd,
															),
															"MMM d, yyyy",
														)}
													</p>
												</div>
											)}
									</div>

									{subscriptionStatus.status === "active" &&
										isOwner && (
											<>
												{subscriptionStatus.cancelAtPeriodEnd && (
													<div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
														<p className="text-sm text-yellow-700">
															<strong>
																Subscription
																Canceled
															</strong>{" "}
															- Active until{" "}
															{subscriptionStatus.currentPeriodEnd
																? format(
																		new Date(
																			subscriptionStatus.currentPeriodEnd,
																		),
																		"MMM d, yyyy",
																	)
																: "end of period"}
														</p>
													</div>
												)}
												{!subscriptionStatus.cancelAtPeriodEnd && (
													<>
														<Button
															variant="outline"
															onClick={() =>
																setShowCancelDialog(
																	true,
																)
															}
															disabled={
																isCanceling
															}
															className="w-full text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
														>
															<X className="h-4 w-4 mr-2" />
															Cancel Subscription
														</Button>

														{/* Cancel Subscription Confirmation Dialog */}
														<AlertDialog
															open={
																showCancelDialog
															}
															onOpenChange={
																setShowCancelDialog
															}
														>
															<AlertDialogContent>
																{/* Logo placeholder */}
																<div className="flex justify-center mb-4">
																	<div
																		className="h-8 w-32 sm:h-9 sm:w-36 bg-[rgba(55,50,47,0.08)] rounded border border-[rgba(55,50,47,0.12)] flex items-center justify-center"
																		aria-hidden
																	>
																		<span className="text-[10px] text-[#6b7280] text-center">
																			144×36
																		</span>
																	</div>
																</div>
																<AlertDialogHeader>
																	<AlertDialogTitle>
																		Sorry to
																		see you
																		go!
																	</AlertDialogTitle>
																	<AlertDialogDescription>
																		Are you
																		sure you
																		want to
																		cancel
																		your
																		subscription?
																		It will
																		remain
																		active
																		until
																		the end
																		of the
																		current
																		billing
																		period.
																	</AlertDialogDescription>
																</AlertDialogHeader>
																<AlertDialogFooter>
																	<AlertDialogCancel
																		disabled={
																			isCanceling
																		}
																	>
																		Keep
																		Subscription
																	</AlertDialogCancel>
																	<AlertDialogAction
																		onClick={
																			handleCancelSubscription
																		}
																		disabled={
																			isCanceling
																		}
																		className="bg-red-600 hover:bg-red-700 text-white"
																	>
																		{isCanceling ? (
																			<>
																				<Loader2 className="h-4 w-4 mr-2 animate-spin" />
																				Canceling...
																			</>
																		) : (
																			"Cancel Subscription"
																		)}
																	</AlertDialogAction>
																</AlertDialogFooter>
															</AlertDialogContent>
														</AlertDialog>
													</>
												)}
											</>
										)}
								</div>
							) : (
								<p className="text-sm text-[#605A57]">
									Unable to load subscription status
								</p>
							)}

							{/* Current Subscription Details - Show above Available Plans */}
							{isOwner &&
								subscriptionStatus?.status === "active" &&
								(() => {
									const currentSubscriptionPriceId =
										subscriptionStatus?.plan;
									const currentSubscriptionProduct =
										currentSubscriptionPriceId
											? products.find(
													(p) =>
														p.priceId ===
														currentSubscriptionPriceId,
												)
											: null;

									if (!currentSubscriptionProduct)
										return null;

									const quantity =
										subscriptionStatus?.quantity || 1;
									const perSeatPrice =
										currentSubscriptionProduct.amount || 0;
									const totalPrice = perSeatPrice * quantity;

									return (
										<div className="pt-4 border-t border-[#E0DEDB]">
											<Card className="border-2 border-[#6f9f6b] bg-green-50/30">
												<CardHeader>
													<CardTitle className="text-lg flex items-center gap-2">
														<CheckCircle2 className="h-5 w-5 text-[#6f9f6b]" />
														Current Subscription
													</CardTitle>
												</CardHeader>
												<CardContent>
													<div className="space-y-4">
														<div className="flex items-center justify-between">
															<div>
																<p className="font-semibold text-[#37322F]">
																	{
																		currentSubscriptionProduct.name
																	}
																</p>
																<p className="text-sm text-[#605A57]">
																	{currentSubscriptionProduct.interval ===
																	"month"
																		? "Billed monthly"
																		: "Billed annually"}
																</p>
															</div>
															<div className="text-right">
																<p className="text-2xl font-bold text-[#37322F]">
																	{formatPrice(
																		totalPrice,
																		currentSubscriptionProduct.currency,
																		currentSubscriptionProduct.priceId,
																	)}
																</p>
																<p className="text-xs text-[#605A57]">
																	{currentSubscriptionProduct.interval ===
																	"month"
																		? "per month"
																		: "per year"}
																</p>
															</div>
														</div>

														{/* Seat Count Breakdown */}
														<div className="pt-3 border-t border-[#E0DEDB]">
															<div className="flex items-center justify-between text-sm">
																<span className="text-[#605A57]">
																	{quantity}{" "}
																	{quantity ===
																	1
																		? "seat"
																		: "seats"}{" "}
																	@{" "}
																	{formatPrice(
																		perSeatPrice,
																		currentSubscriptionProduct.currency,
																		currentSubscriptionProduct.priceId,
																	)}
																	/
																	{currentSubscriptionProduct.interval ===
																	"month"
																		? "month"
																		: "year"}
																</span>
																<span className="font-semibold text-[#37322F]">
																	={" "}
																	{formatPrice(
																		totalPrice,
																		currentSubscriptionProduct.currency,
																		currentSubscriptionProduct.priceId,
																	)}
																	/
																	{currentSubscriptionProduct.interval ===
																	"month"
																		? "month"
																		: "year"}
																</span>
															</div>
														</div>

														{/* Upgrade Button - Only show for monthly subscribers */}
														{currentSubscriptionProduct.priceId ===
															STRIPE_MONTHLY_PRICE_ID &&
															(() => {
																const annualPriceForUpgrade =
																	products.find(
																		(p) =>
																			p.id ===
																				STRIPE_PRODUCT_ID &&
																			p.priceId ===
																				STRIPE_ANNUAL_PRICE_ID,
																	);
																const upgradeMonthlyAnnualCost =
																	currentSubscriptionProduct.amount
																		? currentSubscriptionProduct.amount *
																			12
																		: 0;
																const upgradeAnnualCost =
																	annualPriceForUpgrade?.amount ||
																	0;
																const upgradeSavings =
																	upgradeMonthlyAnnualCost -
																	upgradeAnnualCost;
																const upgradeSavingsFormatted =
																	upgradeSavings >
																		0 &&
																	annualPriceForUpgrade?.currency
																		? new Intl.NumberFormat(
																				"en-US",
																				{
																					style: "currency",
																					currency:
																						annualPriceForUpgrade.currency.toUpperCase(),
																					minimumFractionDigits: 0,
																					maximumFractionDigits: 0,
																				},
																			).format(
																				Math.floor(
																					upgradeSavings /
																						100,
																				),
																			)
																		: null;

																return (
																	<Button
																		onClick={
																			handleUpgradeClick
																		}
																		disabled={
																			isPreviewingUpgrade ||
																			isUpgrading
																		}
																		className="w-full bg-[#37322F] hover:bg-[#37322F]/90 text-white"
																	>
																		{isPreviewingUpgrade ? (
																			<>
																				<Loader2 className="h-4 w-4 mr-2 animate-spin" />
																				Calculating...
																			</>
																		) : upgradeSavingsFormatted ? (
																			`Upgrade & save ${upgradeSavingsFormatted} annually`
																		) : (
																			"Upgrade to annual plan"
																		)}
																	</Button>
																);
															})()}
													</div>
												</CardContent>
											</Card>
										</div>
									);
								})()}

							{/* Pricing Plans - Owner Only */}
							{isOwner &&
								(() => {
									// Hide available plans if user is on monthly subscription
									const isMonthlySubscriber =
										subscriptionStatus?.status ===
											"active" &&
										subscriptionStatus.plan ===
											STRIPE_MONTHLY_PRICE_ID;

									if (isMonthlySubscriber) {
										return null; // Don't show available plans for monthly subscribers
									}

									return (
										<div className="space-y-4 pt-4 border-t border-[#E0DEDB]">
											<div>
												<h3 className="text-lg font-semibold text-[#37322F] mb-2">
													Available Plans
												</h3>
												<p className="text-sm text-[#605A57] mb-4">
													Choose a plan that works for
													your organization
												</p>
											</div>

											{products.length === 0 ? (
												<div className="text-sm text-[#605A57]">
													Loading pricing plans...
												</div>
											) : (
												(() => {
													// Find current subscription price
													const currentSubscriptionPriceId =
														subscriptionStatus?.plan;
													const currentSubscriptionProduct =
														currentSubscriptionPriceId
															? products.find(
																	(p) =>
																		p.priceId ===
																		currentSubscriptionPriceId,
																)
															: null;

													// Group products by product ID to show monthly/annual toggle
													const productGroups =
														products.reduce(
															(acc, product) => {
																if (
																	!acc[
																		product
																			.id
																	]
																) {
																	acc[
																		product.id
																	] = {
																		id: product.id,
																		name: product.name,
																		description:
																			product.description,
																		prices: [],
																	};
																}
																acc[
																	product.id
																].prices.push(
																	product,
																);
																return acc;
															},
															{} as Record<
																string,
																{
																	id: string;
																	name: string;
																	description:
																		| string
																		| null;
																	prices: StripeProduct[];
																}
															>,
														);

													const productGroupsArray =
														Object.values(
															productGroups,
														);

													return (
														<div className="space-y-6">
															{productGroupsArray.map(
																(group) => {
																	const monthlyPrice =
																		group.prices.find(
																			(
																				p,
																			) =>
																				p.interval ===
																				"month",
																		);
																	const annualPrice =
																		group.prices.find(
																			(
																				p,
																			) =>
																				p.interval ===
																				"year",
																		);
																	const selectedPrice =
																		selectedBillingInterval ===
																		"month"
																			? monthlyPrice
																			: annualPrice;

																	// Annual discount calculation – product-agnostic; works with any Stripe monthly/annual prices
																	const monthlyAnnualCost =
																		monthlyPrice?.amount
																			? monthlyPrice.amount *
																				12
																			: 0;
																	const annualCost =
																		annualPrice?.amount ||
																		0;
																	const savings =
																		monthlyAnnualCost -
																		annualCost;
																	const savingsFormatted =
																		savings >
																			0 &&
																		annualPrice?.currency
																			? new Intl.NumberFormat(
																					"en-US",
																					{
																						style: "currency",
																						currency:
																							annualPrice.currency.toUpperCase(),
																						minimumFractionDigits: 0,
																						maximumFractionDigits: 0,
																					},
																				).format(
																					Math.floor(
																						savings /
																							100,
																					),
																				)
																			: null;
																	const savingsPercentage =
																		monthlyAnnualCost >
																			0 &&
																		savings >
																			0
																			? Math.ceil(
																					(savings /
																						monthlyAnnualCost) *
																						100,
																				)
																			: null;

																	return (
																		<Card
																			key={
																				group.id
																			}
																			className="hover:shadow-md transition-shadow"
																		>
																			<CardHeader>
																				<CardTitle className="text-lg">
																					{
																						group.name
																					}
																				</CardTitle>
																				{group.description && (
																					<p className="text-sm text-[#605A57]">
																						{
																							group.description
																						}
																					</p>
																				)}
																			</CardHeader>
																			<CardContent className="space-y-4">
																				{/* Features List */}
																				<div className="space-y-3">
																					{[
																						"Feature 1",
																						"Feature 2",
																						"Feature 3",
																						"Feature 4",
																						"Feature 5",
																					].map(
																						(
																							feature,
																						) => (
																							<div
																								key={
																									feature
																								}
																								className="flex items-center gap-3"
																							>
																								<div
																									className="h-6 w-6 rounded-full flex items-center justify-center shrink-0"
																									style={{
																										backgroundColor:
																											"#6f9f6b",
																									}}
																								>
																									<Check className="h-4 w-4 text-white" />
																								</div>
																								<span className="text-sm text-[#37322F]">
																									{
																										feature
																									}
																								</span>
																							</div>
																						),
																					)}
																				</div>

																				{/* Additional Benefits Section */}
																				<div className="space-y-3 pt-4 border-t border-[rgba(55,50,47,0.12)]">
																					{[
																						"Benefit 1",
																						"Benefit 2",
																						"Benefit 3",
																					].map(
																						(
																							benefit,
																						) => (
																							<div
																								key={
																									benefit
																								}
																								className="flex items-center gap-3"
																							>
																								<Gem className="h-4 w-4 shrink-0 text-[#6f9f6b]" />
																								<span className="text-sm text-[#37322F]">
																									{
																										benefit
																									}
																								</span>
																							</div>
																						),
																					)}
																				</div>
																				{/* Billing Interval Toggle */}
																				{monthlyPrice &&
																					annualPrice && (
																						<div className="flex items-center gap-2 p-1 bg-gray-100 rounded-lg">
																							<button
																								type="button"
																								onClick={() =>
																									setSelectedBillingInterval(
																										"year",
																									)
																								}
																								className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors relative ${
																									selectedBillingInterval ===
																									"year"
																										? "bg-white text-[#37322F] shadow-sm"
																										: "text-[#605A57] hover:text-[#37322F]"
																								}`}
																							>
																								<div className="flex flex-col items-center gap-1">
																									<span>
																										Billed
																										Annually
																									</span>
																									{savingsPercentage && (
																										<Badge className="bg-green-600 text-white text-xs border-0 px-2 py-0.5">
																											Saving{" "}
																											{
																												savingsPercentage
																											}

																											%
																										</Badge>
																									)}
																								</div>
																							</button>
																							<button
																								type="button"
																								onClick={() =>
																									setSelectedBillingInterval(
																										"month",
																									)
																								}
																								className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
																									selectedBillingInterval ===
																									"month"
																										? "bg-white text-[#37322F] shadow-sm"
																										: "text-[#605A57] hover:text-[#37322F]"
																								}`}
																							>
																								Billed
																								Monthly
																							</button>
																						</div>
																					)}

																				<div>
																					<div className="text-lg font-bold text-[#37322F]">
																						{selectedPrice
																							? selectedBillingInterval ===
																								"year"
																								? new Intl.NumberFormat(
																										"en-US",
																										{
																											style: "currency",
																											currency:
																												(
																													selectedPrice.currency ||
																													"usd"
																												).toUpperCase(),
																											minimumFractionDigits: 0,
																											maximumFractionDigits: 0,
																										},
																									).format(
																										Math.floor(
																											(selectedPrice.amount ||
																												0) /
																												1200,
																										),
																									)
																								: new Intl.NumberFormat(
																										"en-US",
																										{
																											style: "currency",
																											currency:
																												(
																													selectedPrice.currency ||
																													"usd"
																												).toUpperCase(),
																											minimumFractionDigits: 0,
																											maximumFractionDigits: 0,
																										},
																									).format(
																										Math.floor(
																											(selectedPrice.amount ||
																												0) /
																												100,
																										),
																									)
																							: "$249"}
																					</div>
																					{selectedBillingInterval ===
																						"month" && (
																						<div className="text-xs text-[#605A57] mt-0.5">
																							per
																							month
																						</div>
																					)}
																					{selectedBillingInterval ===
																						"year" && (
																						<>
																							<div className="text-xs text-[#605A57] mt-0.5">
																								per
																								month
																							</div>
																							{savingsFormatted && (
																								<div className="text-xs text-green-600 font-medium mt-1">
																									Save{" "}
																									{
																										savingsFormatted
																									}{" "}
																									annually
																								</div>
																							)}
																						</>
																					)}
																				</div>
																				<Button
																					onClick={() =>
																						selectedPrice?.priceId &&
																						handleSelectPlan(
																							selectedPrice.priceId,
																						)
																					}
																					disabled={
																						!selectedPrice?.priceId ||
																						isCreatingCheckout ||
																						subscriptionStatus?.status ===
																							"active"
																					}
																					className="w-full bg-[#37322F] hover:bg-[#37322F]/90 text-white"
																				>
																					{isCreatingCheckout ? (
																						<>
																							<Loader2 className="h-4 w-4 mr-2 animate-spin" />
																							Processing...
																						</>
																					) : subscriptionStatus?.status ===
																					  "active" ? (
																						"Current Plan"
																					) : (
																						"Select Plan"
																					)}
																				</Button>
																			</CardContent>
																		</Card>
																	);
																},
															)}
														</div>
													);
												})()
											)}
										</div>
									);
								})()}
						</CardContent>
					</Card>

					{/* Upgrade Confirmation Dialog */}
					<AlertDialog
						open={showUpgradeDialog}
						onOpenChange={setShowUpgradeDialog}
					>
						<AlertDialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
							{/* Logo placeholder */}
							<div className="flex justify-center mb-4">
								<div
									className="h-8 w-32 sm:h-9 sm:w-36 bg-[rgba(55,50,47,0.08)] rounded border border-[rgba(55,50,47,0.12)] flex items-center justify-center"
									aria-hidden
								>
									<span className="text-[10px] text-[#6b7280] text-center">
										144×36
									</span>
								</div>
							</div>
							<AlertDialogHeader>
								<AlertDialogTitle>
									Upgrade to Annual Plan
								</AlertDialogTitle>
								<AlertDialogDescription>
									{(() => {
										const dialogMonthlyPrice =
											products.find(
												(p) =>
													p.id ===
														STRIPE_PRODUCT_ID &&
													p.priceId ===
														STRIPE_MONTHLY_PRICE_ID,
											);
										const dialogAnnualPrice = products.find(
											(p) =>
												p.id === STRIPE_PRODUCT_ID &&
												p.priceId ===
													STRIPE_ANNUAL_PRICE_ID,
										);
										const dialogMonthlyAnnualCost =
											dialogMonthlyPrice?.amount
												? dialogMonthlyPrice.amount * 12
												: 0;
										const dialogAnnualCost =
											dialogAnnualPrice?.amount || 0;
										const dialogSavings =
											dialogMonthlyAnnualCost -
											dialogAnnualCost;
										const dialogSavingsFormatted =
											dialogSavings > 0 &&
											dialogAnnualPrice?.currency
												? new Intl.NumberFormat(
														"en-US",
														{
															style: "currency",
															currency:
																dialogAnnualPrice.currency.toUpperCase(),
															minimumFractionDigits: 0,
															maximumFractionDigits: 0,
														},
													).format(
														Math.floor(
															dialogSavings / 100,
														),
													)
												: null;

										return dialogSavingsFormatted
											? `Upgrade your subscription to the annual plan and save ${dialogSavingsFormatted} per year. You'll be charged a prorated amount based on the time remaining in your current billing period.`
											: "Upgrade your subscription to the annual plan. You'll be charged a prorated amount based on the time remaining in your current billing period.";
									})()}
								</AlertDialogDescription>
							</AlertDialogHeader>
							<div className="py-4">
								{proratedAmount && (
									<div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
										<p className="text-sm text-blue-800 mb-1">
											<strong>
												Amount to be charged:
											</strong>
										</p>
										<p className="text-2xl font-bold text-blue-900">
											{proratedAmount.formatted}
										</p>
										<p className="text-xs text-blue-700 mt-1">
											This is the prorated amount after
											crediting your remaining monthly
											subscription.
										</p>
									</div>
								)}
							</div>
							<AlertDialogFooter>
								<AlertDialogCancel disabled={isUpgrading}>
									Cancel
								</AlertDialogCancel>
								<AlertDialogAction
									onClick={handleConfirmUpgrade}
									disabled={isUpgrading}
									className="bg-[#37322F] hover:bg-[#37322F]/90 text-white"
								>
									{isUpgrading ? (
										<>
											<Loader2 className="h-4 w-4 mr-2 animate-spin" />
											Upgrading...
										</>
									) : (
										"Confirm Upgrade"
									)}
								</AlertDialogAction>
							</AlertDialogFooter>
						</AlertDialogContent>
					</AlertDialog>
				</div>
			</div>
		</div>
	);
}
