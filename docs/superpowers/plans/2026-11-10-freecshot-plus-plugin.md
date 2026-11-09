# 프릭샷플러스용 플러그인 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 같은 코드에서 OBS판과 프릭샷플러스판 스트림덱 플러그인 두 개를 빌드합니다. 프릭샷판에는 WebSocket 자동 설정, 로그인 대기 표시, B안 색을 넣습니다.

**Architecture:** 판(flavour)마다 다른 값은 `src/flavour.ts` 한곳에 모읍니다. rollup은 설정 두 개로 번들을 두 번 만듭니다. 그때 작은 플러그인이 `src/build-flavour.ts`의 내용을 판 이름으로 바꿔 넣습니다. 테스트(tsc → `dist`)는 OBS판 기본값으로 돌고, 색 묶음은 `useTheme()`로 바꿔 끼워 시험합니다. 프릭샷판 플러그인 폴더의 manifest와 ui 공통 파일은 빌드할 때 OBS판 폴더에서 만들어 냅니다.

**Tech Stack:** TypeScript, @elgato/streamdeck 3.0.4, obs-websocket-js 5.0.8, rollup 4, node:test

**Spec:** `docs/superpowers/specs/2026-11-10-freecshot-plus-plugin-design.md`

## Global Constraints

- 프릭샷판 UUID: `com.haeunga0822.freecshot-audio`. 액션은 `com.haeunga0822.freecshot-audio.<OBS판과 같은 이름>`.
- 프릭샷판 이름·카테고리: `Web-Socket Audio Controller for FreecShot Plus`. Author: `Kimtan2`.
- 프릭샷판 기본 포트: `24455`. OBS판 기본 포트: `4455`(그대로).
- 프릭샷 설정 파일: `%APPDATA%\SOOPStudio\plugin_config\obs-websocket\config.json`. 실행 파일 이름: `SoopStudio.exe`.
- 백업 이름: 같은 폴더의 `config.json.bak-YYYYMMDD-HHMMSS`. 덮어쓰지 않습니다.
- B안 색:
  - 키 바탕 `#171B1E`.
  - 켜짐(PTT·토크백·모니터링) `#0CC5FE`.
  - 음소거 `#FF4D5E`.
  - 볼륨 위치 선 `#00D7FC`.
  - 레벨 미터 구간 색은 OBS판과 같습니다.
- 로그인 대기 문구: en `LOGIN`, ko `로그인 대기`, ja `ログイン待ち`.
- 비밀번호 값은 로그·화면 문구·커밋에 절대 넣지 않습니다.
- OBS판의 동작·색·문구는 바뀌면 안 됩니다. 지금 테스트 133개가 그대로 통과해야 합니다.
- SOOP·프릭샷 로고는 쓰지 않습니다. 비공식이라는 문구를 넣습니다.
- PDF 폰트는 Noto Sans KR로 하고, 일본어 한자는 Noto Sans JP로 대신합니다.
- 화면 문구는 en/ko/ja 세 언어 모두 넣습니다.

## Review Focus

1. **자동 설정 중 파일 쓰기가 실패하는 경우:** 원본은 백업과 같아야 하고, 반쯤 쓴 파일이 남으면 안 됩니다. 임시 파일에 쓴 뒤 이름을 바꿉니다. Task 4에서 테스트합니다.
2. **설정 파일에 모르는 키가 더 있거나 순서가 다른 경우:** 그 키들은 그대로 남아야 합니다. Task 4에서 테스트합니다.
3. **자동 설정을 두 번 누른 경우:** 두 번째에도 백업이 새로 생기고, 첫 백업은 남아야 합니다. 같은 초에 두 번 누르면 이름 뒤에 `-2`를 붙입니다. Task 4에서 테스트합니다.
4. **로그인 대기 중 207이 아닌 다른 오류가 나는 경우:** OFFLINE으로 돌아가야 합니다. 로그인이 끝나면 로그인 대기 표시도 사라져야 합니다. Task 3에서 테스트합니다.
5. **두 플러그인을 함께 설치한 경우:** UUID, 로그 폴더, talkback-state.json, 전역 설정이 서로 섞이면 안 됩니다. Task 6의 번들 검사와 Task 8의 실제 설치 확인에서 봅니다.

---

### Task 1: 설정이 남는지 확인 (손으로 확인, 코드 없음)

**Files:** 없음

- [ ] **Step 1:** 사용자에게 프릭샷플러스를 완전히 끄고 다시 켜 달라고 부탁합니다.
  - 다시 켠 뒤 `config.json`의 `server_enabled`가 true인지, `server_port`가 24455인지 확인합니다. 비밀번호는 길이만 출력합니다.
  - 그리고 `Get-NetTCPConnection -LocalPort 24455 -State Listen`이 결과를 내는지 봅니다.
  - Expected: 둘 다 그대로입니다. **값이 4455나 false로 돌아가 있으면 여기서 멈추고 사용자와 방법을 다시 정합니다.**
- [ ] **Step 2:** 결과를 ledger에 한 줄로 적습니다.

### Task 2: 판 설정과 색 묶음

**Files:**
- Create: `src/flavour.ts`
- Create: `src/build-flavour.ts`
- Modify: `src/actions/common.ts:12`, `src/runtime/settings.ts:16`
- Modify: `src/render/keys.ts`, `src/render/meter.ts:33,104`, `src/render/svg.ts`(`frame`의 `#000` 바탕)
- Test: `test/flavour.test.mjs`, `test/render.test.mjs`

**Interfaces:**
- Produces:
  - `type FlavourName = 'obs' | 'freecshot'`
  - `interface Theme { keyBg: string; onStyle: 'fill' | 'border'; muted: string; live: string; monitor: string; talkback: string; faderLine: string }`
  - `interface Flavour { name: FlavourName; uuid: string; defaultPort: number; theme: Theme; autoSetup: boolean }`
  - `FLAVOURS: Record<FlavourName, Flavour>`
  - `FLAVOUR: Flavour`: `FLAVOURS[BUILD]`. `BUILD`는 `src/build-flavour.ts`의 `export const BUILD: FlavourName = 'obs'`.
  - `theme(): Theme`, `useTheme(t: Theme): void`: 테스트에서 색 묶음을 바꿔 끼우는 데 씁니다.
  - `ID`: 이제 `FLAVOUR.uuid + '.'`입니다.
- OBS 색 묶음은 지금 값 그대로입니다.

  | 항목 | 값 |
  | --- | --- |
  | keyBg | `#000` |
  | onStyle | `fill` |
  | muted | `#8b1a1a` |
  | live | `#1f7a1f` |
  | monitor | `#24427a` |
  | talkback | `#b35c00` |
  | faderLine | `rgb(40,140,255)` |

- 프릭샷 색 묶음은 Global Constraints의 B안 값입니다(onStyle `border`).

- [ ] **Step 1: 실패하는 테스트를 씁니다.**
  - `test/flavour.test.mjs`
    - `FLAVOURS.freecshot.uuid === 'com.haeunga0822.freecshot-audio'`, `defaultPort === 24455`, `autoSetup === true`.
    - OBS판은 `com.haeunga0822.obs-audio`, `4455`, `false`.
    - `FLAVOUR.name === 'obs'`(테스트 빌드 기본값).
  - `test/render.test.mjs`에 추가
    - `useTheme(FLAVOURS.freecshot.theme)`일 때:
      - `renderMuteKey({...muted:true})`에 `stroke="#FF4D5E"`와 `fill="#171B1E"`가 들어 있고, `#8b1a1a`는 없습니다.
      - `renderPttKey(live:true)`, `renderTalkbackKey(active:true)`, `renderMonitorKey(type MONITOR_ONLY)`에는 `stroke="#0CC5FE"`가 들어 있습니다.
      - 켜지지 않은 키에는 `stroke=`가 없습니다.
      - `renderButtonFader`에 `#00D7FC`가 들어 있습니다.
    - 테스트 끝에서 `useTheme(FLAVOURS.obs.theme)`로 되돌립니다.
    - 되돌린 뒤 OBS판 키 SVG가 이 작업 전과 같은지 봅니다. 기존 테스트가 이 역할을 합니다.
- [ ] **Step 2:** `npm test`를 실행합니다. Expected: 새 테스트가 `flavour.js`나 `useTheme`를 찾지 못해 FAIL.
- [ ] **Step 3: 구현합니다.**
  - 테두리 그리기: `<rect x="3" y="3" width="138" height="138" rx="12" fill="none" stroke="<색>" stroke-width="6"/>`
  - 켜짐 상태의 아래 글자(MUTED, 누르면 말하기 등)는 그 상태 색으로 칠합니다. 소스 이름은 흰색 그대로 둡니다.
  - PTT가 꺼져 있을 때의 빨간 아래 글자는 두 판 모두 그대로 둡니다.
  - `frame`의 바탕 rect는 `theme().keyBg`를 씁니다.
  - `normalizeSettings`의 기본 포트는 `FLAVOUR.defaultPort`입니다.
- [ ] **Step 4:** `npm test`를 실행합니다. Expected: 모두 PASS(133 + 새 테스트).
- [ ] **Step 5: 커밋합니다.** `feat: flavour settings and themeable key colours`

### Task 3: 로그인 대기 표시

**Files:**
- Modify: `src/connection.ts`(`open`의 catch, `goOffline`)
- Modify: `src/render/svg.ts`(`Overlay`에 `'login'`, `frame`의 case)
- Modify: `src/i18n.ts`(`KeyText`에 `'login'`)
- Modify: `src/runtime/base-action.ts:129`
- Test: `test/connection.test.mjs`, `test/render.test.mjs`, `test/fake-obs.mjs`

**Interfaces:**
- Produces: `ObsConnection.waitingLogin: boolean`(getter).
  - 접속은 됐지만 load가 code 207로 실패하면 true가 됩니다.
  - 그 밖의 오류가 나거나 load에 성공하면 false가 됩니다.
  - 값이 바뀔 때 `changed()`를 부릅니다.
- `fakeObs({ notReady: n })`: 처음 n번의 `GetInputList`가 `Object.assign(new Error('OBS is not ready to perform the request.'), { code: 207 })`을 던집니다.

- [ ] **Step 1: 실패하는 테스트를 씁니다.**
  - `notReady: 1`로 시작합니다.
    - 처음에는 `conn.online === false`, `conn.waitingLogin === true`입니다.
    - `timers`로 3초를 진행합니다.
    - 그 뒤 `online === true`, `waitingLogin === false`입니다.
  - `fail: 1`(일반 오류)일 때는 `waitingLogin === false`입니다.
  - `frame(..., 'login')`의 결과에는 `LOGIN`이 들어 있습니다. `setLanguage('ko')`이면 `로그인 대기`가 들어 있습니다.
- [ ] **Step 2:** `npm test`를 실행합니다. Expected: 새 테스트만 FAIL.
- [ ] **Step 3: 구현합니다.**
  - 표시는 OFFLINE과 같은 방식입니다. 본문을 흐리게 하고, 가운데에 최대 40px 글자를 띄웁니다. 색은 `#0CC5FE`가 아니라 흰색 `#fff`입니다.
  - `base-action`의 overlay는 `online ? 'none' : connection.waitingLogin ? 'login' : 'offline'`입니다.
- [ ] **Step 4:** `npm test`를 실행합니다. Expected: 모두 PASS.
- [ ] **Step 5: 커밋합니다.** `feat: show LOGIN while the program is waiting for sign-in (code 207)`

### Task 4: 프릭샷 WebSocket 자동 설정 (플러그인 쪽)

**Files:**
- Create: `src/freecshot/setup.ts`
- Modify: `src/plugin.ts`(`onSendToPlugin`에 `freecshotSetup` 처리)
- Test: `test/freecshot-setup.test.mjs`

**Interfaces:**
- Produces:
  - `type SetupResult = { ok: true; port: number; password: string } | { ok: false; reason: 'running' | 'noConfig' | 'badConfig' | 'badPort' | 'portBusy' | 'backupFailed' | 'writeFailed' }`
  - `interface SetupDeps { configPath: string; isRunning(): Promise<boolean>; portBusy(port: number): Promise<boolean>; now(): Date; fs?: Pick<typeof import('node:fs/promises'), 'readFile' | 'writeFile' | 'copyFile' | 'rename'> }`
  - `runFreecshotSetup(input: { port: unknown; password: unknown }, deps: SetupDeps): Promise<SetupResult>`
  - `defaultSetupDeps(): SetupDeps`
    - 설정 파일 경로: `path.join(process.env.APPDATA, 'SOOPStudio', 'plugin_config', 'obs-websocket', 'config.json')`.
    - 실행 확인: `tasklist /FI "IMAGENAME eq SoopStudio.exe" /NH` 출력에 `SoopStudio.exe`가 있는지.
    - 포트 확인: `net.createServer().listen(port)`가 `EADDRINUSE`이면 사용 중.
- 처리 순서(스펙 목표 2)
  1. 실행 중인지 확인합니다.
  2. 포트를 정합니다. 비었으면 24455, 정수 1024–65535가 아니면 `badPort`.
  3. 포트가 사용 중인지 확인합니다.
  4. 설정 파일을 읽고 JSON으로 풉니다. 실패하면 `noConfig`나 `badConfig`.
  5. `copyFile(path, path + '.bak-' + stamp, COPYFILE_EXCL)`로 백업합니다. 같은 이름이 있으면 `-2`, `-3`을 붙입니다.
  6. 값을 바꿉니다. 비밀번호를 입력했으면 `auth_required = true`, `server_password = 입력값`으로 바꿉니다. 비었으면 두 값을 건드리지 않습니다.
  7. `JSON.stringify(obj, null, 4)`로 `path + '.tmp'`에 쓰고, `rename`으로 바꿔치기합니다.
  8. 결과 비밀번호를 정합니다. 인증이 켜져 있으면 파일의 `server_password`, 아니면 `''`입니다.
- `plugin.ts`: `{ event: 'freecshotSetup' }`이 오면 `FLAVOUR.autoSetup`이 true일 때만 처리합니다.
  - 지금의 전역 설정 raw 값에서 `port`와 `password`를 넘깁니다.
  - 성공하면 `streamDeck.settings.setGlobalSettings({ ...raw, host: '127.0.0.1', port: String(port), password })`를 하고 `apply()`를 부릅니다.
  - 그다음 `sendToPropertyInspector({ event: 'freecshotSetup', ok, reason })`를 보냅니다. **비밀번호는 보내지 않습니다.**
  - 로그에는 reason만 남깁니다.

- [ ] **Step 1: 실패하는 테스트를 씁니다.** 실제 파일을 쓰고, 테스트 폴더는 `mkdtemp`로 만듭니다.
  - `running`: 실행 중이면 파일이 그대로이고 백업도 없습니다.
  - 기본 동작: 포트와 비밀번호가 비었으면 `server_enabled: true`, `server_port: 24455`가 되고, 기존 비밀번호와 `auth_required`, `alerts_enabled`, `first_load`, 모르는 키 `extra: 1`이 그대로 남습니다. 결과의 `password`는 기존 값입니다.
  - 비밀번호 입력: `password: 'abc'`이면 `auth_required: true`, `server_password: 'abc'`가 됩니다.
  - 백업: 백업 파일 내용이 원본 바이트와 같습니다.
  - 두 번 실행: 같은 `now`로 두 번 실행하면 `.bak-20261110-120000`과 `.bak-20261110-120000-2`가 둘 다 있습니다.
  - 포트 오류: `port: '80'`이면 `badPort`, `portBusy`가 true이면 `portBusy`이고, 둘 다 파일이 그대로입니다.
  - 설정 파일 문제: 파일이 없으면 `noConfig`, 내용이 `{oops`이면 `badConfig`입니다.
  - 쓰기 실패: `fs.rename`이 던지게 하면 `writeFailed`이고, 원본은 그대로입니다.
- [ ] **Step 2:** `npm test`를 실행합니다. Expected: 새 테스트 FAIL(모듈 없음).
- [ ] **Step 3:** `src/freecshot/setup.ts`와 `plugin.ts`의 처리를 구현합니다.
- [ ] **Step 4:** `npm test`를 실행합니다. Expected: 모두 PASS.
- [ ] **Step 5: 커밋합니다.** `feat: FreecShot Plus WebSocket auto setup`

### Task 5: 설정 화면(PI)의 판 구분과 자동 설정 버튼

**Files:**
- Create: `com.haeunga0822.obs-audio.sdPlugin/ui/flavour.js`(`window.PI_FLAVOUR = 'obs'`)
- Modify: `com.haeunga0822.obs-audio.sdPlugin/ui/obs.html`(`i18n.js`보다 먼저 `flavour.js` 불러오기)
- Modify: `com.haeunga0822.obs-audio.sdPlugin/ui/common.js`(`globalBlock`)
- Modify: `com.haeunga0822.obs-audio.sdPlugin/ui/i18n.js`
- Test: `test/settings.test.mjs` 또는 새 `test/pi.test.mjs`

**Interfaces:**
- Consumes: Task 4의 `freecshotSetup` 메시지와 그 답(`{ ok, reason }`).
- `PI_FLAVOUR === 'freecshot'`일 때만 다음이 달라집니다.
  - 제목: `tr('freecshotConnection')`.
  - 포트 기본값: `24455`.
  - 안내 문구: `tr('freecshotHint')`.
  - 비밀번호 칸 아래에 버튼 `tr('autoSetup')`과 결과 줄 `<div class="hint" id="setup-result">`이 생깁니다.
- 결과 줄에는 `tr('setup_' + reason)`이나 `tr('setup_ok')`를 보여 줍니다.
- 새 i18n 키(en/ko/ja 모두): `freecshotConnection`, `freecshotHint`, `autoSetup`, `setup_ok`, `setup_running`, `setup_noConfig`, `setup_badConfig`, `setup_badPort`, `setup_portBusy`, `setup_backupFailed`, `setup_writeFailed`
  - ko 문구는 스펙 목표 2의 문구를 그대로 씁니다.
  - `setup_ok`(ko): "설정했습니다. 프릭샷플러스를 켜고 SOOP에 로그인하세요"
  - `freecshotHint`(ko): "프릭샷플러스를 끈 상태에서 [WebSocket 자동 설정]을 누르세요. 포트를 비우면 24455, 비밀번호를 비우면 프릭샷에 있던 비밀번호를 씁니다."

- [ ] **Step 1: 실패하는 테스트를 씁니다.**
  - `ui/i18n.js`를 읽어 `PI_TEXT`를 평가합니다. 기존 i18n 테스트와 같은 방법을 씁니다.
  - 새 키가 en/ko/ja 모두에 있는지 확인합니다.
- [ ] **Step 2:** `npm test`를 실행합니다. Expected: FAIL.
- [ ] **Step 3:** 구현합니다. 버튼은 `SDPIComponents.streamDeckClient.send('sendToPlugin', { event: 'freecshotSetup' })`를 보내고, 답은 `sendToPropertyInspector.subscribe`로 받습니다.
- [ ] **Step 4:** `npm test`를 실행합니다. Expected: PASS. OBS판 화면(PI_FLAVOUR 'obs')은 그대로입니다.
- [ ] **Step 5: 커밋합니다.** `feat: auto setup button on the FreecShot Plus settings screen`

### Task 6: 두 판 빌드와 프릭샷 플러그인 폴더

**Files:**
- Modify: `rollup.config.mjs`
  - 설정 두 개를 배열로 내보냅니다.
  - 인라인 플러그인 `flavour(name)`을 넣습니다. `load(id)`가 `build-flavour.ts`이면 `export const BUILD = '<name>'`을 돌려줍니다.
  - 출력은 각 플러그인 폴더의 `bin/plugin.js`입니다.
- Create: `scripts/make-freecshot.mjs`
  - OBS판 `manifest.json`의 `com.haeunga0822.obs-audio`를 모두 `com.haeunga0822.freecshot-audio`로 바꿉니다.
  - Name과 Category는 `Web-Socket Audio Controller for FreecShot Plus`로 바꿉니다.
  - Description에는 "Unofficial. Not affiliated with SOOP."을 덧붙입니다.
  - OBS판에서 `ui/`(flavour.js 제외), `layouts/`, `THIRD-PARTY-NOTICES.txt`, `.sdignore`를 복사합니다. 프릭샷판 `ui/flavour.js`에는 `'freecshot'`를 씁니다.
- Create: `com.haeunga0822.freecshot-audio.sdPlugin/imgs/*`(Task 7)
- Modify: `package.json`의 scripts
  - `bundle`: `node scripts/make-freecshot.mjs && rollup -c rollup.config.mjs`
  - `pack`: 두 폴더를 각각 `streamdeck pack`합니다.
- Modify: `.gitignore`: 프릭샷 폴더에서 `imgs/`를 뺀 생성물은 모두 무시합니다.
- Test: `test/bundle.test.mjs`

- [ ] **Step 1: 실패하는 테스트를 씁니다.** `npm run bundle`이 끝난 뒤를 가정합니다. 결과물이 없으면 skip하지 않고 FAIL합니다.
  - 프릭샷 manifest 확인
    - `UUID === 'com.haeunga0822.freecshot-audio'`
    - 모든 액션 UUID가 `com.haeunga0822.freecshot-audio.`로 시작합니다.
    - 액션 개수가 OBS판과 같습니다.
    - 문자열 전체에 `obs-audio`가 없습니다.
  - 프릭샷 번들에는 `com.haeunga0822.freecshot-audio.mute`가 있고 `com.haeunga0822.obs-audio.`는 없습니다. OBS 번들은 그 반대입니다.
  - 프릭샷 `ui/flavour.js`에 `'freecshot'`가 있습니다.
- [ ] **Step 2:** `npm test`를 실행합니다. Expected: FAIL.
- [ ] **Step 3:** 구현합니다. 테스트 스크립트는 `npm run bundle && npm run build && node --test test/*.test.mjs`로 바꿉니다.
- [ ] **Step 4:** `npm test`를 실행합니다. Expected: 모두 PASS.
  - `git status`를 확인합니다. 생성물이 추적 목록에 나오지 않아야 합니다.
  - `npm run pack` 뒤에는 manifest의 마지막 줄바꿈이 사라지므로 `git checkout -- com.haeunga0822.obs-audio.sdPlugin/manifest.json`을 합니다.
- [ ] **Step 5: 커밋합니다.** `build: bundle an OBS and a FreecShot Plus plugin from one source`

### Task 7: 하늘색 아이콘

**Files:**
- Create: `com.haeunga0822.freecshot-audio.sdPlugin/imgs/`
  - `plugin.png`(256), `plugin@2x.png`(512), `category.png`(28), `category@2x.png`(56)
  - 액션 아이콘 `channel.svg`, `dial.svg`, `fader.svg`, `global.svg`

- [ ] **Step 1: SVG를 하늘색으로 바꿉니다.**
  - OBS판 SVG를 복사합니다.
  - 강조색을 `#0CC5FE`로, 바탕을 `#171B1E`로 바꿉니다.
- [ ] **Step 2: PNG를 만듭니다.**
  - B 아이콘을 하늘색 버전 SVG로 다시 그립니다(레벨 미터 + 페이더, 로고 없음).
  - Edge headless `--screenshot --default-background-color=00000000 --window-size=N,N`으로 네 가지 크기를 만듭니다.
- [ ] **Step 3: 확인합니다.**
  - Read 도구로 PNG 네 개를 열어 눈으로 봅니다.
  - 크기를 확인합니다(256/512/28/56).
- [ ] **Step 4: 커밋합니다.** `feat: sky-blue icons for the FreecShot Plus plugin`

### Task 8: 실제 설치로 확인

**Files:** 없음(확인만)

- [ ] **Step 1: 설치하고 실행합니다.**
  - `npm run pack`으로 `com.haeunga0822.freecshot-audio.streamDeckPlugin`을 만듭니다.
  - 사용자에게 더블클릭으로 설치해 달라고 부탁합니다. 경로를 알려 주고 탐색기로 폴더를 엽니다.
  - 설치하면 node.exe가 새로 뜹니다. 명령줄에 `freecshot-audio.sdPlugin`이 들어 있는 프로세스이고, 시작 시각이 설치 뒤여야 합니다.
- [ ] **Step 2: 프릭샷판 키를 확인합니다.** 프릭샷을 켜고 로그인한 상태에서 Mute 키를 하나 둡니다.
  - 소스 목록에 프릭샷의 소스(0.MIC 등)가 나와야 합니다.
  - 음소거하면 빨간 테두리가 생겨야 합니다.
  - 키 바탕은 `#171B1E`여야 합니다.
- [ ] **Step 3: 두 플러그인이 섞이지 않는지 확인합니다.**
  - OBS판 키가 그대로 OBS를 조작해야 합니다.
  - 두 플러그인 폴더의 logs, 전역 설정(포트 4455와 24455)이 따로여야 합니다.
- [ ] **Step 4: 로그인 대기 표시를 확인합니다.** 사용자가 프릭샷을 껐다 켜고 로그인하기 전 키에 `로그인 대기`(언어 ko)가 떠야 합니다. 로그인 뒤에는 사라져야 합니다.
- [ ] **Step 5: 자동 설정 버튼을 확인합니다.**
  - 프릭샷이 켜진 상태에서 누르면 "끈 뒤 다시"가 떠야 하고, 파일은 그대로여야 합니다.
  - 꺼진 상태에서 누르면 백업이 생기고, 설정 화면의 포트 칸에 24455가 들어가야 합니다.
- [ ] **Step 6:** 결과를 ledger에 적습니다. 매니페스트가 바뀌었으므로 스트림덱 앱 재시작이 필요하면 사용자에게 한 번만 알립니다.

### Task 9: README와 설명서, 릴리즈 준비

**Files:**
- Create: `docs/freecshot/README.md`(ko), `README.en.md`, `README.ja.md`
  - OBS판 README 형식을 따릅니다.
  - 2단계 "OBS에서 WebSocket 켜기" 대신 "WebSocket 자동 설정"을 설명합니다.
  - 기본 포트는 24455입니다.
  - 로그인 대기 표시를 키 표시 표에 넣습니다.
  - 비공식 문구를 넣습니다.
- Create: `docs/manual/freecshot/manual.{ko,en,ja}.html`(OBS판 설명서 형식, `manual.css` 공유)과 PDF 세 개
  - ko: `Web-Socket Audio Controller for FreecShot Plus 스트림덱 플러그인 사용설명서.pdf`
  - en: `Web-Socket Audio Controller for FreecShot Plus Stream Deck Plugin Manual (English).pdf`
  - ja: `Web-Socket Audio Controller for FreecShot Plus Stream Deck プラグイン 取扱説明書 (日本語).pdf`
- Modify: 루트 `README.md` 세 언어에 "프릭샷플러스용은 여기" 링크 한 줄씩

- [ ] **Step 1:** README 세 개를 씁니다.
- [ ] **Step 2:** 설명서 HTML 세 개를 쓰고 Edge headless로 PDF를 만듭니다.
- [ ] **Step 3: 확인합니다.**
  - PDF 폰트를 pypdf로 확인합니다. Expected: NotoSansKR(+ 일본어만 NotoSansJP).
  - 페이지 이미지를 열어 줄바꿈·잘림이 없는지 봅니다.
- [ ] **Step 4: 커밋합니다.** `docs: README and manuals for the FreecShot Plus plugin`
- [ ] **Step 5:** 릴리즈 zip 만들기와 GitHub 업로드는 이 계획에 넣지 않습니다. 버전은 사용자가 정하기 때문에, 끝나면 사용자에게 묻습니다.
