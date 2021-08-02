export function sleep(p_ms: number) {
	return new Promise(resolve => setTimeout(resolve, p_ms));
}
