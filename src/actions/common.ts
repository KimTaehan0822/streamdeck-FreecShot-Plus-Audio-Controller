import { FLAVOUR } from '../flavour.js'
import type { DidReceiveSettingsEvent, WillAppearEvent, WillDisappearEvent } from '@elgato/streamdeck'
import type { JsonObject } from '@elgato/utils'
import type { InputState } from '../connection.js'
import type { MeterDisplay } from '../obs/meter-state.js'
import { clampSetDb, stepDb } from '../obs/volume.js'
import type { KeyMeterView, ObsMeterView } from '../render/meter.js'
import type { Overlay } from '../render/svg.js'
import { ObsAction, type RenderContext } from '../runtime/base-action.js'
import { FADER_PEEK_MS, faderAdjustedRecently, markFaderAdjusted } from '../runtime/peek.js'
import { meterOpts, nameOf, sourceOf } from '../runtime/settings.js'

export const ID = FLAVOUR.uuid + '.'
const SILENT: MeterDisplay = { left: -Infinity, right: -Infinity, combined: -Infinity, holdLeft: -Infinity, holdRight: -Infinity, holdCombined: -Infinity }
export type MuteOp = 'toggle' | 'on' | 'off'

/** An action bound to one OBS audio source (settings.inputUuid). */
export abstract class SourceAction extends ObsAction<JsonObject> {
	/** One pending peek redraw per action id; each volume change restarts it. */
	private readonly peekTimers = new Map<string, NodeJS.Timeout>()

	override async onWillAppear(ev: WillAppearEvent<JsonObject>): Promise<void> {
		await super.onWillAppear(ev)
		this.saveName(ev.action, ev.payload.settings)
	}

	override onDidReceiveSettings(ev: DidReceiveSettingsEvent<JsonObject>): void {
		super.onDidReceiveSettings(ev)
		this.saveName(ev.action, ev.payload.settings)
	}

	/** Keeps the OBS name in the settings so the key still shows it while OBS is offline. */
	private saveName(action: WillAppearEvent<JsonObject>['action'], s: JsonObject): void {
		const name = this.input(s)?.name
		if (name && name !== s.inputName) action.setSettings({ ...s, inputName: name }).catch(() => {})
	}

	override onWillDisappear(ev: WillDisappearEvent<JsonObject>): void {
		clearTimeout(this.peekTimers.get(ev.action.id))
		this.peekTimers.delete(ev.action.id)
		super.onWillDisappear(ev)
	}

	protected input(s: JsonObject): InputState | undefined {
		const uuid = sourceOf(s)
		return uuid ? this.connection.input(uuid) : undefined
	}

	/** SET SOURCE until one is picked; N/A when OBS is online but the source is gone. */
	protected overlay(s: JsonObject, ctx: RenderContext): Overlay {
		if (!sourceOf(s)) return 'setup'
		if (ctx.overlay === 'none' && !this.input(s)) return 'unsupported'
		return ctx.overlay
	}

	protected meterView(s: JsonObject, ctx: RenderContext): ObsMeterView {
		const i = this.input(s)
		const muted = i?.muted ?? false
		return {
			name: nameOf(this.connection, s),
			volumeDb: i?.volumeDb ?? -Infinity,
			levels: i ? i.meter.display(Date.now()) : SILENT,
			muted,
			peek: muted && !!i && faderAdjustedRecently(i.uuid),
			...meterOpts(s),
			overlay: this.overlay(s, ctx),
		}
	}

	protected keyMeter(v: ObsMeterView): KeyMeterView {
		return { levels: v.levels, muted: v.muted, style: v.style, channels: v.channels, volumeDb: v.volumeDb }
	}

	/** Sets the volume (dB, -Infinity = silent), updating local state at once so quick steps build on each other. */
	protected setVolume(id: string, i: InputState, db: number): void {
		i.volumeDb = db
		i.volumeMul = db === -Infinity ? 0 : 10 ** (db / 20)
		void this.connection.call('SetInputVolume', db === -Infinity ? { inputUuid: i.uuid, inputVolumeMul: 0 } : { inputUuid: i.uuid, inputVolumeDb: db })
		markFaderAdjusted(i.uuid)
		clearTimeout(this.peekTimers.get(id))
		const timer = setTimeout(() => this.refresh(id), FADER_PEEK_MS + 20)
		timer.unref()
		this.peekTimers.set(id, timer)
		this.refresh(id)
	}

	protected stepVolume(id: string, s: JsonObject, delta: number): void {
		const i = this.input(s)
		if (i) this.setVolume(id, i, stepDb(i.volumeDb, delta))
	}

	/** A typed-in volume; nothing when it is not a number. */
	protected recallVolume(id: string, s: JsonObject, db: number): void {
		const i = this.input(s)
		if (i && Number.isFinite(db)) this.setVolume(id, i, clampSetDb(db))
	}

	protected mute(s: JsonObject, op: MuteOp): Promise<boolean> {
		const uuid = sourceOf(s)
		if (!uuid) return Promise.resolve(false)
		return op === 'toggle'
			? this.connection.call('ToggleInputMute', { inputUuid: uuid })
			: this.connection.call('SetInputMute', { inputUuid: uuid, inputMuted: op === 'on' })
	}
}
