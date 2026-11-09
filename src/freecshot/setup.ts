import { execFile } from 'node:child_process'
import { constants } from 'node:fs'
import nodeFs from 'node:fs/promises'
import { createServer } from 'node:net'
import { join } from 'node:path'

export const FREECSHOT_PORT = 24455

export type SetupFailure = 'running' | 'noConfig' | 'badConfig' | 'badPort' | 'portBusy' | 'backupFailed' | 'writeFailed'
export type SetupResult = { ok: true; port: number; password: string } | { ok: false; reason: SetupFailure }

export interface SetupDeps {
	configPath: string
	isRunning(): Promise<boolean>
	portBusy(port: number): Promise<boolean>
	now(): Date
	fs?: Pick<typeof nodeFs, 'readFile' | 'writeFile' | 'copyFile' | 'rename' | 'unlink'>
}

const fail = (reason: SetupFailure): SetupResult => ({ ok: false, reason })
const pad = (n: number) => String(n).padStart(2, '0')
const stamp = (d: Date) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`

/** Empty means the default; anything else must be a whole number from 1024 to 65535. */
function pickPort(raw: unknown): number | undefined {
	const text = String(raw ?? '').trim()
	if (!text) return FREECSHOT_PORT
	if (!/^\d+$/.test(text)) return undefined
	const port = Number(text)
	return port >= 1024 && port <= 65535 ? port : undefined
}

/**
 * Turns on FreecShot Plus's bundled obs-websocket server by editing its config file. Only while the program is closed
 * (it may write the file back on exit), and only after a backup; every other key in the file is kept.
 */
export async function runFreecshotSetup(input: { port: unknown; password: unknown }, deps: SetupDeps): Promise<SetupResult> {
	const fs = deps.fs ?? nodeFs
	if (await deps.isRunning()) return fail('running')
	const port = pickPort(input.port)
	if (port === undefined) return fail('badPort')
	if (await deps.portBusy(port)) return fail('portBusy')

	let original: string
	try {
		original = await fs.readFile(deps.configPath, 'utf8')
	} catch {
		return fail('noConfig')
	}
	let config: Record<string, unknown>
	try {
		config = JSON.parse(original)
		if (!config || typeof config !== 'object' || Array.isArray(config)) return fail('badConfig')
	} catch {
		return fail('badConfig')
	}

	// Never overwrite an earlier backup: pressing twice in one second adds -2, -3, ...
	const base = `${deps.configPath}.bak-${stamp(deps.now())}`
	let backedUp = false
	for (let i = 1; i <= 99 && !backedUp; i++) {
		try {
			await fs.copyFile(deps.configPath, i === 1 ? base : `${base}-${i}`, constants.COPYFILE_EXCL)
			backedUp = true
		} catch (error) {
			if ((error as { code?: unknown }).code !== 'EEXIST') return fail('backupFailed')
		}
	}
	if (!backedUp) return fail('backupFailed')

	const password = typeof input.password === 'string' ? input.password : ''
	config.server_enabled = true
	config.server_port = port
	if (password) {
		config.auth_required = true
		config.server_password = password
	}
	// Write a temp file and swap it in, so a failure never leaves a half-written config.
	const temp = `${deps.configPath}.tmp`
	try {
		await fs.writeFile(temp, JSON.stringify(config, null, 4))
		await fs.rename(temp, deps.configPath)
	} catch {
		await fs.unlink(temp).catch(() => {})
		return fail('writeFailed')
	}
	const used = config.auth_required === true && typeof config.server_password === 'string' ? config.server_password : ''
	return { ok: true, port, password: used }
}

const isSoopStudioRunning = () =>
	new Promise<boolean>((resolve) =>
		execFile('tasklist', ['/FI', 'IMAGENAME eq SoopStudio.exe', '/NH'], { windowsHide: true }, (error, stdout) =>
			// If tasklist itself fails, assume it is running: editing the file under a running program is the risk.
			resolve(error ? true : /SoopStudio\.exe/i.test(stdout)),
		),
	)

const isPortBusy = (port: number) =>
	new Promise<boolean>((resolve) => {
		const server = createServer()
		server.once('error', (e: NodeJS.ErrnoException) => resolve(e.code === 'EADDRINUSE' || e.code === 'EACCES'))
		server.listen(port, () => server.close(() => resolve(false)))
	})

export function defaultSetupDeps(): SetupDeps {
	return {
		configPath: join(process.env.APPDATA ?? '', 'SOOPStudio', 'plugin_config', 'obs-websocket', 'config.json'),
		isRunning: isSoopStudioRunning,
		portBusy: isPortBusy,
		now: () => new Date(),
	}
}
