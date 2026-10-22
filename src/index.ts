/**
 * Russian (ru) language pack, node half.
 *
 * The dictionary side is pure client contribution; this half exists for two reasons.
 * It makes the plugin appear in the host `cordis.yml` / Loader, and it carries the
 * switches of `src/options.ts` to the page: the browser half cannot read the profile
 * row, and the client boot graph carries no config, so the resolved switches are
 * published as one global through the webserver's index-injection table — the same
 * mechanism the client-modules host uses for `__DSH_BOOT__`.
 */
import type { Context } from '@deepseek-ai/cordis'
import { BOOT_OPTIONS_KEY, Config, normalizeOptions, type Options } from './options.ts'

export { Config }
export type { Options }

/**
 * One row of the webserver's injection table.
 *
 * Declared here rather than imported: the pack depends on `@deepseek-ai/dsh-client-locale`
 * and `@deepseek-ai/cordis` only, and a type-only import of the webserver package would
 * still have to be installed to compile. The host half listens for the table instead of
 * calling a service method, so an absent webserver is not an error — it only means the
 * browser keeps the defaults.
 */
interface IndexInjectionRow {
  /** A page-wide global: the renderer writes `globalThis[name] = value`. */
  kind: 'global'
  /** The global's name. */
  name: string
  /** The value to write. */
  value: unknown
}

/**
 * Host plugin body.
 *
 * `webServer` is optional on purpose: the pack also loads on surfaces that serve no
 * HTML (a desktop shell, a headless boot), and requiring the service there would keep
 * the whole plugin from activating — dictionaries and all.
 *
 * @param ctx - host root context.
 * @param config - the switches from the profile row; omitted means all on.
 */
export function apply(ctx: Context, config: Options = {}): void {
  const options = normalizeOptions(config)
  /*
   * The table is collected on every index render (`webserver/index-inject` emits each
   * time), so the row is pushed per render rather than kept in a queue: a later
   * `cordis.yml` edit reaches the next page load without restarting the host.
   */
  ;(ctx as unknown as {
    on(event: string, listener: (table: IndexInjectionRow[]) => void): () => void
  }).on('webserver/index-inject', table => {
    table.push({ kind: 'global', name: BOOT_OPTIONS_KEY, value: options })
  })
}
