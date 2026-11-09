import { theme } from '../flavour.js'
import { t } from '../i18n.js'
export const KEY = 144
/** Widest a name may be on a key: the key's edges sit under the device's bezel. */
export const NAME_WIDTH = KEY - 16

export type Overlay = 'none' | 'offline' | 'login' | 'unsupported' | 'setup' | 'config'

// Same face, weight and plain fill (no outline) as Elgato's Spotify plugin. One family name only:
// the Stream Deck SVG renderer is not a browser.
const FONT = 'Segoe UI'
const WEIGHT = 600
// Segoe UI has no Hangul and the fallback draws it thin; Malgun Gothic has only Regular and Bold, and Bold matches Segoe's 600.
const HANGUL_FONT = 'Malgun Gothic'
const HANGUL_WEIGHT = 700
const HANGUL = /[\u1100-\u11ff\u3130-\u318f\uac00-\ud7a3]/
// Hangul stands much taller than Latin at the same size and ran into the key edge and the meter bars.
const HANGUL_SCALE = 0.82

export function svgDataUrl(svg: string): string {
	return 'data:image/svg+xml;charset=utf8,' + encodeURIComponent(svg)
}

export function escapeXml(text: string): string {
	return text
		.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '')
		.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export function plainText(
	x: number,
	y: number,
	text: string,
	opts: { size: number; fill: string; anchor?: 'start' | 'middle' | 'end' },
): string {
	const hangul = HANGUL.test(text)
	const size = hangul ? +(opts.size * HANGUL_SCALE).toFixed(1) : opts.size
	return (
		`<text x="${x}" y="${y}" font-family="${hangul ? HANGUL_FONT : FONT}" font-size="${size}" font-weight="${hangul ? HANGUL_WEIGHT : WEIGHT}" ` +
		`text-anchor="${opts.anchor ?? 'middle'}" fill="${opts.fill}">${escapeXml(text)}</text>`
	)
}

// Hangul and other CJK and full-width characters are about 1 em wide (Hangul drawn at HANGUL_SCALE), the rest 0.6 em
const WIDE = /[\u1100-\u11ff\u2e80-\ua4cf\uac00-\ud7a3\uf900-\ufaff\uff00-\uffef]|[\u{20000}-\u{3ffff}]/u
const charWidth = (c: string, size: number) => (HANGUL.test(c) ? HANGUL_SCALE : WIDE.test(c) ? 1 : 0.6) * size

// shortcut: per-class width estimate (no font metrics in Node); upgrade if cut-offs look wrong on a real key
export function fitText(text: string, size: number, maxWidth = KEY - 8): string {
	const chars = Array.from(text)
	if (chars.reduce((w, c) => w + charWidth(c, size), 0) <= maxWidth) return text
	let out = ''
	let w = charWidth('…', size)
	for (const c of chars) {
		w += charWidth(c, size)
		if (w > maxWidth) break
		out += c
	}
	return out + '…'
}

/**
 * Estimated drawn width. Capitals measure about 0.72 em in Segoe UI Semibold (M and W about 0.9); counting them at 0.6
 * left "DAW OUT" wider than planned. Narrow marks and letters (. , i l I space) are about 0.3 em, and counting them at
 * 0.6 shrank names like "1.Stream Mix" more than needed. Other lower case and digits are about 0.55 em (m, w 0.85).
 */
export const textWidth = (text: string, size: number): number =>
	Array.from(text).reduce(
		(w, c) =>
			w +
			(/[MW]/.test(c)
				? 0.9 * size
				: /[A-Z]/.test(c) && c !== 'I'
					? 0.72 * size
					: /[.,:;'!|ijlI ]/.test(c)
						? 0.32 * size
						: /[mw]/.test(c)
							? 0.85 * size
							: /[a-z0-9]/.test(c)
								? 0.55 * size
								: charWidth(c, size)),
		0,
	)

/** Font size at which text fits maxWidth, never above size nor below min (fitText still cuts what min cannot fit). */
export function fitSize(text: string, size: number, maxWidth: number, min: number): number {
	const width = textWidth(text, size)
	// The small margin keeps float rounding from pushing the result just past maxWidth, which fitText would cut.
	return width <= maxWidth ? size : Math.max(min, Math.floor((size * maxWidth) / width - 1e-6))
}

export function frame(width: number, height: number, body: string, overlay: Overlay): string {
	const cx = width / 2
	const cy = height / 2
	// Translated words differ in length: shrink to the frame width rather than spill over the key edge.
	const word = (text: string, y: number, size: number, fill: string) => plainText(cx, y, text, { size: fitSize(text, size, width - 8, 12), fill })
	let content: string
	switch (overlay) {
		case 'offline':
			{
				// As large as fits (up to 40 px), centred on the cap height.
				const size = fitSize(t('offline'), 40, width - 8, 12)
				content = `<g opacity="0.35">${body}</g>` + plainText(cx, +(cy + 0.36 * size).toFixed(2), t('offline'), { size, fill: 'rgb(255,57,31)' })
			}
			break
		case 'login':
			{
				// Same place and size as OFFLINE, in white: connected, only waiting for the user to sign in.
				const size = fitSize(t('login'), 40, width - 8, 12)
				content = `<g opacity="0.35">${body}</g>` + plainText(cx, +(cy + 0.36 * size).toFixed(2), t('login'), { size, fill: '#fff' })
			}
			break
		case 'unsupported':
			content = `<g opacity="0.25">${body}</g>` + plainText(cx, cy + 12, 'N/A', { size: 34, fill: 'rgb(150,150,150)' })
			break
		case 'setup':
			content =
				`<g opacity="0.35">${body}</g>` +
				word(t('set'), cy - 6, 26, '#fff') +
				word(t('source'), cy + 24, 26, '#fff')
			break
		case 'config':
			content = `<g opacity="0.35">${body}</g>` + word(t('setup'), cy + 8, 26, '#fff')
			break
		default:
			content = body
	}
	return (
		`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
		`<rect width="${width}" height="${height}" fill="${theme().keyBg}"/>${content}</svg>`
	)
}
