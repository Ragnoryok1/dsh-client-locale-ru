/**
 * Builds the patch that carries the Russian plugin names into the harness.
 *
 * The patch is a build artefact: it is generated from the translations and the tree, and
 * `check-descriptor-patch.mjs` fails when the committed file and the generated one
 * differ. Run this with `--write` after a translation changes.
 *
 * Usage: node scripts/build-descriptor-patch.mjs [harness tree] [--write]
 * Default tree: ../deepseek-harness/packages. Without `--write` it only reports.
 */
import { existsSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildPatch, readTranslations } from './descriptor-patch.mjs'

const args = process.argv.slice(2)
const write = args.includes('--write')
const root = resolve(
  args.find(argument => !argument.startsWith('--')) ?? process.env.DSH_HARNESS_TREE ?? '../deepseek-harness/packages',
)
const target = fileURLToPath(new URL('../docs/harness-descriptors-ru.patch', import.meta.url))

if (!existsSync(root)) {
  console.log(`дерево харнесса не найдено: ${root}`)
  process.exit(2)
}

const translations = readTranslations()
const { patch, files, missing } = buildPatch(root, translations)

console.log(`дерево: ${root}`)
console.log(`переводов: ${Object.keys(translations).length}; файлов в патче: ${files.length}`)
if (missing.length > 0) {
  console.log('пакеты не найдены в дереве:')
  for (const specifier of missing) console.log(`  ${specifier}`)
  process.exitCode = 1
}
if (write) {
  writeFileSync(target, patch, 'utf8')
  console.log(`патч записан: ${target}`)
} else {
  console.log('патч собран, но не записан: добавьте --write')
}
