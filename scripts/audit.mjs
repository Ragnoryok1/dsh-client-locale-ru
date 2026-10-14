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

/**
 * Read the string literal that starts at or after `from`, or `null` when the
 * value is not one (an object, a concatenation, an identifier).
 *
 * @param {string} text source of a module
 * @param {number} from offset just after the key's colon
 * @returns {string|null} the literal's content, or null
 */
function readStringValue(text, from) {
  let start = from
  while (start < text.length && /\s/u.test(text[start])) start += 1
  const quote = text[start]
  if (quote !== "'" && quote !== '"' && quote !== '`') return null
  let end = start + 1
  while (end < text.length) {
    if (text[end] === '\\') { end += 2; continue }
    if (text[end] === quote) break
    end += 1
  }
  return text.slice(start + 1, end)
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
        if (/^[\w.]+$/u.test(key)) entries.push({ key, value: readStringValue(text, cursor + 2), index: start })
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
        if (/^[\w.]+$/u.test(key)) entries.push({ key, value: readStringValue(text, after + 1), index })
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

/**
 * Key -> every English string the harness carries for it, from every dictionary
 * file, whatever namespace it belongs to. The residue check reads this rather
 * than the per-namespace map: a namespace whose dictionary is imported from
 * another directory (`common`, for one) has no per-namespace English, and a
 * leftover there would otherwise go unnoticed.
 */
const englishValuesByKey = new Map()

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
    // Same directory only: a cross-directory import is an aggregate
    // (`locales/index.ts` re-exporting many dictionaries), and attributing its
    // keys to the claiming namespace invents gaps that the runtime does not have.
    if (dirname(resolved) === own && isDictionary(resolved)) found.add(resolved)
  }
  return found
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
      if (!english.has(entry.key)) english.set(entry.key, entry.value)
    } else if (!fallback.has(entry.key)) {
      fallback.set(entry.key, entry.value)
    }
  }
  fileKeys.set(file, stringKeys)
  // English wins over the Chinese fallback for the same key.
  fileEnglish.set(file, new Map([...fallback, ...english]))
  for (const [key, value] of english) {
    if (!englishValuesByKey.has(key)) englishValuesByKey.set(key, new Set())
    englishValuesByKey.get(key).add(value)
  }
}

/**
 * Namespace -> keys the harness renders in it, rebuilt from the dictionaries
 * each namespace's owner imports or declares.
 */
const harnessNamespaceKeys = new Map()

/** Namespace -> English template per key, so a gap can be translated from the report. */
const namespaceEnglish = new Map()
for (const [namespace, files] of namespaceFiles) {
  const keys = new Set()
  const english = new Map()
  for (const file of files) {
    for (const key of fileKeys.get(file) ?? []) keys.add(key)
    for (const [key, value] of fileEnglish.get(file) ?? []) {
      if (!english.has(key)) english.set(key, value)
    }
  }
  harnessNamespaceKeys.set(namespace, keys)
  namespaceEnglish.set(namespace, english)
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
const extraPlurals = [...packPlurals].filter(k => !harnessPlurals.has(k)).sort()

/**
 * Compare each Russian value with the templates its key renders from.
 * Placeholders are multisets, because a template may repeat one
 * (`{first} … {first}`) and order alone would then look like a mismatch. A value
 * matches when it matches any template of that key, which is what keeps the
 * three different `invalid` keys from inventing a mismatch, while a placeholder
 * no template carries stays a failure.
 */
const placeholderMismatches = []
let placeholderChecked = 0
let placeholderUnavailable = 0
const show = list => list.length === 0 ? '—' : list.join(' ')
for (const [key, russian] of packValues) {
  const candidates = harnessTemplates.get(key)
  if (candidates === undefined) { placeholderUnavailable += russian.size; continue }
  const rendered = [...new Set([...candidates].map(template => show(placeholders(template))))]
  for (const ru of russian) {
    placeholderChecked += 1
    const ruPlaceholders = placeholders(ru)
    const matched = [...candidates].some((template) => {
      const templatePlaceholders = placeholders(template)
      return ruPlaceholders.length === templatePlaceholders.length
        && ruPlaceholders.every((name, position) => name === templatePlaceholders[position])
    })
    if (matched) continue
    placeholderMismatches.push(`${key}  ru: ${show(ruPlaceholders)}  |  шаблон: ${rendered.join(' / ')}`)
  }
}
placeholderMismatches.sort()

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
  return new Map(Object.entries(parsed).filter(([key]) => !key.startsWith('_')))
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
    if (/\.(?:few|many)$/u.test(key)) continue
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

console.log(`плейсхолдеры сверены у ${placeholderChecked} ключей, шаблон недоступен у ${placeholderUnavailable}`)
console.log(`полнота по namespace: ${namespaceGapKeys} ключей в ${namespaceGaps.length} namespace`)
console.log(`остатки: сверено ${residueChecked} значений, английский ${englishResidue.length} (плюс ${declaredEnglish.length} объявленных в политике), китайский ${cjkResidue.length}, пустые ${emptyResidue.length}`)
console.log(`мёртвые ключи (нет в харнессе): ${deadKeys.length} (из них без ссылок: ${deadUnreferenced.length})`)

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
report('плейсхолдеры, расходящиеся с шаблоном харнесса', placeholderMismatches)
report('ключи, которых нет в своём namespace', namespaceGaps)
report('значения с китайскими иероглифами', cjkResidue)
report('пустые значения там, где шаблон не пуст', emptyResidue)
report('значения, совпадающие с английским шаблоном без решения в keep-english.json', englishResidue)
report('ключи пака, которых нет в харнессе (справочно)', deadReport.map(entry => `${entry.id} — ссылок в исходниках харнесса: ${entry.mentions}`))
report('мёртвые ключи без единой ссылки в харнессе', deadUnreferenced)
if (uncovered.size > 0) {
  console.log(`\n=== ключи харнеса без перевода, по файлам (информационно, ${uncovered.size} файлов) ===`)
  for (const [file, keys] of uncovered) console.log(`  ${file}\n      ${keys.join(', ')}`)
}

const failures = duplicateNamespaces.length + deadNamespaces.length + missingPlurals.length
  + extraPlurals.length + placeholderMismatches.length + cjkResidue.length + emptyResidue.length
  + englishResidue.length + deadUnreferenced.length
if (failures === 0) {
  console.log('\nаудит пройден: дублей и мёртвых namespace нет; пары форм, плейсхолдеры и остатки в норме')
  process.exit(0)
}
console.log(`\nаудит провален: ${failures} расхождений`)
process.exit(1)
