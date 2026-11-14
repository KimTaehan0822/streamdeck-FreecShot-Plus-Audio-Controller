import { theme } from '../flavour.js'
import type { MeterDisplay } from '../obs/meter-state.js'
import { t } from '../i18n.js'
import { dbText } from '../obs/volume.js'
import { KEY, fitText, frame, plainText, type Overlay } from './svg.js'
import { LINE_HEIGHT, nameBlock } from './text.js'

export type MeterStyle = 'standard' | 'wide'
export type ChannelMode = 'lr' | 'combined'
export type FaderRole = 'top' | 'bottom' | 'left' | 'right'

export interface ObsMeterView {
	name: string
	volumeDb: number
	levels: MeterDisplay
	muted: boolean
	/** muted and the volume changed within the last 700 ms */
	peek: boolean
	style: MeterStyle
	channels: ChannelMode
	overlay: Overlay
}
export type KeyMeterView = Pick<ObsMeterView, 'levels' | 'muted' | 'style' | 'channels' | 'volumeDb'>

// OBS VolumeMeter: sample peak warns at -20 / errors at -9 dB; true peak at -13 / -2 dB.
export const zoneEdges = (style: MeterStyle): [number, number] => (style === 'wide' ? [-13, -2] : [-20, -9])
/** Where the meters start (their low end); the user picks one for every key. The top is always 0 dB like OBS. */
export const METER_FLOORS = [-60, -50, -40, -30] as const
let floor: number = -60
export const meterFloor = (): number => floor
/** Reads the global setting; anything not in METER_FLOORS is -60. True when the floor changed. */
export function setMeterFloor(raw: unknown): boolean {
	const v = typeof raw === 'number' || typeof raw === 'string' ? Number(raw) : NaN
	const next = (METER_FLOORS as readonly number[]).includes(v) ? v : -60
	const changed = next !== floor
	floor = next
	return changed
}
/** Numbers on the scale every 5, 10 or 20 dB: the tightest that keeps them `minGap` px apart (24 by default) on a meter `length` px long. */
export function labelStep(length: number, from: number, minGap = 24): 5 | 10 | 20 {
	for (const step of [5, 10] as const) if ((length * step) / -from >= minGap) return step
	return 20
}

// OBS default theme colours: dim background zones, bright level, grey while muted.
const BG = ['#267f26', '#7f7f26', '#7f2626']
const FG = ['#4cff4c', '#ffff4c', '#ff4c4c']
const BG_MUTED = ['#4a4a4a', '#5a5a5a', '#6a6a6a']
const FG_MUTED = '#bbb'
const RED = 'rgb(255,57,31)'
const WHITE = '#fff'
const GREY = '#ccc'

const n = (x: number) => +x.toFixed(2)
const clamp01 = (x: number) => Math.max(0, Math.min(1, x))
const rect = (x: number, y: number, w: number, h: number, fill: string, rx = 0) =>
	w > 0 && h > 0 ? `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}"${rx ? ` rx="${rx}"` : ''} fill="${fill}"/>` : ''
const levelText = (db: number) => (db === -Infinity || db < -99 ? '-inf' : db.toFixed(1))

interface Box {
	x: number
	y: number
	w: number
	h: number
}
/** Part of the meter (dB) or slider (0..1) range a split key shows. */
interface Range {
	lo: number
	hi: number
}

/** A box laid along its long side; `f` 0..1 from the low end. */
function along(b: Box, vertical: boolean, f0: number, f1: number): Box {
	return vertical ? { x: b.x, y: b.y + b.h * (1 - f1), w: b.w, h: b.h * (f1 - f0) } : { x: b.x + b.w * f0, y: b.y, w: b.w * (f1 - f0), h: b.h }
}

/** One OBS meter bar: three dim zones, the bright level up to `level`, a peak-hold tick. */
function bar(b: Box, vertical: boolean, level: number, hold: number, v: KeyMeterView, r: Range = { lo: meterFloor(), hi: 0 }): string {
	const [warn, err] = zoneEdges(v.style)
	const f = (db: number) => clamp01((db - r.lo) / (r.hi - r.lo))
	const zones: [number, number][] = [
		[meterFloor(), warn],
		[warn, err],
		[err, 0],
	]
	let out = ''
	zones.forEach(([a, z], i) => {
		const box = along(b, vertical, f(a), f(z))
		out += rect(box.x, box.y, box.w, box.h, v.muted ? BG_MUTED[i] : BG[i])
	})
	zones.forEach(([a, z], i) => {
		const top = Math.min(z, level)
		if (top <= a) return
		const box = along(b, vertical, f(a), f(top))
		out += rect(box.x, box.y, box.w, box.h, v.muted ? FG_MUTED : FG[i])
	})
	if (hold > meterFloor() && hold >= r.lo && hold <= r.hi) {
		const zone = hold >= err ? 2 : hold >= warn ? 1 : 0
		const p = along(b, vertical, f(hold), f(hold))
		out += vertical ? rect(p.x, p.y - 1, b.w, 2, v.muted ? FG_MUTED : FG[zone]) : rect(p.x - 1, p.y, 2, b.h, v.muted ? FG_MUTED : FG[zone])
	}
	return out
}

/** L and R bars side by side in `b`. Combined mode changes only the level text, never the bars. */
function bars(b: Box, vertical: boolean, v: KeyMeterView, r?: Range, gap = 3): string {
	const l = v.levels
	const half = vertical ? { ...b, w: (b.w - gap) / 2 } : { ...b, h: (b.h - gap) / 2 }
	const second = vertical ? { ...half, x: b.x + half.w + gap } : { ...half, y: b.y + half.h + gap }
	return bar(half, vertical, l.left, l.holdLeft, v, r) + bar(second, vertical, l.right, l.holdRight, v, r)
}

/** Fader position: a blue line inside the bars at the volume's place on the meter scale (below the start, and -inf, sit at the low end). */
function faderLine(b: Box, vertical: boolean, v: KeyMeterView, width: number, r: Range = { lo: meterFloor(), hi: 0 }): string {
	const db = Math.max(meterFloor(), Math.min(0, v.volumeDb))
	if (db < r.lo || db > r.hi) return ''
	const p = along(b, vertical, (db - r.lo) / (r.hi - r.lo), (db - r.lo) / (r.hi - r.lo))
	const [x1, y1, x2, y2] = vertical ? [b.x, p.y, b.x + b.w, p.y] : [p.x, b.y, p.x, b.y + b.h]
	const line = (stroke: string, w: number) => `<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}" stroke="${stroke}" stroke-width="${w}"/>`
	return line('#000', width + 4) + line(theme().faderLine, width)
}

/** Bars with the fader line on top. */
const meterWithFader = (b: Box, vertical: boolean, v: KeyMeterView, gap: number, width: number) =>
	bars(b, vertical, v, undefined, gap) + faderLine(b, vertical, v, width)

/**
 * OBS-style dB scale beside the bars (below them when horizontal, right of them when vertical):
 * a tick every 5 dB, a longer one and a number every labelStep dB.
 */
function scaleMarks(b: Box, vertical: boolean, size: number, seam?: number): string {
	const lo = meterFloor()
	// Side by side, wider numbers need more room: 24 px fits the 11 px labels, so scale it with the font size.
	const labelEvery = labelStep(vertical ? b.h : b.w, lo, vertical ? 24 : (24 * size) / 11)
	let out = ''
	for (let db = 0; db >= lo; db -= 5) {
		const p = along(b, vertical, (db - lo) / -lo, (db - lo) / -lo)
		const major = db % labelEvery === 0
		// A number on the seam of a two-key fader would be cut in half; keep just its tick there.
		const label = major && (seam === undefined || Math.abs((vertical ? p.y : p.x) - seam) > 10)
		const len = major ? 4 : 2
		const [x1, y1, x2, y2] = vertical ? [b.x + b.w + 2, p.y, b.x + b.w + 2 + len, p.y] : [p.x, b.y + b.h + 2, p.x, b.y + b.h + 2 + len]
		out += `<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}" stroke="#aaa" stroke-width="1"/>`
		if (label)
			out += vertical
				? plainText(n(b.x + b.w + 8), n(p.y + size * 0.35), String(db), { size, fill: '#aaa', anchor: 'start' })
				: plainText(n(p.x), n(b.y + b.h + 6 + size * 0.9), String(db), { size, fill: '#aaa' })
	}
	return out
}

/** OBS look: thin L/R bars 1 apart, the fader line, the dB scale. */
const obsMeter = (b: Box, vertical: boolean, v: KeyMeterView, width: number, size: number, seam?: number) =>
	meterWithFader(b, vertical, v, 1, width) + scaleMarks(b, vertical, size, seam)

/** Volume text, MUTED while muted, the volume again during a peek. */
function volumeLabel(v: Pick<ObsMeterView, 'muted' | 'peek' | 'volumeDb'>): { text: string; fill: string } {
	return v.muted && !v.peek ? { text: t('muted'), fill: RED } : { text: dbText(v.volumeDb), fill: WHITE }
}

const levelLine = (v: KeyMeterView) =>
	v.channels === 'combined' ? `${levelText(v.levels.combined)} dB` : `L ${levelText(v.levels.left)}  R ${levelText(v.levels.right)}`

// Vertical text centre -> SVG baseline
const base = (cy: number, size: number) => n(cy + size * 0.35)

/**
 * Dial strip (200x100) in the TotalMix plugin's layout: centred name, L/R bars with the fader line,
 * level bottom-left (L and R stacked, or one combined value), volume bottom-right, MUTED centred while muted.
 */
export function renderVuStrip(v: ObsMeterView): string {
	let body = nameBlock(v.name, { x: 100, top: 1, width: 192, height: 28, maxLines: 2, size: 20, minSize: 11 })
	body += obsMeter({ x: 12, y: 31, w: 176, h: 19 }, false, v, 3, 11)
	if (!v.muted) {
		const l = v.levels
		body +=
			v.channels === 'combined'
				? plainText(4, base(82, 19), `${levelText(l.combined)} dB`, { size: 19, fill: WHITE, anchor: 'start' })
				: plainText(4, base(82, 19), `L ${levelText(l.left)} R ${levelText(l.right)}`, { size: 16, fill: WHITE, anchor: 'start' })
		body += plainText(196, base(82, 19), dbText(v.volumeDb), { size: 19, fill: WHITE, anchor: 'end' })
	} else {
		const label = volumeLabel(v)
		body += plainText(100, base(82, 19), label.text, { size: 19, fill: label.fill })
	}
	return frame(200, 100, body, v.overlay)
}

/**
 * Two keys draw one fader, in the TotalMix plugin's layout. The pair is one 144x288 (top/bottom) or 288x144
 * (left/right) picture with the meter in the middle crossing the seam; each key shows its half.
 * Text (in 0..100 units of a key, TotalMix rows): top key name + volume, bottom key level;
 * left key name + level, right key volume. While muted the values hide and MUTED takes the bottom/right key's row.
 */
export function renderButtonFader(v: ObsMeterView, role: FaderRole): string {
	const vertical = role === 'top' || role === 'bottom'
	const second = role === 'bottom' || role === 'right'
	const u = KEY / 100
	const size = n(20 * u)
	// The name keeps 6 px from the top and 8 px from the sides (the TotalMix name width): the rounded corners hide more.
	// One line (16..26 px vertical, 16..29 horizontal, whole-pixel steps) at a fixed height, so every fader's meter is the same size side by side.
	const nameSize = vertical ? 26 : 29
	const nameBox = { x: KEY / 2, top: 6, width: KEY - 16, height: nameSize * LINE_HEIGHT, maxLines: 1, size: nameSize, minSize: 16 }
	const nameBottom = nameBox.top + nameBox.height
	// Both keys compute the same geometry (the pair is one picture), so the meter starts where the name ends.
	// Vertical: the volume row under the name, then the meter down to y 216 (72 into the second key), bars 21.5 px each.
	// Horizontal: bars from under the name, growing taller into free space; 16 px from the ends keeps -60 / 0 inside.
	const volumeBaseline = n(nameBottom + 4 + 24 * 0.9)
	let body: string
	if (vertical) {
		const top = volumeBaseline + 10
		body = obsMeter({ x: 34, y: top, w: 44, h: 216 - top }, true, v, 3, 14, KEY)
	} else {
		const top = nameBottom + 6
		body = obsMeter({ x: 16, y: n(top), w: 256, h: n(Math.max(16, 80 - top)) }, false, v, 3, 14, KEY)
	}
	const row = (t: string, cy: number, fill = WHITE) => plainText(KEY / 2, base(cy * u, size), fitText(t, size, KEY - 4), { size, fill })
	const volume = dbText(v.volumeDb)
	const level = `${levelText(v.levels.combined)} dB`
	const label = volumeLabel(v)
	let text = second ? '' : nameBlock(v.name, nameBox)
	if (vertical) text += second ? (v.muted ? row(label.text, 83, label.fill) : row(level, 83)) : v.muted ? '' : plainText(KEY / 2, volumeBaseline, fitText(volume, 24, KEY - 16), { size: 24, fill: WHITE })
	else text += second ? (v.muted ? row(label.text, 83, label.fill) : row(volume, 83)) : v.muted ? '' : row(level, 83)
	const shift = second ? (vertical ? `translate(0 -${KEY})` : `translate(-${KEY} 0)`) : ''
	return frame(KEY, KEY, (shift ? `<g transform="${shift}">${body}</g>` : body) + text, v.overlay)
}

/** OBS-style meter at the bottom of a key (y 104..132), where the TotalMix value key has its meter. */
export function renderKeyMeter(v: KeyMeterView): string {
	return obsMeter({ x: 12, y: 104, w: 120, h: 13 }, false, v, 2, 11)
}
