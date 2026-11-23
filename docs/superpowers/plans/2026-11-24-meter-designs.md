# 레벨미터 디자인 고르기 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 설정 화면의 "미터 디자인" 칸에서 다이얼·버튼 미터 모양을 TotalMix 플러그인의 6가지 중 하나로 고르게 한다.

**Architecture:** TotalMix의 공용 디자인 폴더(`src/render/meters/`)를 그대로 복사하고, TotalMix `meter.ts` 안의 Classic·Modern을 같은 `MeterDesign` 형식(`meters/mixstudio.ts`)으로 옮긴다. 새 `src/render/design.ts`가 전역 설정(다이얼용·버튼용)을 기억하고, VU Dial·2버튼 페이더·Volume 키의 `render`가 고른 디자인이 있으면 그 디자인으로, 없으면 지금 코드로 그린다. VU에는 OBS가 보내는 RMS(magnitude)를 넘긴다.

**Tech Stack:** TypeScript, @elgato/streamdeck 3, sdpi-components 4, rollup, node --test (`npm test` = bundle + tsc + test).

**Spec:** `docs/superpowers/specs/2026-11-24-meter-designs-design.md`

## Global Constraints

- 원본: `C:\Users\Kimtan_StreamPC\streamdeck-rme-totalmix\src\render\meters\` (types, index, text, big, obs, topping, vu) 와 `src/render/meter.ts`(Classic·Modern).
- 목록과 값: `plugin`(기본) / `classic` / `modern` / `topping` / `big` / `vu`. On Air(`obs`, `obs-wide`)는 목록에 없다. 모르는 값은 `plugin`.
- 전역 설정 이름: `meterDesign`(다이얼, 기본 `plugin`), `meterDesignKey`(버튼, 기본 `same`), `vuReference`(-14 / -18 / -20, 기본 -18). 피크 보정 칸 없음.
- 화면 이름은 TotalMix 것 그대로: Plugin (default) / Mix Studio Classic / Mix Studio Modern / Topping on Plate / Big number / VU Needle Drop. 한국어·일본어도 TotalMix `ui/common.js` 번역 그대로.
- 기존 Meter style(키마다)과 미터 범위(전역)는 플러그인 기본 디자인에만 적용하고, 그 칸은 해당 디자인이 plugin이 아닐 때 숨긴다.
- 디자인 변경은 OBS 연결을 건드리지 않고 `redrawAll()`만 한다.
- 덮개(OFFLINE / LOGIN / SET SOURCE / SETUP / N/A)는 이 플러그인 `svg.ts`의 `frame`으로 그린다. 디자인 안의 "MUTED" 글자는 `t('muted')`.
- 사용자에게 보이는 글은 한국어. 요청하지 않은 파일은 고치지 않는다. 버전 번호는 바꾸지 않는다(릴리즈 때).

## Review Focus

1. 음소거 중 VU 바늘: RMS가 0으로 오므로 바늘은 바닥, 글자는 MUTED(peek 중이면 볼륨). 다른 디자인은 회색 미터가 입력 peak로 움직인다.
2. 볼륨 -inf(무음): 페이더 선이 디자인의 맨 아래에 있고 NaN이 SVG에 나오지 않는다.
3. 다이얼은 VU, 버튼은 "다이얼과 같게"일 때 버튼도 VU가 되고, 버튼만 VU일 때도 VU 기준 칸이 보인다.
4. 바늘이 움직이는 동안 새 미터 값이 없어도 다시 그리기가 이어지고, 키가 사라지면 바늘 기록이 지워진다.
5. 프릭샷플러스 판(같은 코드, ui 복사본)에서도 칸이 보이고 동작한다.

---

### Task 1: 공용 디자인 폴더 복사

**Files:**
- Create: `src/render/meters/{types,index,text,big,topping,vu}.ts` (TotalMix에서 복사, `obs.ts`는 복사하지 않음)
- Test: `test/designs.test.mjs` (새 파일)

**Interfaces:**
- Produces: `SHARED_DESIGNS: Record<'topping'|'big'|'vu', MeterDesign>`, `MeterInput`, `MeterKeyInput`, `MeterDesign`, `FaderRole` (types.ts 그대로), `setVuCalibration(ref, offset)`, `smoothNeedle(key|undefined)`, `needleMoving(): boolean`, `forgetNeedle(key)`, `setNeedleClock(fn)`.

손질(복사 후 이것만):
- `index.ts`: `obs`, `obs-wide` 제거, `SharedDesign = 'topping' | 'big' | 'vu'`. Classic·Modern은 Task 2에서 추가.
- 모든 `'MUTED'` 글자 → `t('muted')` (`import { t } from '../../i18n.js'`).
- `vu.ts`: 머리 주석을 "OBS는 RMS를 보내므로 보정은 0"으로 고친다. 코드는 그대로 두고 호출 쪽이 offset 0을 넘긴다.

- [ ] **Step 1: 실패하는 테스트 작성** — `test/designs.test.mjs`:
  - `for (const name of ['topping','big','vu'])`: `SHARED_DESIGNS[name].strip(input)`가 `<svg`로 시작하고 `width="200"`; `pair(input,'top')`, `pair(input,'right')`, `key(keyInput)`가 `width="144"`; 어느 결과에도 `NaN`이 없다. (`input`: name 'Mic', leftDb -12, rightDb -20, fader {db:-6}, faderText '-6.0 dB', levelText '-12.0 dB', muted false, peek false, overlay 'none')
  - `setLanguage('ko')` 후 `muted:true` 입력의 strip에 `음소거`(이 플러그인 ko의 muted 글자)가 들어 있고 `MUTED`는 없다. 끝나면 `setLanguage('en')`.
  - `leftDb/rightDb = -Infinity`, `fader {db:-Infinity}`에서도 `NaN` 없음.
- [ ] **Step 2: `npm test` → designs.test 실패 (모듈 없음)** 확인.
- [ ] **Step 3: 복사·손질.**
- [ ] **Step 4: `npm test` 전부 통과.**
- [ ] **Step 5: 커밋** `feat: copy the shared meter designs from the TotalMix plugin`

### Task 2: Mix Studio Classic·Modern을 MeterDesign으로

**Files:**
- Create: `src/render/meters/mixstudio.ts`
- Modify: `src/render/meters/index.ts` (`classic`, `modern` 추가)
- Test: `test/designs.test.mjs`

**Interfaces:**
- Produces: `classic: MeterDesign`, `modern: MeterDesign`; `SharedDesign = 'classic' | 'modern' | 'topping' | 'big' | 'vu'`.

옮기는 방법: TotalMix `src/render/meter.ts`의 `TM_SCALE`·`tmBar`·`CLASSIC_STOPS`·`bar`·`scale`·`marker`·`hatch`·`gradient`와 `drawVuStrip`/`renderKeyMeter`/`drawButtonFader`를 복사하되 `style`은 모듈 상태 대신 인자로 받고(`'classic' | 'modern'`), 값은 `MeterInput`의 dB를 `tmBar(db)`로 바로 바꾼다(`toScale`·`barToDb` 불필요; `-Infinity`/NaN은 `tmBar`가 바닥으로 처리). 페이더는 `fader.db`를 `Math.min(0, db)` 후 `tmBar`. `strip`은 `faderText`/`levelText`/`badge`, `pair`는 TotalMix 2버튼 페이더, `key`는 TotalMix 값 키 배치(제목 y40 26px, 값 y90 26px, 미터 y108–122)를 따른다. `'MUTED'` → `t('muted')`.

- [ ] **Step 1: 실패하는 테스트** — Task 1의 반복문 목록에 `'classic','modern'` 추가. 추가로 classic strip에 `rgb(31,41,48)`(어두운 트랙), modern strip에 `rgb(25,209,32)`(초록 구역)이 들어 있다. muted classic pair('bottom')에 빨간 빗금 `stroke="rgb(255,57,31)"`.
- [ ] **Step 2: `npm test` 실패 확인.**
- [ ] **Step 3: `mixstudio.ts` 작성, index에 등록.**
- [ ] **Step 4: `npm test` 통과.**
- [ ] **Step 5: 커밋** `feat: Mix Studio Classic and Modern as shared meter designs`

### Task 3: RMS 값 보관

**Files:**
- Modify: `src/obs/meter-state.ts`, `src/connection.ts:236-241` (InputState에 `rms`), `src/actions/common.ts` (`meterView`), `src/render/meter.ts` (`ObsMeterView`에 `rms`)
- Test: `test/obs-math.test.mjs`

**Interfaces:**
- Produces: `rmsFor(raw: number[][]): { left: number; right: number }` (dB, magnitude×볼륨 = `ch[0]`, 모노면 right=left, 없으면 -Infinity); `InputState.rms: { left: number; right: number }` (처음 -Infinity); `ObsMeterView.rms` (같은 모양, 입력 없으면 -Infinity).

음소거 중에는 `ch[0]`가 0이라 -Infinity가 된다(스펙: 음소거 중 VU 바늘은 0).

- [ ] **Step 1: 실패하는 테스트** — `rmsFor([[0.5, 0.9, 0.9],[0.25, 0.5, 0.5]])` → left ≈ -6.02, right ≈ -12.04; `rmsFor([[0.5,1,1]])` → right === left; `rmsFor([])` → 둘 다 -Infinity; `rmsFor([[0,0,0.8]])` → -Infinity.
- [ ] **Step 2: 실패 확인.**
- [ ] **Step 3: 구현.** connection의 InputVolumeMeters 처리에서 `i.rms = rmsFor(m.inputLevelsMul ?? [])`.
- [ ] **Step 4: `npm test` 통과.**
- [ ] **Step 5: 커밋** `feat: keep the RMS level OBS sends for each source`

### Task 4: 디자인 선택과 그리기 연결

**Files:**
- Create: `src/render/design.ts`
- Modify: `src/actions/meter-actions.ts` (VuDial / ButtonFader / Volume `render`), `src/runtime/base-action.ts` (바늘 다시 그리기), `src/plugin.ts` (`applyMeterDesign`)
- Test: `test/designs.test.mjs`

**Interfaces:**
- Consumes: Task 1–3의 `SHARED_DESIGNS`, `setVuCalibration`, `smoothNeedle`/`needleMoving`/`forgetNeedle`, `ObsMeterView.rms`.
- Produces:
  - `setMeterDesigns(dial: unknown, key: unknown, vuReference: unknown): boolean` — 바뀌었으면 true. key가 `undefined`/`''`/`'same'`이면 dial을 따른다. 모르는 값은 plugin. `setVuCalibration(vuReference, 0)`도 여기서.
  - `designFor(surface: 'dial' | 'key'): MeterDesign | undefined` — plugin이면 undefined.
  - `toMeterInput(v: ObsMeterView, design: MeterDesign): MeterInput` — design이 vu면 leftDb/rightDb = `v.rms`, 아니면 `v.levels.left/right`; fader `{ db: Math.min(0, v.volumeDb) }`; faderText `dbText(v.volumeDb)`; levelText는 channels가 combined면 `"<combined> dB"`, 아니면 지금 다이얼처럼 L/R(`levelText` 함수 재사용 위해 meter.ts에서 export); muted, peek, overlay 그대로.

연결:
- VuDial: `designFor('dial')`가 있으면 `.strip(toMeterInput(...))`, 없으면 `renderVuStrip`.
- ButtonFader: `designFor('key')` → `.pair(input, role)`.
- Volume: `designFor('key')` → `.key({ title: v.name, value: muted&&!peek ? t('muted') : dbText(volumeDb), meter: {leftDb,rightDb,fader,muted}, overlay })`.
- base-action `refresh`: TotalMix처럼 draw 함수 안에서 `smoothNeedle(key)`, `needleMoving()`, 그린 뒤 `needleMoving()`이면 `setTimeout(() => instance.redrawer.request(draw), REDRAW_MS)`, finally `smoothNeedle(undefined)`. `onWillDisappear`에서 `forgetNeedle(id)`.
- plugin.ts: `applyMeterDesign(raw)`를 `applyMeterFloor` 옆(전역 설정 수신과 시작 시)에 두고, true면 `redrawAll()`.

- [ ] **Step 1: 실패하는 테스트**
  - `setMeterDesigns('vu', 'same', '-18')` 후 `designFor('key') === designFor('dial')` 이고 둘 다 `SHARED_DESIGNS.vu`.
  - `setMeterDesigns('obs', undefined)` → `designFor('dial') === undefined`.
  - `setMeterDesigns('big','plugin')` → dial은 big, key는 undefined; 같은 값으로 다시 부르면 false.
  - `toMeterInput(view({ rms:{left:-30,right:-40} }), vu).leftDb === -30`; big이면 `levels.left`.
  - `toMeterInput(view({ volumeDb: -Infinity }), big)`로 그린 strip에 NaN 없음.
  - 끝에 `setMeterDesigns('plugin','same')`로 되돌림.
- [ ] **Step 2: 실패 확인.**
- [ ] **Step 3: 구현.**
- [ ] **Step 4: `npm test` 통과.**
- [ ] **Step 5: 커밋** `feat: pick the meter design for dials and buttons`

### Task 5: 설정 화면

**Files:**
- Modify: `com.haeunga0822.obs-audio.sdPlugin/ui/common.js` (`globalBlock`: 미터 디자인 칸을 미터 범위 위에), `ui/i18n.js` (en/ko/ja), `ui/obs.html` (키마다 Meter style 숨김)
- Test: `test/i18n.test.mjs`(이미 세 언어 키 비교를 하면 그대로 통과해야 함)

내용:
- `<details class="connection"><summary>미터 디자인</summary>`: Dials(`meterDesign`, 기본 plugin) / Buttons(`meterDesignKey`, 기본 same + "Same as dials") 선택, `vuReference` 선택(-14 / -18 / -20 dBFS, 기본 -18)은 다이얼 또는 실제 버튼 디자인이 vu일 때만.
- 미터 범위 칸: 다이얼과 실제 버튼 디자인이 둘 다 plugin이 아니면 숨김.
- obs.html: 이 키가 쓰는 디자인(vu-dial → 다이얼, button-fader·volume → 버튼)이 plugin이 아니면 `meterStyle` 줄과 그 안내를 숨김. 전역 값은 `getGlobalSettings`와 두 선택의 `valuechange`로 따라간다.
- i18n 키: `meterDesign`, `dials`, `buttons`, `sameAsDials`, `designPlugin`, `designClassic`, `designModern`, `designTopping`, `designBig`, `designVu`, `vuReference` — 값은 Global Constraints의 TotalMix 번역.

- [ ] **Step 1:** `npm test`로 기존 i18n 테스트 통과 확인(세 언어 키가 같아야 함).
- [ ] **Step 2:** 구현 후 `npm test` 통과.
- [ ] **Step 3:** 번들 → 이 플러그인 node.exe만 종료 → 시작 시각이 bin/plugin.js보다 늦은지 확인. 브라우저 미리보기 대신 Stream Deck 설정 화면은 사용자 확인 항목으로 남긴다.
- [ ] **Step 4: 커밋** `feat: meter design block on the settings screen`

### Task 6: 실제 값 확인 (OBS, 프릭샷플러스)

- [ ] OBS가 켜져 있으면 작은 스크립트(scratchpad, obs-websocket 연결, 비밀번호는 Stream Deck 전역 설정 파일에서 읽고 출력하지 않음)로 InputVolumeMeters 한 번을 받아 `ch[0] < ch[1]`(RMS가 peak보다 작음)인지 본다.
- [ ] 프릭샷플러스가 켜져 있으면 같은 확인. 꺼져 있거나 다르면 사용자에게 알린다.

### Task 7: 문서

**Files:** `README.md`, `README.en.md`, `README.ja.md`, `docs/manual/manual.{ko,en,ja}.html` (main), freecshot-main의 README와 `docs/manual/freecshot/manual.*.html`은 릴리즈 때 병합하며 맞춘다.

- [ ] "미터 디자인" 절: 6가지 이름, 다이얼/버튼 따로, VU는 RMS + 0 VU 기준, Meter style·미터 범위는 플러그인 기본에만.
- [ ] 커밋 `docs: describe the meter designs`
