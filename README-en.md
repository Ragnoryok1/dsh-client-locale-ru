<!-- deepseek-harness-meta
{
  "name": "Russian (ru) language pack for DeepSeek Harness",
  "version": "0.2.22",
  "tags": ["localization", "russian", "i18n", "web-gui", "language-pack"],
  "description": "Russian for the DeepSeek Harness web GUI: the whole interface plus the menus of 520 third-party plugins — 594 sections, 69 177 strings.",
  "icon": "https://raw.githubusercontent.com/Ragnoryok1/dsh-client-locale-ru/main/assets/icon.png",
  "compatible_versions": ["v0.2.2-alpha.2", "v0.2.1-rc.3", "v0.2.1-rc.2", "v0.2.1-rc.1", "v0.2.1-alpha.5", "v0.2.1-alpha.4", "v0.2.1-alpha.3", "v0.2.1-alpha.2", "v0.2.1-alpha.1", "v0.2.0-rc.2", "v0.2.0-rc.1", "v0.1.7-rc.2", "v0.1.7-rc.1", "v0.1.7-alpha.2"],
  "screenshots": "images",
  "install_method": "dsh plugin --profile web add @ragnoryok1/dsh-client-locale-ru"
}
-->

# @ragnoryok1/dsh-client-locale-ru

[Русский](README.md) | **English** | [中文](README-zh.md)

![Russian language pack for DeepSeek Harness](assets/banner.jpg)

[![npm](https://img.shields.io/npm/v/%40ragnoryok1%2Fdsh-client-locale-ru)](https://www.npmjs.com/package/@ragnoryok1/dsh-client-locale-ru)
[![license](https://img.shields.io/npm/l/%40ragnoryok1%2Fdsh-client-locale-ru)](LICENSE)
[![verify](https://github.com/Ragnoryok1/dsh-client-locale-ru/actions/workflows/verify.yml/badge.svg)](https://github.com/Ragnoryok1/dsh-client-locale-ru/actions/workflows/verify.yml)
[![dsh](https://img.shields.io/badge/dsh-0.2.2--alpha.2%2B-6366f1)](https://github.com/deepseek-ai/deepseek-harness)
[![namespaces](https://img.shields.io/badge/namespaces-594-6466f1)](https://github.com/Ragnoryok1/dsh-client-locale-ru)
[![strings](https://img.shields.io/badge/strings-69177-6466f1)](https://github.com/Ragnoryok1/dsh-client-locale-ru)

The plugin makes the [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) interface Russian. Everything you see is translated: settings, side panels, dialogs, hints, error messages — and the menus of third-party plugins that ship no Russian of their own.

The pack currently holds 594 sections and 69,177 strings, 520 of them dictionaries of third-party plugins — more than any other Russian pack for the harness I could find.

Install is one command: `dsh plugin --profile web add @ragnoryok1/dsh-client-locale-ru`; Russian is then picked in the settings, under General.

Beyond translation the pack does three things the harness cannot do by itself: it chooses the Russian plural form by the number instead of a neutral label, applies Russian typography («ёлочки», em dashes, ellipses), and translates plugin names whose package ships no locale of its own. Each extra can be turned off with one line in the profile — the translation stays.

The pack does not modify harness files and does not touch your data. If a newer harness adds a string the pack does not know yet, it stays English: the interface keeps working. MIT, maintained by the community, not affiliated with DeepSeek.

> **If the pack was useful to you, please star the repository.** It is the only signal that a
> translation is wanted, and it is what decides which parts get worked on next.

---

The complete inventory is in [NAMESPACES.md](NAMESPACES.md): 594 namespaces, 69,177 strings, with the bundled plugin dictionaries marked.

Plugins outside the harness tree are translated the same way, but their English text comes from their own publication: `plugins/<namespace>.json` records the package, the version, the licence and the strings extracted from its bundle. What is still English in your installation is shown by `npm run report:plugins`: it walks the profile's `node_modules`, finds each plugin's own dictionary and compares its keys with ours, and a plugin without a dictionary is reported as such — there is nothing to translate until it asks for one.

One family deserves a word of its own, `@linxin666`: thirteen dictionaries, each translated in full — from a few dozen strings to four hundred.

| Dictionary | Package | Strings |
|---|---|---|
| `update` | `@linxin666/dsh-update` | 43 |
| `git-graph` | `@linxin666/dsh-client-ui-git-graph` | 63 |
| `dsh-web-ui-usage` | `@linxin666/dsh-usage` | 67 |
| `dsh-web-ui-session-archive` | `@linxin666/dsh-session-archive` | 124 |
| `pet` | `@linxin666/dsh-pet` | 81 |
| `remote` | `@linxin666/dsh-remote-web-ui` | 117 |
| `dsh-skill-explorer` | `@linxin666/dsh-client-ui-skill-explorer` | 114 |
| `dsh-web-ui-market` | `@linxin666/dsh-client-ui-market` | 106 |
| `liangshen` | `@linxin666/dsh-liangshen` | 42 |
| `dsh-web-ui-preset-center` | `@linxin666/dsh-client-ui-preset-center` | 46 |
| `dsh-ssh` | `@linxin666/dsh-ssh` | 158 |
| `task-board` | `@linxin666/dsh-client-ui-task-board` | 439 |
| `task-board-github` | `@linxin666/dsh-client-ui-task-board-github` | 113 |
| **Total** | 13 dictionaries | **1,513** |

The names and descriptions of the plugins themselves on the Plugins page cannot come from this pack: the harness keeps them in `locale/<language>.json` inside each package and builds a translation map from them, and `resolveText` in the locale service does not consult dictionaries at all. 221 packages ship `locale/en.json`, 219 ship `locale/zh.json`, and **none ships `locale/ru.json`**: those 261 strings stay English with any language pack. `scripts/descriptor-coverage.mjs` counts that gap; the mechanism and the 32 prepared translations are in [docs/descriptor-upstream.md](https://github.com/Ragnoryok1/dsh-client-locale-ru/blob/main/docs/descriptor-upstream.md).

Another pack's Russian is never copied: there would be nothing to verify it against, while the audit compares our value with the English template of that same plugin. And one warning for the future: if the profile holds a second pack that registers Russian itself, the language belongs to whoever registered it first — the other one silently skips its namespaces, and the interface ends up showing someone else's translation.

## What it looks like

Russian in the language list and the translated settings sections (the screenshots were taken in build `0.1.8`:
the same screen, but the wording and some sections have changed since — the font-size caption, for one, now reads
«Влияет только на содержимое диалога»):):

![Settings in Russian: language, appearance, themes](images/settings-ru.png)

![The plugin list in Russian: section headings and the «Экспериментально» badges](images/plugins-ru.png)

Both screenshots are cropped at the left edge of the panel: workspace and session names are
not in frame.

Russian locale (`ru`) for the [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) web GUI (`dsh`).

The plugin adds **Russian** as a selectable language through the locale's language-pack contract: `ctx.locale.addLanguage({ id: 'ru', label: 'Русский', fallback: 'en' })` plus one `ru` dictionary per namespace. Once **Русский** is picked in Settings → General, the interface switches over immediately.

> **If the package was useful to you, give it a star.** It is the only way to show that a
> translation is wanted, and it genuinely affects which tasks get taken on. Not a single
> “like” button in the interface does that.
>
> The repository, meanwhile, remains the place where the state of the translation is visible:
> a [CHANGELOG](CHANGELOG.md) breaking down every release (including the mistakes that were found
> in it by its own maintainers), the CI checks, and the list of what is deliberately not translated.

## Installation

This is a **hybrid plugin** (`dsh.bundle` + `dsh.client`), so it installs as an ordinary profile bundle through `dsh plugin`:

```sh
dsh plugin --profile web add @ragnoryok1/dsh-client-locale-ru
```

After that, the next time `dsh web` starts, **Русский** will appear in the settings. A separate `pnpm add` into a built `dsh web` is not needed — the plugin pulls in the built-in locale through the `locale` service.

If pnpm answers `ERR_PNPM_NO_MATURE_MATCHING_VERSION`, that is not a broken package but a
maturity policy: a profile refuses versions published less than 48 hours ago. Wait a day or
two (the message names the version) or drop the `minimumReleaseAge` limit in the profile
settings.
The manifest is checked against the harness's own rules rather than by eye (`npm run check:manifest`, part of `verify`). Each rule was read out of the harness sources and each is a failure the user would otherwise meet first: `parseDshClient` accepts `platform` as any string while the consumers keep only `platform === 'web'`, so a typo like `'Web'` would **silently drop** the client half; a declared `dsh.client` without the `./client` export makes `client-modules` throw; and `dsh.bundle.patch` has to point at a file that exists.

Installing from GitHub works too: `dsh plugin --profile web add Ragnoryok1/dsh-client-locale-ru` (the form the plugin catalogue generates, without the npm scope) installs the repository archive, and the built `lib/` is committed — no build runs on your machine, and none is needed. That is exactly why `npm run check:built` (part of `verify`) rebuilds `lib/` and compares it with the commit: a stale bundle in git would reach the user, while the audit would never see it, because the audit reads the sources. The published package is 2019 kB: the banner ships as JPEG, and the icon and source map stay out of the npm payload.

## Why hybrid

`dsh web` takes client (UI) plugins only from **workspace packages**, and an external npm package carrying just a `dsh.client` is not picked up. For an external plugin with a UI half to be installable, it has to declare **`dsh.bundle`** (the profile layer), whose `cordis.patch.yml` adds the client entry `locale-ru` to the browser roster through `- insert:`. Other third-party plugins are built the same way (for example `@zseven-w/dsh-android`).

## How it works

- **Host half** (`lib/index.js`) — an empty `apply()`: a language plugin needs no server logic, it only provides a valid cordis entry for the Loader.
- **Browser half** (`lib/client.js`) — registers `ru` and the dictionaries through the `locale` service (injected from `ctx`). There are no framework runtime imports — only the service.
- **No runtime dependencies** — `lib/client.js` imports no other packages, so it does not drag in heavy dependencies.
- **Effects** — the language and the dictionaries are registered through `ctx.effect(...)`, so they are unloaded together with the plugin (HMR-safe).
- **Plural forms** — the locale contract carries no pluralization rules: components choose the
  form as `count === 1 ? 'key.one' : 'key.other'`, while Russian needs three (1 вызов /
  2 вызова / 5 вызовов). The package takes that over: alongside `.one` and `.other` the
  dictionaries carry `.few` and `.many`, and a wrapper around the runtime's `translate`
  recomputes the form with `Intl.PluralRules('ru')` for any call carrying a numeric `count`
  or `n`. The number decides, not the key the component picked, so «2 вызова инструментов»
  and «5 вызовов инструментов» come out of the same call site. The forms are not limited to
  paired keys: where the harness passes a number to a key it never paired (`terminal.expand`
  with `{n}`), the pack adds its own `.one` / `.few` / `.many` — «Показать ещё 1 строку /
  3 строки / 7 строк» — and the wrapper looks a form up for those keys too. Where a form does
  not fit (a sentence carrying several numbers), the value is rewritten to be count-neutral:
  «Символов: {total}» instead of «{total} символов», «файлов: {files}» instead of
  «{files} файлов». Checked by `npm run check:plural` at counts 0, 1, 2, 3, 5 and 22, on an
  unpaired key, on a fractional count, and on a foreign language pack whose forms our rules
  must not rewrite.
- **Fallback** — a missing Russian key falls back to `en` (the configured `fallback`).

## Typography

The package brings already-rendered Russian text into line with typographic rules: guillemets
(«ёлочки») instead of straight quotes, an em dash instead of a hyphen between words, an ellipsis
instead of three dots, a non-breaking space between a number and the following word or unit of
measurement (so that «187 плагинов» does not break across two lines), and the same space after a
short word — a preposition, a conjunction or a particle — so that «в режим» wraps as a whole
instead of leaving «в» alone at the end of a line. The rules are deliberately conservative: they
fire only on unambiguous patterns, and code, input fields, editable text and elements with
`data-typography="off"` are not touched at all. A second pass changes nothing.

A rule for numeric ranges (an en dash in «5–10») is **deliberately absent**: the only string in
the whole pack with a hyphen between digits is the cron example `0 9 * * 1-5`, and a dash would
corrupt it. Measured, not assumed.

The rules are checked by a script rather than by eye: `npm run check:typography`.

The pass itself sees text nodes only, while a dictionary value also travels into attributes —
`title`, `aria-label`, `placeholder` — that it never reaches. The values are therefore checked
separately: the pack may not contain a straight quote, a hyphen standing for a dash, a dash
without spaces, or three dots. Otherwise the same string would look different depending on
where it landed, and in a hint or a screen-reader label the rules would not work at all.

Text that changes **after** the first pass — token counters, timers, progress — is rewritten
again, so a live «4 с» keeps its non-breaking space. This is checked on a real document rather
than on strings: `npm run check:typography:dom` (jsdom, six cases — the first pass, a later text
change, an added subtree, disposal, a foreign language, and a language switch).

The pass runs **only while Russian is active**: the rules are Russian, and applying them to
another language would edit text this pack does not own — `"quotes"` would become «quotes» in an
English interface. The pack listens to `locale/change` and starts or stops the pass on a switch
rather than on installation.

## Plugin names

A plugin's name comes from its own `locale/<language>.json` file, and the locale service
resolves that map without consulting registered dictionaries — its own documentation says
«maps do not consult registered dictionaries». A dictionary therefore cannot translate a
plugin's name: the pack has no access to another package's map, and the English name stays
English until the plugin itself ships `locale/ru.json`.

The pack carries those names itself: the names of the 32 harness plugins and the names and
descriptions of 33 third-party plugins whose dictionaries it translates. Each comes with the
English text the translation was made from and the Russian text. The rendered interface passes
through a pass that puts the Russian text where the English was — in the plugin cards, in the
rows of a bundle, on a plugin's page and in the settings inventory. The accessible name
(`aria-label`) is replaced too, so a card is read in Russian as a whole.

The pass matches exactly: a string is replaced only when the whole string is one of the titles
or descriptions the pack knows. A sentence that merely mentions a name keeps its wording;
code, input fields and the conversation are not touched. Like the typography pass, it runs
only while Russian is the active language.

The same 32 names go to the harness as a patch (`docs/harness-descriptors-ru.patch`): in the
harness interface the plugins are named in Russian, and the patch gets there first. The patch
is a build artefact — it is built from the translations and the harness tree, and the gate
`npm run check:descriptor-patch` fails when the built patch and the committed one differ.
The third-party names live in `src/client/plugin-names-ru.json`: the file is built from the
vendored plugin dictionaries (`npm run build:plugin-names`), and the gate
`npm run check:plugin-names:map` fails when the map has drifted from the dictionaries. The same
English name cannot be translated two ways — differently in the harness and in a plugin.
`npm run check:plugin-names` proves on a real document (jsdom, 12 cases) that the pass
translates the title, the description, the accessible name and a bundle row — and leaves what
it must alone.


## License

MIT

## Changelog

[CHANGELOG.md](CHANGELOG.md) — what was in each release.
