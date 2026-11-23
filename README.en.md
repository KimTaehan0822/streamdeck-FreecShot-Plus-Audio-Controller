# Web-Socket Audio Controller for FreecShot Plus – Stream Deck Plugin

[한국어](README.md) | **English** | [日本語](README.ja.md)

**Version:** 1.1.0

Control the **FreecShot Plus** audio mixer with the keys and dials of an Elgato Stream Deck. Volume, mute, push to talk, talkback, audio monitoring and balance are one key away, and the keys and dial screens show level meters.

It has the same features as the OBS edition, [Web-Socket Audio Controller](https://github.com/KimTaehan0822/streamdeck-Web-Socket-Audio-Controller/blob/main/README.en.md), and installs as a separate plugin. Install both to use OBS and FreecShot Plus at the same time (each key controls one program).

## Download

Get `Web-Socket-Audio-Controller-for-FreecShot-Plus-StreamDeck-v<version>.zip` from the [releases](https://github.com/KimTaehan0822/streamdeck-FreecShot-Plus-Audio-Controller/releases/latest) page and unzip it. It contains:

- `Web-Socket-Audio-Controller-for-FreecShot-Plus.streamDeckPlugin`: the installer
- The manual as PDF (Korean / English / Japanese)
- `LICENSE`: this plugin's license (MIT)
- `THIRD-PARTY-NOTICES.txt`: notices for the open-source software used

The manual sources are in [`docs/manual/freecshot`](docs/manual/freecshot).

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

## Meter design

Unfold **▸ Meter design** at the bottom of the settings screen to pick how the meters look. **Dials** (VU Dial) and **Buttons** (Fader(2-Button), Volume keys) are picked separately; Buttons starts as **Same as dials**. The choice applies to every key at once.

- **Plugin (default)**: the look this plugin always had
- **Mix Studio Classic** / **Mix Studio Modern**: TotalMix FX's old / new style
- **Topping on Plate**: the TOPPING app look
- **Big number**: the volume in large digits
- **VU Needle Drop**: an analogue VU needle. It uses the RMS level FreecShot Plus sends as it is, and the needle moves as a ~300 ms average. Picking it shows **VU 0 VU reference** (-14 / -18 / -20 dBFS, default -18), where 0 VU sits.

The per-key **Meter style** and the **Meter range** below change only the **Plugin (default)** look, so they hide while another design is picked. The volume tops out at 0 dB, so on designs whose scale goes above 0 dB the fader mark stops at 0 dB.

## Meter range

Unfold **▸ Meter range** at the bottom of the settings screen and pick where the meters start in **Start**: **-60 / -50 / -40 / -30 dB**. The default is -60 dB. The meters on VU Dial, Fader(2-Button) and Volume keys change at once. With -40, for example, only -40 to 0 dB is shown, wider, so speech levels are easier to read. Only what the meters show changes, not the volume range; sound below the start sits at the low end of the meter.

## Signs on the keys

| Sign | Meaning | What to do |
| --- | --- | --- |
| **LOGIN** | Connected, but not signed in to SOOP yet | Sign in to SOOP in FreecShot Plus |
| **OFFLINE** | Not connected to FreecShot Plus | Check that FreecShot Plus is running and that auto setup was done |
| **SET SOURCE** | No source chosen yet | Pick a Source on the settings screen |
| **SETUP** | Another required setting is empty | Enter the Mode and value |
| **N/A** | The chosen source is not in FreecShot Plus | Pick another source |

See the PDF manual for every action's options. The features match the OBS edition, so the action list in the [OBS README](https://github.com/KimTaehan0822/streamdeck-Web-Socket-Audio-Controller/blob/main/README.en.md) applies too.

## Troubleshooting

- **It stays OFFLINE:** with FreecShot Plus closed, press auto setup again and read the result line. Errors are written to the plugin log (`%appdata%\Elgato\StreamDeck\Plugins\com.haeunga0822.freecshot-audio.sdPlugin\logs`).
- **"Another program uses this port":** enter another Port (1024–65535) and press again.
- **Undo:** close FreecShot Plus and put a `config.json.bak-…` file from the settings folder back as `config.json`.

## License and notices

This plugin is released under the [MIT License](LICENSE). The licences of the open-source software it uses are in `THIRD-PARTY-NOTICES.txt`. FreecShot Plus and SOOP are trademarks of their owner. This plugin is unofficial and not affiliated with SOOP.
