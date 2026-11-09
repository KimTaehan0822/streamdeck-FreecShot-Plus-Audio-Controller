import { EventSubscription, OBSWebSocket } from 'obs-websocket-js/json'
import { levelsFor, MeterTracker } from './obs/meter-state.js'

export interface ObsSettings {
	host: string
	port: number
	password: string
}

export interface InputState {
	uuid: string
	name: string
	volumeDb: number
	volumeMul: number
	muted: boolean
	balance: number
	monitorType: string
	meter: MeterTracker
}

/** The part of obs-websocket-js this connection uses, so tests can pass a fake. */
export interface ObsClientLike {
	connect(url: string, password?: string, opts?: { eventSubscriptions: number }): Promise<unknown>
	disconnect(): Promise<void>
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	call(type: string, data?: object): Promise<any>
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	on(event: string, fn: (data: any) => void): void
}

export interface ConnectionDeps {
	createClient?: () => ObsClientLike
	now?: () => number
	setTimeout?: (fn: () => void, ms: number) => unknown
	clearTimeout?: (handle: unknown) => void
}

export const RETRY_MS = 3000
const SUBSCRIPTIONS = EventSubscription.General | EventSubscription.Inputs | EventSubscription.InputVolumeMeters

const toDb = (mul: number): number => (mul > 0 ? 20 * Math.log10(mul) : -Infinity)
const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e))

export class ObsConnection {
	private client?: ObsClientLike
	private settings?: ObsSettings
	private retry?: unknown
	private _online = false
	private _waitingLogin = false
	private readonly state = new Map<string, InputState>()
	/** Browser sources seen, whether listed or not. */
	private readonly browsers = new Set<string>()
	private readonly changeListeners = new Set<() => void>()
	private readonly reconnectListeners = new Set<() => void>()
	private changePending = false
	private readonly createClient: () => ObsClientLike
	private readonly now: () => number
	private readonly setTimeoutFn: NonNullable<ConnectionDeps['setTimeout']>
	private readonly clearTimeoutFn: NonNullable<ConnectionDeps['clearTimeout']>

	constructor(deps: ConnectionDeps = {}) {
		this.createClient = deps.createClient ?? (() => new OBSWebSocket() as unknown as ObsClientLike)
		this.now = deps.now ?? Date.now
		this.setTimeoutFn = deps.setTimeout ?? ((fn, ms) => setTimeout(fn, ms))
		this.clearTimeoutFn = deps.clearTimeout ?? ((h) => clearTimeout(h as NodeJS.Timeout))
	}

	get online(): boolean {
		return this._online
	}

	/** Connected, but the program refuses requests until the user signs in (FreecShot Plus answers code 207). */
	get waitingLogin(): boolean {
		return this._waitingLogin
	}

	input(uuid: string): InputState | undefined {
		return this.state.get(uuid)
	}

	/** Audio inputs for the source dropdown, by name. */
	inputs(): { value: string; label: string }[] {
		return [...this.state.values()].map((i) => ({ value: i.uuid, label: i.name })).sort((a, b) => a.label.localeCompare(b.label))
	}

	onChange(fn: () => void): () => void {
		this.changeListeners.add(fn)
		return () => this.changeListeners.delete(fn)
	}

	onReconnect(fn: () => void): () => void {
		this.reconnectListeners.add(fn)
		return () => this.reconnectListeners.delete(fn)
	}

	start(settings: ObsSettings): void {
		this.stop()
		this.settings = settings
		this.open()
	}

	stop(): void {
		this.clearTimeoutFn(this.retry)
		this.retry = undefined
		const old = this.client
		this.client = undefined
		old?.disconnect().catch(() => {})
		this.goOffline()
	}

	/** Sends a request; dropped while offline, errors are logged. Resolves true only when OBS took it. */
	async call(type: string, data?: object): Promise<boolean> {
		const client = this.client
		if (!client || !this._online) return false
		try {
			await client.call(type, data)
			return true
		} catch (error) {
			console.error(`${type}: ${errorText(error)}`)
			return false
		}
	}

	private open(): void {
		const settings = this.settings
		if (!settings) return
		const client = this.createClient()
		this.client = client
		this.listen(client)
		void (async () => {
			try {
				await client.connect(`ws://${settings.host}:${settings.port}`, settings.password || undefined, { eventSubscriptions: SUBSCRIPTIONS })
				if (this.client !== client) return
				await this.load(client)
				if (this.client !== client) return
				this._online = true
				this._waitingLogin = false
				this.changed()
				for (const fn of this.reconnectListeners) fn()
			} catch (error) {
				if (this.client !== client) return
				console.error(`OBS connect: ${errorText(error)}`)
				this.setWaitingLogin((error as { code?: unknown } | null)?.code === 207)
				this.lost(client)
			}
		})()
	}

	/** Takes this client offline and schedules one retry. */
	private lost(client: ObsClientLike): void {
		if (this.client !== client) return
		this.goOffline()
		if (this.retry !== undefined) return
		this.retry = this.setTimeoutFn(() => {
			this.retry = undefined
			if (this.client !== client) return
			client.disconnect().catch(() => {})
			this.open()
		}, RETRY_MS)
	}

	private setWaitingLogin(waiting: boolean): void {
		if (waiting === this._waitingLogin) return
		this._waitingLogin = waiting
		this.changed()
	}

	private goOffline(): void {
		if (!this._online) return
		this._online = false
		this.changed()
	}

	private async load(client: ObsClientLike): Promise<void> {
		const { inputs } = await client.call('GetInputList')
		this.state.clear()
		this.browsers.clear()
		await Promise.all((inputs as { inputUuid: string; inputName: string; inputKind?: string }[]).map((i) => this.add(client, i.inputUuid, i.inputName, i.inputKind)))
	}

	/**
	 * Adds the input if it has audio (OBS answers GetInputVolume only for those). Browser sources always claim audio,
	 * but OBS's mixer shows them only with "Control audio via OBS" (reroute_audio) on, so the same rule applies here.
	 */
	private async add(client: ObsClientLike, uuid: string, name: string, kind?: string): Promise<void> {
		let mul: number
		try {
			if (kind === 'browser_source') {
				this.browsers.add(uuid)
				const { inputSettings } = await client.call('GetInputSettings', { inputUuid: uuid })
				if (inputSettings?.reroute_audio !== true) {
					if (this.client === client && this.state.delete(uuid)) this.changed()
					return
				}
			}
			mul = (await client.call('GetInputVolume', { inputUuid: uuid })).inputVolumeMul
		} catch {
			return
		}
		const get = <T>(type: string, pick: (r: Record<string, unknown>) => T, fallback: T): Promise<T> =>
			client.call(type, { inputUuid: uuid }).then(pick, () => fallback)
		const [muted, balance, monitorType] = await Promise.all([
			get('GetInputMute', (r) => r.inputMuted === true, false),
			get('GetInputAudioBalance', (r) => Number(r.inputAudioBalance), 0.5),
			get('GetInputAudioMonitorType', (r) => String(r.monitorType), 'OBS_MONITORING_TYPE_NONE'),
		])
		if (this.client !== client) return
		this.state.set(uuid, { uuid, name, volumeMul: mul, volumeDb: toDb(mul), muted, balance, monitorType, meter: new MeterTracker() })
		this.changed()
	}

	private listen(client: ObsClientLike): void {
		const on = (event: string, fn: (d: Record<string, any>, input?: InputState) => void) =>
			client.on(event, (d) => {
				if (this.client !== client) return
				fn(d, this.state.get(d?.inputUuid))
				this.changed()
			})
		client.on('ConnectionClosed', () => this.lost(client))
		on('InputVolumeChanged', (d, i) => {
			if (i) Object.assign(i, { volumeMul: d.inputVolumeMul, volumeDb: toDb(d.inputVolumeMul) })
		})
		on('InputMuteStateChanged', (d, i) => i && (i.muted = d.inputMuted === true))
		on('InputAudioBalanceChanged', (d, i) => i && (i.balance = Number(d.inputAudioBalance)))
		on('InputAudioMonitorTypeChanged', (d, i) => i && (i.monitorType = String(d.monitorType)))
		on('InputNameChanged', (d, i) => i && (i.name = String(d.inputName)))
		on('InputRemoved', (d) => {
			this.state.delete(d.inputUuid)
			this.browsers.delete(d.inputUuid)
		})
		on('InputCreated', (d) => void this.add(client, d.inputUuid, d.inputName, d.inputKind))
		// A browser source joins or leaves the list when "Control audio via OBS" is switched.
		on('InputSettingsChanged', (d, i) => {
			if (this.browsers.has(d.inputUuid)) void this.add(client, d.inputUuid, i?.name ?? String(d.inputName ?? ''), 'browser_source')
		})
		on('InputVolumeMeters', (d) => {
			const now = this.now()
			for (const m of d.inputs ?? []) {
				const i = this.state.get(m.inputUuid)
				if (i) i.meter.update(levelsFor(m.inputLevelsMul ?? [], i.muted, i.volumeMul), now)
			}
		})
	}

	/** Listeners run once per tick however many events arrived. */
	private changed(): void {
		if (this.changePending) return
		this.changePending = true
		setImmediate(() => {
			this.changePending = false
			for (const fn of this.changeListeners) {
				try {
					fn()
				} catch (error) {
					console.error(errorText(error))
				}
			}
		})
	}
}
