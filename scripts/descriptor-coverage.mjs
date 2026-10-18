/**
 * Measures the plugin-descriptor gap, which no language pack can close.
 *
 * A plugin's title and description on the Plugins page come from `locale/<language>.json`
 * inside its own package: the loader reads every such file into a `LocalizedText` map, and
 * the locale service resolves that map without consulting registered dictionaries — its own
 * documentation says «maps do not consult registered dictionaries». So a language pack can
 * translate a plugin's *strings* but never its *name*, and a Russian name exists only when
 * the package ships `locale/ru.json`.
 *
 * This script counts that gap separately from the pack's dictionary coverage, so the
 * README's claims stay precise. A package whose title equals its module name is an
 * identifier, not a label, and is excluded from the readable list.
 *
 * Usage: node scripts/descriptor-coverage.mjs [harness tree] [--json]
 * Default tree: ../deepseek-harness (a sibling checkout).
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { basename, join, relative, resolve } from 'node:path'

const args = process.argv.slice(2)
const asJson = args.includes('--json')
const root = resolve(args.find(argument => !argument.startsWith('--')) ?? '../deepseek-harness/packages')

if (!existsSync(root)) {
  console.log(`дерево харнесса не найдено: ${root}`)
  process.exit(2)
}

/** Every `locale/en.json` under the tree, skipping build output and dependencies. */
function localeDirectories(directory, out = []) {
  for (const entry of readdirSync(directory)) {
    if (entry === 'node_modules' || entry === 'lib' || entry === 'dist') continue
    const path = join(directory, entry)
    if (statSync(path).isDirectory()) {
      localeDirectories(path, out)
      continue
    }
    if (entry === 'en.json' && basename(directory) === 'locale') out.push(directory)
  }
  return out
}

const rows = []
for (const localeDirectory of localeDirectories(root)) {
  const packageDirectory = localeDirectory.slice(0, localeDirectory.lastIndexOf('locale'))
  let manifest = null
  try {
    manifest = JSON.parse(readFileSync(join(packageDirectory, 'package.json'), 'utf8'))
  } catch {
    /* A directory without a manifest is not a published package. */
  }
  const languages = readdirSync(localeDirectory)
    .filter(name => name.endsWith('.json'))
    .map(name => name.slice(0, -5))
  let title = null
  let description = null
  try {
    const english = JSON.parse(readFileSync(join(localeDirectory, 'en.json'), 'utf8'))
    title = typeof english.meta?.title === 'string' ? english.meta.title : null
    description = typeof english.meta?.description === 'string' ? english.meta.description : null
  } catch {
    /* A broken dictionary is the harness's problem, not this report's. */
  }
  const specifier = manifest?.name ?? basename(packageDirectory)
  const plain = specifier.replace(/^@[^/]+\//u, '').replace(/^dsh-(?:experimental-)?/u, '')
  /*
   * A title that is one hyphen-separated piece of the module name (`connection` inside
   * `client-connection`) is still an identifier: nobody reads it as a label.
   */
  const segments = plain.split('-')
  const spellable = segments.some((_, index) => segments.slice(index).join('-') === title)
    || segments.some((_, index) => segments.slice(0, index + 1).join('-') === title)
  const identifierLike = title === null || title === specifier || title === plain || spellable
    || title === plain.replace(/-(?:profile|bundle)$/u, '')
  rows.push({
    package: specifier,
    directory: relative(root, packageDirectory),
    title,
    description,
    languages,
    identifierLike,
  })
}

const titles = rows.filter(row => row.title !== null).length
const descriptions = rows.filter(row => row.description !== null).length
const withRussian = rows.filter(row => row.languages.includes('ru')).length
const withChinese = rows.filter(row => row.languages.includes('zh')).length
const readable = rows.filter(row => !row.identifierLike)

if (asJson) {
  console.log(JSON.stringify({ root, titles, descriptions, withRussian, withChinese, readable }, null, 2))
  process.exit(0)
}

console.log(`дерево: ${root}`)
console.log(`пакетов с locale/en.json: ${rows.length}`)
console.log(`строк meta.title: ${titles}, meta.description: ${descriptions}, всего: ${titles + descriptions}`)
console.log(`с локалью zh: ${withChinese}, с локалью ru: ${withRussian}`)
console.log(`читаемых названий (не идентификаторов): ${readable.length}`)
console.log('')
console.log('названия, которые пользователь видит и которые останутся английскими без locale/ru.json:')
for (const row of readable.slice(0, 40)) {
  console.log(`  ${row.title}  —  ${row.package}`)
}
if (readable.length > 40) console.log(`  … ещё ${readable.length - 40}`)
