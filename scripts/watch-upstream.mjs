/**
 * Watch upstream for a harness release newer than the tag this pack is pinned to.
 *
 * The pack is a translation of a moving target: a new `dsh-v*` tag adds keys, and
 * nothing in the repository notices until someone looks. This script is the
 * looking — a scheduled workflow runs it weekly, and when a newer tag exists it
 * writes what it found and fails, so the maintainer hears about it from GitHub
 * rather than from a user's screenshot.
 *
 * The pinned tag is read from `verify.yml`, which is the single place it lives
 * for CI; `publish.yml` carries the same value and the audit reads the tree.
 *
 * Usage: node scripts/watch-upstream.mjs
 *   PINNED_TAG=<tag>   compare against an older tag, to prove the check fires
 *   GITHUB_TOKEN=<t>   raise the API rate limit (the workflow passes its token)
 *   GITHUB_OUTPUT      where the workflow reads `tag=` and the report body from
 */
import { readFileSync, writeFileSync, appendFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const WORKFLOW = join(ROOT, '.github', 'workflows', 'verify.yml')

/** Order two `dsh-v1.2.3-alpha.4` tags the way a maintainer reads them. */
function compare(left, right) {
  const split = tag => tag.replace(/^dsh-v/u, '').split(/[.-]/u).map(part => (/^\d+$/u.test(part) ? Number(part) : part))
  const a = split(left)
  const b = split(right)
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    const one = a[index]
    const other = b[index]
    // A shorter tag is the release of that tuple: `0.2.1` beats `0.2.1-alpha.3`,
    // and loses to a tag that has more numbers.
    if (one === undefined) return typeof other === 'string' ? 1 : -1
    if (other === undefined) return typeof one === 'string' ? -1 : 1
    if (one === other) continue
    // A release outranks its own prereleases: 0.2.1 comes after 0.2.1-alpha.3.
    if (typeof one === 'number' && typeof other === 'string') return 1
    if (typeof one === 'string' && typeof other === 'number') return -1
    if (typeof one === 'number' && typeof other === 'number') return one < other ? -1 : 1
    return one < other ? -1 : 1
  }
  return 0
}

const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'dsh-locale-ru-watch' }
if (process.env.GITHUB_TOKEN !== undefined) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`

/**
 * Orderings the comparator has to get right, checked without the network.
 *
 * The one that matters most: a release outranks its own prereleases, so
 * `dsh-v0.2.1` is newer than `dsh-v0.2.1-alpha.3`. Getting that backwards would
 * make the watch fire forever once the first stable release lands.
 */
const SELF_TEST = [
  ['dsh-v0.2.1-alpha.3', 'dsh-v0.2.1-alpha.2', 1],
  ['dsh-v0.2.1', 'dsh-v0.2.1-alpha.3', 1],
  ['dsh-v0.2.1-alpha.3', 'dsh-v0.2.1-alpha.3', 0],
  ['dsh-v0.2.1-alpha.1', 'dsh-v0.2.0-rc.2', 1],
  ['dsh-v0.1.7', 'dsh-v0.2.0-rc.1', -1],
]

/** Compare the orderings above and report; used by `--self-test`. */
function selfTest() {
  let failed = 0
  for (const [left, right, expected] of SELF_TEST) {
    const actual = Math.sign(compare(left, right))
    if (actual === expected) {
      console.log(`  ok    ${left} против ${right} → ${actual}`)
    } else {
      failed += 1
      console.log(`  FAIL  ${left} против ${right} → ${actual}, ожидалось ${expected}`)
    }
  }
  console.log(failed === 0 ? `\nсравнение версий: ${SELF_TEST.length} случаев, все прошли` : `\nсравнение версий: провалено ${failed}`)
  return failed === 0 ? 0 : 1
}

/**
 * Run the check and report through the exit code.
 *
 * `process.exit()` straight after an `await` trips a libuv assertion on Windows
 * (`!(handle->flags & UV_HANDLE_CLOSING)`) and hands the shell a garbage status,
 * which a workflow cannot read. Setting `process.exitCode` and returning lets the
 * process end on its own with the code that was asked for.
 *
 * @returns {Promise<number>} 0 when the pack is current, 1 when a newer tag exists, 2 on a failed check.
 */
async function main() {
  const pinned = process.env.PINNED_TAG
    ?? /HARNESS_TAG:\s*(\S+)/u.exec(readFileSync(WORKFLOW, 'utf8'))?.[1]
  if (pinned === undefined) {
    console.error('не нашёл HARNESS_TAG в .github/workflows/verify.yml')
    return 2
  }

  const response = await fetch('https://api.github.com/repos/deepseek-ai/deepseek-harness/tags?per_page=100', { headers })
  if (!response.ok) {
    console.error(`не удалось получить теги харнесса: HTTP ${response.status}`)
    return 2
  }
  const tags = (await response.json()).map(entry => entry.name).filter(name => name.startsWith('dsh-v'))
  if (tags.length === 0) {
    console.error('харнесс не отдал ни одного тега dsh-v*')
    return 2
  }

  const newest = tags.reduce((best, tag) => (compare(tag, best) > 0 ? tag : best))
  console.log(`пришпилено: ${pinned}`)
  console.log(`самый новый: ${newest}`)

  if (compare(newest, pinned) <= 0) {
    console.log('\nпакет идёт за самым новым тегом — синхронизация не нужна')
    return 0
  }

  const body = [
    `Вышел новый тег харнесса **${newest}**, пакет пришпилен к **${pinned}**.`,
    '',
    'Что делать:',
    '',
    '1. выгрузить дерево тега: `git -C <харнесс> archive <тег> packages | tar -x -C tree`;',
    '2. прогнать аудит: `npm run audit -- tree/packages` — он назовёт новые ключи, мёртвые строки и изменения плейсхолдеров;',
    '3. добавить переводы, обновить `HARNESS_TAG` в `verify.yml` и `publish.yml`, счётчики в README и `CHANGELOG.md`.',
  ].join('\n')
  writeFileSync(join(ROOT, 'upstream-report.md'), `${body}\n`)
  if (process.env.GITHUB_OUTPUT !== undefined) appendFileSync(process.env.GITHUB_OUTPUT, `tag=${newest}\n`)
  console.log(`\n${body}`)
  return 1
}

process.exitCode = process.argv.includes('--self-test') ? selfTest() : await main()
