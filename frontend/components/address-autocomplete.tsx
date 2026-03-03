"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";

// Kept for type compatibility with existing imports. Values are boilerplate.
export interface AddressData {
	address: string;
	normalizedAddress: string;
	location: {
		lat: number;
		lng: number;
	};
	placeId: string;
	state?: string;
}

interface AddressAutocompleteProps {
	onAddressSelect: (data: AddressData) => void;
	placeholder?: string;
	className?: string;
}

export default function AddressAutocomplete({
	onAddressSelect,
	placeholder = "Enter an address",
	className,
}: AddressAutocompleteProps) {
	const [value, setValue] = useState("");

	const emit = () => {
		if (!value.trim()) return;
		const trimmed = value.trim();

		onAddressSelect({
			address: trimmed,
			normalizedAddress: trimmed,
			location: { lat: 0, lng: 0 },
			placeId: "",
			state: undefined,
		});
	};

	return (
		<Input
			type="text"
			placeholder={placeholder}
			className={className}
			value={value}
			onChange={(e) => setValue(e.target.value)}
			onBlur={emit}
			onKeyDown={(e) => {
				if (e.key === "Enter") {
					e.preventDefault();
					emit();
				}
			}}
			autoComplete="off"
		/>
	);
}

