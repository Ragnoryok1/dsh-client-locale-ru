/**
 * Keeps the upstream patch in step with the translations.
 *
 * `docs/harness-descriptors-ru.patch` is the artefact that goes to the harness: a pull
 * request adds exactly those files. If a translation changes and the patch is not
 * regenerated, the two disagree and the pull request would carry text that the repository
 * no longer holds — so the patch is compared with `src/client/descriptor-ru.json`.
 *
 * With a harness tree the comparison is exact: the patch is rebuilt from the
 * translations and the tree, and the committed file must match it. Without a tree only
 * the texts can be compared, and that is enough to catch a translation that changed
 * without the patch following.
 *
 * Usage: node scripts/check-descriptor-patch.mjs [harness tree]
 * Default tree: ../deepseek-harness/packages, when it is there.
 */
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { buildPatch, readCommittedPatch, readTranslations } from './descriptor-patch.mjs'

const args = process.argv.slice(2)
const root = resolve(args.find(argument => !argument.startsWith('--')) ?? '../deepseek-harness/packages')
const translations = readTranslations()
const committed = readCommittedPatch().replace(/\r\n/gu, '\n')

const problems = []
const files = [...committed.matchAll(/^diff --git a\/(\S+) b\/(\S+)$/gmu)].map(match => match[2])
if (files.length !== Object.keys(translations).length) {
  problems.push(`в патче ${files.length} файлов, а переводов ${Object.keys(translations).length}`)
}

/* The text the patch adds, one entry per field. A description may end the object, so the
 * closing comma is optional. */
const added = [...committed.matchAll(/^\+\s*"(?:title|description)": "(.+)",?$/gmu)].map(match => match[1])
const expected = []
for (const fields of Object.values(translations)) {
  if (fields.title !== undefined) expected.push(fields.title)
  if (fields.description !== undefined) expected.push(fields.description)
}

for (const value of expected) {
  if (!added.includes(value)) problems.push(`в патче нет строки «${value}»`)
}
for (const value of added) {
  if (!expected.includes(value)) problems.push(`в патче есть строка, которой нет в переводах: «${value}»`)
}

if (existsSync(root)) {
  const { patch, missing } = buildPatch(root, translations)
  if (missing.length > 0) problems.push(`в дереве нет пакетов: ${missing.join(', ')}`)
  if (patch !== committed) {
    const expectedLines = patch.split('\n')
    const actualLines = committed.split('\n')
    const at = expectedLines.findIndex((line, index) => line !== actualLines[index])
    problems.push(`патч разошёлся с собранным${at < 0 ? ' (разная длина)' : ` (строка ${at + 1}: «${actualLines[at] ?? '—'}» вместо «${expectedLines[at]}»)`}`)
  }
} else {
  console.log(`дерево харнесса не найдено: ${root} — патч сверен только по тексту`)
}

if (problems.length > 0) {
  console.error(`патч разошёлся с переводами (${problems.length}):`)
  for (const problem of problems.slice(0, 12)) console.error(`  ${problem}`)
  if (problems.length > 12) console.error(`  … ещё ${problems.length - 12}`)
  process.exit(1)
}
console.log(`патч совпадает с переводами: ${files.length} файлов, ${added.length} строк`)
