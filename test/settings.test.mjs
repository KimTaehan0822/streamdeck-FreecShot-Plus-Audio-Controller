import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeSettings, stepOf, meterOpts, sourceOf, nameOf, num } from '../dist/runtime/settings.js'

test('normalizeSettings defaults and bad ports', () => {
	assert.deepEqual(normalizeSettings({}), { host: '127.0.0.1', port: 4455, password: '' })
	assert.equal(normalizeSettings({ port: '99999' }).port, 4455)
	assert.equal(normalizeSettings({ port: '4460', host: ' 192.168.0.2 ', password: 'pw' }).port, 4460)
	assert.equal(normalizeSettings({ host: ' 192.168.0.2 ' }).host, '192.168.0.2')
	assert.equal(normalizeSettings({ password: 'pw' }).password, 'pw')
})

test('blank or text settings fall back to defaults', () => {
	assert.equal(stepOf({ step: ' ' }, 1), 1)
	assert.equal(stepOf({ step: 'abc' }, 1), 1)
	assert.equal(stepOf({ step: '0' }, 1), 1)
	assert.equal(stepOf({ step: '-2' }, 1), 1)
	assert.equal(stepOf({ step: '0.5' }, 1), 0.5)
	assert.ok(Number.isNaN(num(' ')))
})

test('meterOpts defaults', () => {
	assert.deepEqual(meterOpts({}), { style: 'standard', channels: 'lr' })
	assert.deepEqual(meterOpts({ meterStyle: 'wide', channels: 'combined' }), { style: 'wide', channels: 'combined' })
	assert.deepEqual(meterOpts({ meterStyle: 'x' }), { style: 'standard', channels: 'lr' })
})

test('source and name', () => {
	assert.equal(sourceOf({}), undefined)
	assert.equal(sourceOf({ inputUuid: 'u' }), 'u')
	const conn = { input: (u) => (u === 'u' ? { name: 'Mic' } : undefined) }
	assert.equal(nameOf(conn, { inputUuid: 'u', displayName: '  ' }), 'Mic')
	assert.equal(nameOf(conn, { inputUuid: 'u', displayName: 'Voice' }), 'Voice')
	assert.equal(nameOf(conn, { inputUuid: 'gone', inputName: 'Old Mic' }), 'Old Mic')
})
