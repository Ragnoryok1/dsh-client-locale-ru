/**
 * The switches that turn the pack's extra passes off.
 *
 * The pack is more than a dictionary: it substitutes Russian plural forms, rewrites
 * plugin titles the harness cannot translate, and applies Russian screen typography.
 * Each extra can disagree with a reader who wants only the translation — typography
 * in particular rewrites text the user may have typed into a form or a prompt. A
 * switch disables one pass without touching the dictionaries, so the interface stays
 * Russian and only the extra behaviour disappears.
 *
 * The switches arrive from the profile's `cordis.yml` row:
 *
 * ```yaml
 * - id: locale-ru
 *   config:
 *     typography: false
 * ```
 *
 * The browser half cannot read that row — the client boot graph carries no config —
 * so the host half hands the resolved switches to the page through the webserver's
 * index-injection table (see `src/index.ts`), and the browser half reads the global
 * this module names. Omitting a switch means «on», so an existing profile needs no
 * edit, and a surface without the webserver simply keeps the defaults.
 */

/** The switches, by their name in the config. */
export const SWITCHES = ['typography', 'plurals', 'pluginNames'] as const

/** Switches for the passes the pack runs on top of its dictionaries. */
export interface Options {
  /** Russian screen typography: «ёлочки», em dashes, ellipses, non-breaking spaces. */
  typography?: boolean
  /** Russian plural forms picked by `Intl.PluralRules('ru')` instead of the neutral label. */
  plurals?: boolean
  /** Russian titles and descriptions for plugins whose package ships no Russian locale. */
  pluginNames?: boolean
}

/** The global the host half writes and the browser half reads. */
export const BOOT_OPTIONS_KEY = '__DSH_RU_OPTIONS__'

/** What a Standard Schema validation answers: the normalized options, or the reasons it is not one. */
type ValidationResult = { value: Options } | { issues: { message: string }[] }

/**
 * Config schema without a runtime dependency.
 *
 * The loader accepts any Standard Schema (`~standard.validate`), and this pack ships no
 * dependencies on purpose — a language pack that pulls a validator into every profile
 * to read three booleans is a bad trade. An unknown switch is an error rather than a
 * silent no-op: a typo in `typografy: false` would otherwise leave the pass running and
 * look like the option does not work.
 */
export const Config = {
  '~standard': {
    version: 1 as const,
    vendor: 'dsh-client-locale-ru',
    validate(value: unknown): ValidationResult {
      if (value === undefined || value === null) return { value: {} }
      if (typeof value !== 'object' || Array.isArray(value)) {
        return { issues: [{ message: `опции пакета — объект: ${SWITCHES.join(', ')}` }] }
      }
      const source = value as Record<string, unknown>
      const unknown = Object.keys(source).filter(key => !SWITCHES.includes(key as typeof SWITCHES[number]))
      if (unknown.length > 0) {
        return { issues: [{ message: `неизвестные опции: ${unknown.join(', ')}; известны: ${SWITCHES.join(', ')}` }] }
      }
      const normalized: Options = {}
      for (const key of SWITCHES) {
        const raw = source[key]
        if (raw === undefined) continue
        if (typeof raw !== 'boolean') {
          return { issues: [{ message: `${key} — true или false, получено ${typeof raw}` }] }
        }
        normalized[key] = raw
      }
      return { value: normalized }
    },
  },
}

/**
 * Normalize any candidate into the switches the passes read.
 *
 * Only booleans count: a switch that arrived as a string (`"false"`, a common YAML
 * mistake) is ignored rather than treated as a truthy value, because «off» and «on»
 * must not depend on how generous a cast was.
 *
 * @param value - the candidate, typically the row config or the injected global.
 * @returns the switches that were explicitly set.
 */
export function normalizeOptions(value: unknown): Options {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return {}
  const source = value as Record<string, unknown>
  const normalized: Options = {}
  for (const key of SWITCHES) {
    const raw = source[key]
    if (typeof raw === 'boolean') normalized[key] = raw
  }
  return normalized
}

/**
 * Read the switches the host half injected into the page.
 *
 * @returns the switches, or an empty object when the host half did not run (a surface
 * without the webserver, or a build of the pack older than the switches).
 */
export function readBootOptions(): Options {
  return normalizeOptions((globalThis as Record<string, unknown>)[BOOT_OPTIONS_KEY])
}
