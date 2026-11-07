import { action, type KeyDownEvent, type KeyUpEvent, type WillDisappearEvent } from '@elgato/streamdeck'
import type { JsonObject } from '@elgato/utils'
import type { ObsConnection } from '../connection.js'
import { renderPttKey } from '../render/keys.js'
import type { RenderContext } from '../runtime/base-action.js'
import { PttLatch } from '../runtime/ptt.js'
import { num, pick, sourceOf } from '../runtime/settings.js'
import { ID, SourceAction } from './common.js'

const DEFAULT_DELAY_MS = 200

@action({ UUID: ID + 'ptt' })
export class PttAction extends SourceAction {
	/** One latch per key; it outlives the key only while a restore is still due. */
	private readonly latches = new Map<string, { latch: PttLatch; uuid: string }>()

	constructor(connection: ObsConnection) {
		super(connection)
		connection.onReconnect(() => {
			for (const { latch } of this.latches.values()) latch.reconnected()
		})
	}

	protected render(s: JsonObject, ctx: RenderContext): string {
		const v = this.meterView(s, ctx)
		const mode = pick(s.mode, { talk: 1, mute: 1 }) ?? 'talk'
		return renderPttKey({ name: v.name, mode, live: !v.muted && v.overlay === 'none', meter: this.keyMeter(v), overlay: v.overlay, bare: ctx.userTitle })
	}

	/** Like Mute: the left dot (0) while sound goes out, the right dot (1) while muted. */
	protected override keyState(s: JsonObject): 0 | 1 | undefined {
		const i = this.input(s)
		return i && (i.muted ? 1 : 0)
	}

	override onKeyDown(ev: KeyDownEvent<JsonObject>): void {
		// A multi-action never sends a reliable key-up, so the source could stay unmuted.
		if (ev.action.isInMultiAction()) return
		const s = ev.payload.settings
		const uuid = sourceOf(s)
		const input = this.input(s)
		if (!uuid || !input) return
		let entry = this.latches.get(ev.action.id)
		if (!entry || entry.uuid !== uuid) {
			entry?.latch.abort()
			const latch = new PttLatch((muted) => {
				// Updated at once: a quick next press must not read the state from before OBS answered.
				const i = this.connection.input(uuid)
				if (i) i.muted = muted
				void this.connection.call('SetInputMute', { inputUuid: uuid, inputMuted: muted })
			}, () => this.connection.online)
			entry = { latch, uuid }
			this.latches.set(ev.action.id, entry)
		}
		entry.latch.press(pick(s.mode, { talk: 1, mute: 1 }) ?? 'talk', input.muted)
	}

	override onKeyUp(ev: KeyUpEvent<JsonObject>): void {
		super.onKeyUp(ev)
		const entry = this.latches.get(ev.action.id)
		if (!entry) return
		const delay = num(ev.payload.settings.releaseDelayMs)
		entry.latch.release(delay >= 0 ? delay : DEFAULT_DELAY_MS)
	}

	override onWillDisappear(ev: WillDisappearEvent<JsonObject>): void {
		const entry = this.latches.get(ev.action.id)
		entry?.latch.abort()
		super.onWillDisappear(ev)
	}
}
