# Web-Socket Audio Controller for FreecShot Plus – Stream Deck 플러그인

**한국어** | [English](README.en.md) | [日本語](README.ja.md)

Elgato Stream Deck의 키와 다이얼로 **프릭샷플러스(FreecShot Plus)** 오디오 믹서를 조작하는 플러그인입니다. 볼륨, 뮤트, Push to talk, 토크백, 오디오 모니터링, 밸런스를 키 하나로 다루고, 키와 다이얼 화면에서 레벨 미터를 볼 수 있습니다.

OBS용 [Web-Socket Audio Controller](../../README.md)와 같은 기능이고, 따로 설치되는 별개의 플러그인입니다. 두 개를 함께 설치하면 OBS와 프릭샷플러스를 동시에 쓸 수 있습니다(키 하나는 한 프로그램만 조작합니다).

## 다운로드

[릴리즈](https://github.com/KimTaehan0822/streamdeck-Web-Socket-Audio-Controller/releases) 페이지에서 `Web-Socket-Audio-Controller-for-FreecShot-Plus-StreamDeck-v<버전>.zip`을 받아 압축을 풉니다. 안에 들어 있는 파일은 아래와 같습니다.

- `Web-Socket-Audio-Controller-for-FreecShot-Plus.streamDeckPlugin`: 설치 파일
- 사용설명서 PDF (한국어 / English / 日本語)
- `LICENSE`: 이 플러그인의 라이선스 (MIT)
- `THIRD-PARTY-NOTICES.txt`: 사용한 오픈소스 고지

사용설명서 원본은 이 저장소의 [`docs/manual/freecshot`](../manual/freecshot) 폴더에 있습니다.

## 필요한 것

- Windows 10 이상
- Stream Deck 소프트웨어 7.3 이상
- 프릭샷플러스(FreecShot Plus)
- 다이얼 액션은 Stream Deck +가 필요합니다. 키 액션은 모든 스트림덱에서 쓸 수 있습니다.

## 빠른 시작

### 1. 플러그인 설치

`Web-Socket-Audio-Controller-for-FreecShot-Plus.streamDeckPlugin`을 더블클릭하고, 스트림덱 프로그램이 설치를 물으면 승인합니다. 액션 목록에 **Web-Socket Audio Controller for FreecShot Plus** 카테고리가 생깁니다.

### 2. WebSocket 자동 설정

프릭샷플러스에는 WebSocket 기능이 들어 있지만 처음에는 꺼져 있고, 켜는 메뉴가 화면에 없습니다. 플러그인의 버튼으로 한 번만 켜면 됩니다.

1. **프릭샷플러스를 완전히 끕니다.**
2. 아무 액션이나 키에 놓고 클릭한 뒤, 설정 화면 맨 아래 **▸ FreecShot Plus connection (WebSocket)**을 펼칩니다.
3. Port와 Password는 비워 둡니다. 비우면 포트는 `24455`, 비밀번호는 프릭샷플러스에 이미 있는 것을 씁니다.
4. **WebSocket auto setup**(한국어 설정이면 **WebSocket 자동 설정**)을 누릅니다. "설정했습니다"가 뜨면 끝입니다.
5. 프릭샷플러스를 켜고 **SOOP에 로그인**합니다.

버튼은 바꾸기 전에 원래 설정 파일을 `config.json.bak-날짜-시각`으로 백업합니다(위치: `%APPDATA%\SOOPStudio\plugin_config\obs-websocket\`).

### 3. 첫 키 만들기

**Mute**를 키에 놓고 **Source**에서 마이크 같은 오디오 소스를 고릅니다. 음소거 중에는 빨간 테두리와 옅은 빨간 바탕이 생깁니다.

## 키에 뜨는 표시

| 표시 | 뜻 | 할 일 |
| --- | --- | --- |
| **LOGIN** (로그인 대기) | 연결은 됐지만 SOOP 로그인 전 | 프릭샷플러스에서 SOOP에 로그인 |
| **OFFLINE** (오프라인) | 프릭샷플러스에 연결되지 않음 | 프릭샷플러스가 켜져 있는지, 자동 설정을 했는지 확인 |
| **SET SOURCE** (소스 선택) | 소스를 아직 안 고름 | 설정 화면에서 Source 선택 |
| **SETUP** (설정) | 다른 필수 설정이 비어 있음 | Mode와 값 입력 |
| **N/A** | 고른 소스가 프릭샷플러스에 없음 | 다른 소스 선택 |

액션별 자세한 설정은 PDF 사용설명서를 보세요. 기능은 OBS용과 같으니 [OBS용 README](../../README.md)의 액션 목록도 참고할 수 있습니다.

## 문제 해결

- **계속 OFFLINE:** 프릭샷플러스를 끈 상태에서 자동 설정을 다시 누르고, 결과 문구를 확인하세요. 오류는 플러그인 로그(`%appdata%\Elgato\StreamDeck\Plugins\com.haeunga0822.freecshot-audio.sdPlugin\logs`)에 남습니다.
- **"다른 프로그램이 이 포트를 쓰고 있습니다":** Port에 다른 숫자(1024–65535)를 넣고 다시 누르세요.
- **원래대로 되돌리기:** 프릭샷플러스를 끄고, 설정 폴더의 `config.json.bak-…` 파일을 `config.json`으로 바꿔 넣으세요.

## 라이선스와 고지

이 플러그인은 [MIT 라이선스](../../LICENSE)로 배포합니다. 사용한 오픈소스의 라이선스는 `THIRD-PARTY-NOTICES.txt`에 있습니다. FreecShot Plus(프릭샷플러스)와 SOOP은 해당 회사의 상표입니다. 이 플러그인은 SOOP과 관계없는 비공식 플러그인입니다.
