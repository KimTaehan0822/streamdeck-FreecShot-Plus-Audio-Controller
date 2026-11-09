import { BUILD } from './build-flavour.js'

export type FlavourName = 'obs' | 'freecshot'

/** Key colours. 'fill' paints the whole key while on (OBS); 'border' keeps it dark and draws a coloured frame. */
export interface Theme {
	keyBg: string
	onStyle: 'fill' | 'border'
	muted: string
	live: string
	monitor: string
	talkback: string
	faderLine: string
}

export interface Flavour {
	name: FlavourName
	uuid: string
	defaultPort: number
	theme: Theme
	autoSetup: boolean
}

export const FLAVOURS: Record<FlavourName, Flavour> = {
	obs: {
		name: 'obs',
		uuid: 'com.haeunga0822.obs-audio',
		defaultPort: 4455,
		theme: { keyBg: '#000', onStyle: 'fill', muted: '#8b1a1a', live: '#1f7a1f', monitor: '#24427a', talkback: '#b35c00', faderLine: 'rgb(40,140,255)' },
		autoSetup: false,
	},
	// Colours taken from FreecShot Plus's own window (panel #171B1E, LIVE button cyan).
	freecshot: {
		name: 'freecshot',
		uuid: 'com.haeunga0822.freecshot-audio',
		defaultPort: 24455,
		theme: { keyBg: '#171B1E', onStyle: 'border', muted: '#FF4D5E', live: '#0CC5FE', monitor: '#0CC5FE', talkback: '#0CC5FE', faderLine: '#00D7FC' },
		autoSetup: true,
	},
}

export const FLAVOUR: Flavour = FLAVOURS[BUILD]

let current: Theme = FLAVOUR.theme
export const theme = (): Theme => current
/** Swaps the key colours; tests use it to draw the other flavour's keys. */
export function useTheme(t: Theme): void {
	current = t
}
