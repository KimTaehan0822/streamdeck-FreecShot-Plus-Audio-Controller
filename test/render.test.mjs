import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import test from 'node:test'
import { wrapName } from '../dist/render/text.js'
import { renderVuStrip, renderButtonFader, zoneEdges, setMeterFloor, meterFloor, labelStep } from '../dist/render/meter.js'
import { renderMuteKey, renderVolumeKey, renderPttKey, renderMonitorKey, renderBalanceKey, renderBalanceStrip, renderTalkbackKey } from '../dist/render/keys.js'
import { sliderPos } from '../dist/obs/volume.js'
import { setLanguage } from '../dist/i18n.js'
import { textWidth } from '../dist/render/svg.js'

const levels = { left: -14, right: -18, combined: -14, holdLeft: -10, holdRight: -16, holdCombined: -10 }
const view = (over = {}) => ({ name: 'Mic', volumeDb: -6, levels, muted: false, peek: false, style: 'standard', channels: 'lr', overlay: 'none', ...over })
const meter = { levels, muted: false, style: 'standard', channels: 'lr', volumeDb: -6 }
const count = (s, sub) => s.split(sub).length - 1

// Write a few images to look at by eye (git-ignored).
const out = (name, svg) => {
	mkdirSync('test/out', { recursive: true })
	writeFileSync(`test/out/${name}.svg`, svg)
}

test('wrapName keeps short names on one line', () => {
	assert.deepEqual(wrapName('Mic', 24, 128, 3, 10), { lines: ['Mic'], size: 24 })
})

test('wraps at spaces up to the line limit', () => {
	const r = wrapName('Desktop Audio Capture Main', 24, 128, 3, 10)
	assert.ok(r.lines.length >= 2 && r.lines.length <= 3)
	assert.equal(r.lines.join(' '), 'Desktop Audio Capture Main')
})

test('wraps Hangul without spaces by character', () => {
	const r = wrapName('데스크톱오디오캡처장치', 24, 128, 3, 10)
	assert.ok(r.lines.length >= 2)
	assert.equal(r.lines.join(''), '데스크톱오디오캡처장치')
})

test('shrinks before cutting', () => {
	const name = 'Very Long Source Name That Needs Four Lines At Full Size'
	const r = wrapName(name, 24, 128, 3, 10)
	assert.ok(r.lines.length <= 3)
	assert.ok(r.size < 24)
	assert.equal(r.lines.join(' '), name)
})

test('cuts only the last line at the minimum size', () => {
	const r = wrapName('x'.repeat(200), 24, 128, 3, 10)
	assert.equal(r.lines.length, 3)
	assert.ok(r.lines[2].endsWith('…'))
	assert.ok(!r.lines[0].endsWith('…'))
	assert.equal(r.size, 10)
})

test('wrapName respects a height limit', () => {
	const r = wrapName('Desktop Audio Capture Main', 24, 128, 3, 8, 30)
	assert.ok(r.lines.length * r.size * 1.15 <= 30)
})

test('standard style colours switch at -20 and -9', () => {
	assert.deepEqual(zoneEdges('standard'), [-20, -9])
	const svg = renderVuStrip(view())
	assert.ok(svg.includes('x="129.33"'), 'yellow zone starts at -20 dB')
	assert.ok(svg.includes('x="161.6"'), 'red zone starts at -9 dB')
	out('vu-standard', svg)
})

test('wide style at -13 and -2', () => {
	assert.deepEqual(zoneEdges('wide'), [-13, -2])
	const svg = renderVuStrip(view({ style: 'wide' }))
	assert.ok(svg.includes('x="149.87"'))
	assert.ok(svg.includes('x="182.13"'))
})

test('muted strip is grey with MUTED', () => {
	const svg = renderVuStrip(view({ muted: true }))
	assert.ok(svg.includes('#4a4a4a') && svg.includes('#bbb') && svg.includes('MUTED'))
	assert.ok(!svg.includes('#4cff4c'))
	out('vu-muted', svg)
})

test('peek shows the dB instead of MUTED', () => {
	const svg = renderVuStrip(view({ muted: true, peek: true }))
	assert.ok(!svg.includes('MUTED'))
	assert.ok(svg.includes('-6.0 dB'))
})

test('combined mode keeps both bars, only the level text changes', () => {
	const fills = (svg) => count(svg, 'fill="#267f26"')
	const lr = renderVuStrip(view())
	const combined = renderVuStrip(view({ channels: 'combined' }))
	assert.equal(fills(lr), 2)
	assert.equal(fills(combined), 2)
	assert.ok(lr.includes('>L -14.0 R -18.0<'))
	assert.ok(combined.includes('-14.0 dB') && !combined.includes('L -14.0'))
})

test('fader is a blue line on the meter at the same dB, no OBS slider', () => {
	const svg = renderVuStrip(view())
	assert.ok(svg.includes('x1="170.4"'), 'line at -6 dB on the -60..0 meter')
	assert.ok(svg.includes('y1="31"') && svg.includes('y2="50"'), 'line stays inside the bars')
	assert.ok(svg.includes('rgb(40,140,255)'))
	assert.ok(!svg.includes('#3c404b'), 'no slider track')
	assert.ok(renderVuStrip(view({ volumeDb: -Infinity })).includes('x1="12"'), '-inf sits at the left end')
})

test('dial text is large: name, volume and level at 19px or more', () => {
	const svg = renderVuStrip(view())
	assert.ok(!svg.includes('font-size="15"') && !svg.includes('font-size="8"'))
	assert.ok(svg.includes('font-size="19"'))
})

test('dial uses the TotalMix layout: centred name, level bottom-left, volume bottom-right', () => {
	const svg = renderVuStrip(view())
	assert.match(svg, /<text x="100"[^>]*font-size="20"[^>]*text-anchor="middle"[^>]*>Mic</)
	assert.match(svg, /<text x="4" y="88.65"[^>]*font-size="16"[^>]*>L -14.0 R -18.0</)
	assert.match(renderVuStrip(view({ channels: 'combined' })), /<text x="4" y="88.65"[^>]*font-size="19"[^>]*>-14.0 dB</)
	assert.match(svg, /<text x="196" y="88.65"[^>]*text-anchor="end"[^>]*>-6.0 dB</)
	const muted = renderVuStrip(view({ muted: true }))
	assert.match(muted, /<text x="100" y="88.65"[^>]*>MUTED</)
	assert.ok(!muted.includes('-6.0 dB') && !muted.includes('L -14.0'))
})

test('meters have an OBS-style dB scale next to thin L/R bars on the dial, both faders and the keys', () => {
	const vu = renderVuStrip(view())
	for (const db of [0, -10, -20, -30, -40, -50, -60]) assert.ok(vu.includes(`>${db}<`), `dial label ${db}`)
	assert.ok(vu.includes('height="9"'), 'thin bars')
	assert.ok(renderButtonFader(view(), 'top').includes('>-10<'))
	assert.ok(renderButtonFader(view(), 'left').includes('>-50<'))
	assert.ok(!renderButtonFader(view(), 'top').includes('>-30<'), 'no label cut in half at the seam')
	assert.ok(renderButtonFader(view(), 'bottom').includes('>-14.0 dB<'), 'level text not cut')
	const key = renderVolumeKey({ name: 'Mic', volumeDb: -6, meter, overlay: 'none' })
	assert.ok(key.includes('>-20<') && key.includes('>-40<'))
})

test('button faders use the TotalMix layout: big centred name and volume on the first key, level on the second', () => {
	const top = renderButtonFader(view(), 'top')
	assert.match(top, /<text x="72" y="[0-9.]+"[^>]*font-size="24"[^>]*>-6.0 dB</)
	assert.match(renderButtonFader(view(), 'bottom'), /<text x="72" y="129.6"[^>]*font-size="28.8"[^>]*>-14.0 dB</)
	assert.match(renderButtonFader(view(), 'right'), /<text x="72" y="129.6"[^>]*>-6.0 dB</)
	assert.match(renderButtonFader(view(), 'left'), /<text x="72" y="129.6"[^>]*>-14.0 dB</)
	const mutedTop = renderButtonFader(view({ muted: true }), 'top')
	assert.ok(!mutedTop.includes('-6.0 dB') && !mutedTop.includes('MUTED'))
	assert.match(renderButtonFader(view({ muted: true }), 'bottom'), /<text x="72" y="129.6"[^>]*>MUTED</)
})

test('volume, monitor and balance keys use the Talkback sizes too', () => {
	const fontOf = (svg, text) => +svg.match(new RegExp(`font-size="([0-9.]+)"[^>]*>${text}<`))[1]
	const live = renderMuteKey({ name: 'Mic', muted: false, volumeDb: -6, meter, overlay: 'none' })
	assert.ok(!live.includes('dB'), 'mute key shows no volume')
	const vol = renderVolumeKey({ name: 'Mic', volumeDb: -6, muted: false, peek: false, meter, overlay: 'none' })
	assert.equal(fontOf(vol, 'Mic'), 36)
	assert.ok(fontOf(vol, '-6.0 dB') >= 32)
	const mon = renderMonitorKey({ name: 'Mic', type: 'OBS_MONITORING_TYPE_MONITOR_ONLY', overlay: 'none' })
	assert.equal(fontOf(mon, 'Mic'), 36)
	assert.equal(fontOf(mon, 'MON'), 40)
	const bal = renderBalanceKey({ name: 'Mic', balance: 0.3, overlay: 'none' })
	assert.equal(fontOf(bal, 'Mic'), 36)
	assert.ok(fontOf(bal, 'L 40') >= 32)
	assert.ok(+bal.match(/y="([0-9.]+)"[^>]*>L 40</)[1] + 6 <= 120, 'balance text ends above its bar')
})

test('the minimum size itself is tried when the size steps skip it', () => {
	const r = wrapName('Mmmmmm', 20.8, 84, 2, 16, 48)
	assert.deepEqual(r.lines, ['Mmmmmm'])
	assert.equal(r.size, 16)
})

test('an English word is shrunk, never split in the middle', () => {
	const r = wrapName('Supercalifragilistic', 24, 128, 3, 11)
	assert.deepEqual(r.lines, ['Supercalifragilistic'])
	assert.ok(r.size < 24)
})

const sizeOf = (svg, text) => +svg.match(new RegExp(`font-size="([0-9.]+)"[^>]*>${text}<`))[1]

test('vertical two-key fader: wider meter, readable name and scale', () => {
	const top = renderButtonFader(view({ name: '1.Stream Mix' }), 'top')
	assert.ok(top.includes('width="21.5"'), 'each bar 21.5 px wide')
	assert.ok(sizeOf(top, '1.Stream Mix') >= 18, 'name on one line, at least 18 px')
	assert.equal(sizeOf(top, '-10'), 14)
})

test('two-key faders: one name line, so the meter is the same size for every source', () => {
	for (const role of ['top', 'left']) {
		const svgs = ['Mic', '2.NoneRecord', 'Desktop Audio Capture'].map((name) => renderButtonFader(view({ name }), role))
		for (const svg of svgs) assert.equal([...svg.matchAll(/<text x="72"[^>]*text-anchor="middle"[^>]*>(?![-+]?[0-9.]+ dB)[^<]+</g)].length, 1, `${role}: one name line`)
		assert.ok(svgs.every((svg) => meterTop(svg) === meterTop(svgs[0])), `${role}: ${svgs.map(meterTop).join(' ')}`)
		assert.ok(sizeOf(svgs[1], '2.NoneRecord') >= 19)
	}
})

test('horizontal two-key fader: -60 label stays inside the key', () => {
	const left = renderButtonFader(view(), 'left')
	const x = +left.match(/<text x="([\d.]+)"[^>]*>-60</)[1]
	assert.ok(x - 14 >= 0, `-60 centred at ${x} fits`)
	assert.equal(sizeOf(left, '-50'), 14)
})

test('two-key fader names stay clear of the rounded key corners and are at least 19 px', async () => {
	const { textWidth } = await import('../dist/render/svg.js')
	for (const role of ['top', 'left']) {
		const svg = renderButtonFader(view({ name: '1.Stream Mix' }), role)
		const names = [...svg.matchAll(/<text x="72" y="([0-9.]+)"[^>]*font-size="([0-9.]+)"[^>]*>([^<]*Stream[^<]*|Mix)</g)]
		assert.ok(names.length > 0, role)
		for (const [, y, size, t] of names) {
			assert.ok(+size >= 19, `${role} name ${size}px`)
			assert.ok(+y - +size * 0.9 >= 5.99, `${role} name top at ${+y - +size * 0.9}`)
			assert.ok(textWidth(t, +size) <= 128, `${role} name width`)
		}
	}
})

// Top edge of the first bar (the meter's 0 dB end for vertical, the bars' top for horizontal).
const meterTop = (svg) => Math.min(...[...svg.matchAll(/<rect x="[0-9.]+" y="([0-9.]+)"[^>]*fill="#7f2626"/g)].map((m) => +m[1]))

test('fader names at 19 px are not split mid-word, and a cut keeps its spaces', () => {
	assert.deepEqual(wrapName('2.NoneRecord', 28.8, 128, 2, 22, 56).lines, ['2.None', 'Record'], 'breaks at the natural boundary')
	const r = wrapName('Desktop Audio Capture Long', 19, 128, 2, 19, 48)
	assert.ok(r.lines[1].startsWith('Capture') || r.lines[1].includes(' '), r.lines.join(' | '))
	assert.ok(!r.lines.join('').includes('AudioCapt'))
})

test('key texts follow the language and stay inside the key', () => {
	setLanguage('ko')
	try {
		assert.ok(renderMuteKey({ name: 'Mic', muted: true, volumeDb: -6, meter: { ...meter, muted: true }, overlay: 'none' }).includes('>음소거<'))
		assert.ok(renderVuStrip(view({ overlay: 'offline' })).includes('오프라인'))
		setLanguage('ja')
		const mon = renderMonitorKey({ name: 'Mic', type: 'OBS_MONITORING_TYPE_MONITOR_AND_OUTPUT', overlay: 'none' })
		const m = mon.match(/font-size="([0-9.]+)"[^>]*>モニター</)
		assert.ok(m && mon.includes('>+出力<'), 'translated monitor text, two lines')
		assert.ok(textWidth('モニター', +m[1]) <= 136)
	} finally {
		setLanguage('en')
	}
})

test('talkback key: orange while on, the style in the middle', () => {
	const on = renderTalkbackKey({ name: 'Talkback', style: 'mute', valueDb: 0, active: true, overlay: 'none' })
	assert.ok(on.includes('#b35c00') && on.includes('>MUTE<') && on.includes('>Talkback<'))
	const off = renderTalkbackKey({ name: 'Talkback', style: 'level', valueDb: -30, active: false, overlay: 'none' })
	assert.ok(!off.includes('#b35c00') && off.includes('>-30 dB<'))
	assert.ok(renderTalkbackKey({ name: 'Talkback', style: 'duck', valueDb: 15, active: false, overlay: 'none' }).includes('>▼15 dB<'))
	assert.ok(renderTalkbackKey({ name: 'Talkback', style: 'level', valueDb: -Infinity, active: false, overlay: 'none' }).includes('>-inf dB<'))
})

test('offline overlay', () => {
	assert.ok(renderVuStrip(view({ overlay: 'offline' })).includes('OFFLINE'))
	const key = renderMuteKey({ name: 'Mic', muted: false, volumeDb: -6, meter, overlay: 'offline' })
	const [, y, size] = key.match(/y="([0-9.]+)"[^>]*font-size="([0-9.]+)"[^>]*>OFFLINE</).map(Number)
	assert.ok(size >= 28 && textWidth('OFFLINE', size) <= 136, `OFFLINE ${size} px`)
	assert.ok(Math.abs(y - 0.36 * size - 72) <= 1, `centred: baseline ${y}`)
	const dial = renderVuStrip(view({ overlay: 'offline' }))
	assert.ok(+dial.match(/font-size="([0-9.]+)"[^>]*>OFFLINE</)[1] >= 36, 'larger on the dial')
})

test('button fader halves split meter and slider', () => {
	const top = renderButtonFader(view({ name: '마이크' }), 'top')
	const bottom = renderButtonFader(view({ name: '마이크' }), 'bottom')
	assert.ok(top.includes('마이크') && top.includes('-6.0 dB'))
	assert.ok(!bottom.includes('마이크'))
	assert.ok(bottom.includes('-14.0'))
	out('fader-top', top)
	out('fader-bottom', bottom)
	out('fader-left', renderButtonFader(view(), 'left'))
	out('fader-right', renderButtonFader(view(), 'right'))
	assert.ok(top.includes('rgb(40,140,255)') && !top.includes('#3c404b'))
})

test('ptt key: green while live, its mode under the name, no meter', () => {
	const live = renderPttKey({ name: 'Mic', mode: 'talk', live: true, meter, overlay: 'none' })
	assert.ok(live.includes('>Push to talk<') && live.includes('#1f7a1f'))
	assert.ok(!live.includes('>-20<'), 'no level meter')
	const idle = renderPttKey({ name: 'Mic', mode: 'mute', live: false, meter: { ...meter, muted: true }, overlay: 'none' })
	assert.ok(idle.includes('>Push to mute<') && !idle.includes('#1f7a1f') && !idle.includes('TALK'))
	setLanguage('ko')
	try {
		assert.ok(renderPttKey({ name: 'Mic', mode: 'talk', live: true, meter, overlay: 'none' }).includes('>누르면 말하기<'))
		assert.ok(renderPttKey({ name: 'Mic', mode: 'mute', live: true, meter, overlay: 'none' }).includes('>누르면 음소거<'))
	} finally {
		setLanguage('en')
	}
	out('ptt-live', live)
})

test('mute key is red with MUTED when muted', () => {
	const svg = renderMuteKey({ name: 'Mic', muted: true, volumeDb: -6, meter: { ...meter, muted: true }, overlay: 'none' })
	assert.ok(svg.includes('MUTED') && svg.includes('#8b1a1a'))
	const live = renderMuteKey({ name: 'Mic', muted: false, volumeDb: -6, meter, overlay: 'none' })
	assert.ok(!live.includes('dB'), 'mute key shows no volume')
	const vol = renderVolumeKey({ name: 'Mic', volumeDb: -6, muted: false, peek: false, meter, overlay: 'none' })
	assert.ok(vol.includes('>-20<'), 'the meter scale is drawn with a -20 label')
	assert.ok(!svg.includes('>-20<'), 'mute key draws no level meter')
	out('mute', svg)
})

test('mute key centres the name, and the name with MUTED under it while muted', () => {
	const rows = (svg) => [...svg.matchAll(/<text x="72" y="([0-9.]+)"[^>]*font-size="([0-9.]+)"[^>]*>([^<]+)</g)].map(([, y, size, text]) => ({ y: +y, size: +size, text }))
	// Visible block: from the first line's cap top (0.72 of the size above its baseline) to the last baseline.
	const middle = (r) => (r[0].y - 0.72 * r[0].size + r[r.length - 1].y) / 2
	const idle = rows(renderMuteKey({ name: 'Mic', muted: false, volumeDb: -6, meter, overlay: 'none' }))
	assert.deepEqual(idle.map((r) => r.text), ['Mic'])
	assert.ok(Math.abs(middle(idle) - 72) <= 1, `idle middle ${middle(idle)}`)
	const muted = rows(renderMuteKey({ name: 'Mic', muted: true, volumeDb: -6, meter, overlay: 'none' }))
	assert.deepEqual(muted.map((r) => r.text), ['Mic', 'MUTED'])
	assert.ok(Math.abs(middle(muted) - 72) <= 1, `muted middle ${middle(muted)}`)
	const two = rows(renderMuteKey({ name: '2.NoneRecord', muted: true, volumeDb: -6, meter, overlay: 'none' }))
	assert.deepEqual(two.map((r) => r.text), ['2.None', 'Record', 'MUTED'])
	assert.ok(Math.abs(middle(two) - 72) <= 1 && two[0].y - 0.72 * two[0].size >= 4 && two[2].y <= 140, two.map((r) => r.y).join(' '))
})

test('volume key shows the volume', () => {
	const svg = renderVolumeKey({ name: 'Mic', volumeDb: -6, muted: false, peek: false, meter, overlay: 'none' })
	assert.ok(svg.includes('-6.0 dB'))
	out('volume', svg)
})

test('monitor key shows MON+OUT', () => {
	const both = renderMonitorKey({ name: 'Mic', type: 'OBS_MONITORING_TYPE_MONITOR_AND_OUTPUT', overlay: 'none' })
	assert.ok(both.includes('>MON<') && both.includes('>+OUT<'), 'monitor and output on two lines')
	assert.ok(renderMonitorKey({ name: 'Mic', type: 'OBS_MONITORING_TYPE_NONE', overlay: 'none' }).includes('OFF'))
})

test('balance strip shows L 40', () => {
	assert.ok(renderBalanceStrip({ name: 'Mic', balance: 0.3, overlay: 'none' }).includes('L 40'))
	assert.ok(renderBalanceKey({ name: 'Mic', balance: 0.5, overlay: 'none' }).includes('>C<'))
})

test('talkback and PTT keys: large name, smaller text under it', () => {
	const svg = renderTalkbackKey({ name: 'Mic', style: 'level', valueDb: -30, active: false, overlay: 'none' })
	const size = (text) => +svg.match(new RegExp(`font-size="([0-9.]+)"[^>]*>${text}<`))[1]
	assert.equal(size('Mic'), 48)
	assert.ok(size('-30 dB') <= 26, `under ${size('-30 dB')}`)
	const ptt = renderPttKey({ name: 'Mic', mode: 'talk', live: true, meter, overlay: 'none' })
	const pttSize = (text) => +ptt.match(new RegExp(`font-size="([0-9.]+)"[^>]*>${text}<`))[1]
	assert.equal(pttSize('Mic'), 48)
	assert.ok(pttSize('Push to talk') <= 26 && textWidth('Push to talk', pttSize('Push to talk')) <= 136)
	const ko = renderTalkbackKey({ name: '토크백', style: 'duck', valueDb: 15, active: true, overlay: 'none' })
	assert.ok(textWidth('▼15 dB', +ko.match(/font-size="([0-9.]+)"[^>]*>▼15 dB</)[1]) <= 136)
})

test('mute key keeps a 36 px name and a 32 px+ MUTED', () => {
	const fontOf = (svg, text) => +svg.match(new RegExp(`font-size="([0-9.]+)"[^>]*>${text}<`))[1]
	const mute = renderMuteKey({ name: 'Mic', muted: true, volumeDb: -6, meter: { ...meter, muted: true }, overlay: 'none' })
	for (const [svg, word] of [[mute, 'MUTED']]) {
		assert.equal(fontOf(svg, 'Mic'), 36)
		assert.ok(fontOf(svg, word) >= 32, `${word} ${fontOf(svg, word)}`)
		assert.ok(textWidth(word, fontOf(svg, word)) <= 136)
	}
})

test('monitor and output is two large lines, balance value 48 px', () => {
	const fontOf = (svg, text) => +svg.match(new RegExp(`font-size="([0-9.]+)"[^>]*>${text}<`))[1]
	const mon = renderMonitorKey({ name: '2.NoneRecord', type: 'OBS_MONITORING_TYPE_MONITOR_AND_OUTPUT', overlay: 'none' })
	assert.ok(fontOf(mon, 'MON') >= 30 && fontOf(mon, '[+]OUT') >= 30, `${fontOf(mon, 'MON')} / ${fontOf(mon, '[+]OUT')}`)
	setLanguage('ko')
	try {
		const ko = renderMonitorKey({ name: 'Mic', type: 'OBS_MONITORING_TYPE_MONITOR_AND_OUTPUT', overlay: 'none' })
		assert.ok(ko.includes('>모니터<') && ko.includes('>+출력<'))
	} finally {
		setLanguage('en')
	}
	assert.equal(fontOf(renderBalanceKey({ name: 'Mic', balance: 0.3, overlay: 'none' }), 'L 40'), 48)
	const r100 = renderBalanceKey({ name: 'Mic', balance: 1, overlay: 'none' })
	assert.ok(textWidth('R 100', fontOf(r100, 'R 100')) <= 136)
})

test('a long one-word name breaks at a natural boundary instead of shrinking to one tiny line', () => {
	const r = wrapName('2.NoneRecord', 36, 128, 2, 14, 66)
	assert.deepEqual(r.lines, ['2.None', 'Record'])
	assert.ok(r.size >= 28, `size ${r.size}`)
	assert.deepEqual(wrapName('SoundTrack_Main', 36, 128, 2, 14, 66).lines, ['Sound', 'Track_Main'])
})

test('2.NoneRecord is large on faders, monitor and balance keys', () => {
	const fontOf = (svg, text) => +svg.match(new RegExp(`font-size="([0-9.]+)"[^>]*>${text}<`))[1]
	const h = renderButtonFader(view({ name: '2.NoneRecord' }), 'left')
	assert.ok(fontOf(h, '2.NoneRecord') >= 19, `horizontal fader ${fontOf(h, '2.NoneRecord')}`)
	const mon = renderMonitorKey({ name: '2.NoneRecord', type: 'OBS_MONITORING_TYPE_MONITOR_ONLY', overlay: 'none' })
	assert.ok(fontOf(mon, 'Record') >= 27, `monitor ${fontOf(mon, 'Record')}`)
	const bal = renderBalanceKey({ name: '2.NoneRecord', balance: 0.3, overlay: 'none' })
	assert.ok(fontOf(bal, 'Record') >= 24, `balance ${fontOf(bal, 'Record')}`)
})

test('vertical two-key fader name is at most 26 px', () => {
	const fontOf = (svg, text) => +svg.match(new RegExp(`font-size="([0-9.]+)"[^>]*>${text}<`))[1]
	assert.equal(fontOf(renderButtonFader(view({ name: 'Mic' }), 'top'), 'Mic'), 26)
	assert.equal(fontOf(renderButtonFader(view({ name: 'Mic' }), 'left'), 'Mic'), 29, 'horizontal up to 29')
})

test('FreecShot theme: dark key, coloured border and state text instead of a filled background', async () => {
	const { FLAVOURS, useTheme } = await import('../dist/flavour.js')
	useTheme(FLAVOURS.freecshot.theme)
	try {
		setLanguage('en')
		const muted = renderMuteKey({ name: 'Mic', muted: true, volumeDb: -6, meter: { ...meter, muted: true }, overlay: 'none' })
		assert.ok(muted.includes('stroke="#FF4D5E"'))
		assert.ok(muted.includes('stroke-width="12"'), 'a border thick enough to survive the key bezel')
		assert.ok(muted.includes('fill="#FF4D5E" fill-opacity="0.22"'), 'a faint tint of the state colour')
		assert.ok(muted.includes('fill="#171B1E"'))
		assert.ok(!muted.includes('#8b1a1a'))
		assert.ok(muted.includes('fill="#FF4D5E">MUTED<'), 'MUTED drawn in the mute colour')
		for (const on of [
			renderPttKey({ name: 'Mic', mode: 'talk', live: true, meter, overlay: 'none' }),
			renderTalkbackKey({ name: 'Talkback', style: 'mute', valueDb: 0, active: true, overlay: 'none' }),
			renderMonitorKey({ name: 'Mic', type: 'OBS_MONITORING_TYPE_MONITOR_ONLY', overlay: 'none' }),
		]) {
			assert.ok(on.includes('stroke="#0CC5FE"'))
			assert.ok(!/#1f7a1f|#b35c00|#24427a/.test(on))
		}
		for (const off of [
			renderMuteKey({ name: 'Mic', muted: false, volumeDb: -6, meter, overlay: 'none' }),
			renderPttKey({ name: 'Mic', mode: 'talk', live: false, meter, overlay: 'none' }),
			renderTalkbackKey({ name: 'Talkback', style: 'mute', valueDb: 0, active: false, overlay: 'none' }),
			renderMonitorKey({ name: 'Mic', type: 'OBS_MONITORING_TYPE_NONE', overlay: 'none' }),
		])
			assert.ok(!off.includes('stroke=') && !off.includes('fill-opacity'), 'no border or tint while off')
		// Text keeps clear of the 12 px border: drawn at 86 % both on and off, so it never jumps when toggled.
		const ptt = (live) => renderPttKey({ name: '0.MIC', mode: 'talk', live, meter, overlay: 'none' })
		assert.ok(ptt(true).includes('scale(0.86)') && ptt(false).includes('scale(0.86)'))
		assert.ok(renderButtonFader(view(), 'top').includes('#00D7FC'))
	} finally {
		useTheme(FLAVOURS.obs.theme)
	}
	const obs = renderMuteKey({ name: 'Mic', muted: true, volumeDb: -6, meter: { ...meter, muted: true }, overlay: 'none' })
	assert.ok(obs.includes('#8b1a1a') && !obs.includes('#171B1E'), 'OBS look restored')
})

test('login overlay shows LOGIN, translated', async () => {
	const { frame } = await import('../dist/render/svg.js')
	setLanguage('en')
	assert.ok(frame(144, 144, '', 'login').includes('>LOGIN<'))
	setLanguage('ko')
	assert.ok(frame(144, 144, '', 'login').includes('>로그인 대기<'))
	setLanguage('ja')
	assert.ok(frame(144, 144, '', 'login').includes('>ログイン待ち<'))
	setLanguage('en')
})

test('meter floor setting: only -60/-50/-40/-30, anything else is -60', () => {
	try {
		assert.equal(setMeterFloor('-40'), true)
		assert.equal(meterFloor(), -40)
		assert.equal(setMeterFloor(-40), false)
		for (const bad of [undefined, 'abc', '-45', -100, null]) {
			setMeterFloor(bad)
			assert.equal(meterFloor(), -60, String(bad))
		}
	} finally {
		setMeterFloor(-60)
	}
})

test('label step keeps numbers 24 px apart', () => {
	assert.deepEqual([-60, -50, -40, -30].map((f) => labelStep(176, f)), [10, 10, 10, 5])
	assert.deepEqual([-60, -50, -40, -30].map((f) => labelStep(120, f)), [20, 10, 10, 10])
})

test('dial with the meter starting at -40 shows -40..0 only', () => {
	try {
		setMeterFloor('-40')
		const svg = renderVuStrip(view())
		for (const db of [0, -10, -20, -30, -40]) assert.ok(svg.includes(`>${db}<`), String(db))
		assert.ok(!svg.includes('>-50<') && !svg.includes('>-60<'))
		setMeterFloor('-30')
		assert.ok(renderVuStrip(view()).includes('>-25<'), 'every 5 dB at -30')
	} finally {
		setMeterFloor(-60)
	}
})

test('levels, hold and volume below the start sit at the low end', () => {
	try {
		setMeterFloor('-40')
		const quiet = renderVuStrip(view({ levels: { left: -50, right: -55, combined: -50, holdLeft: -45, holdRight: -48, holdCombined: -45 }, volumeDb: -50 }))
		assert.ok(!quiet.includes('#4cff4c'), 'no bright bar below the start')
		const x = (svg) => +svg.match(/<line x1="([0-9.]+)"[^>]*stroke-width="3"/)[1]
		assert.equal(x(quiet), 12, 'fader line at the left end of the dial meter box')
		assert.equal(x(renderVuStrip(view({ volumeDb: -Infinity }))), 12)
	} finally {
		setMeterFloor(-60)
	}
})

test('two-key vertical fader keeps numbers off the seam at every start', () => {
	try {
		for (const f of [-60, -50, -40, -30]) {
			setMeterFloor(f)
			const top = renderButtonFader(view(), 'top')
			for (const [, y] of top.matchAll(/<text x="[0-9.]+" y="([0-9.]+)"[^>]*fill="#aaa"/g)) assert.ok(Math.abs(+y - 144) > 6, `${f}: label at ${y}`)
		}
	} finally {
		setMeterFloor(-60)
	}
})

test('horizontal two-key fader numbers (14 px) keep a clear gap at every start', () => {
	try {
		setMeterFloor('-50')
		const pair = renderButtonFader(view(), 'left') + renderButtonFader(view(), 'right')
		assert.ok(!pair.includes('>-45<') && !pair.includes('>-35<'), 'numbers every 10 dB at -50, not 5')
		setMeterFloor(-60)
		const top = renderButtonFader(view(), 'top') + renderButtonFader(view(), 'bottom')
		for (const db of [0, -10, -20, -40, -50, -60]) assert.ok(top.includes(`>${db}<`), `vertical default keeps ${db}`)
	} finally {
		setMeterFloor(-60)
	}
})
