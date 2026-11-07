// Remembers when the volume of a source last changed from the Stream Deck, so a muted dial can briefly show the new value.
export const FADER_PEEK_MS = 700

const adjustedAt = new Map<string, number>()

export function markFaderAdjusted(target: string, now = Date.now()): void {
	adjustedAt.set(target, now)
}

export function faderAdjustedRecently(target: string, now = Date.now()): boolean {
	const last = adjustedAt.get(target)
	return last !== undefined && now - last < FADER_PEEK_MS
}
