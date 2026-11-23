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
			const d = SHARED_DESIGNS[name]
			const m = input({ muted: true })
			const all = d.strip(m) + d.pair(m, 'top') + d.pair(m, 'bottom')
			assert.ok(all.includes('음소거'), name)
			assert.ok(!all.includes('MUTED'), name)
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

test('the dial and button designs follow the global settings', async () => {
	const { setMeterDesigns, designFor, toMeterInput } = await import('../dist/render/design.js')
	try {
		assert.equal(setMeterDesigns('vu', 'same', '-18'), true)
		assert.equal(designFor('dial'), SHARED_DESIGNS.vu)
		assert.equal(designFor('key'), SHARED_DESIGNS.vu)
		setMeterDesigns('obs', undefined, undefined)
		assert.equal(designFor('dial'), undefined)
		assert.equal(designFor('key'), undefined)
		setMeterDesigns('big', 'plugin', '-18')
		assert.equal(designFor('dial'), SHARED_DESIGNS.big)
		assert.equal(designFor('key'), undefined)
		assert.equal(setMeterDesigns('big', 'plugin', '-18'), false)
		assert.equal(setMeterDesigns('big', 'plugin', '-14'), true)

		const levels = { left: -10, right: -16, combined: -10, holdLeft: -8, holdRight: -14, holdCombined: -8 }
		const view = (over = {}) => ({ name: 'Mic', volumeDb: -6, levels, rms: { left: -30, right: -40 }, muted: false, peek: false, style: 'standard', channels: 'lr', overlay: 'none', ...over })
		assert.equal(toMeterInput(view(), SHARED_DESIGNS.vu).leftDb, -30)
		assert.equal(toMeterInput(view(), SHARED_DESIGNS.big).leftDb, -10)
		assert.deepEqual(toMeterInput(view(), SHARED_DESIGNS.big).fader, { db: -6 })
		assert.equal(toMeterInput(view({ channels: 'combined' }), SHARED_DESIGNS.big).levelText, '-10.0 dB')
		const silent = toMeterInput(view({ volumeDb: -Infinity }), SHARED_DESIGNS.big)
		assert.ok(!SHARED_DESIGNS.big.strip(silent).includes('NaN'))
	} finally {
		setMeterDesigns('plugin', 'same', undefined)
	}
})

test('volume texts that fit are not cut short (designs measure text like TotalMix)', () => {
	assert.ok(!SHARED_DESIGNS.topping.key(keyInput()).includes('…'))
	assert.ok(!SHARED_DESIGNS.big.pair(input(), 'right').includes('…'))
	assert.ok(!SHARED_DESIGNS.topping.strip(input()).includes('…'))
})

// The <text> elements as [fill, text] (a tspan unit counts as part of its number).
const texts = (svg) => [...svg.matchAll(/<text[^>]*fill="([^"]+)"[^>]*>([^<]*)/g)].map((m) => [m[1], m[2]])
const REDS = ['rgb(255,57,31)', '#E5483E']
const redHas = (svg, word) => texts(svg).some(([fill, t]) => REDS.includes(fill) && t.startsWith(word))

test('muted: every design keeps the volume in red, and shows MUTED where the level would be', () => {
	const m = input({ muted: true })
	for (const name of NAMES) {
		const d = SHARED_DESIGNS[name]
		assert.ok(redHas(d.strip(m), '-6.0'), `${name} strip volume`)
		const vertical = d.pair(m, 'top') + d.pair(m, 'bottom')
		const horizontal = d.pair(m, 'left') + d.pair(m, 'right')
		assert.ok(redHas(vertical, '-6.0'), `${name} vertical volume`)
		assert.ok(redHas(horizontal, '-6.0'), `${name} horizontal volume`)
		assert.ok(redHas(vertical, 'MUTED'), `${name} vertical MUTED`)
		assert.ok(redHas(d.key(keyInput({ muted: true })), '-6.0'), `${name} key volume`)
		assert.ok(!(d.strip(m) + vertical + horizontal).includes('-12.0'), `${name} level hidden while muted`)
	}
})

test('Big number dial: the L/R level is not cut, and the name keeps its size as the level changes', () => {
	const lr = (levelText) => SHARED_DESIGNS.big.strip(input({ name: 'Microphone Aux', levelText }))
	assert.ok(lr('L -12.0 R -20.0').includes('L -12.0 R -20.0'))
	const nameSize = (svg) => /font-size="(\d+)"[^>]*>Micro/.exec(svg)?.[1]
	assert.equal(nameSize(lr('L -5.0 R -5.0')), nameSize(lr('L -45.0 R -45.0')))
	assert.equal(nameSize(lr('L -inf R -inf')), nameSize(lr('L -45.0 R -45.0')))
})

test('Big number vertical fader keeps every dB mark', () => {
	const both = SHARED_DESIGNS.big.pair(input(), 'top') + SHARED_DESIGNS.big.pair(input(), 'bottom')
	for (const m of ['>0<', '>-20<', '>-40<', '>-60<']) assert.ok(both.includes(m), m)
})
