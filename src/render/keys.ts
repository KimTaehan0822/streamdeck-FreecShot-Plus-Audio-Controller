import { balanceText, dbText } from '../obs/volume.js'
import { t } from '../i18n.js'
import type { TalkbackStyle } from '../runtime/talkback.js'
import { renderKeyMeter, type KeyMeterView } from './meter.js'
import { KEY, NAME_WIDTH, fitSize, frame, plainText, type Overlay } from './svg.js'
import { LINE_HEIGHT, nameBlock, wrapName } from './text.js'

const WHITE = '#fff'
const RED = 'rgb(255,57,31)'
const MUTED_BG = '#8b1a1a'
const LIVE_BG = '#1f7a1f'
const MONITOR_BG = '#24427a'
const TALKBACK_BG = '#b35c00'
const BLUE = 'rgb(40,140,255)'

const background = (fill: string) => `<rect width="${KEY}" height="${KEY}" fill="${fill}"/>`

export interface MeterKeyBase {
	name: string
	meter: KeyMeterView
	overlay: Overlay
	/** The user set a title for this state in the Stream Deck app: draw no name or status under it. */
	bare?: boolean
}

/** Name and middle text, or nothing when the user's own title is shown on the key. */
const words = (bare: boolean | undefined, text: string) => (bare ? '' : text)

/**
 * Key text sizes for every key but the two-key fader: name up to 36 px in two lines, middle text up to 40 px
 * (Hangul is drawn at 0.82, so it needs the high caps). Keys with a meter or bar at the bottom keep the name in 50 px
 * and the middle text's baseline at 92 (it ends above y 104); keys without use 66 px and baseline 118.
 */
const bigName = (name: string, top = 6, height = 50) => nameBlock(name, { x: KEY / 2, top, width: NAME_WIDTH, height, maxLines: 2, size: 36, minSize: 14 })
const bigStatus = (text: string, fill: string, y = 92, max = 40) => plainText(KEY / 2, y, text, { size: fitSize(text, max, KEY - 8, 14), fill })

const CAP = 0.72 // visible height of a line, as a share of the font size
const STACK_GAP = 14 // from the name's last baseline to the top of the text under it

/** Name (up to two lines) and an optional text under it, centred together on the key. */
function centredStack(name: string, under: string, nameMax = 36, underMax = 40, underFill = WHITE): string {
	const fit = wrapName(name, nameMax, NAME_WIDTH, 2, 14)
	const underSize = under ? fitSize(under, underMax, KEY - 8, 12) : 0
	const nameSpan = CAP * fit.size + (fit.lines.length - 1) * fit.size * LINE_HEIGHT
	const span = nameSpan + (under ? STACK_GAP + CAP * underSize : 0)
	const firstBase = (KEY - span) / 2 + CAP * fit.size
	const lines = fit.lines.map((line, i) => plainText(KEY / 2, +(firstBase + i * fit.size * LINE_HEIGHT).toFixed(2), line, { size: fit.size, fill: WHITE }))
	const underBase = +(firstBase + nameSpan - CAP * fit.size + STACK_GAP + CAP * underSize).toFixed(2)
	return lines.join('') + (under ? plainText(KEY / 2, underBase, under, { size: underSize, fill: underFill }) : '')
}

export function renderMuteKey(v: MeterKeyBase & { muted: boolean; volumeDb: number }): string {
	return frame(KEY, KEY, (v.muted ? background(MUTED_BG) : '') + words(v.bare, centredStack(v.name, v.muted ? t('muted') : '')), v.overlay)
}

/** Name at the top, value (or MUTED) in the middle, meter below. */
export function renderVolumeKey(v: MeterKeyBase & { volumeDb: number; muted: boolean; peek: boolean }): string {
	const [text, fill] = v.muted && !v.peek ? [t('muted'), RED] : [dbText(v.volumeDb), WHITE]
	return frame(KEY, KEY, bigName(v.name) + bigStatus(text, fill) + renderKeyMeter(v.meter), v.overlay)
}

/** Talkback and PTT: the name is the big part, the text under it is smaller. */
const BIG_NAME = 48
const SMALL_UNDER = 26

/** Green while the source is live; the mode under the name, red while muted. */
export function renderPttKey(v: MeterKeyBase & { mode: 'talk' | 'mute'; live: boolean }): string {
	const mode = t(v.mode === 'mute' ? 'pushMute' : 'pushTalk')
	return frame(KEY, KEY, (v.live ? background(LIVE_BG) : '') + words(v.bare, centredStack(v.name, mode, BIG_NAME, SMALL_UNDER, v.live ? WHITE : RED)), v.overlay)
}

const MONITOR_TEXT = {
	OBS_MONITORING_TYPE_NONE: 'off',
	OBS_MONITORING_TYPE_MONITOR_ONLY: 'mon',
	OBS_MONITORING_TYPE_MONITOR_AND_OUTPUT: 'monOut',
} as const

function monitorText(type: string): string {
	const key = MONITOR_TEXT[type as keyof typeof MONITOR_TEXT]
	if (key === 'monOut') {
		// One line would shrink to ~20 px; two lines ("MON" / "+OUT") stay large, both at the same size.
		const [a, b] = [t('mon'), `+${t('out')}`]
		const size = Math.min(fitSize(a, 34, KEY - 8, 14), fitSize(b, 34, KEY - 8, 14))
		return plainText(KEY / 2, 104, a, { size, fill: WHITE }) + plainText(KEY / 2, 136, b, { size, fill: WHITE })
	}
	return bigStatus(key ? t(key) : '?', WHITE, 118)
}

export function renderMonitorKey(v: { name: string; type: string; overlay: Overlay; bare?: boolean }): string {
	const on = v.type !== 'OBS_MONITORING_TYPE_NONE'
	const body = (on ? background(MONITOR_BG) : '') + words(v.bare, bigName(v.name, 10, 66) + monitorText(v.type))
	return frame(KEY, KEY, body, v.overlay)
}

/** Track with a bar growing from the centre towards the balance side. */
function balanceBar(x: number, y: number, w: number, h: number, balance: number): string {
	const centre = x + w / 2
	const at = x + Math.max(0, Math.min(1, balance)) * w
	return (
		`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#333"/>` +
		`<rect x="${+Math.min(at, centre).toFixed(2)}" y="${y}" width="${+Math.abs(at - centre).toFixed(2)}" height="${h}" fill="${BLUE}"/>` +
		`<rect x="${centre - 1}" y="${y - 4}" width="2" height="${h + 8}" fill="${WHITE}"/>`
	)
}

export function renderBalanceKey(v: { name: string; balance: number; overlay: Overlay }): string {
	// A taller name area (two 26 px lines) above the value; the bar moves down to make room.
	const body = bigName(v.name, 6, 60) + bigStatus(balanceText(v.balance), WHITE, 106, 48) + balanceBar(10, 120, 124, 14, v.balance)
	return frame(KEY, KEY, body, v.overlay)
}

export function renderBalanceStrip(v: { name: string; balance: number; overlay: Overlay }): string {
	const body =
		nameBlock(v.name, { x: 100, top: 2, width: 188, height: 40, maxLines: 2, size: 21, minSize: 10 }) +
		balanceBar(10, 50, 180, 14, v.balance) +
		plainText(100, 92, balanceText(v.balance), { size: 19, fill: WHITE })
	return frame(200, 100, body, v.overlay)
}

/** Talkback key: name on top, what it does in the middle (MUTE, -30 dB, or ▼15 dB lowered), orange while on. */
export function renderTalkbackKey(v: { name: string; style: TalkbackStyle; valueDb: number; active: boolean; overlay: Overlay; bare?: boolean }): string {
	const db = v.valueDb === -Infinity ? '-inf' : String(v.valueDb)
	const what = v.style === 'mute' ? t('mute') : v.style === 'level' ? `${db} dB` : `▼${db} dB`
	return frame(KEY, KEY, (v.active ? background(TALKBACK_BG) : '') + words(v.bare, centredStack(v.name, what, BIG_NAME, SMALL_UNDER)), v.overlay)
}
