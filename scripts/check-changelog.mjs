/**
 * Check the changelog against the version being released.
 *
 * `npm publish` will happily ship a package whose CHANGELOG stops at the previous
 * release: the registry page, the GitHub release notes and the "what changed" line in
 * every announcement then point at text that describes the version before. Nothing
 * else looks at this file — the tag/package.json/metadata checks all pass while the
 * human-readable history is wrong or absent.
 *
 * The rules are the ones a reader would apply:
 *
 * - the newest section names `package.json`'s version exactly;
 * - its date is `YYYY-MM-DD` and not in the future;
 * - the section has at least one bullet, so a release cannot be "documented" by an
 *   empty heading;
 * - versions run newest-first, so an entry inserted in the middle is visible.
 *
 * Usage: node scripts/check-changelog.mjs
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = path => readFileSync(join(ROOT, path), 'utf8').replace(/\r\n/gu, '\n')

const version = JSON.parse(read('package.json')).version
if (typeof version !== 'string' || !/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/u.test(version)) {
  console.error(`package.json: версия ${JSON.stringify(version)} не похожа на semver`)
  process.exit(2)
}

const text = read('CHANGELOG.md')
const lines = text.split('\n')

/** Every `## [x.y.z] — date` heading, in document order, with its body. */
const sections = []
let current = null
for (const line of lines) {
  const heading = /^##\s+\[([^\]]+)\]\s*(?:—|-)?\s*(.*)$/u.exec(line)
  if (heading !== null) {
    current = { version: heading[1].trim(), date: heading[2].trim(), body: [] }
    sections.push(current)
    continue
  }
  if (current !== null) current.body.push(line)
}
if (sections.length === 0) {
  console.error('CHANGELOG.md: не найдено ни одного заголовка «## [версия]»')
  process.exit(1)
}

const problems = []
const newest = sections[0]
if (newest.version !== version) {
  problems.push(`верхний раздел описывает ${newest.version}, а package.json — ${version}; выпуск ушёл бы со старой историей`)
}
if (!/^\d{4}-\d{2}-\d{2}$/u.test(newest.date)) {
  problems.push(`у раздела ${newest.version} дата ${JSON.stringify(newest.date)} — нужен формат YYYY-MM-DD`)
} else if (Date.parse(`${newest.date}T00:00:00Z`) > Date.now()) {
  problems.push(`у раздела ${newest.version} дата ${newest.date} в будущем`)
}
const bullets = newest.body.filter(line => /^\s*[-*]\s+\S/u.test(line)).length
if (bullets === 0) problems.push(`раздел ${newest.version} не содержит ни одного пункта`)

const compare = (left, right) => {
  const parse = value => {
    const [core, prerelease] = value.split('-')
    const numbers = core.split('.').map(Number)
    return { numbers, prerelease: prerelease ?? '' }
  }
  const a = parse(left)
  const b = parse(right)
  for (let index = 0; index < 3; index += 1) {
    if (a.numbers[index] !== b.numbers[index]) return a.numbers[index] - b.numbers[index]
  }
  if (a.prerelease === b.prerelease) return 0
  if (a.prerelease === '') return 1
  if (b.prerelease === '') return -1
  return a.prerelease.localeCompare(b.prerelease, 'en')
}
for (let index = 1; index < sections.length; index += 1) {
  const previous = sections[index - 1]
  const entry = sections[index]
  if (!/^\d+\.\d+\.\d+/u.test(entry.version)) continue
  if (compare(previous.version, entry.version) < 0) {
    problems.push(`разделы не по убыванию: ${previous.version} стоит выше ${entry.version}`)
  }
}

if (problems.length > 0) {
  console.error(`CHANGELOG расходится с версией (${problems.length}):`)
  for (const problem of problems) console.error(`  ${problem}`)
  process.exit(1)
}
console.log(`CHANGELOG: раздел ${newest.version} от ${newest.date}, ${bullets} пунктов; ${sections.length} разделов по убыванию`)
