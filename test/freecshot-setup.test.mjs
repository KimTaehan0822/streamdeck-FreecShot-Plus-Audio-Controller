import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import fs from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { runFreecshotSetup } from '../dist/freecshot/setup.js'

const ORIGINAL = { alerts_enabled: false, auth_required: true, first_load: false, server_enabled: false, server_password: 'old-secret', server_port: 4455, extra: 1 }

function setup({ running = false, busy = false, content = JSON.stringify(ORIGINAL, null, 4), fsOverride } = {}) {
	const dir = mkdtempSync(join(tmpdir(), 'freecshot-'))
	const configPath = join(dir, 'config.json')
	if (content !== null) writeFileSync(configPath, content)
	const deps = { configPath, isRunning: async () => running, portBusy: async () => busy, now: () => new Date(2026, 10, 10, 12, 0, 0), fs: fsOverride }
	const read = () => JSON.parse(readFileSync(configPath, 'utf8'))
	const backups = () => readdirSync(dir).filter((n) => n.startsWith('config.json.bak-')).sort()
	return { dir, configPath, deps, read, backups }
}

test('does nothing while FreecShot Plus is running', async () => {
	const s = setup({ running: true })
	assert.deepEqual(await runFreecshotSetup({ port: '', password: '' }, s.deps), { ok: false, reason: 'running' })
	assert.deepEqual(s.read(), ORIGINAL)
	assert.deepEqual(s.backups(), [])
})

test('empty port and password: server on at 24455, the existing password and other keys kept', async () => {
	const s = setup()
	const r = await runFreecshotSetup({ port: '', password: '' }, s.deps)
	assert.deepEqual(r, { ok: true, port: 24455, password: 'old-secret' })
	assert.deepEqual(s.read(), { ...ORIGINAL, server_enabled: true, server_port: 24455 })
})

test('a typed password turns authentication on with that password', async () => {
	const s = setup({ content: JSON.stringify({ ...ORIGINAL, auth_required: false }) })
	const r = await runFreecshotSetup({ port: '30000', password: 'abc' }, s.deps)
	assert.deepEqual(r, { ok: true, port: 30000, password: 'abc' })
	const c = s.read()
	assert.equal(c.auth_required, true)
	assert.equal(c.server_password, 'abc')
	assert.equal(c.server_port, 30000)
})

test('no password anywhere and authentication off: connects without one', async () => {
	const s = setup({ content: JSON.stringify({ ...ORIGINAL, auth_required: false, server_password: '' }) })
	const r = await runFreecshotSetup({ port: '', password: '' }, s.deps)
	assert.deepEqual(r, { ok: true, port: 24455, password: '' })
})

test('the backup holds the original bytes', async () => {
	const s = setup({ content: '{"server_enabled":false,  "server_port":4455}' })
	await runFreecshotSetup({ port: '', password: '' }, s.deps)
	assert.deepEqual(s.backups(), ['config.json.bak-20261110-120000'])
	assert.equal(readFileSync(join(s.dir, 'config.json.bak-20261110-120000'), 'utf8'), '{"server_enabled":false,  "server_port":4455}')
})

test('running twice in the same second keeps both backups', async () => {
	const s = setup()
	await runFreecshotSetup({ port: '', password: '' }, s.deps)
	await runFreecshotSetup({ port: '', password: '' }, s.deps)
	assert.deepEqual(s.backups(), ['config.json.bak-20261110-120000', 'config.json.bak-20261110-120000-2'])
})

test('a port outside 1024–65535 or already in use changes nothing', async () => {
	for (const port of ['80', '70000', 'abc', '1.5']) {
		const s = setup()
		assert.deepEqual(await runFreecshotSetup({ port, password: '' }, s.deps), { ok: false, reason: 'badPort' }, port)
		assert.deepEqual(s.read(), ORIGINAL)
	}
	const busy = setup({ busy: true })
	assert.deepEqual(await runFreecshotSetup({ port: '', password: '' }, busy.deps), { ok: false, reason: 'portBusy' })
	assert.deepEqual(busy.read(), ORIGINAL)
	assert.deepEqual(busy.backups(), [])
})

test('a missing or broken config file is reported and left alone', async () => {
	const missing = setup({ content: null })
	assert.deepEqual(await runFreecshotSetup({ port: '', password: '' }, missing.deps), { ok: false, reason: 'noConfig' })
	assert.equal(existsSync(missing.configPath), false)
	const broken = setup({ content: '{oops' })
	assert.deepEqual(await runFreecshotSetup({ port: '', password: '' }, broken.deps), { ok: false, reason: 'badConfig' })
	assert.equal(readFileSync(broken.configPath, 'utf8'), '{oops')
})

test('a failed write leaves the original file in place', async () => {
	const failing = { ...fs, rename: async () => { throw new Error('disk full') } }
	const s = setup({ fsOverride: failing })
	assert.deepEqual(await runFreecshotSetup({ port: '', password: '' }, s.deps), { ok: false, reason: 'writeFailed' })
	assert.deepEqual(s.read(), ORIGINAL)
	assert.equal(existsSync(s.configPath + '.tmp'), false, 'no half-written temp file left behind')
})

test('a failed backup stops before touching the config', async () => {
	const failing = { ...fs, copyFile: async () => { throw Object.assign(new Error('denied'), { code: 'EACCES' }) } }
	const s = setup({ fsOverride: failing })
	assert.deepEqual(await runFreecshotSetup({ port: '', password: '' }, s.deps), { ok: false, reason: 'backupFailed' })
	assert.deepEqual(s.read(), ORIGINAL)
})

test('a port another program listens on counts as busy, whichever address it listens on', async () => {
	const { isPortBusy } = await import('../dist/freecshot/setup.js')
	const net = await import('node:net')
	for (const host of ['0.0.0.0', '127.0.0.1', '::']) {
		const other = net.createServer()
		await new Promise((r) => other.listen({ port: 0, host }, r))
		const { port } = other.address()
		try {
			assert.equal(await isPortBusy(port), true, `listener on ${host}`)
		} finally {
			await new Promise((r) => other.close(r))
		}
		assert.equal(await isPortBusy(port), false, `free again after ${host} closed`)
	}
})
