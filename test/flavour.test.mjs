import assert from 'node:assert/strict'
import test from 'node:test'
import { FLAVOUR, FLAVOURS } from '../dist/flavour.js'
import { ID } from '../dist/actions/common.js'
import { normalizeSettings } from '../dist/runtime/settings.js'

test('the FreecShot Plus flavour has its own UUID, port 24455 and auto setup', () => {
	assert.equal(FLAVOURS.freecshot.uuid, 'com.haeunga0822.freecshot-audio')
	assert.equal(FLAVOURS.freecshot.defaultPort, 24455)
	assert.equal(FLAVOURS.freecshot.autoSetup, true)
})

test('the OBS flavour keeps its UUID and port 4455, without auto setup', () => {
	assert.equal(FLAVOURS.obs.uuid, 'com.haeunga0822.obs-audio')
	assert.equal(FLAVOURS.obs.defaultPort, 4455)
	assert.equal(FLAVOURS.obs.autoSetup, false)
})

test('tests build the OBS flavour, and action ids and the default port follow it', () => {
	assert.equal(FLAVOUR.name, 'obs')
	assert.equal(ID, 'com.haeunga0822.obs-audio.')
	assert.equal(normalizeSettings({}).port, 4455)
})
