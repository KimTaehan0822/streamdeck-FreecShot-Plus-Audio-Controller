export type PttMode = 'talk' | 'mute'

/**
 * Push to talk / push to mute for one key. A press remembers the mute state from before it and sets the held state;
 * release puts the remembered state back after a delay. Restoring never gets lost: if OBS is offline it waits for the
 * reconnect, and a key that disappears restores at once.
 */
export class PttLatch {
	private held = false
	private heldMuted = false
	/** Mute state from before the press; set while something is still to restore. */
	private original?: boolean
	private timer?: unknown
	private pending = false
	private readonly setTimeoutFn: (fn: () => void, ms: number) => unknown
	private readonly clearTimeoutFn: (handle: unknown) => void

	/** `isOnline` is asked at the moment of restoring, so a connection lost during the release delay is noticed. */
	constructor(
		private readonly send: (muted: boolean) => void,
		private readonly isOnline: () => boolean,
		deps: { setTimeout?: (fn: () => void, ms: number) => unknown; clearTimeout?: (handle: unknown) => void } = {},
	) {
		this.setTimeoutFn = deps.setTimeout ?? ((fn, ms) => setTimeout(fn, ms))
		this.clearTimeoutFn = deps.clearTimeout ?? ((h) => clearTimeout(h as NodeJS.Timeout))
	}

	get active(): boolean {
		return this.held
	}

	press(mode: PttMode, currentlyMuted: boolean): void {
		this.cancelTimer()
		// A press during the release delay keeps the state from before the first press.
		this.original ??= currentlyMuted
		this.pending = false
		this.held = true
		this.heldMuted = mode === 'mute'
		this.send(this.heldMuted)
	}

	release(delayMs: number): void {
		if (!this.held) return
		this.held = false
		if (delayMs > 0) this.timer = this.setTimeoutFn(() => this.restore(), delayMs)
		else this.restore()
	}

	/** The key disappeared: restore now, without the delay. */
	abort(): void {
		this.held = false
		this.restore()
	}

	reconnected(): void {
		if (this.held) this.send(this.heldMuted)
		else if (this.pending) this.restore()
	}

	private restore(): void {
		this.cancelTimer()
		if (this.original === undefined) return
		if (!this.isOnline()) {
			this.pending = true
			return
		}
		this.pending = false
		this.send(this.original)
		this.original = undefined
	}

	private cancelTimer(): void {
		if (this.timer !== undefined) this.clearTimeoutFn(this.timer)
		this.timer = undefined
	}
}
