"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import * as z from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

const schema = z
	.object({
		email: z.string().email("Enter a valid email"),
		password: z.string().min(6, "Password must be at least 6 characters"),
		confirmPassword: z.string(),
	})
	.refine((data) => data.password === data.confirmPassword, {
		message: "Passwords do not match",
		path: ["confirmPassword"],
	});

type FormValues = z.infer<typeof schema>;

export default function SignupByTryingPage() {
	const router = useRouter();
	const [showPassword, setShowPassword] = useState(false);
	const [showConfirm, setShowConfirm] = useState(false);

	const form = useForm<FormValues>({
		resolver: zodResolver(schema),
		defaultValues: {
			email: "",
			password: "",
			confirmPassword: "",
		},
	});

	const onSubmit = (values: FormValues) => {
		// This is a placeholder; wire to your backend when ready.
		console.log("Signup by trying:", values);
		router.push("/home");
	};

	return (
		<div className="w-full min-h-screen bg-[#F7F5F3] flex items-center justify-center p-4">
			<div className="w-full max-w-md bg-white rounded-lg shadow-sm border border-[rgba(55,50,47,0.12)] p-8 space-y-6">
				<h1 className="text-2xl font-semibold text-[#37322F]">
					Sign up by trying
				</h1>
				<p className="text-sm text-[#605A57]">
					Use this form as a starting point for your own signup or trial flow.
					Connect it to your auth backend when you&apos;re ready.
				</p>
				<Form {...form}>
					<form
						onSubmit={form.handleSubmit(onSubmit)}
						className="space-y-4"
					>
						<FormField
							control={form.control}
							name="email"
							render={({ field }) => (
								<FormItem>
									<FormLabel className="text-[#37322F]">
										Email
									</FormLabel>
									<FormControl>
										<Input
											type="email"
											placeholder="you@example.com"
											{...field}
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
						<FormField
							control={form.control}
							name="password"
							render={({ field }) => (
								<FormItem>
									<FormLabel className="text-[#37322F]">
										Password
									</FormLabel>
									<div className="relative">
										<FormControl>
											<Input
												type={
													showPassword
														? "text"
														: "password"
												}
												placeholder="Create a password"
												{...field}
											/>
										</FormControl>
										<button
											type="button"
											onClick={() =>
												setShowPassword((v) => !v)
											}
											className="absolute inset-y-0 right-3 flex items-center text-[#605A57]"
											aria-label={
												showPassword
													? "Hide password"
													: "Show password"
											}
										>
											{showPassword ? (
												<EyeOff className="h-4 w-4" />
											) : (
												<Eye className="h-4 w-4" />
											)}
										</button>
									</div>
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
										Confirm password
									</FormLabel>
									<div className="relative">
										<FormControl>
											<Input
												type={
													showConfirm
														? "text"
														: "password"
												}
												placeholder="Re-enter password"
												{field}
											/>
										</FormControl>
										<button
											type="button"
											onClick={() =>
												setShowConfirm((v) => !v)
											}
											className="absolute inset-y-0 right-3 flex items-center text-[#605A57]"
											aria-label={
												showConfirm
													? "Hide password"
													: "Show password"
											}
										>
											{showConfirm ? (
												<EyeOff className="h-4 w-4" />
											) : (
												<Eye className="h-4 w-4" />
											)}
										</button>
									</div>
									<FormMessage />
								</FormItem>
							)}
						/>
						<Button type="submit" className="w-full">
							Continue
						</Button>
					</form>
				</Form>
			</div>
		</div>
	);
}

