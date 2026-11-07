import assert from 'node:assert/strict'
import test from 'node:test'
import * as connection from '../dist/connection.js'
import { VuDialAction, ButtonFaderAction, MuteAction, VolumeAction } from '../dist/actions/meter-actions.js'
import { PttAction } from '../dist/actions/ptt.js'
import { MonitorAction, BalanceDialAction, BalanceAction } from '../dist/actions/other.js'
import { connected, fakeAction, settle } from './fake-obs.mjs'
import { setLanguage } from '../dist/i18n.js'

const MIC = { uuid: 'u-mic', name: 'Mic', audio: true, mul: 10 ** (-6 / 20), muted: false }
const setup = () => connected([{ ...MIC }], connection)
const volumes = (sent) => sent().filter(([t]) => t === 'SetInputVolume').map(([, d]) => d)
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} ≉ ${b}`)

// Every action shown in a test disappears afterwards, so its redraw timers let the process exit.
const shown = []
test.afterEach(() => {
	for (const { a, f } of shown.splice(0)) a.onWillDisappear(f.appear)
})

async function appear(Action, conn, dial, s, id = 'a' + shown.length) {
	const a = new Action(conn)
	const f = fakeAction(id, dial, s)
	await a.onWillAppear(f.appear)
	shown.push({ a, f })
	return { a, f }
}

test('dial rotate steps from the current volume', async () => {
	const { conn, sent } = await setup()
	const { a, f } = await appear(VuDialAction, conn, true, { inputUuid: 'u-mic' })
	a.onDialRotate(f.ev({ ticks: 2 }))
	a.onDialRotate(f.ev({ ticks: 1 }))
	await settle()
	const v = volumes(sent)
	near(v[0].inputVolumeDb, -4)
	near(v[1].inputVolumeDb, -3) // second turn builds on the first before OBS answers
})

test('rotate below -60 sends mul 0', async () => {
	const { conn, sent } = await connected([{ ...MIC, mul: 10 ** (-59.5 / 20) }], connection)
	const { a, f } = await appear(VuDialAction, conn, true, { inputUuid: 'u-mic' })
	a.onDialRotate(f.ev({ ticks: -1 }))
	await settle()
	assert.deepEqual(volumes(sent)[0], { inputUuid: 'u-mic', inputVolumeMul: 0 })
})

test('press toggles mute on release when not turned', async () => {
	const { conn, sent } = await setup()
	const { a, f } = await appear(VuDialAction, conn, true, { inputUuid: 'u-mic' })
	await a.onDialDown(f.ev())
	await a.onDialUp(f.ev())
	await settle()
	assert.deepEqual(sent().at(-1), ['ToggleInputMute', { inputUuid: 'u-mic' }])
})

test('press+turn left runs leftAction once per hold and skips the press', async () => {
	const { conn, sent } = await setup()
	const s = { inputUuid: 'u-mic', leftAction: 'muteOn' }
	const { a, f } = await appear(VuDialAction, conn, true, s)
	await a.onDialDown(f.ev())
	a.onDialRotate(f.ev({ ticks: -1, pressed: true }))
	a.onDialRotate(f.ev({ ticks: -1, pressed: true }))
	await a.onDialUp(f.ev())
	await settle()
	assert.deepEqual(sent(), [['SetInputMute', { inputUuid: 'u-mic', inputMuted: true }]])
})

test('recall clamps to 0 dB', async () => {
	const { conn, sent } = await setup()
	const { a, f } = await appear(VuDialAction, conn, true, { inputUuid: 'u-mic', pressAction: 'recall', pressDb: '6' })
	await a.onDialDown(f.ev())
	await a.onDialUp(f.ev())
	await settle()
	assert.deepEqual(volumes(sent)[0], { inputUuid: 'u-mic', inputVolumeDb: 0 })
})

test('touch tap mutes unless touchMute is false', async () => {
	const { conn, sent } = await setup()
	const { a, f } = await appear(VuDialAction, conn, true, { inputUuid: 'u-mic' })
	await a.onTouchTap(f.ev())
	const off = await appear(VuDialAction, conn, true, { inputUuid: 'u-mic', touchMute: false })
	await off.a.onTouchTap(off.f.ev())
	await settle()
	assert.equal(sent().filter(([t]) => t === 'ToggleInputMute').length, 1)
})

test('button fader top steps up, bottom down, repeats while held, stops on key up', async () => {
	const { conn, sent } = await setup()
	const top = await appear(ButtonFaderAction, conn, false, { inputUuid: 'u-mic', role: 'top' })
	top.a.onKeyDown(top.f.ev())
	await new Promise((r) => setTimeout(r, 480))
	top.a.onKeyUp(top.f.ev())
	const count = volumes(sent).length
	await new Promise((r) => setTimeout(r, 300))
	assert.equal(volumes(sent).length, count)
	assert.ok(count >= 2)
	near(volumes(sent)[0].inputVolumeDb, -5)
	const bottom = await appear(ButtonFaderAction, conn, false, { inputUuid: 'u-mic', role: 'bottom', step: '2' })
	bottom.a.onKeyDown(bottom.f.ev())
	bottom.a.onKeyUp(bottom.f.ev())
	near(volumes(sent).at(-1).inputVolumeDb, volumes(sent).at(-2).inputVolumeDb - 2)
})

test('volume key set and step', async () => {
	const { conn, sent } = await setup()
	const set = await appear(VolumeAction, conn, false, { inputUuid: 'u-mic', mode: 'set', value: '-20' })
	set.a.onKeyDown(set.f.ev())
	assert.deepEqual(volumes(sent).at(-1), { inputUuid: 'u-mic', inputVolumeDb: -20 })
	const step = await appear(VolumeAction, conn, false, { inputUuid: 'u-mic', mode: 'step', value: '-3' })
	step.a.onKeyDown(step.f.ev())
	step.a.onKeyUp(step.f.ev())
	near(volumes(sent).at(-1).inputVolumeDb, -23)
})

test('mute key toggles', async () => {
	const { conn, sent } = await setup()
	const { a, f } = await appear(MuteAction, conn, false, { inputUuid: 'u-mic' })
	await a.onKeyDown(f.ev())
	assert.deepEqual(sent().at(-1), ['ToggleInputMute', { inputUuid: 'u-mic' }])
})

test('removed source renders N/A, missing source renders SET SOURCE', async () => {
	const { conn, client } = await setup()
	const { f } = await appear(MuteAction, conn, false, { inputUuid: 'u-mic' })
	client.emit('InputRemoved', { inputUuid: 'u-mic' })
	await settle()
	await new Promise((r) => setTimeout(r, 60))
	assert.match(f.images.at(-1), /N\/A/)
	const none = await appear(VuDialAction, conn, true, {})
	await settle()
	assert.match(none.f.images.at(-1), /SOURCE/)
})

test('a picked source saves its OBS name for offline display', async () => {
	const { conn } = await setup()
	const { f } = await appear(MuteAction, conn, false, { inputUuid: 'u-mic' })
	assert.deepEqual(f.saved.at(-1), { inputUuid: 'u-mic', inputName: 'Mic' })
	const same = await appear(MuteAction, conn, false, { inputUuid: 'u-mic', inputName: 'Mic' })
	assert.equal(same.f.saved.length, 0)
})

const mutes = (sent) => sent().filter(([t]) => t === 'SetInputMute').map(([, d]) => d.inputMuted)

test('ptt talk unmutes while held and restores after the release delay', async () => {
	const { conn, sent } = await connected([{ ...MIC, muted: true }], connection)
	const { a, f } = await appear(PttAction, conn, false, { inputUuid: 'u-mic', mode: 'talk', releaseDelayMs: '30' })
	a.onKeyDown(f.ev())
	a.onKeyUp(f.ev())
	assert.deepEqual(mutes(sent), [false])
	await new Promise((r) => setTimeout(r, 60))
	assert.deepEqual(mutes(sent), [false, true])
})

test('ptt key that disappears while held restores at once', async () => {
	const { conn, sent } = await connected([{ ...MIC, muted: true }], connection)
	const { a, f } = await appear(PttAction, conn, false, { inputUuid: 'u-mic' })
	a.onKeyDown(f.ev())
	a.onWillDisappear(f.appear)
	assert.deepEqual(mutes(sent), [false, true])
})

test('ptt in a multi-action does nothing', async () => {
	const { conn, sent } = await connected([{ ...MIC, muted: true }], connection)
	const a = new PttAction(conn)
	const f = fakeAction('m1', false, { inputUuid: 'u-mic' }, true)
	a.onKeyDown(f.ev())
	assert.deepEqual(mutes(sent), [])
})

test('ptt released while OBS is offline restores after reconnect', async () => {
	const { conn, client, obs, timers, sent } = await connected([{ ...MIC, muted: true }], connection)
	const { a, f } = await appear(PttAction, conn, false, { inputUuid: 'u-mic', releaseDelayMs: '0' })
	a.onKeyDown(f.ev())
	client.emit('ConnectionClosed', new Error('closed'))
	await settle()
	a.onKeyUp(f.ev())
	assert.deepEqual(mutes(sent), [false])
	timers.runAll()
	await settle()
	const restored = obs.clients.at(-1).calls.filter(([t]) => t === 'SetInputMute').map(([, d]) => d.inputMuted)
	assert.deepEqual(restored, [true])
})

const NONE = 'OBS_MONITORING_TYPE_NONE'
const ONLY = 'OBS_MONITORING_TYPE_MONITOR_ONLY'
const BOTH = 'OBS_MONITORING_TYPE_MONITOR_AND_OUTPUT'
const monitors = (sent) => sent().filter(([t]) => t === 'SetInputAudioMonitorType').map(([, d]) => d.monitorType)
const balances = (sent) => sent().filter(([t]) => t === 'SetInputAudioBalance').map(([, d]) => d.inputAudioBalance)

test('monitor set sends the chosen type', async () => {
	const { conn, sent } = await setup()
	const { a, f } = await appear(MonitorAction, conn, false, { inputUuid: 'u-mic', mode: 'set', type: BOTH })
	a.onKeyDown(f.ev())
	assert.deepEqual(monitors(sent), [BOTH])
})

test('monitor cycle goes none → only → both → none', async () => {
	const { conn, sent } = await setup()
	const { a, f } = await appear(MonitorAction, conn, false, { inputUuid: 'u-mic', mode: 'cycle' })
	for (let i = 0; i < 3; i++) a.onKeyDown(f.ev())
	assert.deepEqual(monitors(sent), [ONLY, BOTH, NONE])
})

test('balance dial: one tick moves the shown L/R value by 1 and clamps 0..1', async () => {
	const { conn, sent } = await connected([{ ...MIC, balance: 0.995 }], connection)
	const { a, f } = await appear(BalanceDialAction, conn, true, { inputUuid: 'u-mic' })
	a.onDialRotate(f.ev({ ticks: 1 }))
	a.onDialRotate(f.ev({ ticks: -2 }))
	const b = balances(sent)
	assert.equal(b[0], 1)
	assert.ok(Math.abs(b[1] - 0.99) < 1e-9)
})

test('balance press centres to 0.5', async () => {
	const { conn, sent } = await setup()
	const { a, f } = await appear(BalanceDialAction, conn, true, { inputUuid: 'u-mic' })
	await a.onDialDown(f.ev())
	assert.deepEqual(balances(sent), [0.5])
})

test('balance key set and step', async () => {
	const { conn, sent } = await setup()
	const set = await appear(BalanceAction, conn, false, { inputUuid: 'u-mic', mode: 'set', value: '-40' })
	set.a.onKeyDown(set.f.ev())
	const step = await appear(BalanceAction, conn, false, { inputUuid: 'u-mic', mode: 'step', value: '-5' })
	step.a.onKeyDown(step.f.ev())
	step.a.onKeyUp(step.f.ev())
	const b = balances(sent)
	assert.equal(b[0], 0.3, 'set -40 = L 40')
	assert.ok(Math.abs(b[1] - 0.275) < 1e-9, 'step -5 moves the shown value by 5 (L 40 -> L 45)')
})

test('ptt: connection lost during the release delay still restores after reconnect', async () => {
	const { conn, client, obs, timers, sent } = await connected([{ ...MIC, muted: true }], connection)
	const { a, f } = await appear(PttAction, conn, false, { inputUuid: 'u-mic', releaseDelayMs: '30' })
	a.onKeyDown(f.ev())
	a.onKeyUp(f.ev())
	client.emit('ConnectionClosed', new Error('closed'))
	await new Promise((r) => setTimeout(r, 60))
	assert.deepEqual(mutes(sent), [false])
	timers.runAll()
	await settle()
	const restored = obs.clients.at(-1).calls.filter(([t]) => t === 'SetInputMute').map(([, d]) => d.inputMuted)
	assert.deepEqual(restored, [true])
})

test('ptt: a quick second press before OBS answers still restores to muted', async () => {
	const { conn, client, sent } = await connected([{ ...MIC, muted: true }], connection)
	const { a, f } = await appear(PttAction, conn, false, { inputUuid: 'u-mic', releaseDelayMs: '0' })
	a.onKeyDown(f.ev())
	client.emit('InputMuteStateChanged', { inputUuid: 'u-mic', inputMuted: false }) // OBS answers the press
	a.onKeyUp(f.ev())
	a.onKeyDown(f.ev()) // OBS has not answered the release yet
	a.onKeyUp(f.ev())
	assert.deepEqual(mutes(sent), [false, true, false, true])
})

test('redrawAll redraws visible keys in the new language', async () => {
	const { conn } = await connected([{ ...MIC, muted: true }], connection)
	const { a, f } = await appear(MuteAction, conn, false, { inputUuid: 'u-mic' })
	await new Promise((r) => setTimeout(r, 60))
	setLanguage('ko')
	try {
		a.redrawAll()
		await new Promise((r) => setTimeout(r, 60))
		assert.ok(f.images.at(-1).includes('음소거'))
	} finally {
		setLanguage('en')
	}
})

// ---- Talkback ----
import { TalkbackAction } from '../dist/actions/talkback.js'

const GAME = { uuid: 'u-game', name: 'Game', audio: true, mul: 10 ** (-6 / 20), muted: false }
const MUSIC = { uuid: 'u-music', name: 'Music', audio: true, mul: 10 ** (-10 / 20), muted: false }
const memStore = (state) => ({ saved: [], load: () => state, save(s) { this.saved.push(s) } })
const muteCalls = (sent) => sent().filter(([t]) => t === 'SetInputMute').map(([, d]) => [d.inputUuid, d.inputMuted])
const wait = (ms = 60) => new Promise((r) => setTimeout(r, ms))

async function talkback(s, { inputs = [MIC, GAME, MUSIC], store = memStore(), multi = false, id = 'tb' + shown.length, conn: c } = {}) {
	const env = c ?? (await connected(inputs.map((i) => ({ ...i })), connection))
	const a = new TalkbackAction(env.conn, store)
	const f = fakeAction(id, false, s, multi)
	await a.onWillAppear(f.appear)
	shown.push({ a, f })
	return { ...env, a, f, store }
}

test('talkback except: lowers every source but the listed one, release restores', async () => {
	const { a, f, sent } = await talkback({ scope: 'except', sources: [{ uuid: 'u-mic', name: 'Mic' }], style: 'mute', behavior: 'hold' })
	a.onKeyDown(f.ev())
	assert.deepEqual(muteCalls(sent), [['u-game', true], ['u-music', true]])
	a.onKeyUp(f.ev())
	assert.deepEqual(muteCalls(sent).slice(2), [['u-game', false], ['u-music', false]])
})

test('talkback only: touches just the listed sources', async () => {
	const { a, f, sent } = await talkback({ scope: 'only', sources: [{ uuid: 'u-game', name: 'Game' }], style: 'mute', behavior: 'hold' })
	a.onKeyDown(f.ev())
	assert.deepEqual(muteCalls(sent), [['u-game', true]])
})

test('talkback hold is ignored in a multi-action, toggle works there', async () => {
	const hold = await talkback({ scope: 'except', sources: [], style: 'mute', behavior: 'hold' }, { multi: true })
	hold.a.onKeyDown(hold.f.ev())
	assert.deepEqual(muteCalls(hold.sent), [])
	const tog = await talkback({ scope: 'except', sources: [], style: 'mute', behavior: 'toggle' }, { multi: true })
	tog.a.onKeyDown(tog.f.ev())
	assert.equal(muteCalls(tog.sent).length, 3)
})

test('talkback toggle: second press restores, even after the settings changed', async () => {
	const s = { scope: 'except', sources: [{ uuid: 'u-mic', name: 'Mic' }], style: 'duck', duckDb: '12', levelDb: '-40', behavior: 'toggle' }
	const { a, f, sent } = await talkback(s)
	a.onKeyDown(f.ev())
	a.onKeyUp(f.ev())
	const v = volumes(sent)
	near(v[0].inputVolumeDb, -18)
	near(v[1].inputVolumeDb, -22)
	s.style = 'mute'
	s.sources = []
	a.onDidReceiveSettings(f.ev())
	a.onKeyDown(f.ev())
	const back = volumes(sent).slice(2)
	assert.deepEqual(back.map((d) => d.inputUuid), ['u-game', 'u-music'])
	near(back[0].inputVolumeMul, GAME.mul)
	assert.deepEqual(muteCalls(sent), [])
})

test('talkback: turning one key off turns off another key on the same source', async () => {
	const A = await talkback({ scope: 'only', sources: [{ uuid: 'u-game', name: 'Game' }], style: 'duck', duckDb: '10', behavior: 'toggle' }, { id: 'A' })
	// One action object serves every Talkback key, as in the plugin.
	const fB = fakeAction('B', false, { scope: 'only', sources: [{ uuid: 'u-game', name: 'Game' }], style: 'duck', duckDb: '10', behavior: 'toggle' })
	await A.a.onWillAppear(fB.appear)
	shown.push({ a: A.a, f: fB })
	const B = { a: A.a, f: fB }
	A.a.onKeyDown(A.f.ev())
	B.a.onKeyDown(B.f.ev())
	await wait()
	assert.ok(B.f.images.at(-1).includes('#b35c00'))
	A.a.onKeyDown(A.f.ev())
	await wait()
	assert.ok(!B.f.images.at(-1).includes('#b35c00'), 'B shows off')
	near(volumes(A.sent).at(-1).inputVolumeMul, GAME.mul)
})

test('talkback: a held key restores when it disappears, a toggle stays on', async () => {
	const hold = await talkback({ scope: 'except', sources: [], style: 'mute', behavior: 'hold' })
	hold.a.onKeyDown(hold.f.ev())
	hold.a.onWillDisappear(hold.f.appear)
	assert.equal(muteCalls(hold.sent).filter(([, m]) => !m).length, 3)
	const tog = await talkback({ scope: 'except', sources: [], style: 'mute', behavior: 'toggle' })
	tog.a.onKeyDown(tog.f.ev())
	tog.a.onWillDisappear(tog.f.appear)
	assert.equal(muteCalls(tog.sent).filter(([, m]) => !m).length, 0)
})

test('talkback: a held key saved at shutdown is restored at start', async () => {
	const store = memStore({ keys: { X: 'hold' }, sources: { 'u-game': { mul: GAME.mul, mutedByUs: true, volumeChanged: false, holders: ['X'] } } })
	const { sent } = await talkback({ scope: 'except', sources: [], style: 'mute', behavior: 'hold' }, { store })
	assert.deepEqual(muteCalls(sent), [['u-game', false]])
})

test('talkback: set volume and talkback amounts are separate settings', async () => {
	const { a, f, sent } = await talkback({ scope: 'only', sources: [{ uuid: 'u-game', name: 'Game' }], style: 'level', levelDb: '-25', duckDb: '5', behavior: 'hold' })
	a.onKeyDown(f.ev())
	near(volumes(sent)[0].inputVolumeDb, -25)
})

test('talkback: a toggle switched to hold while on turns off on the next press', async () => {
	const s = { scope: 'except', sources: [], style: 'mute', behavior: 'toggle' }
	const { a, f, sent } = await talkback(s)
	a.onKeyDown(f.ev())
	a.onKeyUp(f.ev())
	s.behavior = 'hold'
	a.onDidReceiveSettings(f.ev())
	a.onKeyDown(f.ev())
	a.onKeyUp(f.ev())
	assert.equal(muteCalls(sent).filter(([, m]) => !m).length, 3)
})

test('talkback: a damaged state file does not stop the plugin', async () => {
	const { a, f, sent } = await talkback({ scope: 'except', sources: [], style: 'mute', behavior: 'hold' }, { store: memStore({ keys: null, sources: { x: {} } }) })
	a.onKeyDown(f.ev())
	assert.equal(muteCalls(sent).length, 3)
})

test('volume and balance keys treat a missing mode as "Set to" (the settings screen default is never saved)', async () => {
	const { conn, sent } = await connected([{ ...MIC }], connection)
	const vol = await appear(VolumeAction, conn, false, { inputUuid: 'u-mic', value: '-20' })
	await wait()
	assert.ok(!vol.f.images.at(-1).includes('SETUP'), 'no SETUP overlay')
	vol.a.onKeyDown(vol.f.ev())
	near(volumes(sent).at(-1).inputVolumeDb, -20)
	const bal = await appear(BalanceAction, conn, false, { inputUuid: 'u-mic', value: '-40' })
	await wait()
	assert.ok(!bal.f.images.at(-1).includes('SETUP'))
	bal.a.onKeyDown(bal.f.ev())
	assert.equal(sent().filter(([t]) => t === 'SetInputAudioBalance').at(-1)[1].inputAudioBalance, 0.3)
})

test('monitor toggle switches between off and the chosen type', async () => {
	const { conn, sent } = await setup()
	const { a, f } = await appear(MonitorAction, conn, false, { inputUuid: 'u-mic', mode: 'toggle', type: BOTH })
	for (let i = 0; i < 3; i++) a.onKeyDown(f.ev())
	assert.deepEqual(monitors(sent), [BOTH, NONE, BOTH])
})

test('toggle keys follow ON/OFF as native states so each state can have its own icon and title', async () => {
	const { conn, sent, client } = await connected([{ ...MIC, muted: true, monitor: 'OBS_MONITORING_TYPE_MONITOR_ONLY' }, { ...GAME }], connection)
	const mute = await appear(MuteAction, conn, false, { inputUuid: 'u-mic' })
	const ptt = await appear(PttAction, conn, false, { inputUuid: 'u-mic' })
	const mon = await appear(MonitorAction, conn, false, { inputUuid: 'u-mic', mode: 'toggle', type: ONLY })
	await wait()
	assert.equal(mute.f.states.at(-1), 1, 'mute on')
	assert.equal(ptt.f.states.at(-1), 1, 'ptt idle (muted) is the right dot, like Mute')
	assert.equal(mon.f.states.at(-1), 1, 'monitoring on')
	ptt.a.onKeyDown(ptt.f.ev())
	client.emit('InputMuteStateChanged', { inputUuid: 'u-mic', inputMuted: false }) // what OBS reports back
	await wait()
	assert.equal(ptt.f.states.at(-1), 0, 'ptt talking (sound going out) is the left dot')
	assert.equal(mute.f.states.at(-1), 0, 'mute follows the unmute')
	mon.a.onKeyDown(mon.f.ev())
	await wait()
	assert.equal(mon.f.states.at(-1), 0, 'monitoring off')
	const tb = await talkback({ scope: 'only', sources: [{ uuid: 'u-game', name: 'Game' }], style: 'mute', behavior: 'toggle' }, { conn: { conn, sent } })
	await wait()
	assert.equal(tb.f.states.at(-1), 0)
	tb.a.onKeyDown(tb.f.ev())
	await wait()
	assert.equal(tb.f.states.at(-1), 1, 'talkback on')
})

test('a title set in the Stream Deck app hides the drawn name and status', async () => {
	const { conn } = await connected([{ ...MIC, muted: true }], connection)
	const { a, f } = await appear(MuteAction, conn, false, { inputUuid: 'u-mic' })
	a.onTitleParametersDidChange({ action: f.action, payload: { settings: {}, state: 1, title: 'MIC OFF', titleParameters: { showTitle: true } } })
	await wait()
	const img = f.images.at(-1)
	assert.ok(!img.includes('>Mic<') && !img.includes('>MUTED<'), 'no drawn text under the user title')
	assert.ok(img.includes('#8b1a1a'), 'background and meter stay')
})
