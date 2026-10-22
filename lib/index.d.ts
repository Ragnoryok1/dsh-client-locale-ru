import { Context } from "@deepseek-ai/cordis";
//#region src/options.d.ts
/** Switches for the passes the pack runs on top of its dictionaries. */
interface Options {
  /** Russian screen typography: «ёлочки», em dashes, ellipses, non-breaking spaces. */
  typography?: boolean;
  /** Russian plural forms picked by `Intl.PluralRules('ru')` instead of the neutral label. */
  plurals?: boolean;
  /** Russian titles and descriptions for plugins whose package ships no Russian locale. */
  pluginNames?: boolean;
}
/** What a Standard Schema validation answers: the normalized options, or the reasons it is not one. */
type ValidationResult = {
  value: Options;
} | {
  issues: {
    message: string;
  }[];
};
/**
 * Config schema without a runtime dependency.
 *
 * The loader accepts any Standard Schema (`~standard.validate`), and this pack ships no
 * dependencies on purpose — a language pack that pulls a validator into every profile
 * to read three booleans is a bad trade. An unknown switch is an error rather than a
 * silent no-op: a typo in `typografy: false` would otherwise leave the pass running and
 * look like the option does not work.
 */
declare const Config: {
  '~standard': {
    version: 1;
    vendor: string;
    validate(value: unknown): ValidationResult;
  };
};
//#endregion
//#region src/index.d.ts
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
declare function apply(ctx: Context, config?: Options): void;
//#endregion
export { Config, type Options, apply };