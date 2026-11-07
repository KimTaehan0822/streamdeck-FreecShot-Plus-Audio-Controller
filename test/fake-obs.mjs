/** Shared test doubles: a fake obs-websocket client and hand-run timers. */
const tick = () => new Promise((r) => setImmediate(r))
export const settle = async () => {
	for (let i = 0; i < 5; i++) await tick()
}

/** Fake obs-websocket client: answers from `inputs`, records calls, emits events by hand. */
export function fakeObs({ inputs = [], fail = 0 } = {}) {
	const clients = []
	let failures = fail
	const create = () => {
		const handlers = {}
		const client = {
			calls: [],
			connects: 0,
			disconnected: false,
			async connect() {
				client.connects++
				if (failures > 0) {
					failures--
					throw new Error('refused')
				}
			},
			async disconnect() {
				client.disconnected = true
			},
			on(event, fn) {
				;(handlers[event] ??= []).push(fn)
			},
			emit(event, data) {
				for (const fn of handlers[event] ?? []) fn(data)
			},
			async call(type, data) {
				client.calls.push([type, data])
				const input = inputs.find((i) => i.uuid === data?.inputUuid)
				switch (type) {
					case 'GetInputList':
						return { inputs: inputs.map((i) => ({ inputUuid: i.uuid, inputName: i.name, inputKind: i.kind ?? 'wasapi_input_capture' })) }
					case 'GetInputVolume':
						if (!input?.audio) throw new Error('not audio')
						return { inputVolumeMul: input.mul ?? 1, inputVolumeDb: 0 }
					case 'GetInputMute':
						return { inputMuted: !!input.muted }
					case 'GetInputAudioBalance':
						return { inputAudioBalance: input.balance ?? 0.5 }
					case 'GetInputSettings':
						return { inputSettings: input.settings ?? {}, inputKind: input.kind ?? 'wasapi_input_capture' }
					case 'GetInputAudioMonitorType':
						return { monitorType: input.monitor ?? 'OBS_MONITORING_TYPE_NONE' }
				}
				return {}
			},
		}
		clients.push(client)
		return client
	}
	return { clients, create }
}

export function fakeTimers() {
	const timers = []
	return {
		setTimeout: (fn, ms) => {
			const t = { fn, ms }
			timers.push(t)
			return t
		},
		clearTimeout: (t) => {
			const i = timers.indexOf(t)
			if (i >= 0) timers.splice(i, 1)
		},
		runAll() {
			const due = timers.splice(0)
			for (const t of due) t.fn()
			return due.map((t) => t.ms)
		},
	}
}


/** A connected ObsConnection over the fake client, with hand-run timers. */
export async function connected(inputs, { ObsConnection }) {
	const obs = fakeObs({ inputs })
	const timers = fakeTimers()
	const conn = new ObsConnection({ createClient: obs.create, now: () => 0, setTimeout: timers.setTimeout, clearTimeout: timers.clearTimeout })
	conn.start({ host: '127.0.0.1', port: 4455, password: '' })
	await settle()
	const client = obs.clients.at(-1)
	/** Requests other than the initial Get* reads. */
	const sent = () => client.calls.filter(([t]) => !t.startsWith('Get'))
	return { conn, client, obs, timers, sent }
}

/** Fake Stream Deck key or dial; images collects what was drawn. */
export function fakeAction(id, dial, s, multi = false) {
	const images = []
	const saved = []
	const states = []
	const action = {
		id,
		isDial: () => dial,
		isKey: () => !dial,
		isInMultiAction: () => multi,
		setImage: async (image) => void images.push(decodeURIComponent(image)),
		setFeedback: async ({ canvas }) => void images.push(decodeURIComponent(canvas)),
		setFeedbackLayout: async () => {},
		setState: async (state) => void states.push(state),
		setSettings: async (v) => void saved.push(v),
	}
	const ev = (payload = {}) => ({ action, payload: { settings: s, ...payload } })
	return { images, saved, states, action, appear: ev(), ev }
}
