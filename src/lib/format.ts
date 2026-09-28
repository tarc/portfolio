export function formatDate(date: Date): string {
	return date
		.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
		.toUpperCase();
}

// The date as YYYY-MM-DD, for <time datetime>.
export function isoDate(date: Date): string {
	return date.toISOString().slice(0, 10);
}
