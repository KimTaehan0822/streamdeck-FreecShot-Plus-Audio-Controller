export type TalkbackStyle = 'mute' | 'level' | 'duck'
export type TalkbackBehavior = 'hold' | 'toggle'

export interface TalkbackTarget {
	uuid: string
	volumeMul: number
	muted: boolean
}

/** What a source was before the first key changed it. A source with no holders is waiting to be restored. */
export interface SourceRecord {
	mul: number
	mutedByUs: boolean
	volumeChanged: boolean
	holders: string[]
}

export interface TalkbackState {
	keys: Record<string, TalkbackBehavior>
	sources: Record<string, SourceRecord>
}

export interface TalkbackDeps {
	/** May report whether OBS took it (false keeps a restore pending for the reconnect). */
	send(type: 'SetInputMute' | 'SetInputVolume', data: object): boolean | void | Promise<boolean | void>
	isOnline(): boolean
	/** Whether OBS (fully loaded) still has the source. */
	exists(uuid: string): boolean
	save(state: TalkbackState): void
	/** Keys that just turned off, the released one first (others shared a source with it). */
	onOff(ids: string[]): void
}

const toDb = (mul: number): number => (mul > 0 ? 20 * Math.log10(mul) : -Infinity)

/**
 * Lowers other sources for Talkback keys and puts them back. Each source remembers only its value from before the
 * first key touched it, so whichever key turns off first restores the true original; every other key holding one of
 * those sources turns off with it (and restores its own sources), so no key looks on while its effect is gone.
 * Already-muted sources are never touched. Restores wait for the reconnect when OBS is offline.
 */
export class TalkbackRegistry {
	private keys: Record<string, TalkbackBehavior> = {}
	private sources: Record<string, SourceRecord> = {}
	/** Restores sent and still waiting for OBS's answer; the reconnect does not send them twice. */
	private readonly inFlight = new Set<string>()

	constructor(private readonly deps: TalkbackDeps) {}

	active(id: string): boolean {
		return id in this.keys
	}

	state(): TalkbackState {
		return { keys: { ...this.keys }, sources: Object.fromEntries(Object.entries(this.sources).map(([u, r]) => [u, { ...r, holders: [...r.holders] }])) }
	}

	apply(id: string, behavior: TalkbackBehavior, targets: TalkbackTarget[], style: TalkbackStyle, valueDb: number): void {
		if (this.active(id) || !this.deps.isOnline()) return
		this.keys[id] = behavior
		for (const target of targets) {
			const held = this.sources[target.uuid]
			if (held && held.holders.length === 0) continue // still waiting to be restored
			if (!held && target.muted) continue
			const record = held ?? { mul: target.volumeMul, mutedByUs: false, volumeChanged: false, holders: [] }
			if (this.change(target, record, style, valueDb) || held) {
				if (!record.holders.includes(id)) record.holders.push(id)
				this.sources[target.uuid] = record
			}
		}
		this.deps.save(this.state())
	}

	/** Sends this key's change for one source; false when there was nothing to change. */
	private change(target: TalkbackTarget, record: SourceRecord, style: TalkbackStyle, valueDb: number): boolean {
		const uuid = target.uuid
		if (style === 'mute') {
			if (target.muted) return false
			this.deps.send('SetInputMute', { inputUuid: uuid, inputMuted: true })
			record.mutedByUs = true
			return true
		}
		const db = toDb(target.volumeMul)
		const next = style === 'level' ? valueDb : db - valueDb
		if (!(next < db)) return false // level only lowers; -inf has nothing left to lower
		this.deps.send('SetInputVolume', next === -Infinity ? { inputUuid: uuid, inputVolumeMul: 0 } : { inputUuid: uuid, inputVolumeDb: next })
		record.volumeChanged = true
		return true
	}

	release(id: string): void {
		if (!this.active(id)) return
		const off: string[] = []
		const queue = [id]
		while (queue.length) {
			const key = queue.shift() as string
			if (off.includes(key)) continue
			off.push(key)
			delete this.keys[key]
			for (const record of Object.values(this.sources)) if (record.holders.includes(key)) queue.push(...record.holders.filter((h) => !off.includes(h)))
		}
		for (const [uuid, record] of Object.entries(this.sources)) {
			if (!record.holders.some((h) => off.includes(h))) continue
			record.holders = []
			if (this.deps.isOnline()) this.restore(uuid, record)
		}
		this.deps.onOff(off)
		this.deps.save(this.state())
	}

	/** Restores what waited for OBS; sources OBS no longer has are dropped. */
	reconnected(): void {
		let changed = false
		for (const [uuid, record] of Object.entries(this.sources)) {
			if (record.holders.length || this.inFlight.has(uuid)) continue
			if (this.deps.exists(uuid)) this.restore(uuid, record)
			else delete this.sources[uuid]
			changed = true
		}
		if (changed) this.deps.save(this.state())
	}

	/** Startup: toggle keys stay on; held keys (no hand on them now) are released, now or at the reconnect. */
	load(state: TalkbackState): void {
		this.keys = { ...state.keys }
		this.sources = Object.fromEntries(Object.entries(state.sources).map(([u, r]) => [u, { ...r, holders: [...r.holders] }]))
		for (const [id, behavior] of Object.entries(this.keys)) if (behavior === 'hold') this.release(id)
		if (this.deps.isOnline()) this.reconnected()
	}

	/**
	 * Sends the original back. The record stays as a pending restore until OBS took every request, so a connection
	 * that dies before OBS answers (and before it counts as offline) is retried at the reconnect.
	 */
	private restore(uuid: string, record: SourceRecord): void {
		record.holders = []
		const results: (boolean | void | Promise<boolean | void>)[] = []
		if (record.volumeChanged) results.push(this.deps.send('SetInputVolume', { inputUuid: uuid, inputVolumeMul: record.mul }))
		if (record.mutedByUs) results.push(this.deps.send('SetInputMute', { inputUuid: uuid, inputMuted: false }))
		const finish = (oks: (boolean | void)[]): boolean => {
			if (oks.some((ok) => ok === false) || this.sources[uuid] !== record) return false
			delete this.sources[uuid]
			return true
		}
		if (results.some((r) => r instanceof Promise)) {
			this.inFlight.add(uuid)
			void Promise.all(results).then((oks) => {
				this.inFlight.delete(uuid)
				if (finish(oks)) this.deps.save(this.state())
			})
		}
		else finish(results as (boolean | void)[])
	}
}
