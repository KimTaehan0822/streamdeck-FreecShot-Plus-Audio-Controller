// Meter designs copied from the TotalMix plugin (shared folder plus its Mix Studio looks); 'plugin' is this plugin's own ../meter.ts.
import { big } from './big.js'
import { classic, modern } from './mixstudio.js'
import { topping } from './topping.js'
import type { MeterDesign } from './types.js'
import { vu } from './vu.js'

export type SharedDesign = 'classic' | 'modern' | 'topping' | 'big' | 'vu'
export const SHARED_DESIGNS: Record<SharedDesign, MeterDesign> = { classic, modern, topping, big, vu }
export const isSharedDesign = (v: unknown): v is SharedDesign => typeof v === 'string' && Object.hasOwn(SHARED_DESIGNS, v)
export type { FaderRole, MeterDesign, MeterInput, MeterKeyInput } from './types.js'
