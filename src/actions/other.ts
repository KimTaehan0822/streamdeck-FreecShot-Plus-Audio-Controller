import { action, type DialDownEvent, type DialRotateEvent, type KeyDownEvent } from '@elgato/streamdeck'
import type { JsonObject } from '@elgato/utils'
import type { ObsConnection } from '../connection.js'
import { renderBalanceKey, renderBalanceStrip, renderMonitorKey } from '../render/keys.js'
import type { RenderContext } from '../runtime/base-action.js'
import { nameOf, num, pick, stepOf } from '../runtime/settings.js'
import { ID, SourceAction } from './common.js'

const CYCLE = ['OBS_MONITORING_TYPE_NONE', 'OBS_MONITORING_TYPE_MONITOR_ONLY', 'OBS_MONITORING_TYPE_MONITOR_AND_OUTPUT']
const TYPES = Object.fromEntries(CYCLE.map((t) => [t, 1])) as Record<string, unknown>
const MODES = { set: 1, step: 1 }

@action({ UUID: ID + 'monitor' })
export class MonitorAction extends SourceAction {
	protected render(s: JsonObject, ctx: RenderContext): string {
		return renderMonitorKey({ name: nameOf(this.connection, s), type: this.input(s)?.monitorType ?? 'OBS_MONITORING_TYPE_NONE', overlay: this.overlay(s, ctx), bare: ctx.userTitle })
	}

	/** ON = monitoring is not off. */
	protected override keyState(s: JsonObject): 0 | 1 | undefined {
		const i = this.input(s)
		return i && (i.monitorType === CYCLE[0] ? 0 : 1)
	}

	override onKeyDown(ev: KeyDownEvent<JsonObject>): void {
		const s = ev.payload.settings
		const i = this.input(s)
		if (!i) return
		const chosen = pick(s.type, TYPES) ?? CYCLE[0]
		// set: always the chosen type; toggle: chosen type <-> off; cycle: off -> monitor only -> monitor and output.
		const next =
			s.mode === 'cycle'
				? CYCLE[(CYCLE.indexOf(i.monitorType) + 1) % CYCLE.length]
				: s.mode === 'toggle' && i.monitorType === chosen
					? CYCLE[0]
					: chosen
		// Updated at once so quick presses cycle on from the new value.
		i.monitorType = next
		void this.connection.call('SetInputAudioMonitorType', { inputUuid: i.uuid, monitorType: next })
		this.refresh(ev.action.id)
	}
}

/** Balance 0 (left) .. 0.5 (centre) .. 1 (right). */
abstract class BalanceFamily extends SourceAction {
	protected setBalance(id: string, s: JsonObject, value: (current: number) => number): void {
		const i = this.input(s)
		if (!i) return
		i.balance = Math.max(0, Math.min(1, +value(i.balance).toFixed(4)))
		void this.connection.call('SetInputAudioBalance', { inputUuid: i.uuid, inputAudioBalance: i.balance })
		this.refresh(id)
	}
}

@action({ UUID: ID + 'balance-dial' })
export class BalanceDialAction extends BalanceFamily {
	protected render(s: JsonObject, ctx: RenderContext): string {
		return renderBalanceStrip({ name: nameOf(this.connection, s), balance: this.input(s)?.balance ?? 0.5, overlay: this.overlay(s, ctx) })
	}

	override onDialRotate(ev: DialRotateEvent<JsonObject>): void {
		// Shown as L/R 0..100 from the centre, so 1 shown step is 1/200 of OBS's 0..1 range.
		const step = stepOf(ev.payload.settings, 1) / 200
		this.setBalance(ev.action.id, ev.payload.settings, (b) => b + ev.payload.ticks * step)
	}

	override async onDialDown(ev: DialDownEvent<JsonObject>): Promise<void> {
		this.setBalance(ev.action.id, ev.payload.settings, () => 0.5)
	}
}

@action({ UUID: ID + 'balance' })
export class BalanceAction extends BalanceFamily {
	private valid(s: JsonObject): boolean {
		// The settings screen shows "Set to" by default but only saves a mode once it is changed, so none means set.
		return Number.isFinite(num(s.value))
	}

	protected render(s: JsonObject, ctx: RenderContext): string {
		const overlay = this.overlay(s, ctx)
		return renderBalanceKey({
			name: nameOf(this.connection, s),
			balance: this.input(s)?.balance ?? 0.5,
			overlay: overlay === 'none' && !this.valid(s) ? 'config' : overlay,
		})
	}

	override onKeyDown(ev: KeyDownEvent<JsonObject>): void {
		const s = ev.payload.settings
		if (!this.valid(s)) return
		// Values are in shown units: set -100 (L 100) .. 0 (C) .. 100 (R 100), step ±; 1 = 1/200 of OBS's 0..1 range.
		if ((pick(s.mode, MODES) ?? 'set') === 'set') this.setBalance(ev.action.id, s, () => 0.5 + num(s.value) / 200)
		else this.hold(ev.action, () => this.setBalance(ev.action.id, s, (b) => b + num(s.value) / 200))
	}
}

export const otherActions = (connection: ObsConnection) => [MonitorAction, BalanceDialAction, BalanceAction].map((Action) => new Action(connection))
