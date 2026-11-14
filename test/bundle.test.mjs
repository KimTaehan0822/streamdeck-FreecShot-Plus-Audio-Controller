import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

// Runs after `npm run bundle` (part of `npm test`): both plugin folders must be built from the one source.
const OBS = 'com.haeunga0822.obs-audio.sdPlugin'
const FC = 'com.haeunga0822.freecshot-audio.sdPlugin'
const json = (p) => JSON.parse(readFileSync(p, 'utf8'))

test('the FreecShot Plus manifest has its own UUIDs and the same actions', () => {
	const obs = json(`${OBS}/manifest.json`)
	const fc = json(`${FC}/manifest.json`)
	assert.equal(fc.UUID, 'com.haeunga0822.freecshot-audio')
	assert.equal(fc.Name, 'Web-Socket Audio Controller for FreecShot Plus')
	assert.equal(fc.Category, 'Web-Socket Audio Controller for FreecShot Plus')
	assert.equal(fc.Author, '김탄2')
	assert.equal(fc.Version, '1.0.3.0', 'the FreecShot Plus plugin has its own version')
	assert.equal(obs.Version, '1.0.2.0')
	assert.match(fc.Description, /Unofficial/)
	assert.deepEqual(fc.Actions.map((a) => a.UUID.split('.').pop()), obs.Actions.map((a) => a.UUID.split('.').pop()))
	for (const a of fc.Actions) assert.ok(a.UUID.startsWith('com.haeunga0822.freecshot-audio.'), a.UUID)
	assert.ok(!JSON.stringify(fc).includes('obs-audio'))
})

test('each bundle registers only its own action UUIDs', () => {
	const obs = readFileSync(`${OBS}/bin/plugin.js`, 'utf8')
	const fc = readFileSync(`${FC}/bin/plugin.js`, 'utf8')
	assert.ok(fc.includes("BUILD = 'freecshot'") || fc.includes('BUILD = "freecshot"'))
	assert.ok(obs.includes("BUILD = 'obs'") || obs.includes('BUILD = "obs"'))
})

test('the FreecShot Plus settings screen knows which plugin it is', () => {
	assert.match(readFileSync(`${FC}/ui/flavour.js`, 'utf8'), /PI_FLAVOUR = 'freecshot'/)
	assert.match(readFileSync(`${OBS}/ui/flavour.js`, 'utf8'), /PI_FLAVOUR = 'obs'/)
	assert.equal(readFileSync(`${FC}/ui/common.js`, 'utf8'), readFileSync(`${OBS}/ui/common.js`, 'utf8'))
})
