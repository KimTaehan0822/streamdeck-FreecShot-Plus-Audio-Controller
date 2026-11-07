# 토크백 액션 + 언어 선택 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 다른 소스들을 한꺼번에 음소거/정한 볼륨/토크백(dB 줄이기) 하고 원래대로 되돌리는 Talkback 키, 그리고 설정 화면·키 글자의 한국어/영어/일본어 선택.

**Architecture:** 소스별 "처음 값"과 그 소스를 잡은 키들을 기억하는 순수 로직 `TalkbackRegistry`(OBS 호출·저장은 주입)를 만들고, 액션은 그 위에 얇게 얹는다. 원래 값은 플러그인 폴더의 `talkback-state.json`에 저장한다. 언어는 전역 설정 `language`, 키 글자는 `src/i18n.ts`의 `t()`, 설정 화면은 `ui/i18n.js` 번역표.

**Tech Stack:** TypeScript, `@elgato/streamdeck` 3.0.4, obs-websocket-js 5.0.8, sdpi-components 4.0.1, `node --test`(dist/를 import).

**Spec:** `docs/superpowers/specs/2026-11-07-talkback-language-design.md`

## Global Constraints

- 언어 값: `'ko' | 'en' | 'ja'`, 기본 `'en'`. 전역 설정 키 이름 `language`.
- 언어만 바뀌면 OBS 재연결 금지(`normalizeSettings`는 host/port/password만 보므로 그대로 두고, 언어는 따로 읽는다).
- 액션 UUID `com.haeunga0822.obs-audio.talkback`, manifest 이름 "Talkback". 한국어 표시 "토크백", 일본어 "トークバック".
- 방식 이름(설정 값 → 표시): `mute` 음소거/Mute/ミュート, `level` 정한 볼륨/Set volume/指定音量, `duck` 토크백/Talkback/トークバック.
- 동작: `hold` 누르는 동안 / `toggle` 토글. 대상: `except` 목록 제외 / `only` 목록만.
- 이미 음소거된 소스는 적용·복구 모두 하지 않음. `level`은 정한 값보다 큰 소스만 내림.
- 복구는 처음 값으로. 한 키가 꺼지면 같은 소스를 잡은 다른 토크백 키도 함께 꺼짐(남은 소스도 복구, 토글 표시 꺼짐).
- 멀티 액션 안에서 `hold`는 무시, `toggle`은 동작.
- 반영 확인: `npm test` 통과만으로 끝내지 말 것. `npm run bundle` → 이 플러그인 node 프로세스만 종료 → 새 프로세스 시작 시각 > `bin/plugin.js` 수정 시각 확인.
- 요청하지 않은 파일은 수정하지 않는다.

## Review Focus

1. 복구 중 OBS 연결이 끊김 → 재연결 시 남은 복구가 이어져야 함(Task 3 테스트로 고정).
2. 플러그인 재시작: 상태 파일의 `hold` 기록은 연결 즉시 복구, `toggle`은 켜진 표시 유지(Task 4 테스트로 고정).
3. 키 A, B가 같은 소스를 잡고 A를 끔 → 소스는 처음 값, B도 꺼짐 표시(Task 3·4 테스트로 고정).
4. 적용 중 사용자가 키 설정(목록·방식)을 바꿔도 복구는 기록된 값대로(Task 4 테스트로 고정).
5. 일본어/한국어 키 글자가 키 밖으로 넘치지 않음(Task 1 테스트: fitSize/fitText 사용 확인).

---

### Task 1: 키 글자 번역 (`src/i18n.ts`)

**Files:**
- Create: `src/i18n.ts`
- Modify: `src/render/svg.ts`(OFFLINE/SET SOURCE/SETUP 등 overlay 글자), `src/render/keys.ts`(MUTED/TALK/OFF/MON/MON+OUT), `src/render/meter.ts`(`volumeLabel`의 MUTED)
- Test: `test/i18n.test.mjs`(새로), `test/render.test.mjs`

**Interfaces:**
- Produces: `type Lang = 'ko' | 'en' | 'ja'`, `setLanguage(l: unknown): Lang`(모르는 값은 `'en'`), `language(): Lang`, `t(key: KeyText): string`, `type KeyText = 'muted' | 'talk' | 'off' | 'mon' | 'monOut' | 'set' | 'source' | 'setup' | 'offline' | 'talkback' | 'mute' | 'notFound'`.

번역표(정확한 문구):

| key | en | ko | ja |
|---|---|---|---|
| muted | MUTED | 음소거 | ミュート |
| talk | TALK | 토크 | トーク |
| off | OFF | 끔 | オフ |
| mon | MON | 모니터 | モニター |
| monOut | MON+OUT | 모니터+출력 | モニター+出力 |
| set / source | SET / SOURCE | 소스 / 선택 | ソース / 選択 |
| setup | SETUP | 설정 | 設定 |
| offline | OFFLINE | 오프라인 | オフライン |
| talkback | Talkback | 토크백 | トークバック |
| mute | MUTE | 음소거 | ミュート |
| notFound | (not found) | (없음) | (見つかりません) |

- [ ] **Step 1: 실패하는 테스트**
  - `test/i18n.test.mjs`: 세 언어의 키 목록이 같음, `setLanguage('xx')`는 `'en'`, `setLanguage('ko'); t('muted') === '음소거'`.
  - `test/render.test.mjs`: `setLanguage('ko')` 후 `renderMuteKey(muted)`에 `>음소거<`, `renderVuStrip(offline)`에 `오프라인`; `setLanguage('ja')` 후 `renderMonitorKey(MONITOR_AND_OUTPUT)`의 글자 크기가 `fitSize`로 줄어 `textWidth ≤ 136`. 각 테스트 끝에 `setLanguage('en')`.
- [ ] **Step 2:** `npm test` → 새 테스트 FAIL 확인.
- [ ] **Step 3:** `src/i18n.ts` 작성, 렌더러의 하드코딩 글자를 `t()`로 교체. 상태 글자(`status`, 모니터 글자, overlay 글자)는 `fitSize(text, size, 136, 12)`로 크기를 정해 넘치지 않게.
- [ ] **Step 4:** `npm test` → 전부 PASS.
- [ ] **Step 5:** 커밋 `feat: translated key texts (ko/en/ja)`.

### Task 2: 언어 설정 연결 (플러그인 + 설정 화면)

**Files:**
- Modify: `src/plugin.ts`, `src/runtime/base-action.ts`, `com.haeunga0822.obs-audio.sdPlugin/ui/common.js`, `com.haeunga0822.obs-audio.sdPlugin/ui/obs.html`
- Create: `com.haeunga0822.obs-audio.sdPlugin/ui/i18n.js`
- Test: `test/i18n.test.mjs`, `test/runtime.test.mjs`

**Interfaces:**
- Consumes: Task 1 `setLanguage`, `t`.
- Produces: `ObsAction.redrawAll(): void`(public, 보이는 키 전부 다시 그림). PI 전역 `tr(key)`와 `PI_TEXT = { en: {...}, ko: {...}, ja: {...} }`(`ui/i18n.js`, 브라우저와 node 둘 다 읽히게 `globalThis.PI_TEXT = ...` 형태).

- [ ] **Step 1: 실패하는 테스트**
  - `test/i18n.test.mjs`: `ui/i18n.js`를 `vm`으로 실행해 `PI_TEXT`의 en/ko/ja 키 목록이 서로 같음. 값이 빈 문자열 아님.
  - `test/runtime.test.mjs`: `redrawAll()`이 보이는 키마다 `setImage`/`setFeedback`를 한 번씩 부름(기존 `fakeAction` 사용).
- [ ] **Step 2:** FAIL 확인.
- [ ] **Step 3: 구현**
  - `plugin.ts`: `onDidReceiveGlobalSettings`와 시작 시 `getGlobalSettings` 결과에서 `language`를 읽어 바뀌었으면 `setLanguage` 후 모든 액션 `redrawAll()`. 디바운스·`apply()`(OBS 연결)와 분리해서 즉시 처리. "(not found)"는 `t('notFound')`.
  - `ui/i18n.js`: 설정 화면의 모든 라벨·선택지·안내 문구(기존 obs.html, common.js의 영어 문구 전부 + Task 5의 토크백 문구 + "Language").
  - `common.js`: 접힌 OBS 연결 블록 **아래**에 `<sdpi-item label="Language"><sdpi-select setting="language" global default="en">`(English/한국어/日本語). 블록 문구는 `tr()`로.
  - `obs.html`: 라벨을 `tr()`로. 전역 설정 변경 알림(`SDPIComponents.streamDeckClient.didReceiveGlobalSettings`, 4.0.1에 있는지 먼저 확인)을 받아 언어가 바뀌면 필드와 전역 블록을 다시 그리고 `initFields` 다시 실행.
- [ ] **Step 4:** `npm test` PASS. 브라우저 확인은 Task 6에서.
- [ ] **Step 5:** 커밋 `feat: language setting for the PI and key texts`.

### Task 3: `TalkbackRegistry` (순수 로직)

**Files:**
- Create: `src/runtime/talkback.ts`
- Test: `test/talkback.test.mjs`

**Interfaces:**
- Produces:
  - `type TalkbackStyle = 'mute' | 'level' | 'duck'`, `type TalkbackBehavior = 'hold' | 'toggle'`
  - `interface TalkbackTarget { uuid: string; volumeMul: number; muted: boolean }`
  - `interface TalkbackState { keys: Record<string, TalkbackBehavior>; sources: Record<string, { mul: number; mutedByUs: boolean; holders: string[] }> }`
  - `class TalkbackRegistry` 생성자 `(deps: { send(type: 'SetInputMute' | 'SetInputVolume', data: object): void; isOnline(): boolean; exists(uuid: string): boolean; save(state: TalkbackState): void; onOff(ids: string[]): void })`
  - 메서드: `apply(id, behavior, targets: TalkbackTarget[], style, valueDb: number): void`, `release(id): void`, `active(id): boolean`, `reconnected(): void`, `load(state: TalkbackState): void`, `state(): TalkbackState`

동작 규칙(테스트가 고정할 값):
- `apply`: 대상마다
  - 이미 기록된 소스(다른 키가 잡음) → `holders`에 id 추가, 원래 값 유지, 이 키 방식도 적용.
  - 기록 없고 `muted` → 건너뜀.
  - 기록 없고 안 뮤트 → `{mul, mutedByUs:false}` 기록 후 적용.
  - 적용: `mute` → `SetInputMute{inputUuid, inputMuted:true}`, `mutedByUs=true`; `level` → 현재 dB > valueDb일 때만 `SetInputVolume`(valueDb가 −∞면 `inputVolumeMul:0`, 아니면 `inputVolumeDb`), 아니면 기록도 하지 않음; `duck` → 현재 dB − valueDb(−∞면 그대로, 보낼 것 없음).
  - 적용 후 `save(state())`.
- `release(id)`: id가 잡은 소스마다 복구(`SetInputVolume{inputVolumeMul: mul}`, `mutedByUs`면 `SetInputMute false`), 기록 삭제. 그 소스를 같이 잡은 다른 id도 같은 방식으로 release(연쇄). 꺼진 id 전부(자기 포함) `onOff(ids)` 한 번. `save`.
  - 오프라인이면 복구 대상 소스를 `pending`에 두고 키는 꺼진 것으로 처리. `reconnected()`가 `exists(uuid)`인 pending만 복구, 나머지 버림.
- `load(state)`: `keys`가 `hold`인 id는 곧바로 `release`(오프라인이면 pending), `toggle`은 활성 유지.

- [ ] **Step 1: 실패하는 테스트** (`test/talkback.test.mjs`, 가짜 deps로 보낸 호출 목록 확인)
  - `mute: 음소거된 소스는 건너뛰고 나머지를 음소거, release로 해제`
  - `level: -30 지정 시 -10 dB 소스만 -30, -40 dB 소스는 건드리지 않음`
  - `duck: 15 dB면 -6 → -21, -inf는 보낼 것 없음, release로 원래 mul`
  - `두 키가 같은 소스: B는 처음 값 유지, A release 시 소스는 처음 값이고 onOff([A,B])`
  - `오프라인 release → reconnected에서 복구, 사라진 소스는 건너뜀`
  - `load: hold 기록은 즉시 복구, toggle 기록은 active 유지`
  - `apply/release마다 save 호출, state()가 JSON 왕복 가능`
- [ ] **Step 2:** FAIL 확인.
- [ ] **Step 3:** 구현.
- [ ] **Step 4:** PASS.
- [ ] **Step 5:** 커밋 `feat: talkback registry (snapshot, shared sources, restore)`.

### Task 4: Talkback 액션 + 키 화면 + 상태 파일

**Files:**
- Create: `src/actions/talkback.ts`
- Modify: `src/render/keys.ts`(`renderTalkbackKey`), `src/plugin.ts`(등록, 상태 파일), `com.haeunga0822.obs-audio.sdPlugin/manifest.json`(액션 추가, 아이콘은 기존 PTT 이미지 재사용), `.gitignore`(`talkback-state.json`)
- Test: `test/actions.test.mjs`, `test/render.test.mjs`

**Interfaces:**
- Consumes: Task 3 `TalkbackRegistry`, Task 1 `t`.
- Produces: `class TalkbackAction extends ObsAction`(소스 하나에 묶이지 않으므로 `SourceAction`이 아님), `renderTalkbackKey(v: { name: string; style: TalkbackStyle; valueDb: number; active: boolean; overlay: Overlay }): string`, `talkbackState(file: string): { load(): TalkbackState | undefined; save(s: TalkbackState): void }`.
- 설정 형식: `scope: 'except'|'only'`, `sources: { uuid: string; name: string }[]`, `style`, `valueDb`(문자열 숫자, `level`은 −∞ 허용 "-inf"), `behavior`, `displayName`.

- [ ] **Step 1: 실패하는 테스트**
  - render: `renderTalkbackKey` 켜짐이면 강조 배경(`#b35c00`), 이름 기본값 `t('talkback')`, 가운데 글자: mute → `t('mute')`, level → `-30 dB`, duck → `▼15 dB`.
  - actions(가짜 OBS `connected([...])`): 
    - `except`: 목록의 마이크를 뺀 소스만 대상.
    - `only`: 목록 소스만 대상.
    - `hold`: keyDown 적용, keyUp 복구. 멀티 액션이면 아무것도 안 함.
    - `toggle`: 두 번 누르면 복구, 멀티 액션에서도 동작.
    - 적용 중 설정의 `sources`/`style` 변경 후 release → 처음 값 복구.
    - 키 A, B 공유 소스: A 끄면 B 키 다시 그림(꺼짐 배경 아님).
    - `hold` 키 willDisappear → 즉시 복구, `toggle` 키 willDisappear → 유지.
    - 시작 시 상태 파일에 `hold` 기록 → OBS 연결 신호에 복구.
- [ ] **Step 2:** FAIL 확인.
- [ ] **Step 3: 구현**
  - 상태 파일 경로: 플러그인 폴더(`process.cwd()`가 플러그인 폴더인지 확인, 아니면 `import.meta.url` 기준 `..`) 안 `talkback-state.json`. 쓰기 실패는 로그만.
  - 레지스트리는 액션 하나에 하나. `onOff(ids)`에서 해당 키들 다시 그림. `connection.onReconnect`에서 `reconnected()`.
  - 대상 계산: `connection.inputs()` 기준(믹서와 같은 기준), `scope`로 거르기.
- [ ] **Step 4:** PASS.
- [ ] **Step 5:** 커밋 `feat: Talkback action`.

### Task 5: 토크백 설정 화면 + README

**Files:**
- Modify: `com.haeunga0822.obs-audio.sdPlugin/ui/obs.html`, `ui/i18n.js`, `README.md`

- [ ] **Step 1:** `obs.html`에 `case 'talkback'`:
  - Display name, 대상(`scope` 선택), 소스 목록(줄마다 소스 `<select>` + × 버튼, 아래 **Add Source**), 방식(`style`), `level`일 때만 "볼륨 (dB)", `duck`일 때만 "줄일 양 (dB)"(기존 `when()` 사용), 동작(`behavior`).
  - 소스 목록은 sdpi 컴포넌트 대신 직접 그린다: 플러그인에 `{event:'getInputs'}`를 보내 받은 목록으로 채우고, 바뀔 때마다 현재 설정을 읽어 `sources`만 바꿔 `setSettings`. 목록에 없는 저장 소스는 `이름 + tr('notFound')`로 보여 줌. 새 줄 기본값은 빈 선택.
  - 기존 공통 필드(Source 드롭다운)는 토크백에서는 그리지 않음.
- [ ] **Step 2:** README에 Talkback 행과 Language 설명 추가(한국어).
- [ ] **Step 3:** `npm test` PASS(i18n 키 일치 테스트 포함).
- [ ] **Step 4:** 커밋 `feat: Talkback settings screen`.

### Task 6: 실제 반영 확인

- [ ] `npm run bundle` → `bin/plugin.js`에 `TalkbackRegistry` 포함 확인.
- [ ] OBS Audio 플러그인 node 프로세스만 종료 → 새 프로세스 시작 시각 > `bin/plugin.js` 수정 시각.
- [ ] 설정 화면을 Edge 헤드리스로 열 수 없으므로(스트림덱 연결 필요) 사용자에게 확인 목록 전달: 언어 3종 전환, Add Source/×, 방식별 칸 표시, hold/toggle 동작, 두 키 공유.
- [ ] `streamdeck pack -f` 후 manifest 줄바꿈 복원(`git checkout -- manifest.json`은 Task 4 변경이 커밋된 뒤에만).
- [ ] 로그에 새 오류 없음 확인.
