/**
 * Russian (ru) language pack, browser half. Registers `ru` as an external
 * selectable language and contributes a `ru` dictionary for every client
 * locale namespace, following the language-pack pattern from
 * `@deepseek-ai/dsh-client-locale` (addLanguage + per-locale register).
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import { RU_DICTS, RU_LABEL } from './dicts.ts'
import { startRussianPlurals } from './plural.ts'
import { startRussianPluginNames } from './plugin-names.ts'
import { startRussianTypography } from './typography.ts'
import { readBootOptions, type Options } from '../options.ts'

/** The switches, resolved from the host half's global and from any config passed in. */
export type Config = Options

/*
 * The browser half never receives the profile row's config — the client boot graph
 * carries none — so the host half publishes the switches as a global (see
 * `src/index.ts`) and this reads it. A config argument still wins when a host passes
 * one, which keeps the shape the loader documents for client plugins.
 */
const HOST_OPTIONS = readBootOptions()

/**
 * Skip only occupied slots; validation and unexpected service errors still fail.
 *
 * A skipped registration is remembered: the caller reports it, because a namespace that
 * stayed with another pack is a difference the user can only notice by looking at the
 * interface.
 */
function skipDuplicate(
  register: () => () => void,
  duplicateMessage: string,
  onDuplicate: (what: string) => void,
): () => void {
  try {
    return register()
  } catch (error) {
    if (!(error instanceof Error) || error.message !== duplicateMessage) throw error
    onDuplicate(duplicateMessage)
    return () => {}
  }
}

/** Required service: the locale registry that owns languages and dictionaries. */
export const inject = ['locale']

/*
 * The browser half never receives the profile row's config — the client boot graph
 * carries none — so the host half publishes the switches as a global and this reads
 * it. A config argument still wins when a host passes one, which keeps the shape the
 * loader documents for client plugins.
 */
const HOST_OPTIONS = readBootOptions()
/**
 * Run a Russian-only pass while Russian is the active language, and stop it on a switch.
 *
 * The typography rules and the plugin names are Russian: applying them while another
 * language is active would edit text this pack does not own — `"quotes"` would become
 * «quotes» in an English interface, and a plugin would be renamed in a language the
 * user did not choose. `locale/change` fires on a language switch only, not on
 * dictionary registration.
 *
 * @param ctx - client root context.
 * @param start - the pass to run, given the check that says whether Russian is active.
 * @returns a disposer stopping the pass and the subscription.
 */
function followLanguage(ctx: ClientContext, start: (isActive: () => boolean) => () => void): () => void {
  const isRussian = (): boolean => ctx.locale.getLocale().active === 'ru'
  let stop = isRussian() ? start(isRussian) : null
  const off = ctx.on('locale/change', () => {
    if (isRussian() && stop === null) {
      stop = start(isRussian)
    } else if (!isRussian() && stop !== null) {
      stop()
      stop = null
    }
  })
  return () => {
    off()
    stop?.()
    stop = null
  }
}

/**
 * Client plugin body: add `ru` to the selectable language catalog, register
 * a ru dictionary for every namespace this pack contributes, and start the
 * Russian plural and typography passes. Registration is an effect, so the
 * contributed language, dictionaries, the plural wrapper and the typography
 * observer are torn down with this plugin's fiber. Existing languages and
 * dictionaries belong to their first registrant: skip duplicates without
 * replacing or disposing those resources. The typography pass runs only while
 * Russian is the active language, and follows a switch through `locale/change`.
 * @param ctx - client root context.
 * @param config - the switches that turn the extra passes off; omitted means on.
 */
export function apply(ctx: ClientContext, config: Config = {}): void {
  /*
   * The language and every namespace can already be taken: by an earlier Russian pack, or
   * by a host that registers them itself. Either way the pack's own text is not what the
   * user will read, and the console is the only place to say so.
   */
  let languageTaken = false
  const lostNamespaces: string[] = []
  const report = (what: string): void => {
    if (what.includes('already registered')) {
      languageTaken = true
      return
    }
    lostNamespaces.push(what)
  }
  ctx.effect(
    () => skipDuplicate(
      () => ctx.locale.addLanguage({ id: 'ru', label: RU_LABEL, fallback: 'en' }),
      'locale "ru" is already registered',
      report,
    ),
    'locale-ru: language',
  )
  for (const [ns, dict] of Object.entries(RU_DICTS)) {
    ctx.effect(
      () => skipDuplicate(
        () => ctx.locale.register(ns, 'ru', dict),
        `locale namespace "${ns}" already has locale "ru"`,
        report,
      ),
      `locale-ru: ${ns} dictionary`,
    )
  }
  if (languageTaken || lostNamespaces.length > 0) {
    const parts = [
      languageTaken ? 'язык ru уже занят другим пакетом' : null,
      lostNamespaces.length > 0 ? `наши словари не зарегистрированы в ${lostNamespaces.length} namespace` : null,
    ].filter(part => part !== null)
    console.warn(
      `[dsh-client-locale-ru] ${parts.join('; ')}. В интерфейсе останется перевод другого пакета — оставьте в профиле один пакет с русским языком.`,
    )
  }
  /*
   * The three passes below are extras on top of the dictionaries. Each is skipped
   * when its switch says so: `false` disables it, anything absent keeps the previous
   * behaviour. The check is written as `!== false` rather than a truthiness test so
   * that a config which never mentions the key reads as «on».
   */
  if (config.plurals !== false) {
    ctx.effect(
      () => startRussianPlurals(ctx.locale),
      'locale-ru: plurals',
    )
  }
  /*
   * The typography rules are Russian: guillemets instead of straight quotes, an
   * em dash between words, a non-breaking space after a short word. Applying them
   * while another language is active would edit text this pack does not own —
   * `"quotes"` would become «quotes» in an English interface — so the pass follows
   * the language, not the installation. `locale/change` fires on a language
   * switch only, not on dictionary registration.
   */
  if (config.typography !== false) {
    ctx.effect(
      () => followLanguage(ctx, isRussian => startRussianTypography(document, isRussian)),
      'locale-ru: typography',
    )
  }
  /*
   * A plugin's name comes from the plugin's own locale file, which no dictionary can
   * reach, so a Russian name exists only where the pack carries it. The pass rewrites
   * the rendered name and description, and follows the language like the typography.
   */
  if (config.pluginNames !== false) {
    ctx.effect(
      () => followLanguage(ctx, isRussian => startRussianPluginNames(document, isRussian)),
      'locale-ru: plugin names',
    )
  }
}
