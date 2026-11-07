import assert from 'node:assert/strict'
import test from 'node:test'
import { sliderPos, stepDb, clampSetDb, dbText, balanceText } from '../dist/obs/volume.js'
import { levelsFor, MeterTracker } from '../dist/obs/meter-state.js'

const near = (a, b, eps = 1e-3) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`)
const db = (mul) => 20 * Math.log10(mul)

test('slider curve matches libobs', () => {
	assert.equal(sliderPos(0), 1)
	assert.equal(sliderPos(5), 1)
	assert.equal(sliderPos(-96), 0)
	assert.equal(sliderPos(-Infinity), 0)
	near(sliderPos(-6), 0.7553)
})

test('steps below -60 go to -inf and back to -60', () => {
	assert.equal(stepDb(-59.5, -1), -Infinity)
	assert.equal(stepDb(-Infinity, 1), -60)
	assert.equal(stepDb(-Infinity, -1), -Infinity)
	assert.equal(stepDb(-0.5, 1), 0)
	assert.equal(stepDb(-6, -1), -7)
})

test('set values clamp', () => {
	assert.equal(clampSetDb(3), 0)
	assert.equal(clampSetDb(-100), -Infinity)
	assert.equal(clampSetDb(-20), -20)
})

test('texts', () => {
	assert.equal(dbText(-6), '-6.0 dB')
	assert.equal(dbText(-Infinity), '-inf dB')
	assert.equal(balanceText(0.5), 'C')
	assert.equal(balanceText(0.3), 'L 40')
	assert.equal(balanceText(0.8), 'R 60')
})

test('levels use post-fader peak, muted uses input peak times volume', () => {
	const raw = [[0.1, 0.5, 1], [0.1, 0.25, 0.5]]
	near(levelsFor(raw, false, 0.5).left, db(0.5), 1e-9)
	near(levelsFor([[0, 0, 1], [0, 0, 0.5]], true, 0.5).left, db(0.5), 1e-9)
	assert.equal(levelsFor(raw, false, 1).combined, levelsFor(raw, false, 1).left)
})

test('mono source shows the same value on both rows; silence is -inf', () => {
	const l = levelsFor([[0, 0.5, 0.5]], false, 1)
	assert.equal(l.left, l.right)
	assert.equal(levelsFor([], false, 1).left, -Infinity)
})

test('peak decays at OBS default (fast) 23.53 dB/s and hold lasts 20 s', () => {
	const m = new MeterTracker()
	m.update({ left: -10, right: -10, combined: -10 }, 0)
	m.update({ left: -60, right: -60, combined: -60 }, 1000)
	near(m.display(1000).left, -33.53, 0.01)
	assert.equal(m.display(19_000).holdLeft, -10)
	assert.ok(m.display(21_000).holdLeft < -10)
})

test('steps keep a boosted or very low volume from jumping', () => {
	assert.equal(stepDb(6, 1), 6) // above 0 dB (set in OBS): up does nothing
	assert.equal(stepDb(6, -1), 5) // down steps normally from the boost
	assert.equal(stepDb(-80, 1), -60) // below the floor: up goes to the floor, not silence
	assert.equal(stepDb(-80, -1), -Infinity)
})
