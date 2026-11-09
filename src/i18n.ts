export type Lang = 'ko' | 'en' | 'ja'
export type KeyText = 'muted' | 'talk' | 'off' | 'mon' | 'monOut' | 'set' | 'source' | 'setup' | 'offline' | 'talkback' | 'mute' | 'notFound' | 'out' | 'pushTalk' | 'pushMute' | 'login'

/** Texts drawn on keys, per language. The settings screen has its own table (ui/i18n.js). */
export const KEY_TEXT: Record<Lang, Record<KeyText, string>> = {
	en: { muted: 'MUTED', talk: 'TALK', off: 'OFF', mon: 'MON', monOut: 'MON+OUT', set: 'SET', source: 'SOURCE', setup: 'SETUP', offline: 'OFFLINE', talkback: 'Talkback', mute: 'MUTE', notFound: '(not found)', out: 'OUT', pushTalk: 'Push to talk', pushMute: 'Push to mute', login: 'LOGIN' },
	ko: { muted: '음소거', talk: '토크', off: '끔', mon: '모니터', monOut: '모니터+출력', set: '소스', source: '선택', setup: '설정', offline: '오프라인', talkback: '토크백', mute: '음소거', notFound: '(없음)', out: '출력', pushTalk: '누르면 말하기', pushMute: '누르면 음소거', login: '로그인 대기' },
	ja: { muted: 'ミュート', talk: 'トーク', off: 'オフ', mon: 'モニター', monOut: 'モニター+出力', set: 'ソース', source: '選択', setup: '設定', offline: 'オフライン', talkback: 'トークバック', mute: 'ミュート', notFound: '(見つかりません)', out: '出力', pushTalk: '押して話す', pushMute: '押してミュート', login: 'ログイン待ち' },
}

let current: Lang = 'en'

/** Sets the language from the global setting; anything unknown is English. */
export function setLanguage(l: unknown): Lang {
	current = l === 'ko' || l === 'ja' ? l : 'en'
	return current
}
export const language = (): Lang => current
export const t = (key: KeyText): string => KEY_TEXT[current][key]
