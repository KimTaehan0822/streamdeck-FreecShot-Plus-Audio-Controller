import type { JsonObject } from '@elgato/utils'
import type { ObsSettings } from '../connection.js'
import type { ChannelMode, MeterStyle } from '../render/meter.js'

// Settings come from the PI as strings. A blank or space-only field is "no value": Number(' ') is 0,
// which would jump a volume to 0 dB.
export const num = (v: unknown): number =>
	(typeof v === 'string' && v.trim() === '') || v === null || v === undefined || typeof v === 'boolean' ? NaN : Number(v)
export const pick = <T extends string>(v: unknown, labels: Record<T, unknown>): T | undefined =>
	typeof v === 'string' && Object.hasOwn(labels, v) ? (v as T) : undefined

export function normalizeSettings(raw: Partial<Record<keyof ObsSettings, unknown>>): ObsSettings {
	const port = num(raw.port)
	return {
		host: String(raw.host ?? '').trim() || '127.0.0.1',
		port: Number.isInteger(port) && port >= 1 && port <= 65535 ? port : 4455,
		password: typeof raw.password === 'string' ? raw.password : '',
	}
}

/** A positive step from the settings, else the fallback. */
export function stepOf(s: JsonObject, fallback: number): number {
	const step = num(s.step)
	return step > 0 ? step : fallback
}

export const meterOpts = (s: JsonObject): { style: MeterStyle; channels: ChannelMode } => ({
	style: pick(s.meterStyle, { standard: 1, wide: 1 }) ?? 'standard',
	channels: pick(s.channels, { lr: 1, combined: 1 }) ?? 'lr',
})

export const sourceOf = (s: JsonObject): string | undefined => (typeof s.inputUuid === 'string' && s.inputUuid ? s.inputUuid : undefined)

/** Display name, else the live OBS name, else the name saved when the source was picked. */
export function nameOf(conn: { input(uuid: string): { name: string } | undefined }, s: JsonObject): string {
	const custom = typeof s.displayName === 'string' ? s.displayName.trim() : ''
	if (custom) return custom
	const uuid = sourceOf(s)
	return (uuid && conn.input(uuid)?.name) || (typeof s.inputName === 'string' ? s.inputName : '')
}
