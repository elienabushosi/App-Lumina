/** Shared formatters for Call Listener (server + client). */

export function formatCallDate(startTime: string | null): string {
	if (!startTime) return "—";
	const d = new Date(startTime);
	if (Number.isNaN(d.getTime())) return "—";
	return new Intl.DateTimeFormat("en-US", {
		timeZone: "America/New_York",
		month: "2-digit",
		day: "2-digit",
		year: "2-digit",
	}).format(d);
}

export function formatCallTime(startTime: string | null): string {
	if (!startTime) return "—";
	const d = new Date(startTime);
	if (Number.isNaN(d.getTime())) return "—";
	return new Intl.DateTimeFormat("en-US", {
		timeZone: "America/New_York",
		hour: "numeric",
		minute: "2-digit",
		hour12: true,
	}).format(d);
}

export function formatDuration(durationSec: number | null): string {
	if (typeof durationSec !== "number") return "—";
	const minutes = Math.floor(durationSec / 60);
	const seconds = Math.max(0, durationSec % 60);
	return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
