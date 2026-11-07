export interface MeterLevels {
	left: number
	right: number
	combined: number
}
export interface MeterDisplay extends MeterLevels {
	holdLeft: number
	holdRight: number
	holdCombined: number
}

const toDb = (mul: number): number => (mul > 0 ? 20 * Math.log10(mul) : -Infinity)

/**
 * obs-websocket InputVolumeMeters gives per channel [magnitude*volume, peak*volume, peak].
 * While muted the first two are 0, so the input peak times the volume keeps the meter moving like OBS's grey meter.
 */
export function levelsFor(raw: number[][], muted: boolean, volumeMul: number): MeterLevels {
	const peaks = raw.map((ch) => toDb(muted ? (ch[2] ?? 0) * volumeMul : (ch[1] ?? 0)))
	const left = peaks[0] ?? -Infinity
	const right = peaks.length > 1 ? peaks[1] : left
	return { left, right, combined: peaks.length ? Math.max(...peaks) : -Infinity }
}

// OBS defaults: Settings → Audio → Meter decay rate "Fast" (VOLUME_METER_DECAY_FAST, 40 dB / 1.7 s) and a 20 s peak hold.
export const DECAY_DB_PER_S = 23.53
export const HOLD_MS = 20_000
const KEYS = ['left', 'right', 'combined'] as const

export class MeterTracker {
	private shown: MeterLevels = { left: -Infinity, right: -Infinity, combined: -Infinity }
	private shownAt = 0
	private hold: MeterLevels = { left: -Infinity, right: -Infinity, combined: -Infinity }
	private holdAt: MeterLevels = { left: 0, right: 0, combined: 0 }

	update(levels: MeterLevels, now: number): void {
		const decayed = this.decayed(now)
		for (const k of KEYS) {
			decayed[k] = Math.max(decayed[k], levels[k])
			if (levels[k] >= this.hold[k] || now - this.holdAt[k] > HOLD_MS) {
				this.hold[k] = levels[k]
				this.holdAt[k] = now
			}
		}
		this.shown = decayed
		this.shownAt = now
	}

	display(now: number): MeterDisplay {
		const d = this.decayed(now)
		const held = (k: (typeof KEYS)[number]) => (now - this.holdAt[k] > HOLD_MS ? d[k] : Math.max(this.hold[k], d[k]))
		return { ...d, holdLeft: held('left'), holdRight: held('right'), holdCombined: held('combined') }
	}

	private decayed(now: number): MeterLevels {
		const drop = (DECAY_DB_PER_S * Math.max(0, now - this.shownAt)) / 1000
		return { left: this.shown.left - drop, right: this.shown.right - drop, combined: this.shown.combined - drop }
	}
}
