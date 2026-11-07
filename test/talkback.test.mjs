import assert from 'node:assert/strict'
import test from 'node:test'
import { TalkbackRegistry } from '../dist/runtime/talkback.js'

const mul = (db) => (db === -Infinity ? 0 : 10 ** (db / 20))
const src = (uuid, db, muted = false) => ({ uuid, volumeMul: mul(db), muted })
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≉ ${b}`)

function registry({ online = true, exists = () => true } = {}) {
	const sent = []
	const saves = []
	const offs = []
	const deps = {
		send: (type, data) => sent.push([type, data]),
		isOnline: () => deps.online,
		exists: (uuid) => exists(uuid),
		save: (s) => saves.push(JSON.parse(JSON.stringify(s))),
		onOff: (ids) => offs.push(ids),
		online,
	}
	return { r: new TalkbackRegistry(deps), sent, saves, offs, deps }
}

test('mute: skips sources already muted, mutes the rest, release unmutes only those', () => {
	const { r, sent } = registry()
	r.apply('A', 'hold', [src('x', -6), src('y', -6, true)], 'mute', 0)
	assert.deepEqual(sent, [['SetInputMute', { inputUuid: 'x', inputMuted: true }]])
	assert.equal(r.active('A'), true)
	sent.length = 0
	r.release('A')
	assert.deepEqual(sent, [['SetInputMute', { inputUuid: 'x', inputMuted: false }]])
	assert.equal(r.active('A'), false)
})

test('level: -30 lowers a -10 dB source, leaves a -40 dB source alone, release restores the exact volume', () => {
	const { r, sent } = registry()
	r.apply('A', 'hold', [src('x', -10), src('y', -40)], 'level', -30)
	assert.deepEqual(sent, [['SetInputVolume', { inputUuid: 'x', inputVolumeDb: -30 }]])
	sent.length = 0
	r.release('A')
	assert.equal(sent.length, 1)
	assert.equal(sent[0][1].inputUuid, 'x')
	near(sent[0][1].inputVolumeMul, mul(-10))
})

test('level -inf sends volume 0', () => {
	const { r, sent } = registry()
	r.apply('A', 'hold', [src('x', -10)], 'level', -Infinity)
	assert.deepEqual(sent, [['SetInputVolume', { inputUuid: 'x', inputVolumeMul: 0 }]])
})

test('duck: 15 dB takes -6 to -21, a -inf source gets nothing, release restores', () => {
	const { r, sent } = registry()
	r.apply('A', 'toggle', [src('x', -6), src('z', -Infinity)], 'duck', 15)
	assert.equal(sent.length, 1)
	assert.equal(sent[0][1].inputUuid, 'x')
	near(sent[0][1].inputVolumeDb, -21)
	sent.length = 0
	r.release('A')
	assert.equal(sent.length, 1)
	near(sent[0][1].inputVolumeMul, mul(-6))
})

test('two keys on one source: the first value is kept, releasing one turns both off', () => {
	const { r, sent, offs } = registry()
	r.apply('A', 'toggle', [src('x', -6)], 'duck', 15)
	r.apply('B', 'toggle', [src('x', -21), src('y', -3)], 'duck', 10)
	sent.length = 0
	r.release('A')
	const vol = Object.fromEntries(sent.filter(([t]) => t === 'SetInputVolume').map(([, d]) => [d.inputUuid, d.inputVolumeMul]))
	near(vol.x, mul(-6))
	near(vol.y, mul(-3))
	assert.deepEqual(offs, [['A', 'B']])
	assert.equal(r.active('B'), false)
})

test('a key with no source to change still counts as on', () => {
	const { r, sent, offs } = registry()
	r.apply('A', 'toggle', [src('x', -6, true)], 'mute', 0)
	assert.equal(r.active('A'), true)
	assert.deepEqual(sent, [])
	r.release('A')
	assert.deepEqual(offs, [['A']])
})

test('release while offline restores on reconnect, skipping sources that are gone', () => {
	const { r, sent, deps } = registry({ exists: (u) => u === 'x' })
	r.apply('A', 'hold', [src('x', -6), src('y', -6)], 'mute', 0)
	sent.length = 0
	deps.online = false
	r.release('A')
	assert.deepEqual(sent, [])
	assert.equal(r.active('A'), false)
	deps.online = true
	r.reconnected()
	assert.deepEqual(sent, [['SetInputMute', { inputUuid: 'x', inputMuted: false }]])
	r.reconnected()
	assert.equal(sent.length, 1)
})

test('nothing is applied while offline', () => {
	const { r, sent } = registry({ online: false })
	r.apply('A', 'hold', [src('x', -6)], 'mute', 0)
	assert.deepEqual(sent, [])
	assert.equal(r.active('A'), false)
})

test('load: a held key is restored at once, a toggle stays on', () => {
	const first = registry()
	first.r.apply('A', 'hold', [src('x', -6)], 'mute', 0)
	first.r.apply('B', 'toggle', [src('y', -6)], 'duck', 10)
	const saved = JSON.parse(JSON.stringify(first.r.state()))
	const { r, sent } = registry()
	r.load(saved)
	assert.deepEqual(sent, [['SetInputMute', { inputUuid: 'x', inputMuted: false }]])
	assert.equal(r.active('A'), false)
	assert.equal(r.active('B'), true)
	sent.length = 0
	r.release('B')
	near(sent[0][1].inputVolumeMul, mul(-6))
})

test('load while offline keeps the restore for the reconnect', () => {
	const first = registry()
	first.r.apply('A', 'hold', [src('x', -6)], 'mute', 0)
	const { r, sent, deps } = registry({ online: false })
	r.load(JSON.parse(JSON.stringify(first.r.state())))
	assert.deepEqual(sent, [])
	deps.online = true
	r.reconnected()
	assert.deepEqual(sent, [['SetInputMute', { inputUuid: 'x', inputMuted: false }]])
})

test('every change is saved and the state survives JSON', () => {
	const { r, saves } = registry()
	r.apply('A', 'toggle', [src('x', -6)], 'duck', 10)
	r.release('A')
	assert.equal(saves.length, 2)
	assert.deepEqual(saves[0].keys, { A: 'toggle' })
	assert.deepEqual(saves[1], { keys: {}, sources: {} })
})

test('a restore OBS did not take stays pending and is retried on reconnect', async () => {
	const { r, sent, deps, saves } = registry()
	r.apply('A', 'hold', [src('x', -6)], 'mute', 0)
	let ok = false
	deps.send = (type, data) => {
		sent.push([type, data])
		return Promise.resolve(ok)
	}
	sent.length = 0
	r.release('A')
	await new Promise((res) => setImmediate(res))
	assert.equal(sent.length, 1)
	assert.ok('x' in saves.at(-1).sources, 'still recorded')
	ok = true
	r.reconnected()
	await new Promise((res) => setImmediate(res))
	assert.equal(sent.length, 2)
	assert.deepEqual(saves.at(-1).sources, {})
})
