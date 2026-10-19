/**
 * Coverage report for every locale namespace found in installed plugins.
 *
 * `npm run fetch:plugins` answers «give me this package's English»; this answers the
 * question a user actually has — «what in my own GUI is still English?». It walks a
 * `node_modules` directory, reads each plugin's own dictionary out of its bundle, and
 * compares the keys with this pack.
 *
 * A registration comes in four shapes, and the first version of this script knew only the
 * first of them — which is why three of our own plugins were reported as having no
 * dictionary at all:
 *
 *   locale.register(NS, { zh, en })              inline object
 *   locale.register(NS, "en", en)                documented shape, dictionary by name
 *   locale.register(NS, { en: {…}, ru: {…} })    bilingual inline
 *   locale.register(NS, { en, ru })              bilingual, both halves by name
 *
 * Usage: node scripts/report-plugins.mjs [node_modules dir] [--json]
 * Default: ~/.dsh/profiles/web/node_modules
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const args = process.argv.slice(2)
const OURS = '@ragnoryok1/dsh-client-locale-ru'
const asJson = args.includes('--json')
const target = args.find(argument => !argument.startsWith('--'))
  ?? join(homedir(), '.dsh', 'profiles', 'web', 'node_modules')

/** Namespace -> keys, straight from our pack. */
function readPack() {
  const text = readFileSync(new URL('../src/client/dicts.ts', import.meta.url), 'utf8')
  const namespaces = new Map()
  const headings = [...text.matchAll(/^ {2}'([^']+)':\s*\{/gmu)]
  for (const [index, heading] of headings.entries()) {
    const start = heading.index
    const end = index + 1 < headings.length ? headings[index + 1].index : text.length
    const body = text.slice(start, end)
    const keys = new Set()
    for (const match of body.matchAll(/^ {4}'([^']+)':/gmu)) keys.add(match[1])
    namespaces.set(heading[1], keys)
  }
  return namespaces
}

/**
 * Members of one object literal: string values at depth 1 and the offsets of nested objects.
 *
 * A quoted key may carry hyphens, dots and CJK; it cannot carry a quote or a colon. Nested
 * objects are reported separately because a bilingual dictionary keeps «en» and «ru» one
 * level below the registration call.
 */
function objectMembers(text, at) {
  const strings = new Map()
  const objects = new Map()
  let index = text.indexOf('{', at)
  if (index === -1) return { strings, objects }
  let depth = 0
  for (; index < text.length; index += 1) {
    const char = text[index]
    if (char === '{') {
      depth += 1
      continue
    }
    if (char === '}') {
      depth -= 1
      if (depth === 0) break
      continue
    }
    if (char !== '"' && char !== "'") continue
    const quote = char
    let cursor = index + 1
    while (cursor < text.length && text[cursor] !== quote) {
      if (text[cursor] === '\\') cursor += 1
      cursor += 1
    }
    const key = text.slice(index + 1, cursor)
    let after = cursor + 1
    while (after < text.length && /\s/u.test(text[after])) after += 1
    if (text[after] === ':' && key.length > 0 && !/['"\\:]/u.test(key)) {
      let valueStart = after + 1
      while (valueStart < text.length && /\s/u.test(text[valueStart])) valueStart += 1
      const valueQuote = text[valueStart]
      if (valueQuote === '"' || valueQuote === "'") {
        let valueCursor = valueStart + 1
        while (valueCursor < text.length && text[valueCursor] !== valueQuote) {
          if (text[valueCursor] === '\\') valueCursor += 1
          valueCursor += 1
        }
        if (depth === 1) strings.set(key, text.slice(valueStart + 1, valueCursor))
        index = valueCursor
        continue
      }
      if (valueQuote === '{' && depth === 1) objects.set(key, valueStart)
    }
    index = cursor
  }
  return { strings, objects }
}

/** Where the object behind one name is declared: `const name = {`, `var`, `let`. */
function declarationOf(text, name) {
  const match = new RegExp(`(?:const|var|let)\\s+${name}\\s*[:=]\\s*\\{`, 'u').exec(text)
  return match === null ? -1 : match.index
}

/**
 * The English half of one registration.
 *
 * The dictionary is either an inline object, a name declared elsewhere, or a bilingual
 * object whose halves are one of those two again.
 */
function englishOf(text, at, dictionaryName) {
  if (dictionaryName !== undefined) {
    const declared = declarationOf(text, dictionaryName)
    return declared === -1 ? new Map() : objectMembers(text, declared).strings
  }
  const top = objectMembers(text, at)
  if (top.strings.size > 0) return top.strings
  const inlineEnglish = top.objects.get('en')
  if (inlineEnglish !== undefined) return objectMembers(text, inlineEnglish).strings
  const namedEnglish = declarationOf(text, 'en')
  if (namedEnglish !== -1) return objectMembers(text, namedEnglish).strings
  return new Map()
}

/** Every registered dictionary in the package, keyed by namespace. */
function readPluginDictionaries(files) {
  const found = new Map()
  const selfTranslated = new Set()
  let loopRegistered = 0
  const registration = /locale\.register\(\s*(?:["']([\w.-]+)["']|([A-Za-z_$][\w$]*))\s*,\s*(?:["']([a-z]{2})["']\s*,\s*)?(?:([A-Za-z_$][\w$]*)|(\{))/gu
  for (const file of files) {
    let text
    try {
      text = readFileSync(file, 'utf8')
    } catch {
      continue
    }
    /*
     * A pack that ships hundreds of namespaces registers them in a loop over one table
     * (`for (const [ns, dict] of Object.entries(DICTS)) locale.register(ns, "ru", dict)`),
     * so no namespace literal exists to read. The table itself is still a literal object:
     * reading it gives the real key count instead of a guess from the Cyrillic payload.
     */
    const loop = /for\s*\(\s*const\s*\[[^\]]+\]\s*of\s*Object\.entries\(\s*([A-Za-z_$][\w$]*)\s*\)\s*\)/u.exec(text)
    if (loop !== null && /locale\.register\(\s*[A-Za-z_$][\w$]*\s*,/u.test(text)) {
      const table = declarationOf(text, loop[1])
      const members = table === -1 ? null : objectMembers(text, table)
      let counted = 0
      /*
       * A namespace holds plain keys plus plural groups (`{ one, few, many }`), so the count
       * walks the nested objects too; otherwise a pack with 90 plural groups reports a total
       * below what its own inventory states.
       */
      const countDeep = (at, depth) => {
        if (depth > 3) return 0
        const level = objectMembers(text, at)
        let total = level.strings.size
        for (const nested of level.objects.values()) total += countDeep(nested, depth + 1)
        return total
      }
      for (const namespaceObject of members?.objects.values() ?? []) {
        counted += countDeep(namespaceObject, 0)
      }
      loopRegistered += counted
    }
    for (const call of text.matchAll(registration)) {
      const [, literal, identifier, language, dictionaryName] = call
      const namespace = literal
        ?? (identifier === undefined
          ? null
          : new RegExp(`(?:const|var|let)\\s+${identifier}\\s*=\\s*["']([\\w.-]+)["']`, 'u').exec(text)?.[1] ?? null)
      if (namespace === null) continue
      if (language !== undefined && language !== 'en' && language !== 'ru') continue
      const pairs = englishOf(text, call.index, dictionaryName)
      if (pairs.size === 0) {
        if (language === 'ru') selfTranslated.add(namespace)
        continue
      }
      /*
       * A bilingual bundle carries its own Russian: reporting it as «we do not cover this»
       * would be true and useless, so the fact is recorded instead. `{ en, ru }` names both
       * halves, so the shorthand itself is evidence.
       */
      const hasRussian = /(?:^|[{,\s])ru\s*[,}]/u.test(text.slice(call.index, call.index + 400))
        || declarationOf(text, 'ru') !== -1
      if (hasRussian) selfTranslated.add(namespace)
      const existing = found.get(namespace) ?? new Map()
      for (const [key, value] of pairs) if (!existing.has(key)) existing.set(key, value)
      found.set(namespace, existing)
    }
  }
  return { found, selfTranslated, loopRegistered }
}


/**
 * Does the bundle register the Russian language itself?
 *
 * Only a claim on the language id counts: `ctx.locale.addLanguage('ru', …)`. A pack that
 * merely registers a few of its own namespaces in Russian is an ordinary plugin, not a rival.
 */
function registersRussian(files) {
  for (const file of files) {
    let text
    try {
      text = readFileSync(file, 'utf8')
    } catch {
      continue
    }
    if (!/addLanguage\(/u.test(text)) continue
    if (/addLanguage\(\s*['"`]ru['"`]/u.test(text)) return true
    if (/\bid\s*:\s*['"`]ru['"`]/u.test(text)) return true
  }
  return false
}

function bundlesOf(packageDir) {
  for (const folder of ['lib', 'dist', 'build']) {
    const dir = join(packageDir, folder)
    if (!existsSync(dir) || !statSync(dir).isDirectory()) continue
    const files = readdirSync(dir)
      .filter(entry => entry.endsWith('.js') || entry.endsWith('.mjs'))
      .filter(entry => !entry.endsWith('.map'))
      .map(entry => join(dir, entry))
    if (files.length > 0) return files
  }
  return readdirSync(packageDir)
    .filter(entry => entry.endsWith('.js') || entry.endsWith('.mjs'))
    .map(entry => join(packageDir, entry))
}

function packageDirectories(root) {
  if (!existsSync(root)) return []
  const found = []
  for (const entry of readdirSync(root)) {
    if (entry.startsWith('.')) continue
    const path = join(root, entry)
    if (!statSync(path).isDirectory()) continue
    if (entry.startsWith('@')) {
      for (const scoped of readdirSync(path)) {
        const scopedPath = join(path, scoped)
        if (statSync(scopedPath).isDirectory()) found.push({ name: `${entry}/${scoped}`, path: scopedPath })
      }
    } else {
      found.push({ name: entry, path })
    }
  }
  return found
}

const pack = readPack()
const rows = []
const competitors = []
for (const pkg of packageDirectories(target).sort((left, right) => left.name.localeCompare(right.name))) {
  let manifest = null
  try {
    manifest = JSON.parse(readFileSync(join(pkg.path, 'package.json'), 'utf8'))
  } catch {
    /* A plugin installed without a manifest is still worth reporting. */
  }
  /*
   * Only DSH plugins are interesting: a dependency of the host (`@aws-sdk/...`, `react`)
   * has no UI of its own. The discriminator is the `dsh` field the host reads, with the
   * package name as the fallback for plugins that ship a client bundle without one.
   */
  const isPlugin = (manifest !== null && typeof manifest.dsh === 'object' && manifest.dsh !== null)
    || /(?:^|\/)dsh[.-][\w.-]*$/u.test(pkg.name)
  if (!isPlugin) continue
  const version = manifest?.version ?? null
  const bundles = bundlesOf(pkg.path)
  if (pkg.name !== OURS && registersRussian(bundles)) competitors.push({ package: pkg.name, version })
  const { found, selfTranslated, loopRegistered } = readPluginDictionaries(bundles)
  if (found.size === 0) {
    rows.push({
      package: pkg.name,
      version,
      namespace: selfTranslated.size > 0 ? [...selfTranslated].join(', ') : null,
      keys: loopRegistered,
      translated: loopRegistered,
      status: selfTranslated.size > 0
        ? 'self-translated'
        : loopRegistered > 0
          ? 'loop-registered'
          : 'no-dictionary',
    })
    continue
  }
  for (const [namespace, pairs] of found) {
    const ours = pack.get(namespace)
    const keys = [...pairs.keys()]
    const translated = ours === undefined ? 0 : keys.filter(key => ours.has(key)).length
    const status = selfTranslated.has(namespace)
      ? 'self-translated'
      : ours === undefined
        ? 'missing-namespace'
        : translated === keys.length
          ? 'covered'
          : 'partial'
    rows.push({ package: pkg.name, version, namespace, keys: keys.length, translated, status })
  }
}

if (asJson) {
  console.log(JSON.stringify({ target, rows }, null, 2))
  process.exit(0)
}

const label = {
  covered: 'переведено нами',
  partial: 'частично',
  'missing-namespace': 'не покрыто',
  'self-translated': 'перевод внутри плагина',
  'loop-registered': 'словарь внутри, регистрация циклом',
  'no-dictionary': 'словаря нет',
}
const width = Math.max(7, ...rows.map(row => row.package.length))
console.log(`${'пакет'.padEnd(width)}  ${'namespace'.padEnd(26)}  ключей  у нас  состояние`)
for (const row of rows) {
  console.log(
    `${row.package.padEnd(width)}  ${(row.namespace ?? '—').padEnd(26)}  ${String(row.keys).padStart(6)}  ${String(row.translated).padStart(4)}  ${label[row.status]}`,
  )
}
const rowsWithDictionary = rows.filter(row => row.status !== 'no-dictionary')
const keys = rowsWithDictionary.reduce((sum, row) => sum + row.keys, 0)
const covered = rowsWithDictionary.reduce((sum, row) => sum + row.translated, 0)
console.log('')
console.log(`пакетов осмотрено: ${rows.length}; со словарём: ${rowsWithDictionary.length}; ключей в них: ${keys}; переведено нами: ${covered}`)
console.log(`без словаря (переводить нечего, пока плагин не спросит перевод): ${rows.filter(row => row.status === 'no-dictionary').length}`)
console.log(`перевод уже внутри плагина: ${rows.filter(row => row.status === 'self-translated' || row.status === 'loop-registered').length}`)
console.log(`ждать нашей работы: ${rows.filter(row => row.status === 'missing-namespace' || row.status === 'partial').length}`)
if (competitors.length > 0) {
  console.log('')
  console.log('ВНИМАНИЕ: в профиле есть другие пакеты, которые сами регистрируют русский:')
  for (const competitor of competitors) {
    console.log(`  ${competitor.package}${competitor.version === null ? '' : `@${competitor.version}`}`)
  }
  console.log('Язык ru достаётся тому, кто зарегистрировал его первым: второй пакет молча пропустит')
  console.log('свои namespace, и в интерфейсе окажется перевод другого пакета. Оставьте один.')
}
