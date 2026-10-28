import { PALETTE } from '../dataset/Palette'
import { COLOR_TOKENS } from './ColorTokens'

/**
 * Appearance: theme, accent and the size of the answers.
 *
 * The interface is painted with colour literals written for the dark theme, and
 * every one of them is a custom property with that literal as its fallback
 * (`var(--c-1f2a3f, #1f2a3f)`). A theme is therefore only a table of values for
 * those properties: the dark one is the literals themselves, the light one is
 * each colour with its lightness mirrored, and the accent rotates the hue of
 * the blue-violet family the interface uses for selection and emphasis.
 */

export const THEME_CHOICES = ['dark', 'light', 'system']
export const DEFAULT_THEME = 'dark'

/** Hue rotation applied to the accent family; `null` leaves the stock colours. */
export const ACCENT_PRESETS = [
  { id: 'indigo', hue: null, swatch: '#7c6aff' },
  { id: 'blue', hue: -22, swatch: '#4a9eff' },
  { id: 'teal', hue: -55, swatch: '#2dd4bf' },
  { id: 'green', hue: -95, swatch: '#4ade80' },
  { id: 'amber', hue: -205, swatch: '#f59e0b' },
  { id: 'red', hue: 113, swatch: '#ef4444' },
  { id: 'rose', hue: 95, swatch: '#f472b6' },
  { id: 'violet', hue: 30, swatch: '#c084fc' },
]

export const DEFAULT_ACCENT = 'indigo'
export const DEFAULT_MESSAGE_FONT_SIZE = 14
export const MIN_MESSAGE_FONT_SIZE = 11
export const MAX_MESSAGE_FONT_SIZE = 22
export const MESSAGE_FONT_SIZE_STEPS = [12, 13, 14, 16, 18, 20]

export const DEFAULT_APPEARANCE = {
  theme: DEFAULT_THEME,
  accent: DEFAULT_ACCENT,
  messageFontSize: DEFAULT_MESSAGE_FONT_SIZE,
}

export function normalizeMessageFontSize(raw) {
  const value = Number(raw)
  if (!Number.isFinite(value)) return DEFAULT_MESSAGE_FONT_SIZE
  return Math.min(MAX_MESSAGE_FONT_SIZE, Math.max(MIN_MESSAGE_FONT_SIZE, Math.round(value)))
}

export function normalizeAppearance(raw) {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
  return {
    theme: THEME_CHOICES.includes(source.theme) ? source.theme : DEFAULT_THEME,
    accent: ACCENT_PRESETS.some(preset => preset.id === source.accent) ? source.accent : DEFAULT_ACCENT,
    messageFontSize: normalizeMessageFontSize(source.messageFontSize ?? DEFAULT_MESSAGE_FONT_SIZE),
  }
}

/** `system` follows the operating system; the other two are taken as they are. */
export function resolveTheme(theme, prefersDark = true) {
  if (theme === 'light' || theme === 'dark') return theme
  return prefersDark ? 'dark' : 'light'
}

function parseToken(token) {
  const r = parseInt(token.slice(0, 2), 16) / 255
  const g = parseInt(token.slice(2, 4), 16) / 255
  const b = parseInt(token.slice(4, 6), 16) / 255
  const alpha = token.length === 8 ? token.slice(6, 8) : ''
  return { r, g, b, alpha }
}

function rgbToHsl({ r, g, b }) {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return { h: 0, s: 0, l }
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0)
  else if (max === g) h = (b - r) / d + 2
  else h = (r - g) / d + 4
  return { h: h * 60, s, l }
}

function hslToHex({ h, s, l }, alpha) {
  const hue = ((h % 360) + 360) % 360 / 360
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  const channel = t => {
    let x = t
    if (x < 0) x += 1
    if (x > 1) x -= 1
    if (x < 1 / 6) return p + (q - p) * 6 * x
    if (x < 1 / 2) return q
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6
    return p
  }
  const hex = value => Math.round(Math.min(1, Math.max(0, value)) * 255).toString(16).padStart(2, '0')
  return `#${hex(s === 0 ? l : channel(hue + 1 / 3))}${hex(s === 0 ? l : channel(hue))}${hex(s === 0 ? l : channel(hue - 1 / 3))}${alpha}`
}

const ACCENT_HUE_MIN = 195
const ACCENT_HUE_MAX = 295
const ACCENT_MIN_SATURATION = 0.2

/** A token's value under a theme and an accent, as a CSS colour. */
export function themedColor(token, { theme = DEFAULT_THEME, accent = DEFAULT_ACCENT } = {}) {
  const parsed = parseToken(token)
  const hsl = rgbToHsl(parsed)
  const shift = ACCENT_PRESETS.find(preset => preset.id === accent)?.hue ?? null
  if (shift != null && hsl.s >= ACCENT_MIN_SATURATION && hsl.h >= ACCENT_HUE_MIN && hsl.h <= ACCENT_HUE_MAX) hsl.h += shift
  if (theme === 'light') hsl.l = 1 - hsl.l
  return hslToHex(hsl, parsed.alpha)
}

const tokenOf = color => {
  if (typeof color !== 'string' || !/^#[0-9a-fA-F]{3,8}$/.test(color)) return null
  const token = color.slice(1).toLowerCase()
  return token.length <= 4 ? [...token].map(c => c + c).join('') : token
}

/**
 * The participant palette. Its colours follow the theme but never the accent:
 * the accent recolors the interface, and a violet participant must not turn
 * green because the user picked a green accent.
 */
const PARTICIPANT_TOKENS = [...new Set(PALETTE.flatMap(entry => [entry.bg, entry.border, entry.label]).map(tokenOf).filter(Boolean))]
const PARTICIPANT_TOKEN_SET = new Set(PARTICIPANT_TOKENS)
const COLOR_TOKEN_SET = new Set(COLOR_TOKENS)

/** The stylesheet that gives every colour token its value for the theme. */
export function buildThemeCss({ theme, accent }) {
  const declarations = COLOR_TOKENS.map(token => `--c-${token}:${themedColor(token, { theme, accent })};`).join('')
  const participants = PARTICIPANT_TOKENS.map(token => `--p-${token}:${themedColor(token, { theme, accent: null })};`).join('')
  return `:root{${declarations}${participants}}`
}

/** An interface colour as a theme-aware value. */
export function themeColor(color) {
  const token = tokenOf(color)
  return token && COLOR_TOKEN_SET.has(token) ? `var(--c-${token}, ${color})` : color
}

/**
 * A participant colour as a theme-aware value. The palette is stored in
 * sessions as plain hex, so it is looked up here instead of being rewritten.
 */
export function participantColor(color) {
  const token = tokenOf(color)
  return token && PARTICIPANT_TOKEN_SET.has(token) ? `var(--p-${token}, ${color})` : themeColor(color)
}

const STYLE_ID = 'app-theme-colors'

/** Puts the appearance on the document. Safe to call repeatedly. */
export function applyAppearance(appearance, { prefersDark = true, doc = globalThis.document } = {}) {
  if (!doc) return
  const normalized = normalizeAppearance(appearance)
  const theme = resolveTheme(normalized.theme, prefersDark)
  let style = doc.getElementById(STYLE_ID)
  if (!style) {
    style = doc.createElement('style')
    style.id = STYLE_ID
    doc.head.appendChild(style)
  }
  style.textContent = buildThemeCss({ theme, accent: normalized.accent })
  const root = doc.documentElement
  root.dataset.theme = theme
  root.style.colorScheme = theme
  root.style.setProperty('--balloon-font-size', `${normalized.messageFontSize}px`)
}
