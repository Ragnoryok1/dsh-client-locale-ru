/**
 * Records the English text each translation was made from, so a later upstream rename is
 * visible as a drift instead of a silently wrong title.
 *
 * Reads `src/client/descriptor-ru.json`, adds or refreshes an `en` snapshot per entry from the harness
 * tree, and writes the file back with the translation order preserved.
 *
 * Usage: node scripts/record-descriptor-sources.mjs [harness tree]
 */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const root = resolve(process.argv[2] ?? '../deepseek-harness/packages')
const file = new URL('../src/client/descriptor-ru.json', import.meta.url)
const translations = JSON.parse(readFileSync(file, 'utf8'))

if (!existsSync(root)) {
  console.log(`дерево харнесса не найдено: ${root}`)
  process.exit(2)
}

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
let recorded = 0
const missing = []
for (const [specifier, fields] of Object.entries(translations)) {
  const localeDirectory = located.get(specifier)
  if (localeDirectory === undefined) {
    missing.push(specifier)
    continue
  }
  const english = JSON.parse(readFileSync(join(localeDirectory, 'en.json'), 'utf8'))
  const snapshot = {}
  if (typeof english.meta?.title === 'string') snapshot.title = english.meta.title
  if (typeof english.meta?.description === 'string') snapshot.description = english.meta.description
  fields.en = snapshot
  recorded += 1
}

writeFileSync(file, `${JSON.stringify(translations, null, 2)}\n`, 'utf8')
console.log(`снимок английского записан для ${recorded} записей`)
if (missing.length > 0) {
  console.log('не найдены в дереве:')
  for (const specifier of missing) console.log(`  ${specifier}`)
  process.exitCode = 1
}
