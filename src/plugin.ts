import { fileURLToPath } from 'node:url'
import streamDeck from '@elgato/streamdeck'
import type { JsonObject } from '@elgato/utils'
import { ObsConnection } from './connection.js'
import { FLAVOUR } from './flavour.js'
import { defaultSetupDeps, runFreecshotSetup } from './freecshot/setup.js'
import { language, setLanguage, t } from './i18n.js'
import { meterActions } from './actions/meter-actions.js'
import { otherActions } from './actions/other.js'
import { PttAction } from './actions/ptt.js'
import { TalkbackAction } from './actions/talkback.js'
import type { ObsAction } from './runtime/base-action.js'
import { normalizeSettings, sourceOf } from './runtime/settings.js'
import { talkbackStore } from './runtime/talkback-store.js'

// The Stream Deck app keeps no console output; send errors to the plugin's logs folder instead.
console.error = (...args: unknown[]) => streamDeck.logger.error(args.map(String).join(' '))
console.info = (...args: unknown[]) => streamDeck.logger.info(args.map(String).join(' '))

export const connection = new ObsConnection()

// Every action is listed here (and in the manifest).
// Talkback originals live next to the plugin's bin/ folder (see talkback-store.ts).
const talkbackFile = fileURLToPath(new URL('../talkback-state.json', import.meta.url))

export const actions: ObsAction<JsonObject>[] = [
	...meterActions(connection),
	new PttAction(connection),
	new TalkbackAction(connection, talkbackStore(talkbackFile)),
	...otherActions(connection),
]

let current: string | undefined
function apply(raw: Parameters<typeof normalizeSettings>[0]): void {
	const next = normalizeSettings(raw)
	const key = JSON.stringify(next)
	if (key === current) return
	current = key
	connection.start(next)
}

// The source dropdown uses <sdpi-select datasource="getInputs" hot-reload>. The list is re-sent whenever it changes
// (e.g. OBS connects). The open PI's saved source stays listed while OBS is offline or the source is gone.
let saved: { value: string; label: string } | undefined
let lastSent: string | undefined
function pushInputs(force = false): void {
	const items = connection.inputs()
	if (saved && !items.some((i) => i.value === saved?.value)) items.unshift(saved)
	const json = JSON.stringify(items)
	if (!force && json === lastSent) return
	lastSent = json
	streamDeck.ui.sendToPropertyInspector({ event: 'getInputs', items }).catch(() => {})
}
streamDeck.ui.onSendToPlugin(async (ev) => {
	const payload = ev.payload as { event?: unknown } | null
	if (payload?.event === 'freecshotSetup' && FLAVOUR.autoSetup) return freecshotSetup()
	if (payload?.event !== 'getInputs') return
	const s: JsonObject = await ev.action.getSettings().catch(() => ({}))
	const uuid = sourceOf(s)
	saved = uuid ? { value: uuid, label: `${typeof s.inputName === 'string' && s.inputName ? s.inputName : uuid} ${t('notFound')}` } : undefined
	pushInputs(true)
})
connection.onChange(() => pushInputs())

/** The language is a global setting too, but applies at once and never touches the OBS connection. */
function applyLanguage(raw: { language?: unknown }): void {
	const before = language()
	if (setLanguage(raw.language) === before) return
	for (const action of actions) action.redrawAll()
}

/** The last global settings seen (connection and language), for the auto setup to start from. */
let globals: JsonObject = {}

/** "WebSocket auto setup" on the FreecShot Plus settings screen. The reply never carries the password. */
async function freecshotSetup(): Promise<void> {
	const r = await runFreecshotSetup({ port: globals.port, password: globals.password }, defaultSetupDeps())
	if (r.ok) {
		globals = { ...globals, host: '127.0.0.1', port: String(r.port), password: r.password }
		await streamDeck.settings.setGlobalSettings(globals)
		apply(globals)
	} else console.error(`FreecShot setup: ${r.reason}`)
	await streamDeck.ui.sendToPropertyInspector({ event: 'freecshotSetup', ok: r.ok, reason: r.ok ? 'ok' : r.reason }).catch(() => {})
}

// Wait for typing to settle so each keystroke does not restart the connection.
let debounce: NodeJS.Timeout | undefined
streamDeck.settings.onDidReceiveGlobalSettings((ev) => {
	globals = ev.settings
	applyLanguage(ev.settings)
	clearTimeout(debounce)
	debounce = setTimeout(() => apply(ev.settings), 500)
})
for (const action of actions) streamDeck.actions.registerAction(action)
await streamDeck.connect()
const initial = await streamDeck.settings.getGlobalSettings()
globals = initial
applyLanguage(initial)
apply(initial)
