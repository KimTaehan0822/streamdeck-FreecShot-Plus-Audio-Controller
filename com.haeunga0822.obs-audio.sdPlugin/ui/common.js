// Shared Property Inspector code. Every PI loads sdpi-components.js, then this file, and contains
// <div data-global></div> where the connection settings should appear.
// Source dropdown: <sdpi-select setting="inputUuid" datasource="getInputs" hot-reload>; the plugin answers with
// OBS's audio inputs (see src/plugin.ts) and re-sends the list when it changes.
// Texts come from ui/i18n.js (loaded before this file); the language is the global setting "language".
let piLang = 'en'
const tr = (key) => (PI_TEXT[piLang] || PI_TEXT.en)[key] || PI_TEXT.en[key] || key
const setPiLang = (l) => (piLang = l === 'ko' || l === 'ja' ? l : 'en')
// ui/flavour.js says which plugin this is; only the FreecShot Plus one has the auto setup button.
const FREECSHOT = globalThis.PI_FLAVOUR === 'freecshot'

// The connection block is folded by default: it is set once and only opened to check or change it.
// Language sits below it, at the very bottom of every settings screen, folded the same way.
const globalBlock = () => `
<style>
	details.connection > summary { cursor: pointer; color: #969696; font-size: 9pt; padding: 4px 0 10px; user-select: none; }
	details.connection > summary:hover, details.connection > summary:focus-visible { color: #d8d8d8; }
	details.connection > summary:focus-visible { outline: 1px solid #708090; }
	.hint { color: #969696; font-size: 8pt; padding: 0 0 8px 0; }
</style>
<details class="connection"><summary>${tr(FREECSHOT ? 'freecshotConnection' : 'obsConnection')}</summary>
<sdpi-item label="${tr('host')}"><sdpi-textfield setting="host" global default="127.0.0.1"></sdpi-textfield></sdpi-item>
<sdpi-item label="${tr('port')}"><sdpi-textfield setting="port" global default="${FREECSHOT ? '24455' : '4455'}" pattern="^[0-9]{1,5}$"></sdpi-textfield></sdpi-item>
<sdpi-item label="${tr('password')}"><sdpi-password setting="password" global></sdpi-password></sdpi-item>
${FREECSHOT ? `<sdpi-item label=""><button type="button" class="tb-btn" id="fc-setup">${tr('autoSetup')}</button></sdpi-item><div class="hint" id="fc-result" role="status"></div>` : ''}
<div class="hint">${tr(FREECSHOT ? 'freecshotHint' : 'obsHint')}</div>
</details>
<details class="connection"><summary>${tr('meterRange')}</summary>
<sdpi-item label="${tr('meterStart')}"><sdpi-select setting="meterFloor" global default="-60">${[-60, -50, -40, -30].map((d) => `<option value="${d}">${d} dB</option>`).join('')}</sdpi-select></sdpi-item>
</details>
<details class="connection"><summary>${tr('language')}</summary>
<sdpi-item label="${tr('language')}"><sdpi-select setting="language" global default="en"><option value="en">English</option><option value="ko">한국어</option><option value="ja">日本語</option></sdpi-select></sdpi-item>
</details>`

/** Draws the connection, meter range and language blocks into every [data-global] slot. */
function renderGlobal() {
	for (const slot of document.querySelectorAll('[data-global]')) slot.innerHTML = globalBlock()
	if (FREECSHOT) wireAutoSetup()
}

// The plugin edits FreecShot Plus's config file and answers { event: 'freecshotSetup', ok, reason } (never the password).
let setupSubscribed = false
function wireAutoSetup() {
	const client = SDPIComponents.streamDeckClient
	const button = document.getElementById('fc-setup')
	button?.addEventListener('click', () => {
		const out = document.getElementById('fc-result')
		if (out) out.textContent = '…'
		client.send('sendToPlugin', { event: 'freecshotSetup' })
	})
	if (setupSubscribed) return
	setupSubscribed = true
	client.sendToPropertyInspector.subscribe(async (ev) => {
		if (ev.payload?.event !== 'freecshotSetup') return
		const out = document.getElementById('fc-result')
		if (out) out.textContent = tr('setup_' + ev.payload.reason)
		// On success the plugin saved the port and password it set; show them in the fields.
		if (ev.payload.ok) await client.getGlobalSettings()
	})
}

// Fields a page adds from script miss what sdpi picks up while the page loads: sdpi-select only sees options
// added after it is on the page, and saved settings only reach fields that existed at connect. Redo both.
async function initFields(root) {
	for (const s of root.querySelectorAll('sdpi-select')) s.append(...s.querySelectorAll('option'))
	await Promise.all([...root.querySelectorAll('[setting]')].map((e) => e.updateComplete))
	await SDPIComponents.streamDeckClient.getSettings()
	await SDPIComponents.streamDeckClient.getGlobalSettings()
}
