# Web-Socket Audio Controller for FreecShot Plus – Stream Deck Plugin

[한국어](README.md) | **English** | [日本語](README.ja.md)

Control the **FreecShot Plus** audio mixer with the keys and dials of an Elgato Stream Deck. Volume, mute, push to talk, talkback, audio monitoring and balance are one key away, and the keys and dial screens show level meters.

It has the same features as the OBS edition, [Web-Socket Audio Controller](../../README.en.md), and installs as a separate plugin. Install both to use OBS and FreecShot Plus at the same time (each key controls one program).

## Download

Get `Web-Socket-Audio-Controller-for-FreecShot-Plus-StreamDeck-v<version>.zip` from the [releases](https://github.com/KimTaehan0822/streamdeck-Web-Socket-Audio-Controller/releases) page and unzip it. It contains:

- `Web-Socket-Audio-Controller-for-FreecShot-Plus.streamDeckPlugin`: the installer
- The manual as PDF (Korean / English / Japanese)
- `LICENSE`: this plugin's license (MIT)
- `THIRD-PARTY-NOTICES.txt`: notices for the open-source software used

The manual sources are in [`docs/manual/freecshot`](../manual/freecshot).

## Requirements

- Windows 10 or later
- Stream Deck software 7.3 or later
- FreecShot Plus
- The dial actions need a Stream Deck +. The key actions work on every Stream Deck.

## Quick start

### 1. Install the plugin

Double-click `Web-Socket-Audio-Controller-for-FreecShot-Plus.streamDeckPlugin` and approve the install. The **Web-Socket Audio Controller for FreecShot Plus** category appears in the action list.

### 2. WebSocket auto setup

FreecShot Plus has a WebSocket server built in, but it is off and there is no menu to turn it on. The plugin's button turns it on once.

1. **Close FreecShot Plus completely.**
2. Put any action on a key, click it, and unfold **▸ FreecShot Plus connection (WebSocket)** at the bottom of the settings screen.
3. Leave Port and Password empty: the port becomes `24455` and the password stays the one FreecShot Plus already has.
4. Press **WebSocket auto setup**. When it says Done, you are set.
5. Start FreecShot Plus and **sign in to SOOP**.

Before changing anything, the button backs up the original file as `config.json.bak-date-time` (in `%APPDATA%\SOOPStudio\plugin_config\obs-websocket\`).

### 3. Make your first key

Put **Mute** on a key and pick an audio source such as your microphone in **Source**. While muted, the key gets a red frame and a faint red tint.

## Signs on the keys

| Sign | Meaning | What to do |
| --- | --- | --- |
| **LOGIN** | Connected, but not signed in to SOOP yet | Sign in to SOOP in FreecShot Plus |
| **OFFLINE** | Not connected to FreecShot Plus | Check that FreecShot Plus is running and that auto setup was done |
| **SET SOURCE** | No source chosen yet | Pick a Source on the settings screen |
| **SETUP** | Another required setting is empty | Enter the Mode and value |
| **N/A** | The chosen source is not in FreecShot Plus | Pick another source |

See the PDF manual for every action's options. The features match the OBS edition, so the action list in the [OBS README](../../README.en.md) applies too.

## Troubleshooting

- **It stays OFFLINE:** with FreecShot Plus closed, press auto setup again and read the result line. Errors are written to the plugin log (`%appdata%\Elgato\StreamDeck\Plugins\com.haeunga0822.freecshot-audio.sdPlugin\logs`).
- **"Another program uses this port":** enter another Port (1024–65535) and press again.
- **Undo:** close FreecShot Plus and put a `config.json.bak-…` file from the settings folder back as `config.json`.

## License and notices

This plugin is released under the [MIT License](../../LICENSE). The licences of the open-source software it uses are in `THIRD-PARTY-NOTICES.txt`. FreecShot Plus and SOOP are trademarks of their owner. This plugin is unofficial and not affiliated with SOOP.
