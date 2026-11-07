# OBS Audio Stream Deck 플러그인 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** OBS 오디오 소스를 obs-websocket v5로 조작·표시하는 별도 Stream Deck 플러그인(VU Dial, Fader(2-Button), Mute, Volume, PTT, Audio monitoring, Balance Dial, Balance 키).

**Architecture:** 새 저장소. SRC(`C:\Users\user\streamdeck-rme-totalmix`)의 그리기 기초(`render/svg.ts`)와 런타임(`runtime/redraw.ts`, `hold.ts`, `base-action.ts`)을 복사하고, TotalMix 통신 자리에 `ObsConnection`(obs-websocket-js 래퍼)을 둔다. OBS 수식(슬라이더 곡선, 볼륨 단계, 미터 감쇠)은 순수 함수/클래스로 따로 두어 Stream Deck 없이 테스트한다.

**Tech Stack:** TypeScript ~6.0, Node 20, `@elgato/streamdeck` 3.0.4, `obs-websocket-js` 5.0.8 (+ `ws`), Rollup, `node --test`, `sdpi-components` (SRC에서 복사).

**Spec:** `docs/superpowers/specs/2026-11-07-obs-audio-plugin-design.md`

## Global Constraints

- 저장소 `C:\Users\user\streamdeck-obs-audio`, 플러그인 UUID `com.haeunga0822.obs-audio`, 액션 UUID `com.haeunga0822.obs-audio.<id>`; id: `vu-dial`, `button-fader`, `mute`, `volume`, `ptt`, `monitor`, `balance-dial`, `balance`.
- 이름/카테고리 "OBS Audio". Windows, Stream Deck 7.3+, OBS 30+.
- 전역 설정 `host`(기본 `127.0.0.1`), `port`(기본 `4455`), `password`(기본 빈 값). 바뀌면 500 ms 디바운스 후 재연결.
- 재연결 간격 3000 ms. 구독 `EventSubscription.General | Inputs | InputVolumeMeters`.
- 미터 −60 ~ 0 dB 직선. 배경 `#267f26`/`#7f7f26`/`#7f2626`, 레벨 `#4cff4c`/`#ffff4c`/`#ff4c4c`. 스타일 `standard`(노랑 −20, 빨강 −9), `wide`(노랑 −13, 빨강 −2). 뮤트 회색 배경 `#4a4a4a`/`#5a5a5a`/`#6a6a6a`, 레벨 `#bbb`, 슬라이더 채움 `#777`.
- 슬라이더 트랙 `#3c404b`, 채움 `#476be6`, 손잡이 `#e0e0e0`. MUTED 글자 `rgb(255,57,31)`. 배경 `#000`.
- 슬라이더 곡선: `pos = (−log10(−dB + 6) + 2.00860017176191756) / (−0.77815125038364363 + 2.00860017176191756)`, dB ≥ 0 → 1, dB ≤ −96 → 0, −∞ → 0.
- 볼륨 단계: −60 아래로 가면 −∞, −∞에서 올리면 −60, 위는 0 dB에서 멈춤. Set/복귀 값은 −100 ~ 0으로 자르고 ≤ −100은 −∞.
- 피크 감쇠 23.53 dB/초 (OBS 기본 "빠름"), 피크 홀드 20 초. 페이더 peek 700 ms. 키 홀드 반복 400 ms 후 150 ms마다. 그리기 40 ms 스로틀.
- 이름 줄바꿈: 키 최대 3줄, 다이얼 최대 2줄, 넘치면 축소, 최소 크기에서도 넘치면 마지막 줄만 "…".
- PTT 기본 `releaseDelayMs` 200. 밸런스 Step 기본 1(%), 다이얼 Step 기본 1(dB).
- SRC는 수정하지 않는다. 사용자에게 "샘플/트루 피크"라는 말을 PI에서 쓰지 않는다(라벨: "Meter style: Standard / Wide green").
- 모든 텍스트 파일 LF(`.gitattributes` `* text=auto eol=lf`).

## Review Focus

1. **OBS가 꺼져 있거나 비밀번호가 틀림** — 플러그인이 죽지 않고 모든 키가 OFFLINE, 3초마다 재시도, OBS가 켜지면 스스로 복구. → Task 3 테스트 `connect failure goes offline and retries after 3000 ms`.
2. **PTT 누른 채 OBS 연결 끊김** — 재연결되는 순간 누르기 전 뮤트 상태로 복원. → Task 7 테스트 `restores on reconnect when released while offline`.
3. **소스 이름 변경/삭제** — 이름은 새 이름으로, 삭제된 소스는 N/A, 예외 없음. → Task 3 테스트 `rename and removal update state`, Task 6 테스트 `removed source renders N/A`.
4. **오디오 없는 입력(이미지, 브라우저 소스 등)** — 소스 목록에 안 나옴. → Task 3 테스트 `only inputs answering GetInputVolume are audio inputs`.
5. **PI의 빈 칸/공백/글자 입력** (Step, 복귀 dB, 지연) — 기본값으로 처리, 볼륨이 0 dB로 튀지 않음. → Task 5 테스트 `blank or text settings fall back to defaults`.

---

## File Structure

```
streamdeck-obs-audio/
  package.json, tsconfig.json, rollup.config.mjs, .gitignore, .gitattributes, README.md
  src/render/svg.ts            SRC에서 복사 (Overlay에 'setup' 문구만 SET SOURCE로)
  src/render/text.ts           wrapName: 줄바꿈 + 축소
  src/render/meter.ts          OBS식 미터 막대, 슬라이더, VU 스트립, 2버튼 페이더, 키용 작은 미터
  src/render/keys.ts           Mute/Volume/PTT/Monitor/Balance 키, Balance 스트립
  src/obs/volume.ts            sliderPos, stepDb, clampSetDb, dbText, balanceText
  src/obs/meter-state.ts       MeterTracker (감쇠·홀드), levelsFor (L/R·통합·뮤트)
  src/connection.ts            ObsConnection
  src/runtime/redraw.ts, hold.ts   SRC 그대로
  src/runtime/base-action.ts   SRC 복사, 연결 타입만 ObsConnection
  src/runtime/settings.ts      normalizeSettings(전역), num/pick/sourceOf/meterOpts
  src/runtime/ptt.ts           PttLatch (순수 상태기계)
  src/actions/meter-actions.ts VuDial, ButtonFader, Mute, Volume
  src/actions/ptt.ts           PttAction
  src/actions/other.ts         Monitor, BalanceDial, Balance
  src/plugin.ts                진입점
  com.haeunga0822.obs-audio.sdPlugin/ manifest.json, layouts/strip.json, imgs/, ui/{common.js,sdpi-components.js,meter.html,keys.html}
  test/*.test.mjs              dist/에서 import (SRC와 같은 방식)
```

---

### Task 1: 저장소 뼈대와 SRC 복사

**Files:** 위 구조의 설정 파일, `src/render/svg.ts`, `src/runtime/redraw.ts`, `src/runtime/hold.ts`, `ui/sdpi-components.js`, `imgs/`(SRC의 `plugin.png`, `plugin@2x.png`, `dial.svg`, `fader.svg`, `channel.svg`, `category.svg`), `THIRD-PARTY-NOTICES.txt`(SRC 복사 + obs-websocket-js MIT, ws MIT 추가), `test/runtime.test.mjs`(SRC에서 `Redrawer`/`HoldRepeater` 부분만).

- [ ] **Step 1:** `git init`, `.gitattributes`, `.gitignore`(SRC와 같게, `bin` 경로만 새 UUID). `package.json`은 SRC 복사 후 name `streamdeck-obs-audio`, UUID 경로 교체, dependencies에 `"obs-websocket-js": "5.0.8"` 추가. `npm install`.
- [ ] **Step 2:** SRC 파일 복사. `svg.ts`의 `'setup'` 오버레이 글자를 `SET` / `SOURCE`로 바꾼다(다른 변경 없음).
- [ ] **Step 3:** `manifest.json`(SRC 형식, Actions는 Task 6~8에서 채움, 일단 빈 배열), `layouts/strip.json`(SRC와 같은 200×100 pixmap, id만 새 UUID), `src/plugin.ts`는 `streamDeck.connect()`만.
- [ ] **Step 4: 확인** `npm test` → runtime 테스트 PASS, `npm run bundle` → `bin/plugin.js` 생성.
- [ ] **Step 5: 커밋** `chore: scaffold OBS audio plugin from the TotalMix plugin runtime`

### Task 2: OBS 수식 (`src/obs/volume.ts`, `src/obs/meter-state.ts`)

**Interfaces — Produces:**
- `sliderPos(db: number): number` (−∞ 허용)
- `stepDb(db: number, delta: number): number` — 결과 −∞ 또는 −60..0
- `clampSetDb(db: number): number`
- `dbText(db: number): string` — `-6.0 dB`, −∞는 `-inf dB`
- `balanceText(b: number): string` — 0.5 → `C`, 0.3 → `L 40`, 0.8 → `R 60`
- `type MeterLevels = { left: number; right: number; combined: number }` (모두 dB, 무음 −∞)
- `levelsFor(raw: number[][], muted: boolean, volumeMul: number): MeterLevels`
- `class MeterTracker { update(levels: MeterLevels, now: number): void; display(now: number): { left: number; right: number; combined: number; holdLeft: number; holdRight: number; holdCombined: number } }`

- [ ] **Step 1: 실패하는 테스트** `test/obs-math.test.mjs`
```js
test('slider curve matches libobs', () => {
  assert.equal(sliderPos(0), 1); assert.equal(sliderPos(5), 1); assert.equal(sliderPos(-96), 0); assert.equal(sliderPos(-Infinity), 0)
  assert.ok(Math.abs(sliderPos(-6) - 0.7553) < 1e-3)
})
test('steps below -60 go to -inf and back to -60', () => {
  assert.equal(stepDb(-59.5, -1), -Infinity); assert.equal(stepDb(-Infinity, 1), -60); assert.equal(stepDb(-Infinity, -1), -Infinity)
  assert.equal(stepDb(-0.5, 1), 0); assert.equal(stepDb(-6, -1), -7)
})
test('set values clamp', () => { assert.equal(clampSetDb(3), 0); assert.equal(clampSetDb(-100), -Infinity); assert.equal(clampSetDb(-20), -20) })
test('texts', () => { assert.equal(dbText(-6), '-6.0 dB'); assert.equal(dbText(-Infinity), '-inf dB'); assert.equal(balanceText(0.5), 'C'); assert.equal(balanceText(0.3), 'L 40'); assert.equal(balanceText(0.8), 'R 60') })
test('levels use post-fader peak, muted uses input peak times volume', () => {
  const raw = [[0.1, 0.5, 1], [0.1, 0.25, 0.5]]
  assert.ok(Math.abs(levelsFor(raw, false, 0.5).left - 20 * Math.log10(0.5)) < 1e-9)
  assert.ok(Math.abs(levelsFor([[0, 0, 1], [0, 0, 0.5]], true, 0.5).left - 20 * Math.log10(0.5)) < 1e-9)
  assert.equal(levelsFor(raw, false, 1).combined, levelsFor(raw, false, 1).left) // max of channels
})
test('mono source shows the same value on both rows; silence is -inf', () => {
  const l = levelsFor([[0, 0.5, 0.5]], false, 1); assert.equal(l.left, l.right)
  assert.equal(levelsFor([], false, 1).left, -Infinity)
})
test('peak decays 11.76 dB/s and hold lasts 20 s', () => {
  const m = new MeterTracker(); m.update({ left: -10, right: -10, combined: -10 }, 0); m.update({ left: -60, right: -60, combined: -60 }, 1000)
  assert.ok(Math.abs(m.display(1000).left - -21.76) < 0.01)
  assert.equal(m.display(19_000).holdLeft, -10); assert.ok(m.display(21_000).holdLeft < -10)
})
```
- [ ] **Step 2:** `npm test` → FAIL (모듈 없음).
- [ ] **Step 3:** 구현. 감쇠는 `display(now)`에서 `max(현재값, 이전표시 − 11.76 × 경과초)`; 홀드는 마지막 갱신 시각부터 20 초 지나면 현재 표시값으로 내려옴. 채널 수 ≥ 2면 0·1, 1이면 같은 값.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5: 커밋** `feat: OBS slider curve, volume steps and meter tracking`

### Task 3: ObsConnection (`src/connection.ts`)

**Interfaces — Produces:**
```ts
export interface ObsSettings { host: string; port: number; password: string }
export interface InputState { uuid: string; name: string; volumeDb: number; volumeMul: number; muted: boolean; balance: number; monitorType: string; meter: MeterTracker }
export interface ObsClientLike { connect(url: string, password?: string, opts?: { eventSubscriptions: number }): Promise<unknown>; disconnect(): Promise<void>; call(type: string, data?: object): Promise<any>; on(event: string, fn: (d: any) => void): void; off?(...a: unknown[]): void }
export class ObsConnection {
  constructor(deps?: { createClient?: () => ObsClientLike; now?: () => number; setTimeout?: (fn: () => void, ms: number) => unknown; clearTimeout?: (h: unknown) => void })
  start(s: ObsSettings): void; stop(): void
  get online(): boolean
  input(uuid: string): InputState | undefined
  inputs(): { value: string; label: string }[]   // 이름순
  onChange(fn: () => void): () => void            // 한 틱에 한 번으로 묶음 (SRC와 같이 setImmediate)
  onReconnect(fn: () => void): () => void          // 연결 성공할 때마다
  call(type: string, data?: object): Promise<void> // 오프라인이면 조용히 무시, 오류는 로그
}
```
- [ ] **Step 1: 실패하는 테스트** `test/connection.test.mjs` — 가짜 클라이언트(호출 기록, 이벤트 emit, `connect` 성공/실패 제어)와 가짜 타이머로:
  - `only inputs answering GetInputVolume are audio inputs`: `GetInputList` 두 개 중 하나만 `GetInputVolume` 성공 → `inputs()` 길이 1.
  - `initial state is read once`: 뮤트/밸런스/모니터 값이 `input(uuid)`에 들어감.
  - `events update state and notify once per tick`: `InputVolumeChanged`, `InputMuteStateChanged`, `InputAudioBalanceChanged`, `InputAudioMonitorTypeChanged` 반영, 같은 틱 여러 이벤트에 `onChange` 1회.
  - `meters feed the tracker`: `InputVolumeMeters { inputs: [{ inputUuid, inputLevelsMul }] }` 후 `meter.display()`가 −∞ 아님.
  - `rename and removal update state`: `InputNameChanged` → 새 이름, `InputRemoved` → `input()` undefined.
  - `InputCreated with audio is added`.
  - `connect failure goes offline and retries after 3000 ms`: 첫 connect reject → `online` false, 3000 ms 진행 후 connect 2회째.
  - `ConnectionClosed goes offline and reconnects; onReconnect fires`.
  - `restart closes the old client before the new one connects`.
- [ ] **Step 2:** FAIL 확인.
- [ ] **Step 3:** 구현. 기본 `createClient`는 `new OBSWebSocket()`(obs-websocket-js), URL `ws://${host}:${port}`, 비밀번호 빈 값이면 `undefined`. 구독 값 `EventSubscription.General | EventSubscription.Inputs | EventSubscription.InputVolumeMeters`. `ConnectionClosed` 이벤트에서 재시도 예약. 초기 읽기는 입력마다 `GetInputVolume`, `GetInputMute`, `GetInputAudioBalance`, `GetInputAudioMonitorType`(`inputUuid` 사용).
- [ ] **Step 4:** PASS 확인.
- [ ] **Step 5: 커밋** `feat: OBS connection with audio input state and meters`

### Task 4: 그리기 (`src/render/text.ts`, `meter.ts`, `keys.ts`)

**Interfaces — Produces:**
```ts
// text.ts
export function wrapName(name: string, size: number, maxWidth: number, maxLines: number, minSize: number): { lines: string[]; size: number }
// meter.ts
export type MeterStyle = 'standard' | 'wide'
export type ChannelMode = 'lr' | 'combined'
export interface ObsMeterView { name: string; volumeDb: number; levels: ReturnType<MeterTracker['display']>; muted: boolean; peek: boolean; style: MeterStyle; channels: ChannelMode; overlay: Overlay }
export function renderVuStrip(v: ObsMeterView): string          // 200x100
export function renderButtonFader(v: ObsMeterView, role: 'top'|'bottom'|'left'|'right'): string // 144x144
export function renderKeyMeter(v: Pick<ObsMeterView,'levels'|'muted'|'style'|'channels'|'volumeDb'>): string // 키 아래 y 108..124 조각
// keys.ts
export function renderMuteKey(v: { name: string; muted: boolean; meter?: …; overlay: Overlay }): string
export function renderVolumeKey(v: { name: string; volumeDb: number; meter: …; muted: boolean; overlay: Overlay }): string
export function renderPttKey(v: { name: string; live: boolean; meter: …; overlay: Overlay }): string
export function renderMonitorKey(v: { name: string; type: string; overlay: Overlay }): string
export function renderBalanceKey(v: { name: string; balance: number; overlay: Overlay }): string
export function renderBalanceStrip(v: { name: string; balance: number; overlay: Overlay }): string
```
레이아웃은 브레인스토밍 시안 A(`streamdeck-rme-totalmix/.superpowers/brainstorm/785-1794011079/content/obs-look.html`의 A 카드)를 따른다. 2버튼 세로: 미터 왼쪽(x 14..42), 세로 슬라이더(x 56), 오른쪽 글자; 위 키 = 미터 −30..0 / 슬라이더 0.5..1, 아래 키 = −60..−30 / 0..0.5. 가로(left/right): VU 스트립을 두 키로 나눔.

- [ ] **Step 1: 실패하는 테스트** `test/render.test.mjs`:
  - `wrapName keeps short names on one line`, `wraps at spaces up to the line limit`(키 3줄), `wraps Hangul without spaces by character`, `shrinks before cutting`(4줄 분량 → 3줄, size < 시작 크기), `cuts only the last line at the minimum size`(마지막 줄이 `…`로 끝남, 나머지 줄은 아님).
  - `standard style colours switch at -20 and -9`, `wide style at -13 and -2`: SVG 문자열에 해당 경계 x 좌표의 rect 존재(구현이 노출하는 `zoneEdges(style)` 헬퍼로 값 확인: standard `[−20, −9]`, wide `[−13, −2]`).
  - `muted strip is grey with MUTED`: `#4a4a4a`, `#bbb`, `MUTED` 포함, `#4cff4c` 없음. `peek shows the dB instead of MUTED`.
  - `combined mode draws one bar, lr draws two`.
  - `slider knob sits at sliderPos`: −6 dB에서 손잡이 x가 `8 + 184 × 0.7553 − 5` 근처.
  - `offline overlay`: `OFFLINE` 포함.
  - `ptt live is green with TALK, idle shows MUTED`; `monitor key shows MON+OUT`; `balance strip shows L 40`.
- [ ] **Step 2:** FAIL 확인.
- [ ] **Step 3:** 구현. 글자는 SRC `plainText`/`fitSize` 사용. 줄 높이 = size × 1.15.
- [ ] **Step 4:** PASS. 시안과 비교하려고 `test/out/`에 몇 장 SVG를 써서 눈으로 확인(SRC의 `test/out` 관례).
- [ ] **Step 5: 커밋** `feat: OBS-style meter, slider and key rendering`

### Task 5: 액션 기반과 설정 (`src/runtime/base-action.ts`, `src/runtime/settings.ts`)

**Interfaces — Produces:**
- `base-action.ts`: SRC `TotalMixAction`을 `ObsAction<S>`로 이름만 바꾸고 생성자 인자 타입 `ObsConnection`. `register()` 추상 메서드는 없앤다(OBS는 등록 불필요). keepalive 2000 ms 대신 미터 갱신이 `onChange`로 오므로 keepalive 제거.
- `settings.ts`: `normalizeSettings(raw): ObsSettings`; `num`, `pick`(SRC `common.ts` 그대로); `sourceOf(s): string | undefined`(`inputUuid`); `meterOpts(s): { style: MeterStyle; channels: ChannelMode }`(기본 `standard`, `lr`); `stepOf(s, fallback): number`(빈칸·0·음수·글자 → fallback); `nameOf(conn, s): string`(`displayName` → OBS 이름 → 저장된 `inputName`).
- [ ] **Step 1: 테스트** `test/settings.test.mjs`: `normalizeSettings({})` → `{ host: '127.0.0.1', port: 4455, password: '' }`, 포트 `'99999'` → 4455; `blank or text settings fall back to defaults`: `stepOf({ step: ' ' }, 1) === 1`, `stepOf({ step: 'abc' }, 1) === 1`, `stepOf({ step: '0.5' }, 1) === 0.5`; `meterOpts({})` 기본값.
- [ ] **Step 2–4:** FAIL → 구현 → PASS.
- [ ] **Step 5: 커밋** `feat: action base and settings parsing for OBS`

### Task 6: 미터 액션 — VU Dial, Fader(2-Button), Mute, Volume (`src/actions/meter-actions.ts`, `ui/meter.html`)

**Interfaces — Consumes:** Task 2~5. **Produces:** `meterActions(conn): SingletonAction[]`.

동작은 SRC `actions/faders.ts`의 `VuDialAction`(press/turn 상태 맵, `run()`), `ButtonFaderAction`, `FaderAction`(set/step)을 따른다. 볼륨 변경: `stepDb`/`clampSetDb` 결과가 −∞면 `SetInputVolume { inputUuid, inputVolumeMul: 0 }`, 아니면 `{ inputVolumeDb }`. step은 현재 `input.volumeDb` 기준. 뮤트 on/off/toggle은 `SetInputMute`/`ToggleInputMute`. peek은 SRC `state/fader-peek.ts`를 복사해 uuid 키로 사용.

- [ ] **Step 1: 테스트** `test/actions.test.mjs` — 가짜 `ObsConnection`(`call` 기록, `input()` 반환)으로 액션 메서드 직접 호출(SRC `actions-faders.test.mjs` 방식):
  - `dial rotate steps from the current volume`(−6 + 2틱 → `inputVolumeDb: -4`), `rotate below -60 sends mul 0`.
  - `press toggles mute on release when not turned`, `press+turn left runs leftAction once per hold`, `recall clamps to 0 dB`.
  - `touch tap mutes unless touchMute is false`.
  - `button fader top steps up, bottom down, repeats while held, stops on key up`.
  - `volume key set and step`.
  - `mute key toggles`.
  - `removed source renders N/A`, `missing source renders SET SOURCE`.
- [ ] **Step 2–4:** FAIL → 구현 → PASS.
- [ ] **Step 5:** `ui/meter.html`: 소스(datasource `getInputs`, hot-reload), Display name, Meter style(Standard / Wide green + 안내문 "OBS Settings → Audio → Peak meter type: Sample peak = Standard, True peak = Wide green"), Channels(L/R / Combined), 액션별 필드(다이얼: Step per tick, Touch tap mutes, 접힌 Press actions — SRC `vu-dial.html` 그대로; 2버튼: role, step; Volume: mode, value). 맨 아래 `data-global`. `common.js`는 SRC 복사 후 전역 블록을 `OBS connection`(Host, Port, Password `type="password"`)으로.
- [ ] **Step 6:** manifest에 4개 액션 추가(VU Dial = Encoder + `layouts/strip.json`, TriggerDescription Rotate "Volume", Push "Mute", Touch "Mute").
- [ ] **Step 7: 커밋** `feat: VU dial, two-key fader, mute and volume actions for OBS`

### Task 7: PTT (`src/runtime/ptt.ts`, `src/actions/ptt.ts`)

**Interfaces — Produces:**
```ts
export class PttLatch {
  constructor(send: (muted: boolean) => void, deps?: { setTimeout?; clearTimeout? })
  press(mode: 'talk' | 'mute', currentlyMuted: boolean): void
  release(delayMs: number): void
  abort(): void            // willDisappear: 즉시 복원
  reconnected(): void      // 끊긴 사이 놓였으면 복원
  setOnline(online: boolean): void
  get active(): boolean
}
```
- [ ] **Step 1: 테스트** `test/ptt.test.mjs`:
  - `talk unmutes on press and restores muted after the delay`(200 ms 전엔 send 1회, 후 2회 `true`).
  - `mute mode on an already muted source stays muted after release`.
  - `pressing again during the delay cancels the restore and keeps the first remembered state`.
  - `delay 0 restores at once`, `abort restores at once`.
  - `restores on reconnect when released while offline`: `setOnline(false)` → release → send 안 함 → `reconnected()` → send(원래 상태).
- [ ] **Step 2–4:** FAIL → 구현 → PASS.
- [ ] **Step 5:** `PttAction`: 키 인스턴스마다 `PttLatch` 하나, `onKeyDown`/`onKeyUp`/`onWillDisappear`, 연결의 `onReconnect`와 online 변화 전달, 멀티 액션이면 무시. 화면 `renderPttKey`(live = 지금 소리가 나가는지 = `!input.muted`). PI는 `ui/keys.html`에 mode(Push to talk / Push to mute), Release delay (ms) 기본 200.
- [ ] **Step 6: 커밋** `feat: push to talk / push to mute`

### Task 8: Monitoring, Balance Dial, Balance 키 (`src/actions/other.ts`)

- [ ] **Step 1: 테스트** (`test/actions.test.mjs`에 추가): `monitor set sends the chosen type`(`OBS_MONITORING_TYPE_NONE` / `MONITOR_ONLY` / `MONITOR_AND_OUTPUT`), `monitor cycle goes none → only → both → none`, `balance dial steps 1% and clamps 0..1`, `balance press centres to 0.5`, `balance key set and step`.
- [ ] **Step 2–4:** FAIL → 구현 → PASS.
- [ ] **Step 5:** PI 필드(`ui/keys.html`: monitor mode·type, balance mode·value(%)·step; `ui/meter.html`은 그대로, Balance Dial은 `keys.html`의 다이얼 분기), manifest 3개 추가.
- [ ] **Step 6: 커밋** `feat: audio monitoring and balance actions`

### Task 9: 진입점, README, 패키징, 실제 확인

- [ ] **Step 1:** `src/plugin.ts`: SRC `plugin.ts` 구조 그대로 — 콘솔을 로거로, 전역 설정 500 ms 디바운스 후 `connection.start`, `getInputs` 데이터소스(`connection.inputs()`, 바뀔 때 다시 보냄; 연결 전엔 저장된 `inputName` 하나만 보이도록 PI가 처리), 모든 액션 등록.
- [ ] **Step 2:** README(한국어, SRC 형식): 필요한 것(OBS 30+), OBS에서 **도구 → WebSocket 서버 설정 → 서버 활성화**, 포트·비밀번호, 액션 표, 미터 스타일 설명("Wide green = OBS 트루 피크 색 구간, 값은 샘플 피크"), PTT 동작.
- [ ] **Step 3: 확인** `npm test` 전체 PASS, `npm run pack` → `.streamDeckPlugin` 생성, `streamdeck link`로 Stream Deck 앱에 오류 없이 표시.
- [ ] **Step 4: 사용자와 수동 확인** (실제 OBS + Stream Deck + XL): 액션마다 한 번, 미터가 OBS 믹서와 같은 높이로 부드럽게, PTT 놓은 뒤 200 ms 후 복원, 연결 끊었다 켜기.
- [ ] **Step 5: 커밋** `docs: README for the OBS audio plugin`
