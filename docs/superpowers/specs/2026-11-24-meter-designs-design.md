# 레벨미터 디자인 고르기 (짧은 설계)

## 왜

TotalMix·TOPPING 플러그인처럼 OBS용(과 프릭샷플러스용) 플러그인에서도 레벨미터 모양을 설정 화면에서 고르게 한다. TotalMix 설계(`streamdeck-rme-totalmix/docs/superpowers/specs/2026-11-16-meter-designs-design.md`)의 2단계다.

## 결정 (사용자)

- 목록: **플러그인 기본(지금 모양)** / **Mix Studio Classic** / **Mix Studio Modern** / **Topping on Plate** / **Big number** / **VU Needle Drop**. On Air·On Air Wide는 이 플러그인의 기본 모양과 겹쳐서 넣지 않는다.
- 방법 A: TotalMix를 원본으로 삼아 공용 디자인 폴더(`src/render/meters/`)와 Classic·Modern 코드를 복사해 OBS에 맞춘다.
- VU는 OBS가 보내는 **RMS(magnitude)** 를 그대로 쓴다. 피크 보정 칸은 두지 않는다.
- 기존 **Meter style**(Standard / Wide green, 키마다)과 **미터 범위**(시작점, 전체)는 **플러그인 기본 디자인에만** 적용한다. 다른 디자인을 고르면 두 칸을 숨긴다.

## 확인한 사실

- obs-websocket `InputVolumeMeters`는 채널마다 `[magnitude×볼륨, peak×볼륨, peak]`(배수 값)을 보낸다. magnitude는 OBS·obs-websocket 모두 소리 조각(block)마다 `sqrt(제곱 평균)`으로 구하는 진짜 RMS다. 지금 플러그인은 peak만 쓴다.
- TotalMix의 VU 디자인은 바늘을 약 300ms 평균으로 움직이고, 피크 보정(`vuPeakOffset`)은 TotalMix가 피크만 보내서 생긴 것이다.

## 동작

- 모든 키의 설정 화면에 접힌 칸 **Meter design**(한국어 "미터 디자인", 일본어 "メーターデザイン")을 둔다. 전역 설정이다.
  - **Dials** (`meterStyle`, 기본 `plugin`): 위 목록.
  - **Buttons** (`meterStyleKey`, 기본 `same` = 다이얼과 같게) + 같은 목록.
  - VU를 고르면 **VU 0 VU reference** (`vuReference`: -14 / -18 / -20 dBFS, 기본 -18) 칸만 나온다.
  - 이름과 한국어·일본어 번역은 TotalMix 목록 것을 그대로 쓴다.
- 적용 대상: VU Dial(다이얼 줄), Fader(2-Button)(버튼 둘), Volume 키(버튼).
- 저장된 값이 없거나 모르는 값(예: `obs`, `obs-wide`)이면 플러그인 기본.
- 디자인을 바꾸면 OBS 연결은 그대로 두고 모든 키를 바로 다시 그린다(언어·미터 범위와 같은 방식).

## OBS에 맞춘 손질 (내 결정)

- **미터 값:** VU 디자인에는 RMS(dB)를, 나머지 디자인에는 지금처럼 peak(dB)를 넘긴다. 음소거 중에는 지금처럼 입력 peak×볼륨으로 회색 미터가 움직이게 둔다(RMS도 같은 방식으로 입력 값에서 구할 수 없으면, 음소거 중 VU 바늘은 0으로 둔다).
- **페이더 위치:** OBS 볼륨(dB, -∞ ~ 0)을 넘긴다. 디자인의 페이더 눈금이 0 dB보다 위까지 있으면(TotalMix의 +6 dB 등) OBS 최대값 0 dB에서 멈춘다.
- **피크 홀드:** 공용 디자인에는 피크 홀드가 없다. 플러그인 기본 디자인에서만 지금처럼 보인다.
- **덮개 표시**(OFFLINE, SET SOURCE, SETUP, N/A)와 언어별 글자는 모든 디자인에서 그대로 나온다(공용 폴더는 이 플러그인의 `svg.ts` `frame`을 쓴다).
- **VU 바늘:** TotalMix `base-action.ts`처럼 바늘이 움직이는 동안 다시 그리기를 이어 간다.
- **Classic·Modern:** TotalMix에서는 공용 폴더 밖(`src/render/meter.ts`)에 있다. 공용 폴더의 `MeterDesign` 형식(strip / pair / key)으로 옮겨 온다.
- **프릭샷플러스용:** 같은 코드로 함께 들어간다. 프릭샷플러스가 magnitude를 OBS와 같게 보내는지는 구현할 때 실제 값으로 확인하고, 다르면 사용자에게 알린다.

## 하지 않을 것

- On Air / On Air Wide, TotalMix "Plugin (default)" 모양.
- 플러그인끼리 쓰는 공용 패키지로 빼기.
- 키마다 다른 디자인(전역 설정만).
- 피크 보정 칸.

## 문서

- README와 설명서(한·영·일)에 미터 디자인 칸 설명을 넣는다. 버전은 릴리즈 때 맞춘다.
