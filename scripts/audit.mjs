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
 * Collect `key: 'value'` pairs outside string literals and comments, with the
 * offset of each key so a harness file's dictionary (`zh` / `en`) can be told
 * apart. `dictionaryKeys` answers "which keys exist"; this answers "what does
 * the template say", which is what placeholder parity needs. A value that is
 * not a single string literal (an object, a concatenation, an identifier)
 * yields `null` and is skipped by the comparison rather than guessed at.
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
        let valueStart = cursor + 2
        while (valueStart < text.length && /\s/u.test(text[valueStart])) valueStart += 1
        const quote = text[valueStart]
        let value = null
        if (quote === "'" || quote === '"' || quote === '`') {
          let end = valueStart + 1
          while (end < text.length) {
            if (text[end] === '\\') { end += 2; continue }
            if (text[end] === quote) break
            end += 1
          }
          value = text.slice(valueStart + 1, end)
        }
        if (/^[\w.]+$/u.test(key)) entries.push({ key, value, index: start })
      }
      index = cursor + 1
      continue
    }
    if (/[A-Za-z_$]/u.test(char)) {
      let end = index + 1
      while (end < text.length && /[\w$.]/u.test(text[end])) end += 1
      index = end
      continue
    }
    index += 1
  }
  return entries
}

/** Dictionary a key belongs to: the nearest preceding `export const <name> = {`. */
function dictionaryScope(text, index) {
  let name = null
  for (const m of text.matchAll(/export\s+const\s+(\w+)\s*=\s*\{/gu)) {
    if (m.index > index) break
    name = m[1]
  }
  return name
}

/** `{name}` placeholders of a template, sorted so two sides compare as multisets. */
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

/** Key -> dictionary name (`zh` / `en`) -> template, for placeholder parity. */
const harnessValues = new Map()

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
    const scope = dictionaryScope(text, entry.index) ?? '?'
    if (!harnessValues.has(entry.key)) harnessValues.set(entry.key, new Map())
    const byScope = harnessValues.get(entry.key)
    if (!byScope.has(scope)) byScope.set(scope, entry.value)
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
/** Key -> ru value, for placeholder parity. */
const packValues = new Map()
for (const entry of dictionaryEntries(packText)) {
  if (NOT_A_KEY.has(entry.key) || entry.value === null) continue
  if (!packValues.has(entry.key)) packValues.set(entry.key, entry.value)
}
const pluralSuffix = /\.(?:one|other)$/u
const harnessPlurals = new Set([...harnessKeys.keys()].filter(k => pluralSuffix.test(k)))
const packPlurals = new Set([...packKeys].filter(k => pluralSuffix.test(k)))
const deadNamespaces = [...packNamespaces].filter(ns => !harnessNamespaces.has(ns)).sort()
const missingPlurals = [...harnessPlurals].filter(k => !packPlurals.has(k)).sort()
const extraPlurals = [...packPlurals].filter(k => !harnessPlurals.has(k)).sort()

/**
 * Compare each translated value with the template the host interpolates.
 * Both sides are multisets, because a template may repeat a placeholder
 * (`{first} … {first}`) and order alone would then look like a mismatch.
 */
const placeholderMismatches = []
let placeholderChecked = 0
let placeholderUnavailable = 0
for (const [key, ru] of packValues) {
  const byScope = harnessValues.get(key)
  if (byScope === undefined) continue
  const template = byScope.get('en') ?? byScope.get('zh')
  if (template === undefined) { placeholderUnavailable += 1; continue }
  placeholderChecked += 1
  const ruPlaceholders = placeholders(ru)
  const templatePlaceholders = placeholders(template)
  const equal = ruPlaceholders.length === templatePlaceholders.length
    && ruPlaceholders.every((name, position) => name === templatePlaceholders[position])
  if (equal) continue
  const show = list => list.length === 0 ? '—' : list.join(' ')
  placeholderMismatches.push(`${key}  ru: ${show(ruPlaceholders)}  |  шаблон: ${show(templatePlaceholders)}`)
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
