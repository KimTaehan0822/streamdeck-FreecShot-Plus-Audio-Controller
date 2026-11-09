import assert from 'node:assert/strict'
import test from 'node:test'
import { setLanguage, language, t, KEY_TEXT } from '../dist/i18n.js'

test('every language has the same key texts', () => {
	const keys = Object.keys(KEY_TEXT.en).sort()
	for (const l of ['ko', 'ja']) assert.deepEqual(Object.keys(KEY_TEXT[l]).sort(), keys, l)
	for (const l of ['en', 'ko', 'ja']) for (const k of keys) assert.ok(KEY_TEXT[l][k], `${l}.${k}`)
})

test('unknown language falls back to English', () => {
	assert.equal(setLanguage('xx'), 'en')
	assert.equal(language(), 'en')
	assert.equal(t('muted'), 'MUTED')
	setLanguage('ko')
	assert.equal(t('muted'), '음소거')
	setLanguage('ja')
	assert.equal(t('talkback'), 'トークバック')
	setLanguage('en')
})

test('settings screen texts exist in every language with the same keys', async () => {
	const { readFileSync } = await import('node:fs')
	const vm = await import('node:vm')
	const ctx = { globalThis: {} }
	ctx.globalThis = ctx
	vm.runInNewContext(readFileSync('com.haeunga0822.obs-audio.sdPlugin/ui/i18n.js', 'utf8'), ctx)
	const { PI_TEXT } = ctx
	const keys = Object.keys(PI_TEXT.en).sort()
	assert.ok(keys.length > 40)
	for (const l of ['ko', 'ja']) assert.deepEqual(Object.keys(PI_TEXT[l]).sort(), keys, l)
	for (const l of ['en', 'ko', 'ja']) for (const k of keys) assert.ok(PI_TEXT[l][k], `${l}.${k}`)
})

test('talkback store ignores a damaged file', async () => {
	const { writeFileSync, mkdtempSync } = await import('node:fs')
	const { join } = await import('node:path')
	const { tmpdir } = await import('node:os')
	const { talkbackStore } = await import('../dist/runtime/talkback-store.js')
	const file = join(mkdtempSync(join(tmpdir(), 'tb-')), 'state.json')
	for (const bad of ['{"keys":null,"sources":{}}', '{"keys":{},"sources":{"x":{}}}', '{"keys":{"A":"hold"},"sources":', 'null']) {
		writeFileSync(file, bad)
		assert.equal(talkbackStore(file).load(), undefined, bad)
	}
	writeFileSync(file, '{"keys":{"A":"toggle"},"sources":{"x":{"mul":0.5,"mutedByUs":false,"volumeChanged":true,"holders":["A"]}}}')
	assert.deepEqual(talkbackStore(file).load().keys, { A: 'toggle' })
})

test('FreecShot Plus settings texts exist in every language', async () => {
	const { readFileSync } = await import('node:fs')
	const vm = await import('node:vm')
	const ctx = {}
	ctx.globalThis = ctx
	vm.runInNewContext(readFileSync('com.haeunga0822.obs-audio.sdPlugin/ui/i18n.js', 'utf8'), ctx)
	const reasons = ['ok', 'running', 'noConfig', 'badConfig', 'badPort', 'portBusy', 'backupFailed', 'writeFailed']
	const keys = ['freecshotConnection', 'freecshotHint', 'autoSetup', ...reasons.map((r) => 'setup_' + r)]
	for (const l of ['en', 'ko', 'ja']) for (const k of keys) assert.ok(ctx.PI_TEXT[l][k], `${l}.${k}`)
	assert.equal(ctx.PI_TEXT.ko.setup_ok, '설정했습니다. 프릭샷플러스를 켜고 SOOP에 로그인하세요')
})
