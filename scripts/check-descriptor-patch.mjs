/**
 * Keeps the upstream patch in step with the translations.
 *
 * `docs/harness-descriptors-ru.patch` is the artefact that goes to the harness: a pull
 * request adds exactly those files. If a translation changes and the patch is not
 * regenerated, the two disagree and the pull request would carry text that the repository
 * no longer holds — so the patch is compared with `descriptor-ru.json`.
 *
 * The comparison is over the whole set rather than file by file: the patch does not name
 * the package a title belongs to, and pairing by content would be guesswork (several
 * packages share a title, and a description may contain a title inside it). A changed
 * translation makes the sets differ — the old value stays in the patch and the new one is
 * missing — which is exactly what must fail.
 *
 * Usage: node scripts/check-descriptor-patch.mjs
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = path => readFileSync(join(ROOT, path), 'utf8').replace(/\r\n/gu, '\n')

const translations = JSON.parse(read('descriptor-ru.json'))
const patch = read('docs/harness-descriptors-ru.patch')

const problems = []
const files = [...patch.matchAll(/^diff --git a\/(\S+) b\/(\S+)$/gmu)].map(match => match[2])
if (files.length !== Object.keys(translations).length) {
  problems.push(`в патче ${files.length} файлов, а переводов ${Object.keys(translations).length}`)
}

/* The text the patch adds, one entry per field. A description may end the object, so the
 * closing comma is optional. */
const added = [...patch.matchAll(/^\+\s*"(?:title|description)": "(.+)",?$/gmu)].map(match => match[1])
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

if (problems.length > 0) {
  console.error(`патч разошёлся с переводами (${problems.length}):`)
  for (const problem of problems.slice(0, 12)) console.error(`  ${problem}`)
  if (problems.length > 12) console.error(`  … ещё ${problems.length - 12}`)
  process.exit(1)
}
console.log(`патч совпадает с переводами: ${files.length} файлов, ${added.length} строк`)
