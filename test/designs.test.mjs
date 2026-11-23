import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import test from 'node:test'
import { SHARED_DESIGNS } from '../dist/render/meters/index.js'
import { setLanguage } from '../dist/i18n.js'

const input = (over = {}) => ({ name: 'Mic', leftDb: -12, rightDb: -20, fader: { db: -6 }, faderText: '-6.0 dB', levelText: '-12.0 dB', muted: false, peek: false, overlay: 'none', ...over })
const keyInput = (over = {}) => ({ title: 'Mic', value: '-6.0 dB', meter: { leftDb: -12, rightDb: -20, fader: { db: -6 }, muted: false, ...over }, overlay: 'none' })
const NAMES = ['classic', 'modern', 'topping', 'big', 'vu']

// Images to look at by eye (git-ignored).
const out = (name, svg) => {
	mkdirSync('test/out', { recursive: true })
	writeFileSync(`test/out/${name}.svg`, svg)
}

test('every design draws a dial strip, both fader halves and a key', () => {
	for (const name of NAMES) {
		const d = SHARED_DESIGNS[name]
		assert.ok(d, name)
		const strip = d.strip(input())
		assert.match(strip, /^<svg[^>]*width="200"/, name)
		out(`design-${name}-strip`, strip)
		for (const role of ['top', 'bottom', 'left', 'right']) {
			const half = d.pair(input(), role)
			assert.match(half, /^<svg[^>]*width="144"/, `${name} ${role}`)
			assert.ok(!half.includes('NaN'), `${name} ${role}`)
			out(`design-${name}-${role}`, half)
		}
		const key = d.key(keyInput())
		assert.match(key, /^<svg[^>]*width="144"/, name)
		out(`design-${name}-key`, key)
		assert.ok(!strip.includes('NaN') && !key.includes('NaN'), name)
	}
})

test('silence and a -inf fader draw without NaN', () => {
	for (const name of NAMES) {
		const d = SHARED_DESIGNS[name]
		const silent = input({ leftDb: -Infinity, rightDb: -Infinity, fader: { db: -Infinity } })
		const all = d.strip(silent) + d.pair(silent, 'top') + d.pair(silent, 'right') + d.key(keyInput({ leftDb: -Infinity, rightDb: -Infinity, fader: { db: -Infinity } }))
		assert.ok(!all.includes('NaN'), name)
	}
})

test('MUTED is drawn in the plugin language', () => {
	setLanguage('ko')
	try {
		for (const name of NAMES) {
			const strip = SHARED_DESIGNS[name].strip(input({ muted: true }))
			assert.ok(strip.includes('음소거'), name)
			assert.ok(!strip.includes('MUTED'), name)
		}
	} finally {
		setLanguage('en')
	}
})

test('Mix Studio Classic and Modern keep their TotalMix colours', () => {
	assert.ok(SHARED_DESIGNS.classic.strip(input()).includes('rgb(31,41,48)'))
	assert.ok(SHARED_DESIGNS.modern.strip(input()).includes('rgb(25,209,32)'))
	assert.ok(SHARED_DESIGNS.classic.pair(input({ muted: true }), 'bottom').includes('stroke="rgb(255,57,31)"'))
})
