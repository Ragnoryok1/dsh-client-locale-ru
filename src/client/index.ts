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
import { startRussianTypography } from './typography.ts'

/** Skip only occupied slots; validation and unexpected service errors still fail. */
function skipDuplicate(register: () => () => void, duplicateMessage: string): () => void {
  try {
    return register()
  } catch (error) {
    if (!(error instanceof Error) || error.message !== duplicateMessage) throw error
    return () => {}
  }
}

/** Required service: the locale registry that owns languages and dictionaries. */
export const inject = ['locale']

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
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(
    () => skipDuplicate(
      () => ctx.locale.addLanguage({ id: 'ru', label: RU_LABEL, fallback: 'en' }),
      'locale "ru" is already registered',
    ),
    'locale-ru: language',
  )
  for (const [ns, dict] of Object.entries(RU_DICTS)) {
    ctx.effect(
      () => skipDuplicate(
        () => ctx.locale.register(ns, 'ru', dict),
        `locale namespace "${ns}" already has locale "ru"`,
      ),
      `locale-ru: ${ns} dictionary`,
    )
  }
  ctx.effect(
    () => startRussianPlurals(ctx.locale),
    'locale-ru: plurals',
  )
  /*
   * The typography rules are Russian: guillemets instead of straight quotes, an
   * em dash between words, a non-breaking space after a short word. Applying them
   * while another language is active would edit text this pack does not own —
   * `"quotes"` would become «quotes» in an English interface — so the pass follows
   * the language, not the installation. `locale/change` fires on a language
   * switch only, not on dictionary registration.
   */
  ctx.effect(() => {
    const isRussian = (): boolean => ctx.locale.getLocale().active === 'ru'
    let stop = isRussian() ? startRussianTypography(document, isRussian) : null
    const off = ctx.on('locale/change', () => {
      if (isRussian() && stop === null) {
        stop = startRussianTypography(document, isRussian)
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
  }, 'locale-ru: typography')
}
