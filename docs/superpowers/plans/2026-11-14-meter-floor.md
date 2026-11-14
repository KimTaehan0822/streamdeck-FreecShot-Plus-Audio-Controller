# 미터 시작점 설정 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 모든 미터(VU Dial, Fader(2-Button), Volume 키)의 시작점을 전역 설정 하나로 -60/-50/-40/-30 dB 중에서 고르게 한다.

**Architecture:** 시작점은 언어처럼 모듈 안의 값 하나로 둔다(`src/render/meter.ts`의 `meterFloor()`). 플러그인이 전역 설정 `meterFloor`를 받으면 값을 바꾸고 모든 키를 다시 그린다. 그리기 코드는 `METER_MIN` 상수 대신 `meterFloor()`를 쓰고, 숫자 눈금 간격은 미터 길이와 범위로 계산한다. 설정 화면은 공통 블록에 접힌 칸 하나를 더한다(프릭샷플러스용 설정 화면은 빌드 스크립트가 그대로 복사한다).

**Tech Stack:** TypeScript, `@elgato/streamdeck` 3, sdpi-components 4, `node --test`

**Spec:** `docs/superpowers/specs/2026-11-14-meter-floor-design.md`

## Global Constraints

- 고를 수 있는 값: `-60`, `-50`, `-40`, `-30` (dB). 기본값과 잘못된 값은 `-60`.
- 전역 설정 이름: `meterFloor` (설정 화면은 문자열로 저장한다: `"-40"`).
- 볼륨 조절 규칙(`src/obs/volume.ts`의 `FLOOR_DB = -60`)은 바꾸지 않는다. 화면 범위만 바뀐다.
- 숫자 눈금 간격: 5, 10, 20 dB 중 숫자 사이가 24px 이상인 가장 촘촘한 값. 작은 눈금은 5 dB마다.
- 시작점이 -60이면 지금 화면과 같아야 한다.
- 화면 글자: English "Meter range" / "Start", 한국어 "미터 범위" / "시작점", 日本語 "メーター範囲" / "開始点". 선택지는 `-60 dB` `-50 dB` `-40 dB` `-30 dB`.
- 사용자에게 보이는 모든 글은 한국어. PDF는 Noto Sans KR(+ Noto Sans JP 보조). 코드 변경 후에는 번들을 다시 만들고 이 플러그인만 다시 시작한다.

## Review Focus

1. 저장된 값이 이상할 때(`undefined`, `"abc"`, `"-45"`, 숫자 `-40`): -60으로 보거나 맞는 값으로 읽어야 한다 → Task 1 테스트.
2. 레벨·볼륨·피크 홀드가 시작점보다 작을 때: 밝은 막대가 없고, 파란 선은 맨 끝, 피크 홀드는 그리지 않는다 → Task 1 테스트.
3. 2버튼 세로 페이더 이음매 근처 숫자: 범위가 바뀌어도 이음매 10px 안에는 숫자가 없어야 한다 → Task 1 테스트.
4. 볼륨이 -inf일 때: 파란 선이 맨 끝에 있어야 한다 → Task 1 테스트.
5. 프릭샷플러스용 설정 화면에도 새 칸이 들어가야 한다 → Task 3 확인 단계.

---

### Task 1: 그리기 코드가 시작점을 따르게 하기

**Files:**
- Modify: `src/render/meter.ts` (`METER_MIN` 쓰는 곳 전부: `bar`, `faderLine`, `scaleMarks`, `renderKeyMeter`·`obsMeter` 호출의 `labelEvery`)
- Test: `test/render.test.mjs`

**Interfaces:**
- Produces:
  - `export const METER_FLOORS = [-60, -50, -40, -30] as const`
  - `export function setMeterFloor(raw: unknown): boolean` — `raw`를 숫자로 읽어 목록에 있으면 그 값, 아니면 -60으로 정한다. 값이 바뀌었으면 `true`.
  - `export const meterFloor = (): number`
  - `export function labelStep(length: number, floor: number): 5 | 10 | 20` — `length * step / -floor >= 24`를 만족하는 가장 작은 step, 없으면 20.
- `obsMeter`·`scaleMarks`는 `labelEvery` 인자를 없애고 `labelStep(vertical ? b.h : b.w, meterFloor())`로 정한다. `METER_MIN` 상수는 지운다(다른 파일에서 쓰지 않음).

- [ ] **Step 1: 실패하는 테스트 쓰기** (`test/render.test.mjs`, 각 테스트는 `finally`에서 `setMeterFloor(-60)`으로 되돌린다)

```js
test('meter floor setting: only -60/-50/-40/-30, anything else is -60', () => {
	try {
		assert.equal(setMeterFloor('-40'), true); assert.equal(meterFloor(), -40)
		assert.equal(setMeterFloor(-40), false)
		for (const bad of [undefined, 'abc', '-45', -100, null]) { setMeterFloor(bad); assert.equal(meterFloor(), -60, String(bad)) }
	} finally { setMeterFloor(-60) }
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
	} finally { setMeterFloor(-60) }
})

test('levels, hold and volume below the start sit at the low end', () => {
	try {
		setMeterFloor('-40')
		const quiet = renderVuStrip(view({ levels: { left: -50, right: -55, combined: -50, holdLeft: -45, holdRight: -48 }, volumeDb: -50 }))
		assert.ok(!quiet.includes('#4cff4c'), 'no bright bar below the start')
		const x = (svg) => +svg.match(/<line x1="([0-9.]+)"[^>]*stroke-width="3"/)[1]
		assert.equal(x(quiet), 12, 'fader line at the left end of the dial meter box')
		assert.equal(x(renderVuStrip(view({ volumeDb: -Infinity }))), 12)
	} finally { setMeterFloor(-60) }
})

test('two-key vertical fader keeps numbers off the seam at every start', () => {
	try {
		for (const f of [-60, -50, -40, -30]) {
			setMeterFloor(f)
			const top = renderButtonFader(view(), 'top')
			for (const [, y] of top.matchAll(/<text x="[0-9.]+" y="([0-9.]+)"[^>]*fill="#aaa"/g)) assert.ok(Math.abs(+y - 144) > 6, `${f}: label at ${y}`)
		}
	} finally { setMeterFloor(-60) }
})
```

  `view()`·`renderVuStrip`·`renderButtonFader`는 이 파일에 이미 있다. `setMeterFloor`, `meterFloor`, `labelStep`을 `../dist/render/meter.js` import에 더한다. 파란 선 선택자(`stroke-width="3"`)와 미터 상자 x(12)는 지금 코드 기준이다: 실행해 보고 실제 값과 다르면 선택자만 맞춘다.

- [ ] **Step 2: 실행해서 실패 확인**

  Run: `npm test 2>&1 | grep -E "ℹ (pass|fail)|setMeterFloor|not a function"`
  Expected: FAIL — `setMeterFloor is not a function` (아직 없음)

- [ ] **Step 3: `src/render/meter.ts`에 구현** — 위 Interfaces 그대로. `bar`의 초록 구간 시작, 피크 홀드 조건(`hold > floor && hold >= r.lo`), `faderLine`의 `Math.max(floor, …)`, `scaleMarks`의 반복 하한과 위치 계산을 모두 `meterFloor()`로 바꾼다. `Range` 기본값도 `{ lo: meterFloor(), hi: 0 }`.

- [ ] **Step 4: 전체 테스트 통과 확인**

  Run: `npm test 2>&1 | grep -E "ℹ (pass|fail)"`
  Expected: `fail 0` (기존 테스트도 그대로 통과: -60이면 화면이 같아야 한다)

- [ ] **Step 5: 커밋**

```bash
git add src/render/meter.ts test/render.test.mjs
git commit -m "feat: meters start at a chosen floor (-60/-50/-40/-30 dB)"
```

### Task 2: 전역 설정을 받아 바로 다시 그리기

**Files:**
- Modify: `src/plugin.ts` (`applyLanguage` 옆)

**Interfaces:**
- Consumes: `setMeterFloor(raw): boolean` (Task 1)

- [ ] **Step 1: 구현** — `applyMeterFloor(raw: { meterFloor?: unknown })`를 `applyLanguage`와 같은 꼴로 만든다: `if (setMeterFloor(raw.meterFloor)) for (const action of actions) action.redrawAll()`. `onDidReceiveGlobalSettings`와 시작 시 `initial` 처리 두 곳에서 `applyLanguage` 바로 다음에 부른다. OBS 연결(`apply`)과는 무관하다.
- [ ] **Step 2: 테스트·빌드** — Run: `npm test 2>&1 | grep -E "ℹ (pass|fail)"` / Expected: `fail 0`
- [ ] **Step 3: 커밋** — `git commit -am "feat: apply the meter floor setting at once to every key"`

  (이 연결부는 스트림덱 앱과 함께 돌아가는 부분이라 자동 테스트가 없다. Task 4에서 실제 키로 확인한다.)

### Task 3: 설정 화면에 "미터 범위" 칸 더하기

**Files:**
- Modify: `com.haeunga0822.obs-audio.sdPlugin/ui/common.js` (`globalBlock`, 언어 칸 바로 앞)
- Modify: `com.haeunga0822.obs-audio.sdPlugin/ui/i18n.js` (en/ko/ja에 `meterRange`, `meterStart`)
- Test: `test/i18n.test.mjs` (기존 "모든 언어에 같은 키" 테스트가 새 키도 검사한다)

- [ ] **Step 1: i18n 키 추가** — en `meterRange: 'Meter range'`, `meterStart: 'Start'` / ko `'미터 범위'`, `'시작점'` / ja `'メーター範囲'`, `'開始点'`.
- [ ] **Step 2: 접힌 칸 추가** — 언어 칸과 같은 모양:

```js
<details class="connection"><summary>${tr('meterRange')}</summary>
<sdpi-item label="${tr('meterStart')}"><sdpi-select setting="meterFloor" global default="-60">${[-60, -50, -40, -30].map((d) => `<option value="${d}">${d} dB</option>`).join('')}</sdpi-select></sdpi-item>
</details>
```

- [ ] **Step 3: 테스트** — Run: `npm test 2>&1 | grep -E "ℹ (pass|fail)"` / Expected: `fail 0`
- [ ] **Step 4: 프릭샷플러스 복사 확인** — Run: `grep -c meterFloor com.haeunga0822.freecshot-audio.sdPlugin/ui/common.js` / Expected: `1` 이상 (`npm test`가 번들 때 복사함)
- [ ] **Step 5: 커밋** — `git add com.haeunga0822.obs-audio.sdPlugin/ui && git commit -m "feat: meter range choice on the settings screen"`

### Task 4: 문서와 실제 키 확인

**Files:**
- Modify: `README.md`, `README.en.md`, `README.ja.md` ("미터 설정"/"Meter settings"/"メーターの設定"에 한 줄)
- Modify: `docs/manual/manual.ko.html`, `manual.en.html`, `manual.ja.html` ("미터 설정" 절에 한 단락) 후 PDF 3개 다시 만들기

- [ ] **Step 1: 문구 추가** — 한국어 예: "**미터 범위:** 설정 화면 맨 아래 **▶ 미터 범위**에서 미터 시작점을 -60 / -50 / -40 / -30 dB 중에서 고릅니다. 모든 키에 함께 적용되고, 화면에 보이는 범위만 바뀝니다(볼륨 조절 범위는 그대로). 시작점보다 작은 소리는 미터 맨 끝에 붙습니다." 영·일도 같은 뜻으로.
- [ ] **Step 2: PDF 다시 만들기** — Edge headless로 `manual.{ko,en,ja}.html` → 같은 이름의 PDF 3개. 페이지 이미지 하나씩 열어 확인하고, PDF 글꼴이 Noto Sans KR/JP뿐인지 확인한다.
- [ ] **Step 3: 번들·플러그인 재시작** — `npm run bundle` 후 `obs-audio.sdPlugin` node 프로세스만 종료, 새 프로세스 시작 시각이 `bin/plugin.js` 수정 시각보다 늦은지 확인.
- [ ] **Step 4: 커밋·push** — `git add README*.md docs/manual && git commit -m "docs: meter range setting" && git push`
- [ ] **Step 5: 사용자에게 실제 키 확인 요청** — 설정 화면에서 -40을 고르면 VU Dial·2버튼 페이더·Volume 키 미터가 바로 -40 ~ 0으로 바뀌는지.
