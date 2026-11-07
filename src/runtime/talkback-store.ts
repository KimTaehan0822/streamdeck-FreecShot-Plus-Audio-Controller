import { readFileSync, writeFileSync } from 'node:fs'
import type { TalkbackState } from './talkback.js'

export interface TalkbackStore {
	load(): TalkbackState | undefined
	save(state: TalkbackState): void
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** Only a file of the exact shape is used; anything else (torn write, hand edit) is ignored. */
function valid(s: unknown): s is TalkbackState {
	if (!isObject(s) || !isObject(s.keys) || !isObject(s.sources)) return false
	if (!Object.values(s.keys).every((b) => b === 'hold' || b === 'toggle')) return false
	return Object.values(s.sources).every(
		(r) =>
			isObject(r) &&
			typeof r.mul === 'number' &&
			typeof r.mutedByUs === 'boolean' &&
			typeof r.volumeChanged === 'boolean' &&
			Array.isArray(r.holders) &&
			r.holders.every((h) => typeof h === 'string'),
	)
}

/**
 * Keeps the Talkback originals in a file in the plugin folder, so sources can be put back after the plugin, the
 * Stream Deck app or the PC restarts. Not in the key settings: the settings screen writes those whole, and the plugin
 * only sees a key's settings while the key is on screen.
 */
export function talkbackStore(file: string): TalkbackStore {
	return {
		load() {
			try {
				const s: unknown = JSON.parse(readFileSync(file, 'utf8'))
				return valid(s) ? s : undefined
			} catch {
				return undefined // no file yet, or unreadable: nothing to restore
			}
		},
		save(state) {
			try {
				writeFileSync(file, JSON.stringify(state))
			} catch (error) {
				console.error(`Talkback state: ${error instanceof Error ? error.message : String(error)}`)
			}
		},
	}
}
