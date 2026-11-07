import assert from 'node:assert/strict'
import test from 'node:test'
import { PttLatch } from '../dist/runtime/ptt.js'
import { fakeTimers } from './fake-obs.mjs'

function latch() {
	const sent = []
	const timers = fakeTimers()
	let online = true
	const l = new PttLatch((muted) => sent.push(muted), () => online, { setTimeout: timers.setTimeout, clearTimeout: timers.clearTimeout })
	l.setOnline = (v) => (online = v)
	return { l, sent, timers }
}

test('talk unmutes on press and restores muted after the delay', () => {
	const { l, sent, timers } = latch()
	l.press('talk', true)
	assert.deepEqual(sent, [false])
	assert.equal(l.active, true)
	l.release(200)
	assert.deepEqual(sent, [false])
	assert.deepEqual(timers.runAll(), [200])
	assert.deepEqual(sent, [false, true])
	assert.equal(l.active, false)
})

test('mute mode on an already muted source stays muted after release', () => {
	const { l, sent } = latch()
	l.press('mute', true)
	l.release(0)
	assert.deepEqual(sent, [true, true])
})

test('pressing again during the delay cancels the restore and keeps the first remembered state', () => {
	const { l, sent, timers } = latch()
	l.press('talk', true)
	l.release(200)
	l.press('talk', false) // OBS now reports unmuted because of the first press
	assert.deepEqual(timers.runAll(), [])
	l.release(0)
	assert.deepEqual(sent.at(-1), true)
})

test('delay 0 restores at once, abort restores at once', () => {
	const a = latch()
	a.l.press('talk', true)
	a.l.release(0)
	assert.deepEqual(a.sent, [false, true])
	const b = latch()
	b.l.press('talk', true)
	b.l.abort()
	assert.deepEqual(b.sent, [false, true])
	b.l.abort()
	assert.deepEqual(b.sent, [false, true])
})

test('abort during the delay restores at once and cancels the timer', () => {
	const { l, sent, timers } = latch()
	l.press('talk', true)
	l.release(200)
	l.abort()
	assert.deepEqual(sent, [false, true])
	assert.deepEqual(timers.runAll(), [])
})

test('restores on reconnect when released while offline', () => {
	const { l, sent } = latch()
	l.press('talk', true)
	l.setOnline(false)
	l.release(0)
	assert.deepEqual(sent, [false])
	l.setOnline(true)
	l.reconnected()
	assert.deepEqual(sent, [false, true])
	l.reconnected()
	assert.deepEqual(sent, [false, true])
})

test('still held at reconnect re-sends the held state, release restores', () => {
	const { l, sent } = latch()
	l.press('talk', true)
	l.setOnline(false)
	l.setOnline(true)
	l.reconnected()
	assert.deepEqual(sent, [false, false])
	l.release(0)
	assert.deepEqual(sent, [false, false, true])
})
