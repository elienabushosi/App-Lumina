/**
 * Pretty-print phone numbers for the Calls UI.
 * US/Canada NANP (+1): +1 (AAA) BBB-CCCC
 * Other values: pass through with leading + if digits only, else original string.
 */
export function formatDisplayPhone(
	input: string | null | undefined
): string {
	if (input == null || String(input).trim() === "") return "—";

	const raw = String(input).trim();
	const digits = raw.replace(/\D/g, "");

	if (digits.length === 0) return raw;

	// US / Canada: 10-digit national or 11-digit with country code 1
	if (digits.length === 10) {
		return `+1 (${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
	}
	if (digits.length === 11 && digits[0] === "1") {
		const n = digits.slice(1);
		return `+1 (${n.slice(0, 3)}) ${n.slice(3, 6)}-${n.slice(6)}`;
	}

	// International or extensions: keep + and all digits
	if (raw.startsWith("+") || digits.length > 11) {
		return `+${digits}`;
	}

	return raw;
}
