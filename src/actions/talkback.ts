import { action, type KeyDownEvent, type KeyUpEvent, type WillDisappearEvent } from '@elgato/streamdeck'
import type { JsonObject } from '@elgato/utils'
import type { ObsConnection } from '../connection.js'
import { t } from '../i18n.js'
import { renderTalkbackKey } from '../render/keys.js'
import { ObsAction, type RenderContext } from '../runtime/base-action.js'
import { num, pick } from '../runtime/settings.js'
import { TalkbackRegistry, type TalkbackBehavior, type TalkbackStyle, type TalkbackTarget } from '../runtime/talkback.js'
import type { TalkbackStore } from '../runtime/talkback-store.js'
import { ID } from './common.js'

const STYLES = { mute: 1, level: 1, duck: 1 } as const
const BEHAVIORS = { hold: 1, toggle: 1 } as const
const DEFAULT_DB: Record<TalkbackStyle, number> = { mute: 0, level: -30, duck: 15 }

const styleOf = (s: JsonObject): TalkbackStyle => pick(s.style, STYLES) ?? 'mute'
const behaviorOf = (s: JsonObject): TalkbackBehavior => pick(s.behavior, BEHAVIORS) ?? 'hold'

/**
 * levelDb: the volume to lower to (-inf allowed); duckDb: how many dB to lower by (sign ignored). Separate settings,
 * so switching the style never reuses the other one's number (-30 as "lower by 30").
 */
function valueOf(s: JsonObject, style: TalkbackStyle): number {
	const raw = style === 'level' ? s.levelDb : s.duckDb
	if (style === 'level' && /^\s*-?inf/i.test(String(raw ?? ''))) return -Infinity
	const v = num(raw)
	if (!Number.isFinite(v)) return DEFAULT_DB[style]
	return style === 'duck' ? Math.abs(v) : v
}

/** The listed sources' OBS UUIDs ({ uuid, name } rows from the settings screen). */
function listed(s: JsonObject): Set<string> {
	const rows = Array.isArray(s.sources) ? s.sources : []
	return new Set(rows.map((r) => (r && typeof r === 'object' && !Array.isArray(r) ? String((r as JsonObject).uuid ?? '') : '')).filter(Boolean))
}

/** Lowers every other source (or just the listed ones) while held, or until pressed again, then puts them back. */
@action({ UUID: ID + 'talkback' })
export class TalkbackAction extends ObsAction<JsonObject> {
	private readonly registry: TalkbackRegistry

	constructor(connection: ObsConnection, store: TalkbackStore) {
		super(connection)
		this.registry = new TalkbackRegistry({
			send: (type, data) => {
				// Updated at once so the next press (or another key) reads the new state before OBS answers.
				const d = data as { inputUuid: string; inputMuted?: boolean; inputVolumeDb?: number; inputVolumeMul?: number }
				const i = connection.input(d.inputUuid)
				if (i && d.inputMuted !== undefined) i.muted = d.inputMuted
				if (i && (d.inputVolumeDb !== undefined || d.inputVolumeMul !== undefined)) {
					i.volumeMul = d.inputVolumeMul ?? 10 ** ((d.inputVolumeDb as number) / 20)
					i.volumeDb = i.volumeMul > 0 ? 20 * Math.log10(i.volumeMul) : -Infinity
				}
				return connection.call(type, data)
			},
			isOnline: () => connection.online,
			exists: (uuid) => !!connection.input(uuid),
			save: (state) => store.save(state),
			onOff: (ids) => ids.forEach((id) => this.refresh(id)),
		})
		try {
			const saved = store.load()
			if (saved) this.registry.load(saved)
		} catch (error) {
			// A damaged state file must not stop the plugin (and every other key with it).
			console.error(`Talkback state: ${error instanceof Error ? error.message : String(error)}`)
		}
		connection.onReconnect(() => this.registry.reconnected())
	}

	protected render(s: JsonObject, ctx: RenderContext): string {
		const style = styleOf(s)
		const name = typeof s.displayName === 'string' && s.displayName.trim() ? s.displayName.trim() : t('talkback')
		return renderTalkbackKey({ name, style, valueDb: valueOf(s, style), active: this.registry.active(ctx.id), overlay: ctx.overlay, bare: ctx.userTitle })
	}

	/** ON = this key is lowering its sources. */
	protected override keyState(_s: JsonObject, id: string): 0 | 1 {
		return this.registry.active(id) ? 1 : 0
	}

	private targets(s: JsonObject): TalkbackTarget[] {
		const list = listed(s)
		const only = pick(s.scope, { except: 1, only: 1 }) === 'only'
		return this.connection
			.inputs()
			.filter(({ value }) => list.has(value) === only)
			.map(({ value }) => this.connection.input(value))
			.filter((i) => i !== undefined)
			.map((i) => ({ uuid: i.uuid, volumeMul: i.volumeMul, muted: i.muted }))
	}

	override onKeyDown(ev: KeyDownEvent<JsonObject>): void {
		const s = ev.payload.settings
		const behavior = behaviorOf(s)
		const id = ev.action.id
		// A multi-action never sends a reliable key-up, so a held Talkback could stay on.
		if (behavior === 'hold' && ev.action.isInMultiAction()) return
		// Any press of a key that is on turns it off, also when its Behavior was switched to hold meanwhile.
		if (this.registry.active(id)) this.registry.release(id)
		else {
			const style = styleOf(s)
			this.registry.apply(id, behavior, this.targets(s), style, valueOf(s, style))
		}
		this.refresh(id)
	}

	override onKeyUp(ev: KeyUpEvent<JsonObject>): void {
		super.onKeyUp(ev)
		if (this.registry.state().keys[ev.action.id] === 'hold') this.registry.release(ev.action.id)
	}

	override onWillDisappear(ev: WillDisappearEvent<JsonObject>): void {
		// A held key restores at once; a toggle stays on (the user may only have changed page).
		if (this.registry.state().keys[ev.action.id] === 'hold') this.registry.release(ev.action.id)
		super.onWillDisappear(ev)
	}
}
