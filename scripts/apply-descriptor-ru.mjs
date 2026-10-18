/**
 * Applies `descriptor-ru.json` to a harness checkout as `locale/ru.json` files.
 *
 * The loader builds a plugin's `LocalizedText` from `locale/<language>.json` and the locale
 * service resolves that map without consulting dictionaries, so a plugin's *name* can only
 * be Russian when the package itself ships `locale/ru.json`. This script writes exactly
 * those files: same `meta` keys the package's `locale/en.json` declares, no extras, so the
 * shape stays the one the harness validates.
 *
 * Usage: node scripts/apply-descriptor-ru.mjs [harness tree] [--write]
 * Default tree: ../deepseek-harness/packages. Without `--write` it only reports.
 */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, relative, resolve } from 'node:path'

const args = process.argv.slice(2)
const write = args.includes('--write')
const root = resolve(args.find(argument => !argument.startsWith('--')) ?? '../deepseek-harness/packages')
const translations = JSON.parse(readFileSync(new URL('../descriptor-ru.json', import.meta.url), 'utf8'))

if (!existsSync(root)) {
  console.log(`дерево харнесса не найдено: ${root}`)
  process.exit(2)
}

/** Package name -> directory, for every package that ships `locale/en.json`. */
function localeByPackage(directory, out = new Map()) {
  let manifest = null
  try {
    manifest = JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8'))
  } catch {
    /* Not a package directory. */
  }
  const localeDirectory = join(directory, 'locale')
  if (manifest?.name !== undefined && existsSync(join(localeDirectory, 'en.json'))) {
    out.set(manifest.name, localeDirectory)
    return out
  }
  for (const entry of readdirSync(directory)) {
    if (entry === 'node_modules' || entry === 'lib' || entry === 'dist' || entry === 'locale') continue
    const path = join(directory, entry)
    if (statSync(path).isDirectory()) localeByPackage(path, out)
  }
  return out
}

const located = localeByPackage(root)
const missing = []
const written = []
const skipped = []

for (const [specifier, fields] of Object.entries(translations)) {
  const localeDirectory = located.get(specifier)
  if (localeDirectory === undefined) {
    missing.push(specifier)
    continue
  }
  const english = JSON.parse(readFileSync(join(localeDirectory, 'en.json'), 'utf8'))
  const target = join(localeDirectory, 'ru.json')
  const wanted = {}
  /* Only the fields English declares: an extra key would be a shape mismatch, not a translation. */
  if (english.meta?.title !== undefined && fields.title !== undefined) wanted.title = fields.title
  if (english.meta?.description !== undefined && fields.description !== undefined) wanted.description = fields.description
  if (Object.keys(wanted).length === 0) {
    skipped.push(`${specifier}: нечего писать — в en.json нет этих полей`)
    continue
  }
  const body = `${JSON.stringify({ meta: wanted }, null, 2)}\n`
  const before = existsSync(target) ? readFileSync(target, 'utf8') : null
  if (before === body) {
    skipped.push(`${specifier}: уже совпадает`)
    continue
  }
  if (write) writeFileSync(target, body, 'utf8')
  written.push({ specifier, path: relative(root, target), fields: Object.keys(wanted) })
}

console.log(`дерево: ${root}`)
console.log(`переводов в descriptor-ru.json: ${Object.keys(translations).length}; найденных пакетов: ${located.size}`)
console.log(`${write ? 'записано' : 'будет записано'}: ${written.length}`)
for (const item of written) console.log(`  ${item.path}  (${item.fields.join(', ')})`)
if (skipped.length > 0) {
  console.log('без изменений:')
  for (const line of skipped) console.log(`  ${line}`)
}
if (missing.length > 0) {
  console.log('пакеты не найдены в дереве (проверьте имя и версию):')
  for (const line of missing) console.log(`  ${line}`)
  process.exitCode = 1
}
