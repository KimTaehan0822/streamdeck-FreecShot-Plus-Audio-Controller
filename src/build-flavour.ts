import type { FlavourName } from './flavour.js'

/** Which plugin this build is. rollup.config.mjs replaces this file per bundle; tsc (tests) keeps 'obs'. */
export const BUILD: FlavourName = 'obs'
