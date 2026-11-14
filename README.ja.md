# Web-Socket Audio Controller for FreecShot Plus – Stream Deck プラグイン

[한국어](README.md) | [English](README.en.md) | **日本語**

**バージョン:** 1.0.4

Elgato Stream Deck のキーとダイヤルで **FreecShot Plus** の音声ミキサーを操作するプラグインです。音量、ミュート、プッシュトゥトーク、トークバック、音声モニタリング、バランスをキー一つで操作でき、キーとダイヤルの画面にレベルメーターを表示します。

OBS 版の [Web-Socket Audio Controller](https://github.com/KimTaehan0822/streamdeck-Web-Socket-Audio-Controller/blob/main/README.ja.md) と同じ機能で、別のプラグインとしてインストールされます。両方入れると OBS と FreecShot Plus を同時に使えます(キー一つが操作するのは一つのプログラムだけです)。

## ダウンロード

[リリース](https://github.com/KimTaehan0822/streamdeck-FreecShot-Plus-Audio-Controller/releases/latest) ページから `Web-Socket-Audio-Controller-for-FreecShot-Plus-StreamDeck-v<バージョン>.zip` をダウンロードして展開します。中には次のファイルが入っています。

- `Web-Socket-Audio-Controller-for-FreecShot-Plus.streamDeckPlugin`: インストールファイル
- 取扱説明書 PDF (韓国語 / 英語 / 日本語)
- `LICENSE`: このプラグインのライセンス (MIT)
- `THIRD-PARTY-NOTICES.txt`: 使用しているオープンソースの表記

取扱説明書の元ファイルは [`docs/manual/freecshot`](docs/manual/freecshot) にあります。

## 必要なもの

- Windows 10 以降
- Stream Deck ソフトウェア 7.3 以降
- FreecShot Plus
- ダイヤルアクションには Stream Deck + が必要です。キーアクションはすべての Stream Deck で使えます。

## クイックスタート

### 1. プラグインをインストール

`Web-Socket-Audio-Controller-for-FreecShot-Plus.streamDeckPlugin` をダブルクリックし、インストールを承認します。アクション一覧に **Web-Socket Audio Controller for FreecShot Plus** カテゴリーが追加されます。

### 2. WebSocket 自動設定

FreecShot Plus には WebSocket サーバーが内蔵されていますが、最初はオフで、オンにするメニューもありません。プラグインのボタンで一度だけオンにします。

1. **FreecShot Plus を完全に終了します。**
2. どれかのアクションをキーに置いてクリックし、設定画面のいちばん下の **▸ FreecShot Plus connection (WebSocket)** を開きます。
3. Port と Password は空欄のままにします。ポートは `24455`、パスワードは FreecShot Plus にすでにあるものを使います。
4. **WebSocket auto setup**(日本語設定では **WebSocket 自動設定**)を押します。「設定しました」と出れば完了です。
5. FreecShot Plus を起動して **SOOP にログイン**します。

ボタンは変更する前に、元の設定ファイルを `config.json.bak-日付-時刻` としてバックアップします(場所: `%APPDATA%\SOOPStudio\plugin_config\obs-websocket\`)。

### 3. 最初のキーを作る

**Mute** をキーに置き、**Source** でマイクなどの音声ソースを選びます。ミュート中は赤い枠と薄い赤の背景になります。

## メーター範囲

設定画面のいちばん下の **▸ Meter range**(日本語設定では**メーター範囲**)を開き、**Start**(開始点)でメーターが始まる値を **-60 / -50 / -40 / -30 dB** から選びます。初期値は -60 dB です。選ぶとすぐに VU Dial、Fader(2-Button)、Volume キーのメーターがすべて変わります。たとえば -40 を選ぶと -40 〜 0 dB だけが広く表示され、話し声の範囲が見やすくなります。変わるのは表示の範囲だけで音量の調整範囲はそのままです。開始点より小さい音はメーターの端に表示されます。

## キーに表示される文字

| 表示 | 意味 | すること |
| --- | --- | --- |
| **LOGIN** (ログイン待ち) | 接続はできたが SOOP にまだログインしていない | FreecShot Plus で SOOP にログイン |
| **OFFLINE** (オフライン) | FreecShot Plus に接続していない | FreecShot Plus が起動しているか、自動設定をしたか確認 |
| **SET SOURCE** (ソース選択) | ソースをまだ選んでいない | 設定画面で Source を選ぶ |
| **SETUP** (設定) | ほかの必須設定が空欄 | Mode と値を入力 |
| **N/A** | 選んだソースが FreecShot Plus にない | 別のソースを選ぶ |

各アクションの詳しい設定は PDF 取扱説明書をご覧ください。機能は OBS 版と同じなので、[OBS 版 README](https://github.com/KimTaehan0822/streamdeck-Web-Socket-Audio-Controller/blob/main/README.ja.md) のアクション一覧も参考になります。

## トラブルシューティング

- **ずっと OFFLINE のまま:** FreecShot Plus を終了した状態で自動設定をもう一度押し、結果の文を確認してください。エラーはプラグインのログ(`%appdata%\Elgato\StreamDeck\Plugins\com.haeunga0822.freecshot-audio.sdPlugin\logs`)に残ります。
- **「ほかのプログラムがこのポートを使っています」:** Port に別の数字(1024〜65535)を入れてもう一度押してください。
- **元に戻す:** FreecShot Plus を終了し、設定フォルダーの `config.json.bak-…` を `config.json` として戻してください。

## ライセンスと表記

このプラグインは [MIT ライセンス](LICENSE) で配布しています。使用しているオープンソースのライセンスは `THIRD-PARTY-NOTICES.txt` にあります。FreecShot Plus および SOOP は各社の商標です。このプラグインは SOOP とは関係のない非公式プラグインです。
