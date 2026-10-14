/**
 * Russian plural forms for count-driven strings.
 *
 * The harness locale contract is a flat `Record<string, string>` with no plural
 * rules: a component renders `count === 1 ? t('key.one', { count }) : t('key.other', { count })`,
 * so a language pack can offer two forms while Russian needs three — 1 вызов,
 * 2 вызова, 5 вызовов. The dictionaries sidestep that today by making `.other`
 * a neutral label («Вызовов инструментов: 5»), which is grammatical for every
 * count but reads like a caption rather than a sentence.
 *
 * `LocaleRuntime.bind()` returns a closure that calls
 * `this.translate(ns, key, params)` at call time, so `translate` is the single
 * place every translated string passes through, whichever namespace or
 * component asked for it. Wrapping it lets the pack choose its own form: when
 * the active locale is `ru` and the call carries a numeric `count` or `n`, the
 * suffix is recomputed from `Intl.PluralRules('ru')` and the matching
 * `.one` / `.few` / `.many` key is used when the dictionaries carry it.
 *
 * Keys that have no extra forms keep the previous behaviour, so `.other`
 * remains a safe fallback and no count-driven string can regress to a form the
 * caller did not choose. The wrapper delegates to the original method for
 * every other call and is reference counted, so a second activation of the pack
 * (or its disposal) never wraps the method twice.
 */

/** The `translate` signature the runtime exposes and this module wraps. */
type Translate = (ns: string, key: string, params?: Record<string, unknown>) => string

/**
 * CLDR plural category to dictionary suffix. `other` covers fractions
 * («1,5 субагента») and keeps the caller's key instead of inventing a form.
 */
const SUFFIX_BY_CATEGORY: Readonly<Record<string, string | undefined>> = {
  one: 'one',
  few: 'few',
  many: 'many',
  other: undefined,
}

/** Count-driven dictionary keys end in `.one` / `.other`; the category replaces that suffix. */
const PLURAL_KEY = /^(.*)\.(?:one|other)$/u

/** One installation per prototype, shared by every activation that reaches it. */
interface Installation {
  readonly original: Translate
  readonly patched: Translate
  holders: number
}

/** Prototype to installation, so activation is reference counted rather than stacked. */
const installations = new WeakMap<object, Installation>()

/** `Intl.PluralRules` for Russian, or undefined where the runtime lacks it. */
function pluralRules(): Intl.PluralRules | undefined {
  return typeof Intl === 'undefined' || typeof Intl.PluralRules !== 'function'
    ? undefined
    : new Intl.PluralRules('ru')
}

/**
 * Numeric count carried by a translate call, from the harness convention
 * (`count`) or the workspace and archive keys (`n`).
 *
 * @param params - interpolation parameters of the call.
 * @returns the count, or undefined when the call carries none.
 */
function countOf(params: Record<string, unknown> | undefined): number | undefined {
  if (params === undefined) return undefined
  const raw = params.count ?? params.n
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : undefined
  if (typeof raw === 'string' && raw.trim() !== '') {
    const parsed = Number(raw)
    if (Number.isFinite(parsed)) return parsed
  }
  // The harness names its counts after the screen: `{shown}`, `{files}`,
  // `{turns}`, `{n}`. Reading the first numeric parameter lets a key the harness
  // never paired carry forms of its own; a form is substituted only when the
  // dictionary actually has it, so a misread count cannot invent a translation.
  for (const value of Object.values(params)) {
    if (typeof value === 'number' && Number.isFinite(value)) return value
  }
  return undefined
}

/**
 * Active locale id as the runtime publishes it.
 *
 * @param receiver - the runtime instance a translate call runs on.
 * @returns the active locale, or undefined on a runtime that does not expose it.
 */
function activeLocale(receiver: unknown): string | undefined {
  const snapshot = (receiver as { getLocale?: () => { active?: string } }).getLocale?.()
  return snapshot?.active
}

/**
 * Translate one key, substituting the Russian form its count calls for.
 *
 * @param original - the runtime's own `translate`.
 * @param rules - Russian plural rules.
 * @param receiver - the runtime instance.
 * @param ns - locale namespace.
 * @param key - dictionary key.
 * @param params - interpolation parameters.
 * @returns the translated string.
 */
function translateWithPlurals(
  original: Translate,
  rules: Intl.PluralRules,
  receiver: unknown,
  ns: string,
  key: string,
  params?: Record<string, unknown>,
): string {
  if (activeLocale(receiver) === 'ru') {
    const count = countOf(params)
    if (count !== undefined) {
      const suffix = SUFFIX_BY_CATEGORY[rules.select(count)]
      if (suffix !== undefined) {
        // A key the harness pairs with `.one` / `.other` gets its suffix replaced.
        // A key it never paired — `terminal.expand`, whose count it passes to the
        // plain key — is looked up as `<key>.<category>` instead, which is how the
        // pack inflects a noun the harness does not ask about by name.
        const paired = PLURAL_KEY.exec(key)
        const candidate = paired !== null ? `${paired[1]}.${suffix}` : `${key}.${suffix}`
        // The runtime answers with the key itself when no dictionary carries it.
        if (candidate !== key && original.call(receiver, ns, candidate, undefined) !== candidate) {
          return original.call(receiver, ns, candidate, params)
        }
      }
    }
  }
  return original.call(receiver, ns, key, params)
}

/** Drop one holder and restore the method when the last one disposes. */
function release(prototype: object, installation: Installation): void {
  installation.holders -= 1
  if (installation.holders > 0) return
  installations.delete(prototype)
  const holder = prototype as { translate?: unknown }
  if (holder.translate === installation.patched) holder.translate = installation.original
}

/**
 * Start substituting Russian plural forms for count-driven strings.
 *
 * @param locale - the injected locale service instance.
 * @returns disposer restoring the runtime's own method.
 */
export function startRussianPlurals(locale: object): () => void {
  const prototype: object | null = Object.getPrototypeOf(locale) as object | null
  if (prototype === null) return () => {}

  const existing = installations.get(prototype)
  if (existing !== undefined) {
    existing.holders += 1
    return () => release(prototype, existing)
  }

  const holder = prototype as { translate?: unknown }
  const original = holder.translate
  if (typeof original !== 'function') return () => {}
  const rules = pluralRules()
  if (rules === undefined) return () => {}

  const own = original as Translate
  const patched: Translate = function (this: unknown, ns, key, params) {
    return translateWithPlurals(own, rules, this, ns, key, params)
  }
  const installation: Installation = { original: own, patched, holders: 1 }
  installations.set(prototype, installation)
  holder.translate = patched
  return () => release(prototype, installation)
}
