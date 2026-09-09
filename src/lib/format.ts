export function formatDate(date: Date): string {
	return date
		.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
		.toUpperCase();
}
