# Web-Socket Audio Controller – Stream Deck プラグイン

[한국어](README.md) | [English](README.en.md) | **日本語**

**バージョン:** 1.0.3

Elgato Stream Deck のキーとダイヤルで **OBS の音声ミキサー**を操作するプラグインです。音量、ミュート、プッシュトゥトーク、トークバック、音声モニタリング、バランスをキー一つで操作でき、キーとダイヤルの画面に OBS と同じ見た目のレベルメーターを表示します。OBS に内蔵された **obs-websocket** で直接通信するので、ほかのプログラムは必要ありません。

## ダウンロード

[最新リリース](https://github.com/KimTaehan0822/streamdeck-Web-Socket-Audio-Controller/releases/latest) ページから `Web-Socket-Audio-Controller-StreamDeck-v<バージョン>.zip` をダウンロードして展開します。中には次のファイルが入っています。

- `Web-Socket-Audio-Controller.streamDeckPlugin`: インストールファイル
- 取扱説明書 PDF (言語ごとに一つ)
  - `Web-Socket Audio Controller 스트림덱 플러그인 사용설명서.pdf`: 韓国語
  - `Web-Socket Audio Controller Stream Deck Plugin Manual (English).pdf`: 英語
  - `Web-Socket Audio Controller Stream Deck プラグイン 取扱説明書 (日本語).pdf`: 日本語
- `LICENSE`: このプラグインのライセンス (MIT)
- `THIRD-PARTY-NOTICES.txt`: 使用しているオープンソースの表記

取扱説明書の元ファイルは、このリポジトリの [`docs/manual`](docs/manual) フォルダーにあります。

## 必要なもの

- Windows 10 以降
- Stream Deck ソフトウェア 7.3 以降
- **OBS Studio 30 以降** (obs-websocket 5 を内蔵)
- ダイヤルアクションには Stream Deck + が必要です。キーアクションはすべての Stream Deck で使えます。

## クイックスタート

### 1. プラグインをインストール

`Web-Socket-Audio-Controller.streamDeckPlugin` をダブルクリックし、Stream Deck ソフトウェアがインストールを確認したら承認します。アクション一覧に **Web-Socket Audio Controller** カテゴリーが追加されます。

### 2. OBS で WebSocket をオンにする

1. OBS のメニュー **ツール → WebSocket サーバー設定**を開きます。
2. **WebSocket サーバーを有効にする**をオンにします。
3. サーバーポート(初期値 `4455`)を確認します。**認証を有効にする**がオンなら、**接続情報を表示**を押してパスワードを確認します。

### 3. 最初のキーを作る

1. アクション一覧の **Web-Socket Audio Controller** から **Mute** をキーにドラッグします。
2. 設定画面の **Source** でマイクなどの音声ソースを選びます。音声のないソース(画像、ブラウザなど)は一覧に出ません。
3. OBS で認証をオンにしている場合は、下の「接続設定」でパスワードを入力します。

## 接続設定

どれかのアクションを選び、設定画面のいちばん下の **▸ OBS connection (WebSocket)** を開きます。この設定はすべてのアクションで共通です。

| 項目 | 初期値 |
| --- | --- |
| Host | `127.0.0.1` (OBS が同じパソコンにある場合) |
| Port | `4455` |
| Password | 空欄 (OBS で認証をオフにしている場合) |

変更するとすぐに再接続します。OBS が起動していないとキーに **OFFLINE** と表示され、3秒ごとに再接続を試みます。

## 言語

設定画面のいちばん下の **▸ Language** を開き、**English / 한국어 / 日本語** から選びます。選ぶとすぐに設定画面の文字とキーの文字(MUTED、OFFLINE など)が切り替わり、すべてのアクションに適用されます。初期値は English です。アクション一覧の名前は変わりません。

## メーター範囲

設定画面のいちばん下の **▸ Meter range**(日本語設定では**メーター範囲**)を開き、**Start**(開始点)でメーターが始まる値を **-60 / -50 / -40 / -30 dB** から選びます。初期値は -60 dB(OBS と同じ)です。選ぶとすぐに VU Dial、Fader(2-Button)、Volume キーのメーターがすべて変わります。たとえば -40 を選ぶと -40 〜 0 dB だけが広く表示され、話し声の範囲が見やすくなります。変わるのは表示の範囲だけで音量の調整範囲はそのままです。開始点より小さい音はメーターの端に表示されます。

## アクション一覧

**キー**

| アクション | できること |
| --- | --- |
| Mute | ミュートのオン・オフ。ミュート中は赤い背景 |
| Fader(2-Button) | キー2つ(上+下 または 左+右)で音量を上げ下げ。2つのキーにまたがってレベルメーターを表示 |
| Volume | 音量を指定値にするか、指定量だけ上げ下げ。レベルメーターを表示 |
| Push to talk / Push to mute | 押している間だけ音が出る、または止まる。離すと押す前の状態に戻る |
| Talkback | ほかのソースをまとめてミュートまたは下げ、離す(またはもう一度押す)と元に戻す |
| Audio monitoring | 音声モニタリングをオフ / モニターのみ / モニターと出力 に切り替え |
| Balance | 左右バランスを指定値にするか、指定量だけ動かす |

**ダイヤル (Stream Deck +)**

| アクション | 回すと | 押すと |
| --- | --- | --- |
| VU Dial | 音量調整、レベルメーター表示 | ミュート (変更可) |
| Balance Dial | 左右バランス調整 | 中央に戻す |

VU Dial は設定画面の **▸ Press actions** で、押したときと押したまま左右に回したときの動作(ミュートのオン・オフ、指定音量に戻すなど)を選べます。

Mute、Push to talk / Push to mute、Talkback、Audio monitoring のキーは、オンとオフでアイコンとタイトルを別々に設定できます。キーに出るソース名は **Display name** で変えられます。

各アクションの詳しい設定は、同梱の PDF 取扱説明書をご覧ください。

## キーに表示される文字

| 表示 | 意味 | すること |
| --- | --- | --- |
| **OFFLINE** | OBS に接続していない | OBS の起動、WebSocket サーバーの有効化、ポートとパスワードを確認 |
| **SET SOURCE** | ソースをまだ選んでいない | 設定画面で Source を選ぶ |
| **SETUP** | ほかの必須設定が空欄 | 設定画面で Mode と値を入力 |
| **N/A** | 選んだソースが OBS にない(削除された) | 別のソースを選ぶ |

言語を日本語にすると、OFFLINE は**オフライン**、SET SOURCE は**ソース選択**、SETUP は**設定**と表示されます。

## トラブルシューティング

- **ずっと OFFLINE のまま:** OBS の **ツール → WebSocket サーバー設定**でサーバーがオンか、ポートとパスワードがプラグインの設定と同じか確認してください。エラーはプラグインのログ(`%appdata%\Elgato\StreamDeck\Plugins\com.haeunga0822.obs-audio.sdPlugin\logs`)に残ります。
- **レベルメーターが動かない:** そのソースに実際に音が入っているか、OBS の音声ミキサーで確認してください。
- **トークバックをオフにしても音が小さい:** Toggle がオンのままキーを削除すると、ソースが下がったまま残ります。OBS で音量を直接戻し、次からはオフにしてから削除してください。
- **キーを押していないのに繰り返し続ける:** そのキーをもう一度押すと止まります。

## 自分でビルドする

```bash
npm install
npm test
npm run pack
```

`npm run pack` を実行すると `.streamDeckPlugin` ファイルが作られます。

## ライセンスと表記

このプラグインは [MIT ライセンス](LICENSE) で配布しています。このプラグインが使用しているオープンソースのライセンスは `THIRD-PARTY-NOTICES.txt` にあります。OBS および OBS Studio は OBS Project の商標です。このプラグインは OBS Project とは関係のない非公式プロジェクトです。
