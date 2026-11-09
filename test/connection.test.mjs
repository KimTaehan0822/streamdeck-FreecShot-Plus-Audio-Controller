import assert from 'node:assert/strict'
import test from 'node:test'
import { ObsConnection } from '../dist/connection.js'
import { fakeObs, fakeTimers, settle } from './fake-obs.mjs'

const MIC = { uuid: 'u-mic', name: 'Mic', audio: true, mul: 0.5, muted: true, balance: 0.3, monitor: 'OBS_MONITORING_TYPE_MONITOR_ONLY' }
const IMG = { uuid: 'u-img', name: 'Image', audio: false }
const SETTINGS = { host: '127.0.0.1', port: 4455, password: '' }

async function started(opts) {
	const obs = fakeObs(opts)
	const timers = fakeTimers()
	const conn = new ObsConnection({ createClient: obs.create, now: () => 0, setTimeout: timers.setTimeout, clearTimeout: timers.clearTimeout })
	conn.start(SETTINGS)
	await settle()
	return { obs, timers, conn, client: obs.clients.at(-1) }
}

test('only inputs answering GetInputVolume are audio inputs', async () => {
	const { conn } = await started({ inputs: [MIC, IMG] })
	assert.equal(conn.online, true)
	assert.deepEqual(conn.inputs(), [{ value: 'u-mic', label: 'Mic' }])
})

test('initial state is read once', async () => {
	const { conn } = await started({ inputs: [MIC] })
	const i = conn.input('u-mic')
	assert.equal(i.name, 'Mic')
	assert.equal(i.muted, true)
	assert.equal(i.balance, 0.3)
	assert.equal(i.monitorType, 'OBS_MONITORING_TYPE_MONITOR_ONLY')
	assert.equal(i.volumeMul, 0.5)
	assert.ok(Math.abs(i.volumeDb - 20 * Math.log10(0.5)) < 1e-9)
})

test('silent volume is -Infinity dB', async () => {
	const { conn } = await started({ inputs: [{ ...MIC, mul: 0 }] })
	assert.equal(conn.input('u-mic').volumeDb, -Infinity)
})

test('events update state and notify once per tick', async () => {
	const { conn, client } = await started({ inputs: [MIC] })
	let changes = 0
	conn.onChange(() => changes++)
	client.emit('InputVolumeChanged', { inputUuid: 'u-mic', inputVolumeMul: 1, inputVolumeDb: 0 })
	client.emit('InputMuteStateChanged', { inputUuid: 'u-mic', inputMuted: false })
	client.emit('InputAudioBalanceChanged', { inputUuid: 'u-mic', inputAudioBalance: 0.9 })
	client.emit('InputAudioMonitorTypeChanged', { inputUuid: 'u-mic', monitorType: 'OBS_MONITORING_TYPE_NONE' })
	await settle()
	const i = conn.input('u-mic')
	assert.equal(i.volumeDb, 0)
	assert.equal(i.muted, false)
	assert.equal(i.balance, 0.9)
	assert.equal(i.monitorType, 'OBS_MONITORING_TYPE_NONE')
	assert.equal(changes, 1)
})

test('meters feed the tracker', async () => {
	const { conn, client } = await started({ inputs: [MIC] })
	client.emit('InputVolumeMeters', { inputs: [{ inputUuid: 'u-mic', inputLevelsMul: [[0.1, 0.5, 1]] }] })
	assert.ok(conn.input('u-mic').meter.display(0).left > -7)
})

test('rename and removal update state', async () => {
	const { conn, client } = await started({ inputs: [MIC] })
	client.emit('InputNameChanged', { inputUuid: 'u-mic', oldInputName: 'Mic', inputName: 'Voice' })
	assert.equal(conn.input('u-mic').name, 'Voice')
	client.emit('InputRemoved', { inputUuid: 'u-mic', inputName: 'Voice' })
	assert.equal(conn.input('u-mic'), undefined)
	assert.deepEqual(conn.inputs(), [])
})

test('InputCreated with audio is added', async () => {
	const inputs = [IMG]
	const { conn, client } = await started({ inputs })
	inputs.push({ uuid: 'u-new', name: 'Desktop', audio: true })
	client.emit('InputCreated', { inputUuid: 'u-new', inputName: 'Desktop' })
	client.emit('InputCreated', { inputUuid: 'u-img', inputName: 'Image' })
	await settle()
	assert.deepEqual(conn.inputs(), [{ value: 'u-new', label: 'Desktop' }])
})

test('connect failure goes offline and retries after 3000 ms', async () => {
	const { conn, obs, timers } = await started({ inputs: [MIC], fail: 1 })
	assert.equal(conn.online, false)
	assert.deepEqual(timers.runAll(), [3000])
	await settle()
	assert.equal(obs.clients.reduce((n, c) => n + c.connects, 0), 2)
	assert.equal(conn.online, true)
})

test('ConnectionClosed goes offline and reconnects; onReconnect fires', async () => {
	const { conn, client, timers } = await started({ inputs: [MIC] })
	let reconnects = 0
	conn.onReconnect(() => reconnects++)
	client.emit('ConnectionClosed', new Error('closed'))
	assert.equal(conn.online, false)
	assert.deepEqual(timers.runAll(), [3000])
	await settle()
	assert.equal(conn.online, true)
	assert.equal(reconnects, 1)
})

test('restart closes the old client before the new one connects', async () => {
	const { conn, obs } = await started({ inputs: [MIC] })
	conn.start({ ...SETTINGS, port: 4456 })
	await settle()
	assert.equal(obs.clients.length, 2)
	assert.equal(obs.clients[0].disconnected, true)
	// a late close of the old client must not take the new one offline
	obs.clients[0].emit('ConnectionClosed', new Error('closed'))
	assert.equal(conn.online, true)
})

test('calls while offline are dropped, errors do not throw', async () => {
	const { conn, client } = await started({ inputs: [MIC], fail: 1 })
	await conn.call('SetInputMute', { inputUuid: 'u-mic', inputMuted: true })
	assert.equal(client.calls.filter(([t]) => t === 'SetInputMute').length, 0)
})

test('browser sources are audio inputs only with "control audio via OBS" on', async () => {
	const { conn } = await started({
		inputs: [
			{ uuid: 'u-web', name: 'Web', audio: true, kind: 'browser_source', settings: {} },
			{ uuid: 'u-web2', name: 'Web Audio', audio: true, kind: 'browser_source', settings: { reroute_audio: true } },
		],
	})
	assert.deepEqual(conn.inputs(), [{ value: 'u-web2', label: 'Web Audio' }])
})

test('turning on reroute_audio for a browser source adds it', async () => {
	const web = { uuid: 'u-web', name: 'Web', audio: true, kind: 'browser_source', settings: {} }
	const { conn, client } = await started({ inputs: [web] })
	web.settings = { reroute_audio: true }
	client.emit('InputSettingsChanged', { inputUuid: 'u-web', inputSettings: web.settings })
	await settle()
	assert.equal(conn.inputs().length, 1)
	web.settings = {}
	client.emit('InputSettingsChanged', { inputUuid: 'u-web', inputSettings: {} })
	await settle()
	assert.equal(conn.inputs().length, 0)
})

test('call reports whether OBS took the request', async () => {
	const { conn } = await started({ inputs: [MIC] })
	assert.equal(await conn.call('SetInputMute', { inputUuid: 'u-mic', inputMuted: true }), true)
	assert.equal(await conn.call('GetInputVolume', { inputUuid: 'missing' }), false)
	const offline = await started({ inputs: [MIC], fail: 1 })
	assert.equal(await offline.conn.call('SetInputMute', { inputUuid: 'u-mic', inputMuted: true }), false)
})

test('code 207 (not signed in yet) waits for login, then clears once the program is ready', async () => {
	const { conn, timers } = await started({ inputs: [MIC], notReady: 1 })
	assert.equal(conn.online, false)
	assert.equal(conn.waitingLogin, true)
	let changes = 0
	conn.onChange(() => changes++)
	assert.deepEqual(timers.runAll(), [3000])
	await settle()
	assert.equal(conn.online, true)
	assert.equal(conn.waitingLogin, false)
	assert.ok(changes > 0)
})

test('any other connect error is plain offline, not waiting for login', async () => {
	const { conn } = await started({ inputs: [MIC], fail: 1 })
	assert.equal(conn.waitingLogin, false)
})
