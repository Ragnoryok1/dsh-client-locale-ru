<!-- deepseek-harness-meta
{
  "name": "Russian (ru) language pack for DeepSeek Harness",
  "version": "0.2.0",
  "tags": ["localization", "russian", "i18n", "web-gui", "language-pack"],
  "description": "Full Russian interface for the DeepSeek Harness web GUI: 53 namespaces, 2418 translated strings, Russian screen typography, and a locale audit in CI pinned to a harness tag. Includes the automation-task manager and the reminder catalog.",
  "icon": "https://raw.githubusercontent.com/Ragnoryok1/dsh-client-locale-ru/main/assets/icon.png",
  "compatible_versions": ["v0.2.1-alpha.1", "v0.2.0-rc.2", "v0.2.0-rc.1", "v0.1.7-rc.2", "v0.1.7-rc.1", "v0.1.7-alpha.2"],
  "screenshots": "images",
  "install_method": "dsh plugin --profile web add @ragnoryok1/dsh-client-locale-ru"
}
-->

# @ragnoryok1/dsh-client-locale-ru

[Русский](README.md) | **English** | [中文](README.zh.md)

![Russian language pack for DeepSeek Harness](assets/banner.png)

[![npm](https://img.shields.io/npm/v/%40ragnoryok1%2Fdsh-client-locale-ru)](https://www.npmjs.com/package/@ragnoryok1/dsh-client-locale-ru)
[![license](https://img.shields.io/npm/l/%40ragnoryok1%2Fdsh-client-locale-ru)](LICENSE)
[![verify](https://github.com/Ragnoryok1/dsh-client-locale-ru/actions/workflows/verify.yml/badge.svg)](https://github.com/Ragnoryok1/dsh-client-locale-ru/actions/workflows/verify.yml)
[![dsh](https://img.shields.io/badge/dsh-0.2.1--alpha.1%2B-6366f1)](https://github.com/deepseek-ai/deepseek-harness)
[![namespaces](https://img.shields.io/badge/namespaces-53-6466f1)](https://github.com/Ragnoryok1/dsh-client-locale-ru)
[![strings](https://img.shields.io/badge/strings-2%2C418-6466f1)](https://github.com/Ragnoryok1/dsh-client-locale-ru)

Russian (`ru`) language pack for the [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) web GUI (`dsh`). It registers `ru` as a selectable client language through the locale service (`ctx.locale.addLanguage`) plus one dictionary per namespace — 53 namespaces, 2,418 strings, built against dsh `0.2.1-alpha.1`. Install with `dsh plugin --profile web add @ragnoryok1/dsh-client-locale-ru`, then pick **Русский** in Settings → General. Missing keys fall back to English, so a newer harness keeps working. The scope is the harness's own client interface only — third-party plugin dictionaries are deliberately out of scope, and 11 of the 17 most-downloaded ecosystem plugins ship no strings of their own, so they are already Russian through these namespaces. MIT, community-maintained, not affiliated with DeepSeek.

> **If the pack was useful to you, please star the repository.** It is the only signal that a
> translation is wanted, and it is what decides which parts get worked on next.

---

## What it looks like

Russian in the language list and the translated settings sections (the screenshots were taken in build `0.1.8`):

![Settings in Russian: language, appearance, themes](images/settings-ru.png)

![Built-in plugins in Russian: the counting unit «N плагинов»](images/plugins-ru.png)

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

## Why hybrid

`dsh web` takes client (UI) plugins only from **workspace packages**, and an external npm package carrying just a `dsh.client` is not picked up. For an external plugin with a UI half to be installable, it has to declare **`dsh.bundle`** (the profile layer), whose `cordis.patch.yml` adds the client entry `locale-ru` to the browser roster through `- insert:`. Other third-party plugins are built the same way (for example `@zseven-w/dsh-android`).

## How it works

- **Host half** (`lib/index.js`) — an empty `apply()`: a language plugin needs no server logic, it only provides a valid cordis entry for the Loader.
- **Browser half** (`lib/client.js`) — registers `ru` and the dictionaries through the `locale` service (injected from `ctx`). There are no framework runtime imports — only the service.
- **No runtime dependencies** — `lib/client.js` imports no other packages, so it does not drag in heavy dependencies.
- **Effects** — the language and the dictionaries are registered through `ctx.effect(...)`, so they are unloaded together with the plugin (HMR-safe).
- **Plural forms** — the locale contract carries no pluralization rules (there is no ICU/`Intl.PluralRules`), and
  components choose the form as `count === 1 ? 'ключ.one' : 'ключ.other'`. Russian
  requires three forms for `n ≥ 2` (2 задачи / 5 задач), so a single `.other` string cannot
  be correct every time. The package solves this **without** changing upstream: `.one` (which is exactly `n = 1`)
  holds the natural form, while `.other` holds a construction that is correct for any `n ≥ 2`
  («Субагентов: 3», «Фоновых задач: 5») or an invariant abbreviation («каждые 2 ч»,
  «ещё 3 стр.»). No visible string shows the wrong number form.
- **Fallback** — a missing Russian key falls back to `en` (the configured `fallback`).

## Typography

The package brings already-rendered Russian text into line with typographic rules: guillemets
(«ёлочки») instead of straight quotes, an em dash instead of a hyphen between words, an ellipsis
instead of three dots, and a non-breaking space between a number and the following word or unit
of measurement (so that «187 плагинов» does not break across two lines). The rules are deliberately
conservative: they fire only on unambiguous patterns, and code, input fields, editable text and
elements with `data-typography="off"` are not touched at all. A second pass changes nothing.

The rules are checked by a script rather than by eye: `npm run check:typography`.

## Checks

```sh
npm run build             # сборка трёх выходов
npm run check:typography  # 12 правил типографики, включая «не трогать»
npm run audit -- <дерево харнеса>   # аудит локали
npm run verify -- <дерево харнеса>  # всё вместе
```

The audit runs in CI (`.github/workflows/verify.yml`) against a **pinned harness tag**,
not against some random local checkout. Two things are gated, and both have already caught
real defects:

- **dead namespaces** — every namespace the package registers has to
  exist in the harness. In 0.1.6 the schedule catalog translations were registered
  under the name `schedule.manager`, whereas `schedule.catalog` is what reads them: the per-key
  coverage check nonetheless reported «всё переведено»;
- **plural-form pairs** — the `.one`/`.other` sets have to match, because the client
  chooses the form as `count === 1 ? '.one' : '.other'`.

The coverage number is printed but is not a gate: an exact “add / remove” list
requires comparing keys **per namespace** (which the release tooling does), whereas comparing
key names globally would flag sections the package deliberately leaves in English.

## Coverage scope: the official interface only

The package translates **the harness client's own namespaces** — 53 namespaces, reconciled against
the pinned tag. Third-party plugin dictionaries are deliberately out of scope, and here is
why.

We checked the 17 most-downloaded plugins in the ecosystem (npm, `keywords:dsh-plugin`,
monthly downloads) and looked at which of them ship strings of their own at all:

| What we found | Plugins |
|---|---|
| **No strings of their own** — the interface takes its text from harness namespaces | **11 of 17** |
| A large dictionary of their own (confirmed by hand) | 2 — `dshmarket` (~1262 keys), `@nanmicoder/dsh-agent-teams` (420) |
| `.d.ts` types only, no strings | 1 — `dsh-plugin-model-proxy` |
| Needs a separate check | 3 |

The practical consequence: for **11 of the 17** most popular plugins the Russian interface
already works — their text lives in the shared harness namespaces, which the package translates
in full. A separate dictionary is needed only where a plugin carries strings of its own, and such
a dictionary is a commitment to track someone else's releases: `dshmarket` is already at version 1.66.3,
and its keys change independently of the harness.

That is why there is one package and one commitment here: **the official interface, translated and
verified**, with no race after other people's dictionaries. Need a specific plugin? Open an issue:
a dictionary for it is possible as a separate layer pinned to a version, rather than as a silent
promise that «покрыто всё».

## Development

```sh
pnpm install
pnpm run build     # tsdown -> lib/index.js (node half) + lib/client.js (client bundle)
npm pack           # -> ragnoryok1-dsh-client-locale-ru-<version>.tgz
```

`lib/client.js` is built in the format the `dsh` client loader understands (`__ModuleLoader__.load`) and exports `inject`/`apply`.

## Releases

Publishing to npm is done by the `publish` workflow on a tag — the credentials live in a repository
secret (`NPM_TOKEN`), so the token never has to be typed into a terminal or passed around.
Publishing by hand from a machine is possible, but unnecessary.

```
npm version 0.3.0 --no-git-tag-version      # поднять версию в package.json
# …и синхронно обновить версию в блоке deepseek-harness-meta в этом README
git commit -am "release: 0.3.0" && git tag v0.3.0 && git push origin v0.3.0
```

Before publishing, the workflow checks:

1. the version in the tag matches the version in `package.json`;
2. the version in the `deepseek-harness-meta` block matches `package.json` — the marketplace takes it from there,
   and reads it **only on first indexing**, so a mismatch does not fix itself;
3. the typography (12 rules);
4. the localization audit against the pinned harness tag — dead namespaces, duplicates and plural-form
   pairs will fail and stop the publication.

To check all the same things locally, without publishing:

```
npm run verify -- путь/к/дереву/харнесса
```

The workflow also has a manual run with a «только проверки, без публикации» toggle
(`workflow_dispatch` → `dry-run`).

## Contents

- `src/client/dicts.ts` — the Russian dictionaries (53 namespaces, 2418 translations, ~2900 lines). This is where the main value lies.
- `src/client/index.ts` — the client plugin entry point (registration of `ru` + the dictionaries).
- `src/index.ts` — the empty host half (`apply()`).
- `cordis.patch.yml` — the profile patch (`- insert:` of the client entry `locale-ru`).

## What is translated

The current set follows the harness tags: the keys were taken from the matching commit, and keys
added later fall back to `en` on lookup, so the package does not break the interface on newer versions.

### 0.1.7 — dead namespace fixed, task manager translated, plural forms rewritten

The headline item in the release is **a fix for a mistake from 0.1.6**. At the time it was recorded
that the namespace `schedule.catalog` had been retired and that `schedule.manager` had taken its place.
In reality **both** namespaces live in the harness, separately: `schedule.catalog` is the reminder
catalog in the session header with frequencies and units, `schedule.manager` is the new automation-task
manager. Because of that wrong conclusion, ~30 translation strings (reminders, frequency, time
units) were registered under a name nobody reads and were **never shown** in the interface. The
catalog is now registered as `schedule.catalog`.

- **fixed:** the schedule catalog translations are visible again — `trigger.*`, `list.*`,
  `delete.*`, `frequency.*`, `cron.*`, `unit.*`, `relative.*`, `mark.aria`, `hover.more`;
- **`schedule.manager` added** (188 keys) — the automation-task manager entirely in
  Russian: the task panel and catalog, search, status filter, task details and its tabs,
  the **run log** with retention rules, the schedule editor (date, time, hour, minute,
  second, time zone, repeat interval), repeat rules (once, every N minutes/hours/
  seconds, daily, Mon–Fri, weekly, custom cron), the cron form with date and minute
  pickers, deletion with confirmation, notifications and cards;
- **plural forms rewritten** (17 key pairs): forms that broke on the numbers 2–4
  were replaced with ones that are correct for any `n ≥ 2` — for example «2 субагентов» → «Субагентов: 2»,
  «каждые 2 часов» → «каждые 2 ч». Another 8 strings with `{count}` before an inflected word
  were switched to abbreviations: «ещё 3 строк» → «ещё 3 стр.»;
- **7 missing keys added**: `blocked.composer`,
  `defaultWorkspace.title`, `schedule.active`, `settings.transcript.expanded`,
  `status.scheduled`, `status.overdue` and the namespace `shortcuts.layout` (the label for
  the command that shows the left panel);
- **a new check in the project:** a namespace-name audit. The previous coverage check
  compared keys inside a namespace but never compared the names themselves, so an entire
  namespace could be registered under a non-existent name and quietly do nothing. Names
  are now extracted from every way they can be declared (`const NS`/`SETTINGS_NS`/`namespace`,
  `locale.register`, `locale.bind`, `PropsLocale<…>`) and compared as sets.

0.1.2 added sections that 0.1.1 did not have: `open-in-app` («Открыть в
приложении»), `sidebarFiles`, `sidebarRight` (the right sidebar with files) and
`sidebarCodePreview` (code preview). It also updated the keys that changed in
harness 0.1.5 and removed 21 keys that no longer exist there.

In 0.1.3 the package caught up with harness 0.1.6-alpha.1: 139 keys and 7 new
sections were added — `sidebarTerminal` (the terminal in the right sidebar), `settings.archivedSessions`
(archived sessions) and the document-preview family (`sidebarDocumentPreview`,
`documentHtml`, `sidebarImage`, `documentMarkdown`, `sidebarPdf`). Besides that, the experimental
«Автопроверка» was translated (`permission.access`: `auto.*`), along with the command-palette
labels and tokens, the endpoint fields in the model settings, and the
changes in `conversation`, `trajectory`, `chat`, `session-log-download`.
28 keys that had disappeared from the harness were removed.

The coverage check runs against the harness sources: for each namespace the
key sets are compared, so the next release starts from an exact
“add / check / remove” list.

In 0.1.6 the package caught up with harness **0.1.7-rc.2**: **252 keys** added, 18 updated,
26 removed, and two new namespaces added. The changes:

- **`shortcuts`** (new namespace, 56 keys) — the hotkey editor: recording
  a combination, conflicts, reserved combinations, hints for macOS and
  Windows, restoring the default values;
- **`schedule.manager`** (70 keys at the time) — the automation-task manager: list,
  deletion, repeat, run history, Cron expressions. **It was wrongly recorded that
  the namespace `schedule.catalog` had been retired by this; 0.1.7 fixed that — both
  namespaces exist side by side**;
- **`settings.account`** (50 keys) — the app's first launch: the welcome,
  the choice of purpose and of how much of the work is shown, topping up the balance, signing out of
  the account while tasks are running;
- added the labels for adding and removing tools on the fly
  (`message.tools*`, `trajectory.layout.*`), the right sidebar commands
  (`sidebarRight`), the «сначала выберите сессию» states in the panels, and updated
  the name of the settings section: «Инструменты для кода» instead of «Инструментов
  разработчика»;
- 18 keys updated to match the changed English text, 26 removed. A single term,
  «рабочая папка», instead of «рабочей области» in one place.

In 0.1.5 the package caught up with harness **0.1.7-rc.1**: **49 keys** added, 13 updated,
16 removed, and the namespace `directory-browser` dropped (it is gone in rc.1). There appeared
the labels for the steps tools go through (`message.stepProcess.prepare.*` and `done.*` —
reading images, writing files, preparing for code search, web search,
subagent coordination and others), full-screen image viewing
(`image.*`), the «Стандартный» and «Подробный» modes for showing the work, installing plugins
from GitHub with a timeout and a Chinese mirror, the warning about an incompatible
plugin version, the choice of model download source for voice input, and `Cordis` command
messages. The wording was tightened where upstream replaced “teammate/agent”
with “subagent” and “Beta” with “Experimental”.

0.1.5 also fixed the counting unit in the plugin inventory: it was «187 плагины»,
now it is «187 плагинов». The built-in interface screenshots were translated too, npm
keywords were added, and the peer range of `@deepseek-ai/dsh-client-locale`
(`>=0.1.0-rc.2 <0.2.0`) was fixed — previously `^0.1.0` did not resolve, because the package
is published only under prerelease versions.

In 0.1.4 the package caught up with harness **0.1.7-alpha.2** — the biggest jump:
**905 keys** added, 29 changed, 126 removed. New sections:

- **`pluginManager`** — the built-in plugin panel: installation, removal,
  enabling and disabling components, versions, registries and install hints;
- **`settings.account`** — the DeepSeek account: sign-in, balance, spend,
  API key;
- the separate settings sections the former `settings.plugins` split into:
  **`settings.agentLoop`**, **`settings.shell`**, **`settings.subagent`**,
  **`settings.webSearch`**;
- **`sidebarBrowser`** — the built-in browser in the right panel (address, sandbox,
  restoring the page);
- **`sidebarExcel`** and **`sidebarOffice`** — preview of Office spreadsheets and
  documents; zooming (`zoom.*`) was added to PDFs and images;
- **`voice-input`** — experimental voice input.

Also translated were the new texts in `conversation` (+194), `chat` (+53),
`workspace` (+43: session archive, pinning), `deliverables` (+31: the review of
work changes), `job` (+24: live output of background tasks), `settings` (+22:
desktop app update), `plan`, `open-in-app`, `trajectory`,
`model`, `reference`, `session-log-download`, and in the agent-mode
guides (`settings.agentPreset`, 12 long texts). The section
`settings.archivedSessions` was removed: in 0.1.7 upstream dropped that package, and the session
archive moved to `workspace`.

## License

MIT

## Changelog

[CHANGELOG.md](CHANGELOG.md) — what was in each release.
