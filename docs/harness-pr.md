# Pull request text: Russian plugin descriptors

Everything below is ready to paste into a pull request against
`deepseek-ai/deepseek-harness`. The patch itself is `docs/harness-descriptors-ru.patch`:
32 new files, verified with `git apply --check` against the exported `dsh-v0.2.1-rc.2` tree.

---

**Title:** `i18n: add Russian (ru) plugin descriptors for the plugins a user can see`

**Body:**

Plugin names and descriptions on the Plugins page are not dictionary text. The loader reads
`locale/<language>.json` next to each package and builds a translation map from them
(`packages/boot/app-boot/src/package-meta.ts`, `dictionariesOf`), and the locale service
resolves that map without consulting registered dictionaries — its own documentation says
*"Plain strings stay verbatim; maps do not consult registered dictionaries"*
(`packages/client/locale/src/client/index.ts`, `resolveText`).

A consequence: a language pack can translate a plugin's *strings* but never its *name*. A
plugin's name is Russian only when the package itself ships `locale/ru.json`.

Measured across the tree at `dsh-v0.2.1-rc.2`:

| | |
|---|---|
| packages with `locale/en.json` | 221 |
| strings in them (`meta.title` / `meta.description`) | 221 / 35 |
| packages with `locale/zh.json` | 219 |
| packages with `locale/ru.json` | **0** |
| names a user actually reads (rather than a module identifier) | 34 |

Chinese descriptors are shipped almost everywhere; Russian ones nowhere. A Russian-speaking
user therefore sees English plugin names in the Plugins page, with any language pack
installed, and no pack can change that from the outside.

This pull request adds `locale/ru.json` for the 32 packages whose descriptor reads as a
label rather than as a module name — the ones a user recognises:

`dsh-client-ui-schedule`, `dsh-time-context`, `dsh-experimental-agent-team`,
`dsh-experimental-agent-team-profile`, `dsh-experimental-api-speech-to-text`,
`dsh-experimental-auto-review`, `dsh-experimental-badge-skill-bundle`,
`dsh-experimental-browser-use-chrome-devtools-mcp`, `dsh-experimental-browser-use-playwright-mcp`,
`dsh-experimental-client-ui-agent-team`, `dsh-experimental-client-ui-cot-translation`,
`dsh-experimental-client-ui-voice-input`, `dsh-experimental-computer-use-cua-driver-mcp`,
`dsh-experimental-computer-use-cua-driver-native`, `dsh-experimental-cot-translation-bundle`,
`dsh-experimental-inspector`, `dsh-experimental-inspector-profile`,
`dsh-experimental-plugin-market-bundle`, `dsh-experimental-ralph-bundle`,
`dsh-experimental-session-inspector`, `dsh-experimental-session-search`,
`dsh-experimental-session-titles-bundle`, `dsh-skill-badge`, `dsh-experimental-speech-to-text`,
`dsh-experimental-speech-to-text-sensevoice`, `dsh-experimental-terminal-bundle`,
`dsh-experimental-tool-agent-team`, `dsh-experimental-tool-worktree`,
`dsh-experimental-voice-input-bundle`, `dsh-schedule`, `dsh-subagent-claude-code`,
`dsh-subagent-codex`.

The remaining 189 descriptors are module names (`connection`, `api-gateway`, `ui-approval`).
They are identifiers, not labels, and translating them would make the Plugins page harder to
recognise, so they keep their English text.

Each file mirrors the fields its own `locale/en.json` declares — `title`, `description` or
both — and nothing else, so the shape the loader validates is unchanged. The English text was
translated, not copied from another pack: every `ru.json` here is a translation of the
`en.json` in the same directory.

Verification:

- the key set of every `ru.json` is identical to the key set of the `en.json` beside it
  (32 of 32, no extra and no missing field);
- the patch applies cleanly to the exported tree at `dsh-v0.2.1-rc.2`;
- a second `dsh web` instance booted from this tree shows «Команды агентов»,
  «Голосовой ввод», «Автоматическая проверка разрешений» and «Инструменты разработчика» in
  the Plugins page where the English titles used to be.

No test changes are needed: the loader already merges any `locale/<language>.json` it finds,
and the existing `package-meta` suite covers that path.

A follow-up worth considering separately: a gate that reports packages which ship
`locale/en.json` but no translation for a given language. It would name the 189 identifier
descriptors as false positives, so it needs a rule for what counts as a label.

---

## How the translations were produced and kept in step

The Russian text lives in this repository, not in the harness tree, so it can be reviewed and
regenerated:

- `src/client/descriptor-ru.json` — the translations, with an `en` snapshot of the text each one was
  made from;
- `npm run apply:descriptors -- <harness tree>` — writes the `locale/ru.json` files;
- `npm run check:descriptors -- <harness tree>` — fails when upstream rewrites a title, so a
  Russian name cannot silently stop saying what the English says;
- `npm run report:descriptors -- <harness tree>` — the measurement above, repeatable.

The translations themselves come from `@ragnoryok1/dsh-client-locale-ru`, the Russian
language pack for the harness web GUI, which already ships 55870 strings across 407 namespaces
and audits them against the harness tree in CI.
