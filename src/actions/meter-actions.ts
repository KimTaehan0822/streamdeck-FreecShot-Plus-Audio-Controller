import { action, type DialDownEvent, type DialRotateEvent, type DialUpEvent, type KeyDownEvent, type TouchTapEvent, type WillDisappearEvent } from '@elgato/streamdeck'
import type { JsonObject } from '@elgato/utils'
import type { ObsConnection } from '../connection.js'
import { renderMuteKey, renderVolumeKey } from '../render/keys.js'
import { renderButtonFader, renderVuStrip, type FaderRole } from '../render/meter.js'
import type { RenderContext } from '../runtime/base-action.js'
import { num, pick, stepOf } from '../runtime/settings.js'
import { ID, SourceAction, type MuteOp } from './common.js'

const ROLES: Record<FaderRole, unknown> = { top: 1, bottom: 1, left: 1, right: 1 }
const PRESS_ACTIONS = { mute: 1, recall: 1 }
const TURN_ACTIONS = { step: 1, muteToggle: 1, muteOn: 1, muteOff: 1, recall: 1 }
const MUTE_OPS: Record<string, MuteOp> = { mute: 'toggle', muteToggle: 'toggle', muteOn: 'on', muteOff: 'off' }
const MODES = { set: 1, step: 1 }

@action({ UUID: ID + 'vu-dial' })
export class VuDialAction extends SourceAction {
	/** Per held dial: whether it turned, and which directions already ran a once-per-hold action. */
	private readonly presses = new Map<string, { turned: boolean; fired: Set<string> }>()

	protected render(s: JsonObject, ctx: RenderContext): string {
		return renderVuStrip(this.meterView(s, ctx))
	}

	override onWillDisappear(ev: WillDisappearEvent<JsonObject>): void {
		this.presses.delete(ev.action.id)
		super.onWillDisappear(ev)
	}

	// The press acts on release so a press-and-turn can skip it.
	override async onDialDown(ev: DialDownEvent<JsonObject>): Promise<void> {
		this.presses.set(ev.action.id, { turned: false, fired: new Set() })
	}

	override async onDialUp(ev: DialUpEvent<JsonObject>): Promise<void> {
		const hold = this.presses.get(ev.action.id)
		this.presses.delete(ev.action.id)
		const s = ev.payload.settings
		if (hold && !hold.turned) await this.run(ev.action.id, s, pick(s.pressAction, PRESS_ACTIONS) ?? 'mute', s.pressDb)
	}

	override onDialRotate(ev: DialRotateEvent<JsonObject>): void {
		const { settings: s, ticks, pressed } = ev.payload
		const id = ev.action.id
		if (!ticks) return
		// A held turn with no recorded press (e.g. the plugin restarted mid-hold) starts its own hold.
		if (pressed && !this.presses.has(id)) this.presses.set(id, { turned: false, fired: new Set() })
		const hold = pressed ? this.presses.get(id) : undefined
		const dir = ticks < 0 ? 'left' : 'right'
		const chosen = pressed ? (pick(s[dir + 'Action'], TURN_ACTIONS) ?? 'step') : 'step'
		if (hold) hold.turned = true
		if (chosen === 'step') return this.stepVolume(id, s, ticks * stepOf(s, 1))
		if (hold?.fired.has(dir)) return
		hold?.fired.add(dir)
		void this.run(id, s, chosen, s[dir + 'Db'])
	}

	override async onTouchTap(ev: TouchTapEvent<JsonObject>): Promise<void> {
		const s = ev.payload.settings
		if (s.touchMute !== false && s.touchMute !== 'false') await this.mute(s, 'toggle')
	}

	/** A mute operation or a recall to `db`. */
	private async run(id: string, s: JsonObject, chosen: string, db: unknown): Promise<void> {
		if (chosen === 'recall') return this.recallVolume(id, s, num(db))
		await this.mute(s, MUTE_OPS[chosen])
	}
}

@action({ UUID: ID + 'button-fader' })
export class ButtonFaderAction extends SourceAction {
	protected render(s: JsonObject, ctx: RenderContext): string {
		return renderButtonFader(this.meterView(s, ctx), pick(s.role, ROLES) ?? 'top')
	}

	override onKeyDown(ev: KeyDownEvent<JsonObject>): void {
		const s = ev.payload.settings
		const role = pick(s.role, ROLES) ?? 'top'
		const amount = (role === 'top' || role === 'right' ? 1 : -1) * stepOf(s, 1)
		this.hold(ev.action, () => this.stepVolume(ev.action.id, s, amount))
	}
}

@action({ UUID: ID + 'mute' })
export class MuteAction extends SourceAction {
	protected render(s: JsonObject, ctx: RenderContext): string {
		const v = this.meterView(s, ctx)
		return renderMuteKey({ name: v.name, muted: v.muted, volumeDb: v.volumeDb, meter: this.keyMeter(v), overlay: v.overlay, bare: ctx.userTitle })
	}

	/** ON = muted. */
	protected override keyState(s: JsonObject): 0 | 1 | undefined {
		const i = this.input(s)
		return i && (i.muted ? 1 : 0)
	}

	override async onKeyDown(ev: KeyDownEvent<JsonObject>): Promise<void> {
		await this.mute(ev.payload.settings, 'toggle')
	}
}

@action({ UUID: ID + 'volume' })
export class VolumeAction extends SourceAction {
	protected render(s: JsonObject, ctx: RenderContext): string {
		const v = this.meterView(s, ctx)
		const overlay = v.overlay === 'none' && !this.valid(s) ? 'config' : v.overlay
		return renderVolumeKey({ name: v.name, volumeDb: v.volumeDb, muted: v.muted, peek: v.peek, meter: this.keyMeter(v), overlay })
	}

	// The settings screen shows "Set to" by default but only saves a mode once it is changed, so none means set.
	private valid(s: JsonObject): boolean {
		return Number.isFinite(num(s.value))
	}

	override onKeyDown(ev: KeyDownEvent<JsonObject>): void {
		const s = ev.payload.settings
		if (!this.valid(s)) return
		const value = num(s.value)
		if ((pick(s.mode, MODES) ?? 'set') === 'set') this.recallVolume(ev.action.id, s, value)
		else this.hold(ev.action, () => this.stepVolume(ev.action.id, s, value))
	}
}

export const meterActions = (connection: ObsConnection) => [VuDialAction, ButtonFaderAction, MuteAction, VolumeAction].map((Action) => new Action(connection))
