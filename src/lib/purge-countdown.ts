/** Human-readable time until automatic permanent deletion. */
export function formatPurgeCountdown(expiresAt: Date | string | null): string {
	if (!expiresAt) return '';
	const ms = new Date(expiresAt).getTime() - Date.now();
	if (ms <= 0) return 'Removal pending';
	const hours = Math.ceil(ms / (60 * 60 * 1000));
	if (hours < 24) {
		return hours === 1 ? '1 hour left' : `${hours} hours left`;
	}
	const days = Math.ceil(ms / (24 * 60 * 60 * 1000));
	return days === 1 ? '1 day left' : `${days} days left`;
}
