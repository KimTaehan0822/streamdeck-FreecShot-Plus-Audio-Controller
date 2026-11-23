// The meter design picked in the settings (global): one for dials, one for buttons ('same' follows the dials).
// 'plugin' (or anything unknown) leaves the drawing to this plugin's own ./meter.ts.
import { dbText } from '../obs/volume.js'
import { levelText, type ObsMeterView } from './meter.js'
import { SHARED_DESIGNS, isSharedDesign, type MeterDesign, type MeterInput } from './meters/index.js'
import { setVuCalibration, vu } from './meters/vu.js'

let dial: MeterDesign | undefined
let key: MeterDesign | undefined
let current = ''

/** Reads the global settings; true when anything the keys draw changed. */
export function setMeterDesigns(dialRaw: unknown, keyRaw: unknown, vuReference: unknown): boolean {
	const d = isSharedDesign(dialRaw) ? dialRaw : 'plugin'
	const k = keyRaw === undefined || keyRaw === null || keyRaw === '' || keyRaw === 'same' ? d : isSharedDesign(keyRaw) ? keyRaw : 'plugin'
	dial = d === 'plugin' ? undefined : SHARED_DESIGNS[d]
	key = k === 'plugin' ? undefined : SHARED_DESIGNS[k]
	// OBS sends RMS, so no peak offset.
	setVuCalibration(vuReference, 0)
	const next = `${d}|${k}|${String(vuReference ?? '')}`
	const changed = next !== current
	current = next
	return changed
}

/** The design for dials or buttons; undefined = the plugin's own look. */
export const designFor = (surface: 'dial' | 'key'): MeterDesign | undefined => (surface === 'dial' ? dial : key)

/** The VU needle shows RMS; every other design shows the decaying peak, as the plugin's meter does. */
export function toMeterInput(v: ObsMeterView, design: MeterDesign): MeterInput {
	const [leftDb, rightDb] = design === vu ? [v.rms.left, v.rms.right] : [v.levels.left, v.levels.right]
	const l = v.levels
	return {
		name: v.name,
		leftDb,
		rightDb,
		fader: { db: Math.min(0, v.volumeDb) },
		faderText: dbText(v.volumeDb),
		levelText: v.channels === 'combined' ? `${levelText(l.combined)} dB` : `L ${levelText(l.left)} R ${levelText(l.right)}`,
		muted: v.muted,
		peek: v.peek,
		overlay: v.overlay,
	}
}
