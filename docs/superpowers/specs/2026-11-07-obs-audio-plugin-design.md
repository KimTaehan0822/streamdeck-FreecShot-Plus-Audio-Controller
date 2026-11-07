# OBS 오디오 믹서용 Stream Deck 플러그인 — 설계

## 왜

사용자는 RME TotalMix 스트림덱 플러그인(`C:\Users\user\streamdeck-rme-totalmix`, 이하 SRC)의
**VU Dial**과 **Fader(2-Button)** 를 OBS 오디오 믹서에도 쓰고 싶다. 방송 중 스트림덱에서
**OBS 소스의 현재 레벨(미터)과 설정된 볼륨(페이더)을 확인**하고 바로 조절하는 것이 주 목적이다.
TotalMix 플러그인과는 **따로 설치되는 별도 플러그인**으로 만든다. 개인용, Windows, Stream Deck + XL.

## 목표

- 별도 플러그인 "OBS Audio" — obs-websocket v5로 OBS에 직접 연결한다(다른 프로그램 불필요).
- 생김새는 **OBS 기본 오디오 믹서**에 맞춘다(브레인스토밍 시안 A안: 미터 + OBS식 슬라이더).
- 액션 8개: VU Dial, Fader(2-Button), Mute, Volume, Push to talk / Push to mute, Audio monitoring,
  Balance Dial, Balance 키.

## 하지 않는 것

- 트루 피크 값 표시. obs-websocket은 미터 방식을 `SAMPLE_PEAK_METER`로 고정해 두었고 바꾸는 코드가 없다
  (`src/utils/Obs_VolumeMeter.cpp`, 2026-11-07 확인). 플러그인은 소리 샘플을 받지 못해 직접 계산도 못 한다.
- 오디오 트랙(1~6) 지정, 싱크 오프셋. 방송 중 거의 안 만지는 설정이라 뺐다.
- 여러 OBS 동시 연결, macOS, Elgato 마켓플레이스 배포. _(내 판단)_
- 흘러가는(마퀴) 이름 표시. 계속 다시 그려야 해서 스트림덱에 부담. _(내 판단)_

## 실패로 보는 것

- TotalMix 플러그인보다 미터가 끊기거나 다이얼 반응이 느림.
- PTT가 눌린 상태로 남아 마이크가 켜진 채 방치됨.
- SRC(TotalMix 플러그인)를 고침. SRC는 복사해 오는 원본일 뿐이다.

## 제약

- Elgato Stream Deck SDK(`@elgato/streamdeck` 3.0.4, SRC와 같은 버전), Node.js 20, Windows, Stream Deck 7.3+.
- **OBS 30 이상**(obs-websocket 5.x 내장, 입력 UUID 지원). 기본 포트 4455, 비밀번호 선택.
- Stream Deck 그리기는 비싸다: SRC와 같은 40 ms 스로틀(`Redrawer`)과 같은 이미지 재전송 금지.
- 키 144×144, 다이얼 화면 200×100.

## 방법

- **A (선택): 새 저장소에 SRC의 그리기·런타임 코드를 복사하고 통신만 OBS용으로 새로 만든다.**
  `render/svg.ts`, `runtime/redraw.ts`, `runtime/hold.ts`, `runtime/base-action.ts`(연결 타입만 교체),
  PI의 `sdpi-components.js`·`common.js` 구조를 가져온다. 두 플러그인이 서로 영향을 주지 않는다.
  대가: 나중에 SRC에서 고친 것이 자동으로 따라오지 않는다.
- B: SRC 플러그인 안에 OBS 액션을 추가. 사용자가 "따로 만들고 싶다"고 해서 제외.
- C: 공통 패키지로 묶어 두 플러그인이 공유. 빌드·배포가 복잡해져 개인용에 과함. 제외.
- OBS 통신 라이브러리: **`obs-websocket-js` 5.0.8**(OBS 공식 조직의 클라이언트, 인증·재요청 처리 포함) + Node 20용 `ws`.
  직접 WebSocket 프로토콜을 구현하는 것보다 짧고 안전하다. _(내 판단)_

## 구조

- 저장소 `C:\Users\user\streamdeck-obs-audio`, 플러그인 UUID `com.haeunga0822.obs-audio`,
  액션 UUID `com.haeunga0822.obs-audio.<id>`, 이름 "OBS Audio", 카테고리 "OBS Audio". _(내 판단)_
- **전역 설정**(모든 액션 PI 맨 아래 접힌 `OBS connection`): Host(기본 `127.0.0.1`), Port(기본 `4455`),
  Password(비어 있으면 인증 없음). 바꾸면 500 ms 뒤 다시 연결(SRC `plugin.ts`와 같은 디바운스).
- **ObsConnection**(SRC `connection.ts` 자리):
  - 연결 시 구독: `General | Inputs | InputVolumeMeters`.
  - 연결 직후 `GetInputList`로 입력 목록을 받고, 각 입력에 `GetInputVolume`을 보내 **성공한 것만 오디오 소스**로 친다.
    같은 방법으로 뮤트·밸런스·모니터링 상태를 처음 한 번 읽는다.
  - 이후는 이벤트로 갱신: `InputVolumeChanged`, `InputMuteStateChanged`, `InputAudioBalanceChanged`,
    `InputAudioMonitorTypeChanged`, `InputNameChanged`, `InputCreated`(오디오인지 다시 확인), `InputRemoved`,
    `InputVolumeMeters`(약 50 ms마다).
  - 연결 끊김·실패 시 3초마다 다시 시도. 끊긴 동안 모든 액션은 SRC처럼 흐리게 + `OFFLINE`.
  - 상태가 바뀌면 `onChange` 리스너 호출(SRC와 같은 방식, 한 틱에 한 번으로 묶음).
- **소스 지정**: 액션 설정에 `inputUuid`(값)와 `inputName`(표시용 마지막 이름) 저장. PI 드롭다운은
  SRC의 `getChannels` 데이터소스 방식 그대로(`getInputs`), 연결 전에는 저장된 이름만 보인다.
  소스가 사라졌으면 `N/A`, 아직 안 골랐으면 `SET SOURCE`.

## 미터와 페이더

- **미터 범위** −60 ~ 0 dB, dB에 대해 직선. 색(OBS 기본값):
  - 배경(어두운 색) 초록 `#267f26` / 노랑 `#7f7f26` / 빨강 `#7f2626`
  - 레벨(밝은 색) 초록 `#4cff4c` / 노랑 `#ffff4c` / 빨강 `#ff4c4c`
- **미터 스타일**(액션 설정, 사용자에게 "샘플/트루 피크"라는 말은 쓰지 않는다):
  - `기본` — 노랑 −20 dB, 빨강 −9 dB (OBS 샘플 피크 색 구간)
  - `넓은 초록` — 노랑 −13 dB, 빨강 −2 dB (OBS 트루 피크 색 구간)
  - PI 안내문: "OBS 설정 → 오디오 → 피크 미터 방식과 같은 쪽을 고르세요." README에는 "넓은 초록 = 트루 피크의
    색 구간, 값은 샘플 피크"라고 정확히 적는다.
- **값**: `InputVolumeMeters`의 채널별 `[magnitude×볼륨, peak×볼륨, peak]` 중 **두 번째(볼륨 적용 peak)** 를 쓴다.
  뮤트 중엔 obs-websocket이 앞의 두 값을 0으로 보내므로 **세 번째 × 현재 볼륨(mul)** 로 계산해 회색으로 계속 그린다.
- **표시 동작(OBS와 같게)**: 피크는 OBS 기본(빠름, `VOLUME_METER_DECAY_FAST`) 감쇠 23.53 dB/초로 내려가고, 피크 홀드 표시는 20초 유지.
  OBS의 감쇠 속도 설정은 websocket으로 읽을 수 없어 빠름 고정. _(내 판단)_ magnitude 표시는 생략. _(내 판단)_
- **L/R 또는 통합**(액션 설정 `채널 표시`): L/R은 채널 0·1(모노 소스는 같은 값 두 줄, 5.1은 앞 L/R만),
  통합은 모든 채널 중 가장 큰 값 한 줄.
- **뮤트 표시**: 미터·슬라이더를 OBS처럼 회색으로(배경 `#4a4a4a`/`#5a5a5a`/`#6a6a6a`, 레벨 `#bbb`, 슬라이더 채움 `#777`),
  볼륨 dB 자리에 빨간 `MUTED`. 뮤트 중 볼륨을 바꾸면 0.7초 동안 dB 값을 보여 준다(SRC `FADER_PEEK_MS`).
- **슬라이더 눈금 = OBS 슬라이더 곡선**(libobs `OBS_FADER_LOG`):
  위치 = (−log10(−dB + 6) + 2.00860017) / (−0.77815125 + 2.00860017), dB ≥ 0 → 1, dB ≤ −96 → 0.
  그래서 슬라이더 손잡이와 미터 눈금의 같은 dB 위치가 다르다(OBS도 그렇다).
- **볼륨 범위** −∞ ~ 0 dB(OBS 슬라이더와 같음). 1단계씩 내릴 때 −60 dB 아래로 가면 −∞(mul 0),
  −∞에서 올리면 −60 dB. 정한 값(복귀·Set)은 −100 ~ 0 dB로 자르고 −100 이하는 −∞. _(내 판단: 미터 바닥이 −60이라
  그 아래 36단계는 쓸모없음)_ 볼륨은 `SetInputVolume`의 `inputVolumeDb`(−∞는 `inputVolumeMul: 0`)로 보낸다.

## 이름 표시

- 이름은 사용자가 정한 표시 이름(`displayName`) → 없으면 OBS 소스 이름.
- 넘치면 "…"로 자르지 않는다. **키는 최대 3줄, 다이얼은 최대 2줄**까지 줄바꿈하고, 그래도 넘치면 글자를 줄인다
  (최소 크기에서도 넘치는 극단적 경우만 마지막 줄 끝을 자름). 줄바꿈은 공백 우선, 공백이 없으면 글자 단위.
  다이얼은 화면이 작아 2줄로 둔다. _(내 판단)_
- 글자 폭 계산과 한글 글꼴은 SRC `render/svg.ts`의 `fitSize`/`fitText`/`plainText`를 그대로 쓴다.

## 액션

| # | 액션 [장치] | 동작 | 화면 |
|---|---|---|---|
| 1 | **VU Dial** [다이얼] | 돌리기 = Step per tick(dB, 기본 1). 누르기/누른 채 왼쪽/누른 채 오른쪽 = SRC의 Press actions 그대로(`pressAction` mute·recall, `leftAction`/`rightAction` step·muteToggle·muteOn·muteOff·recall, `pressDb`/`leftDb`/`rightDb`; 누르기는 손 뗄 때·돌리지 않았을 때만). 화면 터치 = 뮤트 토글(`touchMute`, 기본 켬). | 시안 A: 이름(좌상, 2줄까지), 볼륨 dB(우상), 미터(L/R 두 줄 또는 통합 한 줄), dB 눈금, OBS 슬라이더, 아래 레벨 dB |
| 2 | **Fader(2-Button)** [키] | SRC와 같음: `role` top/bottom/left/right, 같은 소스 두 키가 한 페이더. 위/오른쪽 +Step, 아래/왼쪽 −Step, 누르고 있으면 반복(0.4초 후 0.15초마다). | 세로: 미터(왼쪽) + 세로 슬라이더 + 이름·볼륨(위 키)·레벨(아래 키). 가로: 다이얼 모양을 두 키로 나눔. 범위는 반으로 나눔(미터 −60~−30 / −30~0, 슬라이더 곡선 0~0.5 / 0.5~1). |
| 3 | **Mute** [키] | 누르면 뮤트 토글. | 이름(3줄까지), 뮤트 시 빨간 배경 + MUTED, 아래 작은 미터 |
| 4 | **Volume** [키] | 모드 `set`(정한 dB로) 또는 `step`(±dB, 누르고 있으면 반복). | 이름, 현재 볼륨 dB, 아래 작은 미터 |
| 5 | **Push to talk / Push to mute** [키] | 아래 PTT 절 | 아래 PTT 절 |
| 6 | **Audio monitoring** [키] | 모드 `set`(끄기/모니터만/모니터+출력 중 하나로) 또는 `cycle`(끄기→모니터만→모니터+출력→끄기). `SetInputAudioMonitorType`. | 이름 + 현재 모드(`OFF`/`MON`/`MON+OUT`), 끄기 아닐 때 켜진 색 |
| 7 | **Balance Dial** [다이얼] | 돌리기 = Step(%, 기본 1), 누르기 = 가운데(50%). `SetInputAudioBalance`(0.0~1.0). | 이름, 가운데 기준 막대, `L 20` / `C` / `R 20` |
| 8 | **Balance** [키] | 모드 `set`(정한 %로) 또는 `step`(±%, 반복). | 이름, 현재 값, 가운데 기준 막대 |

공통 설정: 소스, 표시 이름. 미터가 있는 액션(1~5)은 미터 스타일과 채널 표시(L/R·통합)도.
밸런스 값 표시: 0.5 → `C`, 0.3 → `L 40`(가운데에서 떨어진 정도 ×200 %), 0.8 → `R 60`. _(내 판단)_

## PTT (Push to talk / Push to mute)

- 설정 `mode`: `talk` 또는 `mute`. 설정 `releaseDelayMs`: 놓은 뒤 지연, 기본 200(OBS PTT 기본값과 같음), 0이면 바로.
- 누르는 순간 현재 뮤트 상태를 기억하고, `talk`면 뮤트 해제, `mute`면 뮤트(`SetInputMute`).
- 손을 떼면 `releaseDelayMs` 뒤에 **누르기 직전 상태로 되돌린다**. 기다리는 동안 다시 누르면 되돌리기를 취소하고
  계속 유지한다(기억한 원래 상태는 그대로 둔다).
- 안전장치:
  - 누른 중에 키가 사라지면(페이지 이동 등, `willDisappear`) 지연 없이 즉시 되돌린다.
  - 누른 중이거나 되돌리기 대기 중에 OBS 연결이 끊기면, 다시 연결되는 순간 되돌린다.
  - 멀티 액션 안에서는 키를 뗀 신호가 확실하지 않아 동작하지 않는다(SRC `hold()`와 같은 이유). _(내 판단)_
- OBS 자체 PTT 단축키를 쓰지 않는 이유: websocket으로 단축키를 실행하면 "누르고 있는 상태"를 유지할 수 없다.
- 화면: 소리가 나가는 동안 초록 배경 + 이름 + `TALK`, 막힌 동안 빨간 `MUTED`, 아래 작은 미터.

## 테스트

- SRC에서 복사한 런타임 테스트(`Redrawer`, `HoldRepeater`)가 계속 통과.
- 새 단위 테스트: OBS 슬라이더 곡선(−6 dB → 0.7553 등 libobs 값), 볼륨 단계(−60 아래 → −∞, −∞에서 위 → −60),
  미터 값 계산(뮤트 시 세 번째 값 × 볼륨, L/R·통합, 모노), 피크 감쇠·홀드, 줄바꿈(3줄/2줄, 넘치면 축소),
  렌더 SVG에 기대 색·글자 포함(기본/넓은 초록, 뮤트 회색, OFFLINE), PTT(되돌리기, 지연 중 재누름, 사라짐, 재연결),
  밸런스 표시 문자열, 가짜 OBS 클라이언트로 연결(입력 목록·오디오 필터·이벤트 반영·재연결).
- 사용자의 실제 OBS·Stream Deck + XL에서 수동 확인: 액션마다 한 번, 미터가 OBS 화면과 같은 높이로 부드럽게 움직이는지.

## 빌더 몫

- SVG 세부 좌표·글자 크기(시안 A와 SRC 좌표에서 출발).
- 플러그인 아이콘, PI 문구.
- README(설치, OBS에서 WebSocket 켜는 법: 도구 → WebSocket 서버 설정, 포트·비밀번호, 액션 목록).
