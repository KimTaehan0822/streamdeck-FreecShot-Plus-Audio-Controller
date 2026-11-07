// OBS mixer slider: libobs OBS_FADER_LOG (obs-audio-controls.c log_db_to_def).
const LOG_OFFSET_DB = 6
const LOG_OFFSET_VAL = -0.77815125038364363
const LOG_RANGE_VAL = -2.00860017176191756

/** Slider position 0..1 for a volume in dB (-Infinity = silent). */
export function sliderPos(db: number): number {
	if (db >= 0) return 1
	if (db <= -96) return 0
	return (-Math.log10(-db + LOG_OFFSET_DB) - LOG_RANGE_VAL) / (LOG_OFFSET_VAL - LOG_RANGE_VAL)
}

/** Lowest audible step; one step further down is -Infinity (the meter's floor is -60 dB too). */
export const FLOOR_DB = -60

/** One step: up stops at 0 dB (a boost set in OBS is kept, not cut), down past the floor goes silent. */
export function stepDb(db: number, delta: number): number {
	if (db === -Infinity) return delta > 0 ? FLOOR_DB : -Infinity
	if (delta > 0) return db < FLOOR_DB ? FLOOR_DB : Math.max(db, Math.min(0, db + delta))
	const next = db + delta
	return next < FLOOR_DB ? -Infinity : next
}

/** A typed-in volume: OBS's slider tops out at 0 dB and treats -100 dB and below as silent. */
export function clampSetDb(db: number): number {
	return db <= -100 ? -Infinity : Math.min(0, db)
}

export const dbText = (db: number): string => (db === -Infinity ? '-inf dB' : `${db.toFixed(1)} dB`)

/** OBS balance 0 (left) .. 0.5 (centre) .. 1 (right), shown as distance from centre in percent. */
export function balanceText(b: number): string {
	const pct = Math.round(Math.abs(b - 0.5) * 200)
	return pct === 0 ? 'C' : `${b < 0.5 ? 'L' : 'R'} ${pct}`
}
