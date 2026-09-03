/**
 * Russian (ru) language pack, browser half. Registers `ru` as an external
 * selectable language and contributes a `ru` dictionary for every client
 * locale namespace, following the language-pack pattern from
 * `@deepseek-ai/dsh-client-locale` (addLanguage + per-locale register).
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import { RU_DICTS, RU_LABEL } from './dicts.ts'

/** Required service: the locale registry that owns languages and dictionaries. */
export const inject = ['locale']

/**
 * Client plugin body: add `ru` to the selectable language catalog and register
 * a ru dictionary for every namespace this pack contributes. Registration is
 * an effect, so the contributed language and dictionaries are torn down with
 * this plugin's fiber.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(
    () => ctx.locale.addLanguage({ id: 'ru', label: RU_LABEL, fallback: 'en' }),
    'locale-ru: language',
  )
  for (const [ns, dict] of Object.entries(RU_DICTS)) {
    ctx.effect(() => ctx.locale.register(ns, 'ru', dict), `locale-ru: ${ns} dictionary`)
  }
}
