// "Big number": thin large fader value and two slim L/R bars, after the TOPPING app's volume screen (mockup approved 2026-11-16).
import { t } from '../../i18n.js'
import { KEY, escapeXml, frame, plainText } from '../svg.js'
import { fitSize, fitText, textWidth } from './measure.js'
import { nameBlock } from './text.js'
import { MUTED_RED, base, clamp01, n, safeDb, type FaderRole, type MeterDesign, type MeterInput, type MeterKeyInput } from './types.js'

const WHITE = '#fff'
const GREY = '#bbb'
const TRACK = '#1d2a30'
const MUTED_BAR = '#555'
// Bars are linear in dB from -60 to 0 dBFS.
const barFrac = (db: number) => clamp01((safeDb(db) + 60) / 60)

function thinBars(x: number, y: number, w: number, h: number, gap: number, l: number, r: number, muted: boolean, id: string, vertical = false): string {
	const grad = vertical
		? `<linearGradient id="${id}" x1="0" x2="0" y1="${y + h}" y2="${y}" gradientUnits="userSpaceOnUse">`
		: `<linearGradient id="${id}" x1="${x}" x2="${x + w}" y1="0" y2="0" gradientUnits="userSpaceOnUse">`
	const stops = '<stop offset="0" stop-color="rgb(40,150,190)"/><stop offset="0.7" stop-color="rgb(90,200,200)"/><stop offset="1" stop-color="rgb(240,220,80)"/></linearGradient>'
	const fill = muted ? MUTED_BAR : `url(#${id})`
	const one = (i: number, db: number) => {
		const f = barFrac(db)
		if (vertical) {
			const xx = x + i * (w + gap)
			return `<rect x="${n(xx)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" fill="${TRACK}"/>` + (f > 0 ? `<rect x="${n(xx)}" y="${n(y + h * (1 - f))}" width="${n(w)}" height="${n(h * f)}" fill="${fill}"/>` : '')
		}
		const yy = y + i * (h + gap)
		return `<rect x="${n(x)}" y="${n(yy)}" width="${n(w)}" height="${n(h)}" fill="${TRACK}"/>` + (f > 0 ? `<rect x="${n(x)}" y="${n(yy)}" width="${n(w * f)}" height="${n(h)}" fill="${fill}"/>` : '')
	}
	return `<defs>${grad}${stops}</defs>` + one(0, l) + one(1, r)
}

/** Large light number with a small unit ("dB") after it, shrunk to fit maxWidth; a text with no number (MUTED) is drawn plain. */
function bigNumber(cx: number, baseline: number, text: string, size: number, maxWidth: number, fill = WHITE): string {
	const m = /^(.*?)\s*(dB)$/.exec(text)
	const [num, unit] = m ? [m[1], m[2]] : [text, '']
	const unitSize = Math.round(size * 0.4)
	const unitW = unit ? textWidth(unit, unitSize) + 4 : 0
	const s = fitSize(num, size, maxWidth - unitW, 12)
	const shown = fitText(num, s, maxWidth - unitW)
	const tspan = unit ? `<tspan font-size="${unitSize}" dx="4">${unit}</tspan>` : ''
	return `<text x="${n(cx)}" y="${n(baseline)}" font-family="Segoe UI" font-weight="300" font-size="${s}" fill="${fill}" text-anchor="middle">${escapeXml(shown)}${tspan}</text>`
}

const mutedText = (cx: number, cy: number, size: number) => plainText(cx, base(cy, size), t('muted'), { size, fill: MUTED_RED })
const name = (text: string, x: number, cy: number, size: number, maxWidth: number, anchor: 'start' | 'middle' = 'middle', fill = WHITE) => {
	if (!text) return ''
	const s = fitSize(text, size, maxWidth, 10)
	return plainText(x, base(cy, s), fitText(text, s, maxWidth + 4), { size: s, fill, anchor })
}

function strip(v: MeterInput): string {
	// Top row: name left, level (or the badge, which takes priority) right.
	// The level's room is fixed by its widest form, so the name does not resize as the level moves.
	const room = v.badge ? 60 : Math.ceil(textWidth(v.levelText.startsWith('L ') ? 'L -60.0 R -60.0' : '-60.0 dB', 14))
	const right = v.badge ? { text: fitText(v.badge.text, 15, room), fill: v.badge.fill, size: 15 } : { text: fitText(v.levelText, 14, room + 4), fill: GREY, size: 14 }
	const rightW = v.badge ? textWidth(right.text, right.size) : room
	let b = name(v.name, 8, 14, 18, 184 - rightW - 8, 'start', GREY)
	// While muted, MUTED takes the level's place (a badge keeps it) and the volume stays, in red.
	if (!v.muted || v.badge) b += plainText(192, base(14, right.size), right.text, { size: right.size, fill: right.fill, anchor: 'end' })
	else b += plainText(192, base(14, 14), t('muted'), { size: 14, fill: MUTED_RED, anchor: 'end' })
	b += bigNumber(100, 68, v.faderText, 44, 184, v.muted ? MUTED_RED : WHITE)
	b += thinBars(10, 82, 180, 4, 3, v.leftDb, v.rightDb, v.muted, 'bs')
	return frame(200, 100, b, v.overlay)
}

/** dB marks beside slim bars (vertical: right of them; horizontal: under them), skipping a number that would sit on the key seam. */
function marks(x: number, y: number, len: number, vertical: boolean, seam: number, size = 11): string {
	let out = ''
	for (const db of [0, -20, -40, -60]) {
		const p = vertical ? y + len * (1 - barFrac(db)) : x + len * barFrac(db)
		if (Math.abs(p - seam) < 10) continue
		out += vertical
			? plainText(n(x), base(p, size), String(db), { size, fill: GREY, anchor: 'start' })
			: plainText(n(p), base(y, size), String(db), { size, fill: GREY })
	}
	return out
}

/**
 * The two keys are one picture (144x288 or 288x144) and each key shows its half, so the bars run through the seam.
 * Vertical: name and the big fader value on top, slim upright bars down through the seam, the level (or MUTED) at the bottom.
 * Horizontal: name and level on the left, the big fader value on the right, the bars across both keys under them.
 */
function pair(v: MeterInput, role: FaderRole): string {
	const vertical = role === 'top' || role === 'bottom'
	const second = role === 'bottom' || role === 'right'
	let b: string
	if (vertical) {
		b = nameBlock(v.name, { x: 72, top: 2, width: 132, height: 30, maxLines: 1, size: 26, minSize: 13 })
		b += bigNumber(72, 80, v.faderText, 44, 136, v.muted ? MUTED_RED : WHITE)
		b += thinBars(40, 98, 20, 168, 10, v.leftDb, v.rightDb, v.muted, 'bp', true) + marks(96, 98, 168, true, KEY, 12)
		b += v.muted ? mutedText(72, 278, 22) : name(v.levelText, 72, 278, 22, 136)
	} else {
		b = nameBlock(v.name, { x: 72, top: 4, width: 132, height: 38, maxLines: 1, size: 32, minSize: 14 })
		b += v.muted ? mutedText(72, 60, 24) : name(v.levelText, 72, 60, 24, 132, 'middle', GREY)
		b += bigNumber(216, 66, v.faderText, 58, 136, v.muted ? MUTED_RED : WHITE)
		b += thinBars(12, 84, 264, 11, 6, v.leftDb, v.rightDb, v.muted, 'bp') + marks(12, 126, 264, false, KEY, 13)
	}
	const shift = second ? (vertical ? `translate(0 -${KEY})` : `translate(-${KEY} 0)`) : ''
	return frame(KEY, KEY, shift ? `<g transform="${shift}">${b}</g>` : b, v.overlay)
}

function key(v: MeterKeyInput): string {
	let b = nameBlock(v.title, { x: 72, top: 4, width: 128, height: 50, maxLines: 2, size: 22, minSize: 12 })
	b += bigNumber(72, 92, v.value, 42, 132, v.meter.muted ? MUTED_RED : WHITE)
	b += thinBars(12, 112, 120, 5, 4, v.meter.leftDb, v.meter.rightDb, v.meter.muted, 'bk')
	return frame(KEY, KEY, b, v.overlay)
}

export const big: MeterDesign = { strip, pair, key }
