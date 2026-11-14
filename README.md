# Web-Socket Audio Controller – Stream Deck 플러그인

**한국어** | [English](README.en.md) | [日本語](README.ja.md)

Elgato Stream Deck의 키와 다이얼로 **OBS 오디오 믹서**를 조작하는 플러그인입니다. 볼륨, 뮤트, Push to talk, 토크백, 오디오 모니터링, 밸런스를 키 하나로 다루고, 키와 다이얼 화면에서 OBS와 같은 모양의 레벨 미터를 볼 수 있습니다. OBS에 들어 있는 **obs-websocket**으로 직접 통신하므로 다른 프로그램은 필요 없습니다.

## 다운로드

[최신 릴리즈](https://github.com/KimTaehan0822/streamdeck-Web-Socket-Audio-Controller/releases/latest) 페이지에서 `Web-Socket-Audio-Controller-StreamDeck-v<버전>.zip`을 받아 압축을 풉니다. 안에 들어 있는 파일은 아래와 같습니다.

- `Web-Socket-Audio-Controller.streamDeckPlugin`: 설치 파일
- 사용설명서 PDF (언어별로 하나씩)
  - `Web-Socket Audio Controller 스트림덱 플러그인 사용설명서.pdf`: 한국어
  - `Web-Socket Audio Controller Stream Deck Plugin Manual (English).pdf`: 영어
  - `Web-Socket Audio Controller Stream Deck プラグイン 取扱説明書 (日本語).pdf`: 일본어
- `LICENSE`: 이 플러그인의 라이선스 (MIT)
- `THIRD-PARTY-NOTICES.txt`: 함께 쓰인 오픈소스 고지

사용설명서 원본은 이 저장소의 [`docs/manual`](docs/manual) 폴더에 있습니다.

## 필요한 것

- Windows 10 이상
- Stream Deck 소프트웨어 7.3 이상
- **OBS Studio 30 이상** (obs-websocket 5 내장)
- 다이얼 액션을 쓰려면 Stream Deck +가 필요합니다. 키 액션은 모든 Stream Deck에서 쓸 수 있습니다.

## 빠른 시작

### 1. 플러그인 설치

`Web-Socket-Audio-Controller.streamDeckPlugin`을 더블클릭하고, Stream Deck 소프트웨어가 설치할지 물으면 승인합니다. 액션 목록에 **Web-Socket Audio Controller** 카테고리가 생깁니다.

### 2. OBS에서 WebSocket 켜기

1. OBS 메뉴 **도구 → WebSocket 서버 설정**을 엽니다.
2. **WebSocket 서버 활성화**를 켭니다.
3. 서버 포트(기본 `4455`)를 확인합니다. **인증 사용**이 켜져 있으면 **연결 정보 표시**를 눌러 비밀번호를 확인합니다.

### 3. 첫 키 만들기

1. 액션 목록의 **Web-Socket Audio Controller**에서 **Mute**를 키에 끌어다 놓습니다.
2. 설정 화면의 **Source**에서 마이크 같은 오디오 소스를 고릅니다. 소리가 없는 소스(이미지, 브라우저 등)는 목록에 나오지 않습니다.
3. OBS에서 인증을 켰다면 아래 "연결 설정"에서 비밀번호를 넣습니다.

## 연결 설정

아무 액션이나 고른 뒤 설정 화면 맨 아래의 **▸ OBS connection (WebSocket)** 을 펼칩니다. 이 설정은 모든 액션이 함께 씁니다.

| 항목 | 기본값 |
| --- | --- |
| Host | `127.0.0.1` (OBS가 같은 PC에 있을 때) |
| Port | `4455` |
| Password | 비어 있음 (OBS에서 인증을 끈 경우) |

바꾸면 바로 다시 연결합니다. OBS가 꺼져 있으면 키에 **OFFLINE**이 뜨고, 3초마다 다시 연결을 시도합니다.

## 언어

설정 화면 맨 아래의 **▸ Language**를 펼쳐 **English / 한국어 / 日本語** 중에서 고릅니다. 고르는 즉시 설정 화면의 글자와 키에 뜨는 글자(MUTED, OFFLINE 등)가 함께 바뀌고, 모든 액션에 똑같이 적용됩니다. 처음 값은 English입니다. 액션 목록의 이름은 바뀌지 않습니다.

## 미터 범위

설정 화면 맨 아래의 **▸ Meter range**(한국어 설정에서는 **미터 범위**)를 펼쳐 **Start**(시작점)에서 미터가 시작하는 값을 **-60 / -50 / -40 / -30 dB** 중에서 고릅니다. 처음 값은 -60 dB(OBS와 같음)입니다. 고르는 즉시 VU Dial, Fader(2-Button), Volume 키의 미터가 모두 바뀝니다. 예를 들어 -40을 고르면 -40 ~ 0 dB만 넓게 보여서, 말소리 구간을 보기 쉬워집니다. 화면에 보이는 범위만 바뀌고 볼륨 조절 범위는 그대로이며, 시작점보다 작은 소리는 미터 맨 끝에 붙습니다.

## 액션 목록

**키**

| 액션 | 하는 일 |
| --- | --- |
| Mute | 뮤트 켜기/끄기. 뮤트 중에는 빨간 배경 |
| Fader(2-Button) | 키 두 개(위+아래 또는 왼쪽+오른쪽)로 볼륨 올리기/내리기. 두 키에 걸쳐 레벨 미터 표시 |
| Volume | 볼륨을 정한 값으로 맞추거나 정한 만큼 올리기/내리기. 레벨 미터 표시 |
| Push to talk / Push to mute | 누르고 있는 동안만 소리가 나가거나 막힘. 손을 떼면 누르기 전 상태로 |
| Talkback | 다른 소스들을 한꺼번에 음소거하거나 줄이고, 떼면(또는 다시 누르면) 원래대로 |
| Audio monitoring | 오디오 모니터링을 끔 / 모니터만 / 모니터와 출력 중 하나로 바꾸기 |
| Balance | 좌우 밸런스를 정한 값으로 맞추거나 정한 만큼 이동 |

**다이얼 (Stream Deck +)**

| 액션 | 돌리면 | 누르면 |
| --- | --- | --- |
| VU Dial | 볼륨 조절, 레벨 미터 표시 | 뮤트 (바꿀 수 있음) |
| Balance Dial | 좌우 밸런스 조절 | 가운데로 |

VU Dial은 설정 화면의 **▸ Press actions**에서 누르기와 누른 채 왼쪽·오른쪽으로 돌리기에 다른 동작(뮤트 켜기/끄기, 정한 볼륨으로 복귀 등)을 고를 수 있습니다.

Mute, Push to talk / Push to mute, Talkback, Audio monitoring 키는 ON/OFF 상태마다 아이콘과 제목을 따로 정할 수 있습니다. 소스 이름은 **Display name**으로 바꿀 수 있습니다.

각 액션의 자세한 옵션은 함께 들어 있는 PDF 사용설명서를 보세요.

## 키에 뜨는 표시

| 표시 | 뜻 | 할 일 |
| --- | --- | --- |
| **OFFLINE** | OBS에 연결되지 않음 | OBS 실행, WebSocket 서버 켜기, 포트·비밀번호 확인 |
| **SET SOURCE** | 소스를 아직 고르지 않음 | 설정 화면에서 Source 선택 |
| **SETUP** | 다른 필수 설정이 비어 있음 | 설정 화면에서 Mode·값 입력 |
| **N/A** | 고른 소스가 OBS에 없음(삭제됨) | 다른 소스를 고르세요 |

언어를 한국어로 고르면 OFFLINE은 **오프라인**, SET SOURCE는 **소스 선택**, SETUP은 **설정**으로 뜹니다.

## 문제 해결

- **계속 OFFLINE이에요:** OBS의 **도구 → WebSocket 서버 설정**에서 서버가 켜져 있는지, 포트와 비밀번호가 플러그인 설정과 같은지 확인하세요. 오류 내용은 플러그인 로그(`%appdata%\Elgato\StreamDeck\Plugins\com.haeunga0822.obs-audio.sdPlugin\logs`)에 남습니다.
- **레벨 미터가 움직이지 않아요:** 그 소스에 실제로 소리가 들어오는지 OBS 오디오 믹서에서 확인하세요.
- **토크백을 껐는데 소리가 작아요:** 토글이 켜진 채 키를 지우면 소스가 줄어든 채 남습니다. OBS에서 볼륨을 직접 되돌리고, 다음부터는 끄고 나서 지우세요.
- **키를 누르고 있지 않은데 계속 반복돼요:** 그 키를 한 번 더 누르면 멈춥니다.

## 직접 빌드하기

```bash
npm install
npm test
npm run pack
```

`npm run pack`을 실행하면 `.streamDeckPlugin` 파일이 만들어집니다.

## 라이선스와 고지

이 플러그인은 [MIT 라이선스](LICENSE)로 배포됩니다. 이 플러그인이 사용하는 오픈소스의 라이선스는 `THIRD-PARTY-NOTICES.txt`에 있습니다. OBS와 OBS Studio는 OBS Project의 상표이며, 이 플러그인은 OBS Project와 관계없는 비공식 프로젝트입니다.
