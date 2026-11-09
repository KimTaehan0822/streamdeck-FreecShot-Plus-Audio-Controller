# Web-Socket Audio Controller – Stream Deck Plugin

[한국어](README.md) | **English** | [日本語](README.ja.md)

Control the **OBS audio mixer** with the keys and dials of an Elgato Stream Deck. Volume, mute, push to talk, talkback, audio monitoring and balance are one key away, and the keys and dial screens show level meters that look like the ones in OBS. The plugin talks to OBS directly over its built-in **obs-websocket**, so no other program is needed.

## Download

Get `Web-Socket-Audio-Controller-StreamDeck-v<version>.zip` from the [latest release](https://github.com/KimTaehan0822/streamdeck-Web-Socket-Audio-Controller/releases/latest) page and unzip it. It contains:

- `Web-Socket-Audio-Controller.streamDeckPlugin`: the installer
- The manual as PDF (one per language)
  - `Web-Socket Audio Controller 스트림덱 플러그인 사용설명서.pdf`: Korean
  - `Web-Socket Audio Controller Stream Deck Plugin Manual (English).pdf`: English
  - `Web-Socket Audio Controller Stream Deck プラグイン 取扱説明書 (日本語).pdf`: Japanese
- `LICENSE`: this plugin's license (MIT)
- `THIRD-PARTY-NOTICES.txt`: notices for the open-source software used

The manual sources are in the [`docs/manual`](docs/manual) folder of this repository.

## Requirements

- Windows 10 or later
- Stream Deck software 7.3 or later
- **OBS Studio 30 or later** (includes obs-websocket 5)
- The dial actions need a Stream Deck +. The key actions work on every Stream Deck.

## Quick start

### 1. Install the plugin

Double-click `Web-Socket-Audio-Controller.streamDeckPlugin` and approve when the Stream Deck software asks to install it. The **Web-Socket Audio Controller** category appears in the action list.

### 2. Turn on WebSocket in OBS

1. Open **Tools → WebSocket Server Settings** in OBS.
2. Turn on **Enable WebSocket server**.
3. Check the server port (default `4455`). If **Enable Authentication** is on, click **Show Connect Info** to see the password.

### 3. Make your first key

1. Drag **Mute** from **Web-Socket Audio Controller** in the action list onto a key.
2. Pick an audio source such as your microphone in **Source** on the settings screen. Sources without audio (images, browsers and so on) are not listed.
3. If authentication is on in OBS, enter the password under "Connection" below.

## Connection

Select any action and unfold **▸ OBS connection (WebSocket)** at the bottom of the settings screen. All actions share these settings.

| Field | Default |
| --- | --- |
| Host | `127.0.0.1` (OBS on the same PC) |
| Port | `4455` |
| Password | empty (authentication off in OBS) |

Changes reconnect right away. While OBS is not running the keys show **OFFLINE**, and the plugin retries every 3 seconds.

## Language

Unfold **▸ Language** at the bottom of the settings screen and pick **English / 한국어 / 日本語**. The settings screen and the text on the keys (MUTED, OFFLINE and so on) change at once, for every action. The default is English. Action names in the action list do not change.

## Actions

**Keys**

| Action | What it does |
| --- | --- |
| Mute | Mute on/off. Red while muted |
| Fader(2-Button) | Raise/lower the volume with two keys (top + bottom or left + right), with a level meter across both keys |
| Volume | Set the volume to a value or move it by an amount. Shows a level meter |
| Push to talk / Push to mute | Sound goes out or is blocked only while held; on release it goes back to how it was before the press |
| Talkback | Mutes or lowers other sources at once; release (or press again) to put them back |
| Audio monitoring | Switch audio monitoring between off / monitor only / monitor and output |
| Balance | Set the balance to a value or move it by an amount |

**Dials (Stream Deck +)**

| Action | Turn | Press |
| --- | --- | --- |
| VU Dial | Volume, with a level meter | Mute (configurable) |
| Balance Dial | Balance | Centre |

On VU Dial, **▸ Press actions** on the settings screen lets you pick other actions (mute on/off, recall a set volume and so on) for pressing and for turning left or right while pressed.

The Mute, Push to talk / Push to mute, Talkback and Audio monitoring keys can have their own icon and title for ON and OFF. Rename a source on the keys with **Display name**.

See the PDF manual for every action's options.

## Signs on the keys

| Sign | Meaning | What to do |
| --- | --- | --- |
| **OFFLINE** | Not connected to OBS | Start OBS, enable the WebSocket server, check the port and password |
| **SET SOURCE** | No source chosen yet | Pick a Source on the settings screen |
| **SETUP** | Another required setting is empty | Enter the Mode and value on the settings screen |
| **N/A** | The chosen source is not in OBS (deleted) | Pick another source |

## Troubleshooting

- **It stays OFFLINE:** in OBS **Tools → WebSocket Server Settings**, check that the server is on and that the port and password match the plugin's settings. Errors are written to the plugin log (`%appdata%\Elgato\StreamDeck\Plugins\com.haeunga0822.obs-audio.sdPlugin\logs`).
- **The level meter does not move:** check in the OBS audio mixer that the source actually receives audio.
- **Still quiet after turning Talkback off:** deleting a key while its Toggle is on leaves the sources lowered. Restore the volume in OBS, and turn the key off before deleting it next time.
- **It keeps repeating although I let go:** press that key once more to stop it.

## Building it yourself

```bash
npm install
npm test
npm run pack
```

`npm run pack` creates the `.streamDeckPlugin` file.

## License and notices

This plugin is released under the [MIT License](LICENSE). The licences of the open-source software this plugin uses are in `THIRD-PARTY-NOTICES.txt`. OBS and OBS Studio are trademarks of the OBS Project. This plugin is an unofficial project, not affiliated with the OBS Project.
