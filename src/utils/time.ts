export function formatTime(date: Date | string | number): string {
	const d = new Date(date);
	const options: Intl.DateTimeFormatOptions = {
		year: "numeric",
		month: "short",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
	};
	return d.toLocaleString("en-GB", options);
}
