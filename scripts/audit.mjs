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
import { join } from 'node:path'

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

for (const file of walk(HARNESS)) {
  const text = readFileSync(file, 'utf8')
  const claim = (name, why) => { if (!harnessNamespaces.has(name)) harnessNamespaces.set(name, `${file} (${why})`) }
  for (const m of text.matchAll(/(?:export\s+)?const\s+[A-Za-z_]*NS[A-Za-z_]*\s*(?::\s*string)?\s*=\s*'([\w.]+)'/gu)) claim(m[1], 'const')
  for (const m of text.matchAll(/const\s+namespace\s*(?::\s*string)?\s*=\s*'([\w.]+)'/gu)) claim(m[1], 'namespace')
  for (const m of text.matchAll(/locale\.register\(\s*'([\w.]+)'/gu)) claim(m[1], 'register')
  for (const m of text.matchAll(/locale\.bind\(\s*'([\w.]+)'\s*\)/gu)) claim(m[1], 'bind')
  for (const m of text.matchAll(/PropsLocale<'([\w.]+)'>/gu)) claim(m[1], 'PropsLocale')
  if (!isDictionary(file)) continue
  for (const key of dictionaryKeys(text)) {
    if (!NOT_A_KEY.has(key) && !harnessKeys.has(key)) harnessKeys.set(key, file)
  }
  for (const entry of dictionaryEntries(text)) {
    if (NOT_A_KEY.has(entry.key) || entry.value === null) continue
    if (!harnessTemplates.has(entry.key)) harnessTemplates.set(entry.key, new Set())
    harnessTemplates.get(entry.key).add(entry.value)
  }
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
if (uncovered.size > 0) {
  console.log(`\n=== ключи харнеса без перевода, по файлам (информационно, ${uncovered.size} файлов) ===`)
  for (const [file, keys] of uncovered) console.log(`  ${file}\n      ${keys.join(', ')}`)
}

const failures = duplicateNamespaces.length + deadNamespaces.length + missingPlurals.length
  + extraPlurals.length + placeholderMismatches.length
if (failures === 0) {
  console.log('\nаудит пройден: дублей и мёртвых namespace нет, пары форм и плейсхолдеры совпадают')
  process.exit(0)
}
console.log(`\nаудит провален: ${failures} расхождений`)
process.exit(1)
