// Text measuring copied from the TotalMix plugin's svg.ts: these designs were laid out with its measured Segoe UI widths.
// This plugin's own ../svg.js estimates 0.6 em for every Latin letter, which cut texts like "-6.0 dB" that do fit.
const HANGUL = /[ᄀ-ᇿ㄰-㆏가-힣]/
const HANGUL_SCALE = 0.82
const WIDE = /[ᄀ-ᇿ⺀-꓏가-힣豈-﫿＀-￯]|[\u{20000}-\u{3ffff}]/u
// Printable ASCII advance widths of Segoe UI Semibold in hundredths of an em, measured in a browser (Node has no font metrics).
const SEGOE = [
	27, 30, 44, 59, 56, 84, 72, 26, 33, 33, 43, 69, 24, 40, 24, 41, 56, 40, 56, 56, 58, 56, 56, 54, 56, 56, 24, 24, 69, 69, 69, 44,
	95, 67, 60, 62, 72, 52, 50, 70, 74, 29, 40, 61, 49, 92, 77, 76, 58, 76, 62, 54, 55, 70, 64, 97, 62, 58, 59, 33, 40, 33, 69, 42,
	29, 52, 60, 47, 60, 53, 34, 60, 58, 26, 26, 52, 26, 89, 58, 60, 60, 60, 37, 43, 36, 58, 51, 76, 50, 51, 46, 33, 28, 33, 69,
]
// 5% over the measured widths so rounding in the Stream Deck renderer never pushes text past the edge.
const MARGIN = 1.05
const charWidth = (c: string, size: number) => {
	const code = c.codePointAt(0) ?? 0
	if (code >= 32 && code < 127) return (SEGOE[code - 32] / 100) * MARGIN * size
	return (HANGUL.test(c) ? HANGUL_SCALE : WIDE.test(c) ? 1 : 0.6) * size
}

export const textWidth = (text: string, size: number): number => Array.from(text).reduce((w, c) => w + charWidth(c, size), 0)

export function fitText(text: string, size: number, maxWidth = 136): string {
	const chars = Array.from(text)
	if (textWidth(text, size) <= maxWidth) return text
	let out = ''
	let w = charWidth('…', size)
	for (const c of chars) {
		w += charWidth(c, size)
		if (w > maxWidth) break
		out += c
	}
	return out + '…'
}

/** A level text's size, taken from its widest form so it always fits and keeps one size as the values move. */
export const levelSize = (text: string, size: number, maxWidth: number, min: number): number =>
	fitSize(text.startsWith('L ') ? 'L -60.0 R -60.0' : '-60.0 dB', size, maxWidth, min)

/** Font size at which text fits maxWidth, never above size nor below min (fitText still cuts what min cannot fit). */
export function fitSize(text: string, size: number, maxWidth: number, min: number): number {
	const width = textWidth(text, size)
	return width <= maxWidth ? size : Math.max(min, Math.floor((size * maxWidth) / width - 1e-6))
}
