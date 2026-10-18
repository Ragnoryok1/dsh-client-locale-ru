/**
 * Locale audits for the Russian pack, run in CI and by `npm run audit`.
 *
 * The harness tree is passed as the first argument or in DSH_HARNESS_TREE and
 * must contain the `packages` directory of a harness checkout or tag export.
 *
 * Three checks gate the build, because each one has already caught a real
 * defect that a key-level comparison could not see:
 *
 *   namespaces   every namespace the pack registers must exist in the harness.
 *                In 0.1.6 the pack registered `schedule.manager` while the
 *                reminder catalog is `schedule.catalog`; ~30 translated strings
 *                were therefore registered under a name nothing reads, and a
 *                key-level coverage report still said "complete".
 *   plurals      the `.one`/`.other` key sets must match exactly, since the
 *                client picks the form as `count === 1 ? '.one' : '.other'`.
 *   placeholders a ru value must carry exactly the placeholders its English
 *                template carries. The service returns an un-parametrized
 *                template verbatim, so a placeholder the host never passes
 *                reaches the screen literally (`Заняло {duration}7мин 26с`,
 *                fixed in #2), and one the template has but the translation
 *                dropped silently removes interpolated data. Compared against
 *                `en`, falling back to `zh` for the packages that ship only the
 *                Chinese dictionary.
 *
 * Coverage counts are reported, not gated. An exact add/remove list needs a
 * per-namespace key diff, which is the release tooling's job; comparing key
 * names globally would flag every namespace the pack deliberately leaves
 * English (experimental packages, test support, `transcriptView`).
 *
 * Usage: node scripts/audit.mjs [harnessTree]
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

const HARNESS = process.argv[2] ?? process.env.DSH_HARNESS_TREE ?? ''
const PACK = new URL('../src/client/dicts.ts', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/u, '$1')

if (!HARNESS || !existsSync(HARNESS)) {
  console.error('нужен путь к дереву харнеса: node scripts/audit.mjs <tree> (или DSH_HARNESS_TREE)')
  process.exit(2)
}

/** Recursive file list, skipping dependency and build directories. */
function walk(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'lib' || entry === 'dist' || entry === '.git') continue
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) out.push(...walk(path))
    else if (/\.tsx?$/u.test(path)) out.push(path)
  }
  return out
}

const isDictionary = path => /locales?(?:[.-][\w-]+)?\.ts$/u.test(path) || /[\\/]locales[\\/]/u.test(path)

/**
 * Collect `key:` positions outside string literals and comments.
 *
 * A plain regex also matches text inside values — `'Next scheduled time: '`
 * would report a key named `time` — so the text is walked with string and
 * comment state. Comments matter here: an apostrophe in prose ("this plugin's
 * fiber") would otherwise open a string that swallows the rest of the file.
 *
 * @param {string} text source of a module
 * @returns {string[]} keys written as `key:` or `'key':`
 */
function dictionaryKeys(text) {
  const keys = []
  let index = 0
  while (index < text.length) {
    const char = text[index]
    if (char === '/' && text[index + 1] === '/') {
      const end = text.indexOf('\n', index)
      index = end === -1 ? text.length : end
      continue
    }
    if (char === '/' && text[index + 1] === '*') {
      const end = text.indexOf('*/', index + 2)
      index = end === -1 ? text.length : end + 2
      continue
    }
    if (char === "'" || char === '"' || char === '`') {
      let cursor = index + 1
      while (cursor < text.length) {
        if (text[cursor] === '\\') { cursor += 2; continue }
        if (text[cursor] === char) break
        cursor += 1
      }
      if (text[cursor + 1] === ':') {
        const key = text.slice(index + 1, cursor)
        if (/^[\w.]+$/u.test(key)) keys.push(key)
      }
      index = cursor + 1
      continue
    }
    if (/[A-Za-z_$]/u.test(char)) {
      let end = index + 1
      while (end < text.length && /[\w$.]/u.test(text[end])) end += 1
      let after = end
      while (after < text.length && /\s/u.test(text[after])) after += 1
      if (text[after] === ':' && text[after + 1] !== ':') keys.push(text.slice(index, end))
      index = end
      continue
    }
    index += 1
  }
  return keys
}

/** Read one quoted literal at `at`, with the offset just past it. */
function readQuoted(text, at) {
  const quote = text[at]
  if (quote !== "'" && quote !== '"' && quote !== '`') return null
  let end = at + 1
  while (end < text.length) {
    if (text[end] === '\\') { end += 2; continue }
    if (text[end] === quote) break
    end += 1
  }
  return { value: text.slice(at + 1, end), end: end + 1 }
}

/** Read an identifier at `at`, with the offset just past it. */
function readIdentifier(text, at) {
  if (!/[A-Za-z_$]/u.test(text[at] ?? '')) return null
  let end = at
  while (end < text.length && /[\w$]/u.test(text[end])) end += 1
  return { name: text.slice(at, end), end }
}

/**
 * Read the text a dictionary value carries.
 *
 * Three shapes appear in the harness dictionaries, and only the first was read
 * at the start: a plain literal, an **array of paragraphs** (the preset guides
 * are stored that way), and a **reference to a constant** declared in the same
 * file (`'hint.plan': PLAN_NEXT_ACTION_EN`). The last two made a key look as if
 * the harness carried no text for it, which quietly exempted ten keys — eight of
 * them whole guide documents — from every comparison.
 *
 * @param {string} text - source of a module.
 * @param {number} from - offset just after the key's colon.
 * @param {Map<string, string>} constants - string constants declared in the file.
 * @returns {string|null} the text, or null when the value is something else.
 */
function readStringValue(text, from, constants = new Map()) {
  let start = from
  while (start < text.length && /\s/u.test(text[start])) start += 1
  const literal = readQuoted(text, start)
  if (literal !== null) return literal.value
  if (text[start] === '[') {
    const parts = []
    let cursor = start + 1
    while (cursor < text.length && text[cursor] !== ']') {
      const quoted = readQuoted(text, cursor)
      if (quoted !== null) { parts.push(quoted.value); cursor = quoted.end; continue }
      const reference = readIdentifier(text, cursor)
      if (reference !== null) {
        const resolved = constants.get(reference.name)
        if (resolved !== undefined) parts.push(resolved)
        cursor = reference.end
        continue
      }
      cursor += 1
    }
    return parts.length === 0 ? null : parts.join('\n')
  }
  const reference = readIdentifier(text, start)
  if (reference !== null) return constants.get(reference.name) ?? null
  return null
}

/**
 * String constants a module declares, so a value written as a name resolves to
 * its text. Only literals are collected: an imported constant stays unknown, and
 * a key using one is compared against nothing rather than against a guess.
 *
 * @param {string} text - source of a module.
 * @returns {Map<string, string>} name to text.
 */
function stringConstants(text) {
  const constants = new Map()
  for (const match of text.matchAll(/(?:^|\n)\s*(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*(?::[^=]*)?=\s*('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")/gu)) {
    constants.set(match[1], match[2].slice(1, -1))
  }
  return constants
}

/**
 * Collect `key: 'value'` pairs outside string literals and comments, with the
 * offset of each key so a harness file's dictionary (`zh` / `en`) can be told
 * apart. `dictionaryKeys` answers "which keys exist"; this answers "what does
 * the template say", which is what placeholder parity needs.
 *
 * Both key forms are read: many harness dictionaries write bare identifiers
 * (`panel: '插件'`, ui-plugin-manager), others quote them. Missing the bare form
 * silently exempted whole files from the placeholder check.
 *
 * @param {string} text source of a module
 * @returns {{key: string, value: string|null, index: number}[]} entries in file order
 */
function dictionaryEntries(text) {
  const entries = []
  const constants = stringConstants(text)
  let index = 0
  while (index < text.length) {
    const char = text[index]
    if (char === '/' && text[index + 1] === '/') {
      const end = text.indexOf('\n', index)
      index = end === -1 ? text.length : end
      continue
    }
    if (char === '/' && text[index + 1] === '*') {
      const end = text.indexOf('*/', index + 2)
      index = end === -1 ? text.length : end + 2
      continue
    }
    if (char === "'" || char === '"' || char === '`') {
      const start = index
      let cursor = index + 1
      while (cursor < text.length) {
        if (text[cursor] === '\\') { cursor += 2; continue }
        if (text[cursor] === char) break
        cursor += 1
      }
      if (text[cursor + 1] === ':') {
        const key = text.slice(start + 1, cursor)
        if (/^[\w.]+$/u.test(key)) entries.push({ key, value: readStringValue(text, cursor + 2, constants), index: start })
      }
      index = cursor + 1
      continue
    }
    if (/[A-Za-z_$]/u.test(char)) {
      let end = index + 1
      while (end < text.length && /[\w$.]/u.test(text[end])) end += 1
      let after = end
      while (after < text.length && /\s/u.test(text[after])) after += 1
      if (text[after] === ':' && text[after + 1] !== ':') {
        const key = text.slice(index, end)
        if (/^[\w.]+$/u.test(key)) entries.push({ key, value: readStringValue(text, after + 1, constants), index })
      }
      index = end
      continue
    }
    index += 1
  }
  return entries
}

/**
 * Dictionary a literal belongs to: the nearest preceding
 * `export const <name> = {` (with an optional type annotation). It tells the
 * English dictionary from the Chinese one, so the per-namespace report can show
 * the text a translator needs.
 *
 * @param {string} text - source of a module.
 * @param {number} index - offset of a key.
 * @returns {string|null} dictionary name, or null before the first one.
 */
function dictionaryScope(text, index) {
  let name = null
  for (const m of text.matchAll(/export\s+const\s+(\w+)\s*(?::[^=]*)?=\s*\{/gu)) {
    if (m.index > index) break
    name = m[1]
  }
  return name
}

/**
 * `{name}` placeholders of a template, sorted so two sides compare as multisets.
 *
 * @param {string} value template or translated text
 * @returns {string[]} placeholder names, sorted
 */
function placeholders(value) {
  return [...value.matchAll(/\{([A-Za-z_]\w*)\}/gu)].map(m => m[1]).sort()
}

const NOT_A_KEY = new Set([
  'en', 'zh', 'export', 'const', 'let', 'var', 'return', 'default', 'type', 'interface',
  'function', 'as', 'true', 'false', 'null', 'undefined', 'import', 'from',
  // Exported dictionary names and ordinary object properties, not locale keys.
  'primary', 'rest', 'value', 'namespace', 'guideZh', 'frequencyEn', 'onboardingEnglishCopy',
  't', 'key', 'dictionary', 'name', 'configurable',
])

/** Namespace names the harness owns, and where each claim was found. */
const harnessNamespaces = new Map()
const harnessKeys = new Map()

/** Every harness source file, walked once and reused by the reference probe. */
const HARNESS_FILES = walk(HARNESS)

/**
 * Key -> every template the harness renders for it.
 *
 * Grouping by key rather than by dictionary file is deliberate: most harness
 * dictionary files declare no namespace of their own — the consumer binds it —
 * so a file-to-namespace map is not derivable. Keeping every template means a
 * key that appears in several namespaces (`invalid` is in three) matches when
 * it matches any of them, while a placeholder no template carries is still a
 * failure.
 */
const harnessTemplates = new Map()

/** Namespace -> dictionary files whose keys it renders, from claims next to imports. */
const namespaceFiles = new Map()

/** Dictionary file -> the keys it defines, so a namespace's key set can be rebuilt. */
const fileKeys = new Map()

/** Dictionary file -> English template per key, for the per-namespace report. */
const fileEnglish = new Map()

/** Dictionary file -> English template per key, English dictionaries only. */
const fileEnglishOnly = new Map()

/**
 * Dictionary sources spell some characters as escapes — `'Creating\\u2026'` is an
 * ellipsis — so comparisons decode them first. A raw comparison reads that value
 * as ending in the digit `6` and invents a difference.
 *
 * @param {string} value - dictionary value as written in the source.
 * @returns {string} the value the runtime would see.
 */
const decoded = value => value.replace(/\\u([0-9a-fA-F]{4})/gu, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)))

/**
 * Key -> every English string the harness carries for it, from every dictionary
 * file, whatever namespace it belongs to. The residue check reads this rather
 * than the per-namespace map: a namespace whose dictionary is imported from
 * another directory (`common`, for one) has no per-namespace English, and a
 * leftover there would otherwise go unnoticed.
 */
const englishValuesByKey = new Map()

/**
 * Key -> its English values, collected from English dictionaries only.
 *
 * A namespace whose dictionary file is an aggregate (`locales/index.ts`
 * re-exporting the rest) declares no `en` of its own, so the per-namespace map
 * has nothing for `common` — and a comparison that silently skips a whole
 * namespace is worse than one that reports. A key with exactly one English
 * wording can be compared against it whatever the namespace; a key with several
 * wordings stays unchecked, because they are not interchangeable.
 */
const englishVariantsByKey = new Map()

/**
 * Record that a namespace renders the keys of a dictionary file.
 *
 * @param {string} namespace - locale namespace.
 * @param {string} file - absolute path of the dictionary file.
 */
function addNamespaceFile(namespace, file) {
  if (!namespaceFiles.has(namespace)) namespaceFiles.set(namespace, new Set())
  namespaceFiles.get(namespace).add(file)
}

/**
 * Dictionary files a module imports through a relative specifier.
 *
 * Most harness dictionaries declare no namespace of their own — the component
 * that registers them does — so the consumer's import is what ties a namespace
 * to the keys it renders. Without that link a per-namespace comparison is not
 * possible, and a key translated under the wrong namespace looks covered while
 * the screen it belongs to falls back to English.
 *
 * @param {string} file - absolute path of the importing module.
 * @param {string} text - source of the module.
 * @returns {Set<string>} absolute paths of imported dictionary files.
 */
function importedDictionaries(file, text) {
  const found = new Set()
  const own = dirname(file)
  for (const m of text.matchAll(/from\s+'(\.[^']+\.ts)'/gu)) {
    const resolved = resolve(own, m[1])
    // Same directory only: a cross-directory import is usually an aggregate
    // (`locales/index.ts` re-exporting many dictionaries), and attributing its
    // keys to the claiming namespace invents gaps the runtime does not have.
    if (dirname(resolved) === own && isDictionary(resolved)) found.add(resolved)
  }
  return found
}

/**
 * Imported bindings that resolve to a dictionary file, wherever it lives.
 *
 * The same-directory rule above leaves the locale package's own two namespaces
 * unattributed: `client/index.ts` takes `common` from `../locales/index.ts` and
 * `settings.locale` from `../locales/settings.ts`. Reading the register call's
 * bindings pins each namespace to the exact file it renders, without the
 * over-attribution a bare cross-directory import would cause.
 *
 * @param {string} file - absolute path of the importing module.
 * @param {string} text - source of the module.
 * @returns {Map<string, string>} binding name to dictionary path.
 */
function importedBindings(file, text) {
  const bindings = new Map()
  for (const m of text.matchAll(/import\s+(?:type\s+)?\{([^}]*)\}\s*from\s+'(\.[^']+\.ts)'/gu)) {
    const resolved = resolve(dirname(file), m[2])
    if (!isDictionary(resolved)) continue
    for (const raw of m[1].split(',')) {
      const name = raw.trim().replace(/^type\s+/u, '').split(/\s+as\s+/u).pop()?.trim()
      if (name !== undefined && name !== '') bindings.set(name, resolved)
    }
  }
  return bindings
}

for (const file of HARNESS_FILES) {
  const text = readFileSync(file, 'utf8')
  const claims = new Set()
  const owns = new Set()
  const claim = (name, why) => {
    claims.add(name)
    if (!harnessNamespaces.has(name)) harnessNamespaces.set(name, `${file} (${why})`)
  }
  for (const m of text.matchAll(/(?:export\s+)?const\s+[A-Za-z_]*NS[A-Za-z_]*\s*(?::\s*string)?\s*=\s*'([\w.]+)'/gu)) claim(m[1], 'const')
  for (const m of text.matchAll(/const\s+namespace\s*(?::\s*string)?\s*=\s*'([\w.]+)'/gu)) claim(m[1], 'namespace')
  for (const m of text.matchAll(/locale\.register\(\s*'([\w.]+)'/gu)) claim(m[1], 'register')
  for (const m of text.matchAll(/locale\.bind\(\s*'([\w.]+)'\s*\)/gu)) claim(m[1], 'bind')
  for (const m of text.matchAll(/PropsLocale<'([\w.]+)'>/gu)) claim(m[1], 'PropsLocale')
  /*
   * Ownership, not usage: a namespace declaration or a literal `register`
   * argument. `bind` and `PropsLocale` only read a namespace, and a component
   * that reads `settings.agentPreset` while importing its own dictionary would
   * otherwise donate that dictionary's keys to a namespace it does not own —
   * which is how plugin-inventory keys first appeared as agent-preset gaps.
   */
  for (const m of text.matchAll(/(?:export\s+)?const\s+[A-Za-z_]*NS[A-Za-z_]*\s*(?::\s*string)?\s*=\s*'([\w.]+)'/gu)) owns.add(m[1])
  for (const m of text.matchAll(/const\s+namespace\s*(?::\s*string)?\s*=\s*'([\w.]+)'/gu)) owns.add(m[1])
  for (const m of text.matchAll(/locale\.register\(\s*'([\w.]+)'/gu)) owns.add(m[1])
  /*
   * Identifier-based registration: `const NS = 'x'` plus
   * `locale.register(NS, { zh, en })`, where the bindings come from a dictionary
   * in another directory. Resolving the bindings pins the namespace to that
   * file without guessing.
   */
  const bindings = importedBindings(file, text)
  if (bindings.size > 0) {
    const byIdentifier = new Map()
    for (const m of text.matchAll(/(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*(?::\s*string)?\s*=\s*'([\w.]+)'/gu)) {
      byIdentifier.set(m[1], m[2])
    }
    for (const m of text.matchAll(/locale\.register\(\s*([A-Za-z_$][\w$]*)\s*,\s*\{([^}]*)\}/gu)) {
      const namespace = byIdentifier.get(m[1])
      if (namespace === undefined) continue
      for (const raw of m[2].split(',')) {
        const binding = (raw.includes(':') ? raw.split(':')[1] : raw).trim()
        const source = bindings.get(binding)
        if (source !== undefined) addNamespaceFile(namespace, source)
      }
    }
  }
  for (const imported of importedDictionaries(file, text)) {
    for (const name of owns) addNamespaceFile(name, imported)
  }
  if (!isDictionary(file)) continue
  // A dictionary that declares its own namespace serves it directly.
  for (const name of owns) addNamespaceFile(name, file)
  const keys = new Set(dictionaryKeys(text).filter(key => !NOT_A_KEY.has(key)))
  fileKeys.set(file, keys)
  for (const key of keys) {
    if (!harnessKeys.has(key)) harnessKeys.set(key, file)
  }
  /**
   * Keys this file really carries. `dictionaryKeys` also reads type members
   * (`trajectory: TrajectoryKey`), which are not dictionary entries, so the
   * per-namespace comparison uses entries with string values instead.
   */
  const stringKeys = new Set()
  const english = new Map()
  const fallback = new Map()
  for (const entry of dictionaryEntries(text)) {
    if (NOT_A_KEY.has(entry.key) || entry.value === null) continue
    stringKeys.add(entry.key)
    if (!harnessTemplates.has(entry.key)) harnessTemplates.set(entry.key, new Set())
    harnessTemplates.get(entry.key).add(entry.value)
    const scope = dictionaryScope(text, entry.index)
    if (scope === 'en') {
      if (!english.has(entry.key)) english.set(entry.key, decoded(entry.value))
    } else if (!fallback.has(entry.key)) {
      fallback.set(entry.key, decoded(entry.value))
    }
  }
  fileKeys.set(file, stringKeys)
  // English wins over the Chinese fallback for the same key.
  fileEnglish.set(file, new Map([...fallback, ...english]))
  fileEnglishOnly.set(file, english)
  for (const [key, value] of english) {
    if (!englishValuesByKey.has(key)) englishValuesByKey.set(key, new Set())
    englishValuesByKey.get(key).add(value)
    if (!englishVariantsByKey.has(key)) englishVariantsByKey.set(key, new Set())
    englishVariantsByKey.get(key).add(value)
  }
}

/**
 * Namespace -> keys the harness renders in it, rebuilt from the dictionaries
 * each namespace's owner imports or declares.
 */
const harnessNamespaceKeys = new Map()

/** Namespace -> English template per key, so a gap can be translated from the report. */
const namespaceEnglish = new Map()

/** Namespace -> English-only template per key, for comparisons with a Russian value. */
const namespaceEnglishOnly = new Map()
for (const [namespace, files] of namespaceFiles) {
  const keys = new Set()
  const english = new Map()
  const englishOnly = new Map()
  for (const file of files) {
    for (const key of fileKeys.get(file) ?? []) keys.add(key)
    for (const [key, value] of fileEnglish.get(file) ?? []) {
      if (!english.has(key)) english.set(key, value)
    }
    for (const [key, value] of fileEnglishOnly.get(file) ?? []) {
      if (!englishOnly.has(key)) englishOnly.set(key, value)
    }
  }
  harnessNamespaceKeys.set(namespace, keys)
  namespaceEnglish.set(namespace, english)
  namespaceEnglishOnly.set(namespace, englishOnly)
}

const packText = readFileSync(PACK, 'utf8')
const packNamespaceList = [...packText.matchAll(/^ {2}'([\w.]+)':\s*\{/gmu)].map(m => m[1])
const packNamespaces = new Set(packNamespaceList)
// A namespace declared twice shadows the earlier block in the object literal,
// silently dropping every translation in it while key coverage still looks
// complete. Counted before the Set collapses duplicates.
const namespaceTally = new Map()
for (const name of packNamespaceList) namespaceTally.set(name, (namespaceTally.get(name) ?? 0) + 1)
const duplicateNamespaces = [...namespaceTally].filter(([, count]) => count > 1).map(([name]) => name).sort()
const packEntries = dictionaryKeys(packText).filter(key => !NOT_A_KEY.has(key))
const packKeys = new Set(packEntries)
/**
 * Key -> every Russian value the pack carries for it. Several namespaces may
 * use the same bare key (`invalid`, `read`), so the values are collected rather
 * than first-wins: each of them has to match a template on its own.
 */
const packValues = new Map()
for (const entry of dictionaryEntries(packText)) {
  if (NOT_A_KEY.has(entry.key) || entry.value === null) continue
  if (!packValues.has(entry.key)) packValues.set(entry.key, new Set())
  packValues.get(entry.key).add(entry.value)
}
/**
 * Namespace -> keys the pack carries in it, read from the `  '<namespace>': {`
 * headings of `dicts.ts`.
 */
const packKeysByNamespace = new Map()

/** Namespace -> key -> Russian value, for the residue checks. */
const packValuesByNamespace = new Map()
const packHeadings = [...packText.matchAll(/^ {2}'([\w.]+)':\s*\{/gmu)].map(m => ({ name: m[1], index: m.index }))
const namespaceAt = index => {
  let name = null
  for (const heading of packHeadings) {
    if (heading.index > index) break
    name = heading.name
  }
  return name
}
for (const entry of dictionaryEntries(packText)) {
  if (NOT_A_KEY.has(entry.key) || entry.value === null) continue
  const namespace = namespaceAt(entry.index)
  if (namespace === null) continue
  if (!packKeysByNamespace.has(namespace)) packKeysByNamespace.set(namespace, new Set())
  packKeysByNamespace.get(namespace).add(entry.key)
  if (!packValuesByNamespace.has(namespace)) packValuesByNamespace.set(namespace, new Map())
  const byKey = packValuesByNamespace.get(namespace)
  if (!byKey.has(entry.key)) byKey.set(entry.key, entry.value)
}

const pluralSuffix = /\.(?:one|other)$/u
const harnessPlurals = new Set([...harnessKeys.keys()].filter(k => pluralSuffix.test(k)))
const packPlurals = new Set([...packKeys].filter(k => pluralSuffix.test(k)))
const deadNamespaces = [...packNamespaces].filter(ns => !harnessNamespaces.has(ns)).sort()
const missingPlurals = [...harnessPlurals].filter(k => !packPlurals.has(k)).sort()
/*
 * A pair the harness does not have is the pack's own augmentation: the harness
 * passes some counts to a plain key (`terminal.expand` with `{n}`), and forms
 * there are the only way to inflect the noun. Such a pair is legitimate as long
 * as its base is translated; a pair whose base is missing too is drift.
 */
const packKeySet = new Set(packKeys)
const extraPlurals = [...packPlurals]
  .filter(k => !harnessPlurals.has(k) && !packKeySet.has(k.replace(pluralSuffix, '')))
  .sort()
const augmentedPlurals = [...packPlurals]
  .filter(k => !harnessPlurals.has(k) && packKeySet.has(k.replace(pluralSuffix, '')))
  .sort()

/**
 * Compare each Russian value with the templates its key renders from.
 * Placeholders are multisets, because a template may repeat one
 * (`{first} … {first}`) and order alone would then look like a mismatch. A value
 * matches when it matches any template of that key, which is what keeps the
 * three different `invalid` keys from inventing a mismatch, while a placeholder
 * no template carries stays a failure.
 */
const placeholdersMatch = (value, templates) => {
  const wanted = placeholders(value)
  return templates.some((template) => {
    const carried = placeholders(template)
    return wanted.length === carried.length && wanted.every((name, position) => name === carried[position])
  })
}
const placeholderMismatches = []
const pluralFormMismatches = []
const untemplatedKeys = []
let placeholderChecked = 0
let pluralFormChecked = 0
let placeholderUnavailable = 0
const show = list => list.length === 0 ? '—' : list.join(' ')
for (const [key, russian] of packValues) {
  const candidates = harnessTemplates.get(key)
  if (candidates === undefined) {
    /*
     * Our own plural forms are not in the harness, so they used to be
     * unverifiable: every `.few`/`.many` we add, and the `.one` of a key the
     * harness never paired, had no template at all and therefore went
     * unchecked — 49 values, where a dropped `{count}` would render literally on
     * screen. The same lexeme's template is right there under a sibling suffix
     * (`.one`/`.other`) or under the base key, so a form is compared with that.
     * What has no sibling either stays in the report: there the blind spot is
     * real and cannot be closed from the pack's side.
     */
    const suffix = /^(.*)\.(?:one|few|many|other)$/u.exec(key)
    const siblings = suffix === null ? [] : ['one', 'other', 'few', 'many']
      .flatMap(kind => [...harnessTemplates.get(`${suffix[1]}.${kind}`) ?? []])
    const base = suffix === null ? [] : [...harnessTemplates.get(suffix[1]) ?? []]
    const inherited = siblings.length > 0 ? siblings : base
    if (inherited.length === 0) {
      placeholderUnavailable += russian.size
      untemplatedKeys.push(`${key} — ${russian.size} знач.`)
      continue
    }
    for (const ru of russian) {
      pluralFormChecked += 1
      if (placeholdersMatch(ru, inherited)) continue
      const rendered = [...new Set([...inherited].map(template => show(placeholders(template))))]
      pluralFormMismatches.push(`${key}  ru: ${show(placeholders(ru))}  |  соседняя форма: ${rendered.join(' / ')}`)
    }
    continue
  }
  const rendered = [...new Set([...candidates].map(template => show(placeholders(template))))]
  for (const ru of russian) {
    placeholderChecked += 1
    if (placeholdersMatch(ru, [...candidates])) continue
    placeholderMismatches.push(`${key}  ru: ${show(placeholders(ru))}  |  шаблон: ${rendered.join(' / ')}`)
  }
}
placeholderMismatches.sort()
pluralFormMismatches.sort()
untemplatedKeys.sort()

/**
 * Harness namespaces the pack never registers.
 *
 * Key coverage cannot see this class: every key of such a dictionary may be
 * translated under another namespace and still count as covered, while the
 * component that registers this namespace keeps falling back to English. The
 * pack shipped 55 namespaces against the harness's 63, and one of the extras —
 * `settings.sessionLog` — reaches the general settings screen, so an unclaimed
 * namespace with keys is a failure, not a report. Namespaces the registration
 * scan picks up without carrying any key (a constant that merely looks like a
 * namespace) are ignored: there is nothing to translate in them.
 */
const harnessNamespaceGaps = [...harnessNamespaceKeys]
  .filter(([namespace, keys]) => keys.size > 0 && !packNamespaces.has(namespace))
  .map(([namespace, keys]) => `${namespace} — ключей ${keys.size}, регистрация: ${harnessNamespaces.get(namespace)}`)
  .sort()

/**
 * Keys the harness renders in a namespace the pack translates but omits there.
 *
 * Global name coverage hides these: a key translated under another namespace
 * counts as covered while this screen keeps falling back to English. The
 * namespace-to-dictionary link comes from the registering component's import,
 * so the comparison is like for like.
 *
 * A key the pack carries in `common` is served anyway — the runtime falls back
 * to `common` for every namespace — so only keys missing from both places are
 * reported.
 */
/**
 * Namespaces the pack registers that no registration pattern tied to a
 * dictionary, so the per-namespace comparison above cannot cover them. Listed
 * rather than gated: a namespace may be unattributable for a legitimate reason,
 * but the blind spot has to be visible.
 */
const uncomparedNamespaces = [...packKeysByNamespace.keys()]
  .filter(namespace => !harnessNamespaceKeys.has(namespace))
  .sort()

const commonKeys = packKeysByNamespace.get('common') ?? new Set()
const namespaceGaps = []
let namespaceGapKeys = 0
for (const [namespace, needed] of harnessNamespaceKeys) {
  const have = packKeysByNamespace.get(namespace)
  if (have === undefined) continue
  const missing = [...needed].filter(key => !have.has(key) && !commonKeys.has(key)).sort()
  if (missing.length === 0) continue
  namespaceGapKeys += missing.length
  const sources = [...(namespaceFiles.get(namespace) ?? [])]
    .map(file => file.replaceAll('\\', '/').split('/').pop())
    .slice(0, 3)
    .join(', ')
  const english = namespaceEnglish.get(namespace) ?? new Map()
  const lines = missing.map(key => `${key} — ${JSON.stringify(english.get(key) ?? '')}`)
  namespaceGaps.push(`${namespace}: ${missing.length} (${sources})\n      ${lines.join('\n      ')}`)
}
namespaceGaps.sort()

/**
 * Values that carry no Russian at all.
 *
 * An exact copy of the English template is sometimes right — product and
 * protocol names stay untranslated — but a leftover Chinese character or an
 * empty value where the template has text is always a defect, so those two gate
 * the build and the English copies are listed for review.
 */
/**
 * Keys the pack deliberately leaves in English, with the reason. The policy is
 * data, not a comment: an undeclared copy of the English template fails the
 * build, so a new leftover cannot arrive unnoticed.
 */
const KEEP_ENGLISH = (() => {
  const path = new URL('./keep-english.json', import.meta.url)
  if (!existsSync(path)) return new Map()
  const parsed = JSON.parse(readFileSync(path, 'utf8'))
  const entries = Object.entries(parsed).filter(([key]) => !key.startsWith('_'))
  /*
   * An empty policy is never intended: it would mean every declared English value
   * went back to being a defect. A policy that fails to load — a mangled file, a
   * renamed key — must fail loudly instead of quietly widening the gate, which is
   * how a rewrite of this very script once reported thirty-four false findings.
   */
  if (entries.length === 0) {
    console.error('keep-english.json не дал ни одной записи — политика не загрузилась')
    process.exit(2)
  }
  return new Map(entries)
})()

const englishResidue = []
const declaredEnglish = []
const cjkResidue = []
const emptyResidue = []
let residueChecked = 0
for (const [namespace, byKey] of packValuesByNamespace) {
  for (const [key, value] of byKey) {
    if (/[\u4e00-\u9fff]/u.test(value)) cjkResidue.push(`${namespace} · ${key} — ${JSON.stringify(value)}`)
    const templates = englishValuesByKey.get(key)
    if (templates === undefined) continue
    residueChecked += 1
    if (value === '' && [...templates].some(template => template !== '')) {
      emptyResidue.push(`${namespace} · ${key} — шаблон ${JSON.stringify([...templates][0])}`)
    }
    if (!templates.has(value) || !/[A-Za-z]/u.test(value)) continue
    const id = `${namespace} · ${key}`
    if (KEEP_ENGLISH.has(id)) declaredEnglish.push(id)
    else englishResidue.push(`${id} — ${JSON.stringify(value)}`)
  }
}
englishResidue.sort()
cjkResidue.sort()
emptyResidue.sort()

/**
 * Keys the pack carries that the harness no longer defines anywhere.
 *
 * A dead key shows as nothing on screen, so it cannot be caught by eye; the
 * report is what turns "the upstream removed a package" into a visible line.
 * The `.few` / `.many` forms are the pack's own (see `plural.ts`), not drift.
 */
const deadKeys = []
for (const [namespace, byKey] of packValuesByNamespace) {
  for (const key of byKey.keys()) {
    if (harnessKeys.has(key)) continue
    /*
     * A plural form of a translated key is the pack's own: the wrapper adds
     * `.few` / `.many` to keys the harness paired, and `.one` as well to keys it
     * never paired (`terminal.expand`). The base of a paired key exists only with
     * its own suffixes, so both shapes count as translated. A form whose base is
     * nowhere is drift.
     */
    const base = key.replace(/\.(?:one|few|many|other)$/u, '')
    if (base !== key
      && (harnessKeys.has(`${base}.one`) || harnessKeys.has(`${base}.other`) || packKeySet.has(base))) continue
    deadKeys.push(`${namespace} · ${key}`)
  }
}
deadKeys.sort()

/**
 * Whether any harness source still names a key. A dictionary may drop an entry
 * while a component keeps asking for it, and then the pack's value is the only
 * thing on screen; the count tells a reviewer which dead keys are safe to drop.
 * Only called for keys already reported, so the cost stays near zero.
 *
 * @param {string} key - dictionary key to look for.
 * @returns {number} files that mention the key in quotes.
 */
function harnessMentions(key) {
  let files = 0
  for (const file of HARNESS_FILES) {
    if (readFileSync(file, 'utf8').includes(`'${key}'`)) files += 1
  }
  return files
}

/** Dead keys with the reference count, so a reviewer sees which are safe to drop. */
const deadReport = deadKeys.map(id => ({ id, mentions: harnessMentions(id.slice(id.indexOf(' · ') + 3)) }))

/**
 * Dead and referenced by nothing: pure leftovers from an older harness, safe to
 * delete and therefore gated. A key a component still names stays reported
 * only — the pack's value is the last thing that can serve it.
 */
const deadUnreferenced = deadReport.filter(entry => entry.mentions === 0).map(entry => entry.id)

/**
 * Terminology: one concept, one rendering.
 *
 * A forbidden variant means the same notion is spelled two ways in one
 * interface — «кэш» and «кеш», «сессия» and «сеанс» — which no other check can
 * see, because both renderings are Russian. Watched concepts are only counted,
 * so a drift shows up before it becomes a defect.
 */
const terminology = JSON.parse(readFileSync(new URL('./terminology.json', import.meta.url), 'utf8'))
for (const section of ['forbidden', 'latin', 'capitalized']) {
  if (Object.keys(terminology[section] ?? {}).length === 0) {
    console.error(`terminology.json: раздел «${section}» пуст — проверка онемела бы молча`)
    process.exit(2)
  }
}
const terminologyViolations = []
for (const [namespace, byKey] of packValuesByNamespace) {
  for (const [key, value] of byKey) {
    const lower = value.toLowerCase()
    for (const [variant, preferred] of Object.entries(terminology.forbidden ?? {})) {
      if (lower.includes(variant)) terminologyViolations.push(`${namespace} · ${key} — «${variant}» вместо «${preferred}»`)
    }
  }
}
terminologyViolations.sort()

/**
 * Latin words inside otherwise-Russian values.
 *
 * A product name, a slash-command name or a code token belongs there; an
 * ordinary English word in a sentence does not, and nothing else sees it — the
 * residue check only compares whole values, and terminology only Russian
 * variants. Allowed tokens live in `terminology.json` under `latin`.
 */
const latinProse = []
const allowedLatin = terminology.latin ?? {}
for (const [namespace, byKey] of packValuesByNamespace) {
  for (const [key, value] of byKey) {
    const cleaned = value.replace(/\{[^}]*\}/gu, ' ').replace(/\\[a-z]/gu, ' ')
    for (const match of cleaned.matchAll(/[A-Za-z][A-Za-z0-9._+-]*/gu)) {
      const token = match[0]
      // Whole lowercase words only: capitalised names are product terms, and a
      // token with punctuation is a package name, a path or an identifier.
      if (token[0] !== token[0].toLowerCase()) continue
      if (token.length < 4 || /[._/+-]/u.test(token)) continue
      if (allowedLatin[token.toLowerCase()] !== undefined) continue
      latinProse.push(`${namespace} · ${key} — «${token}»`)
    }
  }
}
latinProse.sort()

/**
 * Capitalised address forms in the middle of a sentence.
 *
 * Russian software addresses the reader with a lowercase «вы», while a capital
 * «Вы» belongs to a personal letter — **except at the start of a sentence**, where
 * a capital is simply correct spelling. So the rule looks at the middle only: a
 * value that opens with «Вы вошли» is right, one that says «… и Вы можете» is not.
 *
 * The check is case-sensitive on purpose, which is why it lives here rather than
 * among the terminology variants: those compare in lowercase.
 */
const capitalizedAddress = []
for (const [namespace, byKey] of packValuesByNamespace) {
  for (const [key, value] of byKey) {
    for (const form of terminology.capitalized ?? []) {
      // `\b` is defined on Latin word characters, so Cyrillic needs its own edges.
      const pattern = new RegExp(`(?<!\\p{L})${form}(?!\\p{L})`, 'gu')
      for (const match of value.matchAll(pattern)) {
        const before = value.slice(0, match.index).trimEnd()
        // Start of the value or after a sentence terminator: a capital is correct there.
        if (before === '' || /[.!?…:]$/u.test(before)) continue
        capitalizedAddress.push(`${namespace} · ${key} — «${form}» с заглавной в середине фразы`)
      }
    }
  }
}
capitalizedAddress.sort()

/**
 * A number directly in front of an inflecting noun.
 *
 * Russian needs a form there — «1 путь», «2 пути», «5 путей» — and a dictionary
 * entry carries exactly one. The pack handles it two ways: forms (`.one` /
 * `.few` / `.many`) where the harness pairs the key, and a count-neutral wording
 * («Путей: {shown}» instead of «{shown} путей») where it does not. This report
 * lists the places still doing neither, with the neutral words declared in
 * `terminology.json` subtracted, so the class cannot come back quietly.
 */
const numberInflection = []
const NEUTRAL_AFTER_NUMBER = new Set((terminology.neutralAfterNumber ?? []).map(word => word.toLowerCase()))
const NUMERIC_PLACEHOLDERS = new Set(terminology.numericPlaceholders ?? [])
for (const [namespace, byKey] of packValuesByNamespace) {
  for (const [key, value] of byKey) {
    // Keys with forms inflect by design: the runtime picks the right one, and the
    // plain value is only the fallback for a fractional count.
    if (/\.(?:one|few|many|other)$/u.test(key)) continue
    if (['one', 'few', 'many'].some(form => packKeySet.has(`${key}.${form}`))) continue
    for (const match of value.matchAll(/\{(\w+)\}\s+([^\s{}]+)/gu)) {
      if (!NUMERIC_PLACEHOLDERS.has(match[1])) continue
      const word = match[2].replace(/[^\p{L}\p{N}./-]+$/gu, '')
      if (!/\p{L}/u.test(word)) continue
      if (NEUTRAL_AFTER_NUMBER.has(word.toLowerCase())) continue
      numberInflection.push(`${namespace} · ${key} — «{${match[1]}} ${word}»`)
    }
  }
}
numberInflection.sort()

/**
 * The numbers a README advertises have to match the pack.
 *
 * A badge (`strings-2%2C526`), a meta description (`2526 translated strings`) and
 * a body sentence (`2526 переводов`) are three spellings of one fact. The publish
 * workflow checks the version in that block but not these, so the count can go
 * stale unnoticed — it did: the pack grew to 2535 with the plural forms while the
 * READMEs kept advertising 2526, and a count is exactly what a reader compares
 * between packs.
 */
const packRoot = new URL('..', import.meta.url)
/*
 * Only the statements of *current* size are read, and they are recognised by
 * their shape rather than by the word alone: a comma before the count («…,
 * 2526 переводов», «…, 2526 translated strings»), an enumeration comma in the
 * Chinese form, and a count in front of `namespace` that a punctuation mark
 * closes. A bare `перевод` matched the version in «В 0.1.6 переводы каталога…»
 * and a history section's own figures, which are legitimately different numbers.
 *
 * A grouped thousands separator is a fourth spelling of the same fact — the
 * English and Chinese leads said «2,489 strings» while every gated form said
 * 2535 — so the digit pattern accepts separators and the reader strips them.
 */
const readGrouped = match => Number(match[1].replace(/[^\d]/gu, ''))
const ADVERTISED = [
  { label: 'строк', pattern: /badge\/strings-(\d+)%2C(\d+)-/u, read: match => `${match[1]}${match[2]}`, expected: packKeys.size },
  { label: 'строк', pattern: /,\s*(\d[\d,\u00A0]*)\s*translated strings/u, read: readGrouped, expected: packKeys.size },
  { label: 'строк', pattern: /,\s*(\d[\d,\u00A0]*)\s*strings/u, read: readGrouped, expected: packKeys.size },
  { label: 'строк', pattern: /,\s*(\d[\d,\u00A0]*)\s*перевод/u, read: readGrouped, expected: packKeys.size },
  { label: 'строк', pattern: /、\s*(\d[\d,\u00A0]*)\s*条翻译/u, read: readGrouped, expected: packKeys.size },
  { label: 'namespace', pattern: /(\d+)\s*(?:namespaces?|个 namespace)\s*[,、]/u, expected: packNamespaces.size },
]

/**
 * The harness version the READMEs say they were built against.
 *
 * The pinned tag and the prose about it drift apart silently: both leads claimed
 * `0.2.1-alpha.2` while the workflow had already moved to `dsh-v0.2.1-alpha.3`,
 * and a reader compares packs by that sentence, not by the workflow. The tag is
 * read from the workflow that pins it, so the claim is checked against the thing
 * that actually builds and verifies the pack.
 */
const pinnedTag = (() => {
  const workflow = readFileSync(new URL('.github/workflows/verify.yml', packRoot), 'utf8')
  const match = /^\s*HARNESS_TAG:\s*(\S+)\s*$/mu.exec(workflow)
  if (match === null) {
    console.error('verify.yml не объявляет HARNESS_TAG — сверять заявление README не с чем')
    process.exit(2)
  }
  return match[1]
})()
const pinnedVersion = pinnedTag.replace(/^dsh-v?/u, '')
const BUILT_AGAINST = /(?:built|verified) against dsh\s+`?v?([\w.+-]+)`?/gu

/*
 * `package.json` is the fourth place the same facts are written down, and the
 * description is what npm shows in search and on the package page; it had drifted
 * to «55 namespaces» while the READMEs said 56. The version claim is matched in
 * both phrasings — «built against dsh» in the leads, «verified against dsh» in
 * the manifest — because both name the harness release a reader relies on.
 */
const ADVERTISED_FILES = ['README.md', 'README.en.md', 'README.zh.md', 'package.json']

const advertisedWrong = []
for (const file of ADVERTISED_FILES) {
  let text
  try {
    text = readFileSync(new URL(file, packRoot), 'utf8')
  } catch {
    advertisedWrong.push(`${file} — не читается`)
    continue
  }
  for (const { label, pattern, read, expected } of ADVERTISED) {
    for (const match of text.matchAll(new RegExp(pattern.source, `${pattern.flags}g`))) {
      const claimed = Number(read === undefined ? match[1] : read(match))
      if (claimed !== expected) advertisedWrong.push(`${file}: заявлено ${claimed} ${label}, а в пакете ${expected}`)
    }
  }
  for (const match of text.matchAll(BUILT_AGAINST)) {
    const claimed = match[1].trim().replace(/\.+$/u, '')
    if (claimed !== pinnedVersion) advertisedWrong.push(`${file}: заявлено «${match[0]}», а workflow закрепляет ${pinnedTag}`)
  }
}
advertisedWrong.sort()

/**
 * Mechanical text hygiene: spacing and paired punctuation are unambiguous, so a
 * violation gates. Values carrying markdown (the guides) are left alone — line
 * breaks and double spaces there are layout, not prose.
 *
 * An edge space is a composition concern: a value that starts or ends with one
 * is glued to a neighbour by the component, so it must match what the English of
 * its own namespace does. `number.groupSeparator` is the one value that exists
 * to hold a non-breaking space.
 */
const HYGIENE_RULES = [
  ['двойной пробел', value => / {2,}/u.test(value)],
  ['пробел перед знаком препинания', value => / [,.!?;:]/u.test(value) && !/ \.[a-z]/u.test(value)],
  ['пробел после « или перед »', value => /«\s|\s»/u.test(value)],
  ['непарные « »', value => (value.match(/«/gu)?.length ?? 0) !== (value.match(/»/gu)?.length ?? 0)],
  ['непарные скобки', value => (value.match(/\(/gu)?.length ?? 0) !== (value.match(/\)/gu)?.length ?? 0)],
  ['неразрывный пробел в значении', value => /[\u00A0\u202F]/u.test(value)],
]
const hygiene = []
const edgeSpaces = []
const style = []
for (const [namespace, byKey] of packValuesByNamespace) {
  const english = namespaceEnglishOnly.get(namespace) ?? new Map()
  for (const [key, value] of byKey) {
    if (!value.includes('\\n')) {
      for (const [title, test] of HYGIENE_RULES) {
        if (title === 'неразрывный пробел в значении' && key === 'number.groupSeparator') continue
        if (test(value)) hygiene.push(`${namespace} · ${key} — ${title}`)
      }
    }
    const variants = englishVariantsByKey.get(key)
    const template = english.get(key) ?? (variants?.size === 1 ? variants.values().next().value : undefined)
    if (template === undefined) continue
    if (/^ /u.test(value) !== /^ /u.test(template) || / $/u.test(value) !== / $/u.test(template)) {
      edgeSpaces.push(`${namespace} · ${key} — у нас ${JSON.stringify(value)} | шаблон ${JSON.stringify(template)}`)
    }
    /*
     * Style parity: the same value may differ in word order, but a terminator the
     * template has should not disappear, and a capitalised template should not
     * become lowercase. Only a lost terminator is reported — a Russian status
     * line may add «…» for work in progress, which the template need not carry.
     * A template that opens with a placeholder carries no case to mirror.
     */
    const trimmedValue = value.trimEnd()
    const trimmedTemplate = template.trimEnd()
    const abbreviation = /[а-яё]{1,5}\.$/iu.test(trimmedValue)
    if (/[.!?…]$/u.test(trimmedTemplate) && !/[.!?…]$/u.test(trimmedValue) && !abbreviation) {
      style.push(`${namespace} · ${key} — потерян знак в конце: у нас ${JSON.stringify(trimmedValue.slice(-30))} | шаблон ${JSON.stringify(trimmedTemplate.slice(-30))}`)
    }
    if (!trimmedTemplate.startsWith('{') && !/^[«"([<]*[A-Z\u0400-\u042F]{2,}/u.test(trimmedValue)) {
      const firstLetter = (text) => text.replace(/^[«"([<]+/u, '')[0]
      const firstValue = firstLetter(value)
      const firstTemplate = firstLetter(trimmedTemplate)
      if (firstValue !== undefined && firstTemplate !== undefined && /[A-Za-z\u0400-\u04FF]/u.test(firstTemplate)) {
        if ((firstValue !== firstValue.toLowerCase()) !== (firstTemplate !== firstTemplate.toLowerCase())) {          style.push(`${namespace} · ${key} — регистр: у нас ${JSON.stringify(value.slice(0, 30))} | шаблон ${JSON.stringify(trimmedTemplate.slice(0, 30))}`)
        }
      }
    }
  }
}
hygiene.sort()
edgeSpaces.sort()
style.sort()

/**
 * Short interface strings that grew far longer than their template.
 *
 * A label, a tab or a chip has no room to reflow, and Russian runs longer than
 * English by nature; past roughly twice the length of a short template the text
 * starts to overflow. Prose is excluded — only strings whose English is under 28
 * characters are compared, and the report is advisory, because a legitimate
 * rewrite can be longer than its template.
 */
const grownShortStrings = []
for (const [namespace, byKey] of packValuesByNamespace) {
  const english = namespaceEnglishOnly.get(namespace)
  if (english === undefined) continue
  for (const [key, value] of byKey) {
    const template = english.get(key)
    if (template === undefined) continue
    if (template.length < 6 || template.length > 28) continue
    if (template.includes('{') || value.includes('{') || value.includes('\\n')) continue
    const ratio = value.length / template.length
    if (ratio < 2.8) continue
    grownShortStrings.push({ id: `${namespace} · ${key}`, ratio, template, value })
  }
}
// Russian runs longer than English as a rule — «Command failed» becomes «Команда
// завершилась с ошибкой» — so only the extreme cases are worth a look, longest first.
grownShortStrings.sort((left, right) => right.ratio - left.ratio)
const grownShortStringsReport = grownShortStrings
  .slice(0, 15)
  .map(row => `${row.id} — ${row.ratio.toFixed(1)}× («${row.template}» → «${row.value}»)`)
grownShortStringsReport.total = grownShortStrings.length
/**
 * One English sentence, one Russian rendering.
 *
 * `terminology.json` pins the terms a human decided about; this check finds the
 * rest of that class: the same English sentence translated into two different
 * Russian sentences. It is how `confirm.description` was found rendered as
 * «пропускать шаги подтверждения» in one namespace and «уменьшать число шагов
 * подтверждения» in another — the second also reading "subsequent tasks" as
 * «текущей задачей». Labels are excluded — «Open» is legitimately «Открыть» in a
 * menu and «Открыто» in a status — so only templates of four words or more are
 * compared, where a second rendering is a decision and not a context.
 *
 * A deliberate second rendering is declared in `one-rendering.json` with its
 * reason, the same way an English leftover is declared in `keep-english.json`:
 * the decision is data, so an undeclared divergence cannot arrive unnoticed. An
 * exception that no longer matches anything is a failure too, or the list rots
 * and quietly widens the check.
 */
const ONE_RENDERING = (() => {
  const path = new URL('./one-rendering.json', import.meta.url)
  if (!existsSync(path)) {
    console.error('one-rendering.json отсутствует — проверка «одна фраза, один перевод» онемела бы молча')
    process.exit(2)
  }
  const parsed = JSON.parse(readFileSync(path, 'utf8'))
  const entries = parsed.exceptions ?? []
  if (!Array.isArray(entries)) {
    console.error('one-rendering.json: раздел exceptions обязан быть списком')
    process.exit(2)
  }
  for (const entry of entries) {
    if (typeof entry.template !== 'string' || entry.template.length === 0
      || typeof entry.reason !== 'string' || entry.reason.length === 0) {
      console.error('one-rendering.json: у каждого исключения нужны непустые template и reason')
      process.exit(2)
    }
  }
  return new Map(entries.map(entry => [entry.template, entry.reason]))
})()

const renderingsByTemplate = new Map()
for (const [namespace, byKey] of packValuesByNamespace) {
  const english = namespaceEnglishOnly.get(namespace)
  if (english === undefined) continue
  for (const [key, value] of byKey) {
    const template = english.get(key)
    if (template === undefined) continue
    if (value.includes('\\n') || template.includes('\\n')) continue
    if (template.split(/\s+/u).length < 4) continue
    if (!renderingsByTemplate.has(template)) renderingsByTemplate.set(template, new Map())
    const renderings = renderingsByTemplate.get(template)
    if (!renderings.has(value)) renderings.set(value, [])
    renderings.get(value).push(`${namespace} · ${key}`)
  }
}
const allSplitRenderings = [...renderingsByTemplate]
  .filter(([, renderings]) => renderings.size > 1)
  .map(([template, renderings]) => ({ template, renderings: [...renderings] }))
const splitRenderings = allSplitRenderings.filter(row => !ONE_RENDERING.has(row.template))
const declaredSplitRenderings = allSplitRenderings.filter(row => ONE_RENDERING.has(row.template))
const staleSplitRenderings = [...ONE_RENDERING.keys()].filter(
  template => !allSplitRenderings.some(row => row.template === template),
)
splitRenderings.sort((left, right) => right.renderings.length - left.renderings.length)
const renderSplitList = rows => rows.slice(0, 15).map(({ template, renderings }) => {
  const listed = renderings.map(([value, sources]) => `${JSON.stringify(value)} (${sources.join(', ')})`)
  return `«${template}»\n      ${listed.join('\n      ')}`
})
const splitRenderingsReport = renderSplitList(splitRenderings)
splitRenderingsReport.total = splitRenderings.length
const declaredSplitRenderingsReport = renderSplitList(declaredSplitRenderings)
declaredSplitRenderingsReport.total = declaredSplitRenderings.length
const terminologyCounts = Object.entries(terminology.watch ?? {}).map(([concept, stems]) => {
  const counts = stems.map((stem) => {
    let count = 0
    for (const byKey of packValuesByNamespace.values()) {
      for (const value of byKey.values()) {
        count += value.toLowerCase().split(stem).length - 1
      }
    }
    return `${stem}:${count}`
  })
  return `${concept} → ${counts.join(' / ')}`
})

const covered = [...packKeys].filter(k => harnessKeys.has(k)).length
const uncovered = new Map()
for (const [key, file] of harnessKeys) {
  if (packKeys.has(key)) continue
  const short = file.replaceAll('\\', '/').split('/packages/')[1] ?? file
  if (!uncovered.has(short)) uncovered.set(short, [])
  uncovered.get(short).push(key)
}

console.log(`дерево харнеса: ${HARNESS}`)
console.log(`в пакете: ${packNamespaces.size} namespace, ${packKeys.size} переводов, ${packPlurals.size} пар форм числа`)
console.log(`в харнессе: ${harnessNamespaces.size} namespace, ${harnessKeys.size} ключей, ${harnessPlurals.size} пар форм`)
console.log(`покрытие (информационно): ${covered} из ${harnessKeys.size} найденных ключей харнеса`)

console.log(`плейсхолдеры сверены у ${placeholderChecked} ключей, у ${pluralFormChecked} значений форм числа — с соседней формой; шаблона нет вовсе у ${placeholderUnavailable}`)
console.log(`полнота по namespace: ${namespaceGapKeys} ключей в ${namespaceGaps.length} namespace`)
console.log(`  сверено namespace: ${[...packKeysByNamespace.keys()].filter(ns => harnessNamespaceKeys.has(ns)).length} из ${packKeysByNamespace.size} в пакете; опознано в харнессе: ${harnessNamespaceKeys.size} из ${harnessNamespaces.size}`)
console.log(`остатки: сверено ${residueChecked} значений, английский ${englishResidue.length} (плюс ${declaredEnglish.length} объявленных в политике), китайский ${cjkResidue.length}, пустые ${emptyResidue.length}`)
console.log(`мёртвые ключи (нет в харнессе): ${deadKeys.length} (из них без ссылок: ${deadUnreferenced.length})`)
console.log(`терминология: нарушений ${terminologyViolations.length}; латинских слов в прозе вне списка: ${latinProse.length}`)
console.log(`гигиена текста: ${hygiene.length}, краевые пробелы: ${edgeSpaces.length}, стиль: ${style.length}`)
console.log(`  ${terminologyCounts.join(', ')}`)

const report = (title, items) => {
  console.log(`\n=== ${title}: ${items.length} ===`)
  for (const item of items) console.log('  ' + item)
}

report('namespace пака, объявленных дважды (перекрывают друг друга)', duplicateNamespaces)
report('namespace пака, которых нет в харнессе (мёртвые)', deadNamespaces.map(ns => {
  const near = [...harnessNamespaces.keys()].filter(name => name.startsWith(ns.split('.')[0]))
  return `${ns}${near.length > 0 ? `  (похожие: ${near.join(', ')})` : ''}`
}))
report('пар форм харнесса, которых нет в паке', missingPlurals)
report('лишние пары форм в паке', extraPlurals)
report('формы, добавленные пакетом к ключам без пары (справочно)', augmentedPlurals)
report('плейсхолдеры, расходящиеся с шаблоном харнесса', placeholderMismatches)
report('плейсхолдеры наших форм числа, расходящиеся с соседней формой', pluralFormMismatches)
report('ключи без шаблона в харнессе — сверить не с чем (справочно)', untemplatedKeys)
report('ключи, которых нет в своём namespace', namespaceGaps)
report('namespace пака, которых не сверить с харнессом (нет привязки к словарю)', uncomparedNamespaces)
report('namespace харнесса с ключами, которых пак не регистрирует', harnessNamespaceGaps)
report('значения с китайскими иероглифами', cjkResidue)
report('пустые значения там, где шаблон не пуст', emptyResidue)
report('значения, совпадающие с английским шаблоном без решения в keep-english.json', englishResidue)
report('ключи пака, которых нет в харнессе (справочно)', deadReport.map(entry => `${entry.id} — ссылок в исходниках харнесса: ${entry.mentions}`))
report('мёртвые ключи без единой ссылки в харнессе', deadUnreferenced)
report('терминология: запрещённые варианты', terminologyViolations)
report('обращение к пользователю с заглавной («Вы» вместо «вы»)', capitalizedAddress)
report('латинские слова в русской прозе вне списка terminology.json', latinProse)
report('число перед склоняемым словом (нет форм и нет нейтральной формулировки)', numberInflection)
report('числа, заявленные в README, разошедшиеся с пакетом', advertisedWrong)
report('гигиена текста', hygiene)
report('краевые пробелы, расходящиеся с шаблоном своего namespace', edgeSpaces)
report('стиль, расходящийся с шаблоном своего namespace (знак в конце, регистр)', style)
report('короткие строки, выросшие больше чем в 2,8 раза (риск вёрстки)', grownShortStringsReport)
report('одна английская фраза, переведённая по-разному', splitRenderingsReport)
report('исключения one-rendering.json, объявленные вручную (справочно)', declaredSplitRenderingsReport)
report('исключения one-rendering.json, которые уже ничего не исключают', staleSplitRenderings)
if (uncovered.size > 0) {
  console.log(`\n=== ключи харнеса без перевода, по файлам (информационно, ${uncovered.size} файлов) ===`)
  for (const [file, keys] of uncovered) console.log(`  ${file}\n      ${keys.join(', ')}`)
}

const failures = duplicateNamespaces.length + deadNamespaces.length + missingPlurals.length
  + extraPlurals.length + placeholderMismatches.length + cjkResidue.length + emptyResidue.length
  + englishResidue.length + deadUnreferenced.length + terminologyViolations.length + latinProse.length
  + hygiene.length + edgeSpaces.length + style.length + advertisedWrong.length + capitalizedAddress.length
  + splitRenderings.length + staleSplitRenderings.length + harnessNamespaceGaps.length
  + pluralFormMismatches.length
if (failures === 0) {
  console.log('\nаудит пройден: дублей и мёртвых namespace нет; пары форм, плейсхолдеры и остатки в норме')
  process.exit(0)
}
console.log(`\nаудит провален: ${failures} расхождений`)
process.exit(1)
