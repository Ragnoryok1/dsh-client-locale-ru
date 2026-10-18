#!/usr/bin/env node
/**
 * The committed `lib/` is what an install from GitHub runs.
 *
 * pnpm refuses to run a git dependency's build script
 * (`ERR_PNPM_GIT_DEP_PREPARE_NOT_ALLOWED`), so a plugin installed straight from
 * this repository executes the `lib/client.js` that is committed here. A stale
 * bundle therefore never reaches the audit — it reaches users — and while
 * `verify` rebuilt over it, nothing compared the result with the commit. This
 * check builds (the same command publish runs) and then compares every tracked
 * file of `lib/` with HEAD itself, normalising line endings so a CRLF checkout
 * and an LF one agree; a file the build creates but nobody committed is
 * reported too.
 *
 * The build is deterministic — two runs produce the same bytes — which is what
 * makes the comparison meaningful rather than noisy.
 */
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const windows = process.platform === 'win32'
/** `npm` is a shell script, so Windows reaches it through cmd.exe without shell:true. */
const build = windows
  ? spawnSync(process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', 'npm run build'], { encoding: 'utf8' })
  : spawnSync('npm', ['run', 'build'], { encoding: 'utf8' })
const git = (args) => spawnSync('git', args, { encoding: 'utf8' })

const insideRepository = git(['rev-parse', '--is-inside-work-tree'])
if (insideRepository.status !== 0 || insideRepository.stdout.trim() !== 'true') {
  console.log('check-built: не git-репозиторий — собранный lib/ сверять не с чем, проверка пропущена')
  process.exit(0)
}

if (build.status !== 0) {
  console.error('check-built: сборка провалилась — собранный lib/ не сверить')
  console.error(`${build.stdout ?? ''}${build.stderr ?? ''}`.trimEnd())
  process.exit(1)
}

const normalize = text => text.replace(/\r\n/gu, '\n')
const paths = (args) => git(args).stdout.split('\n').map(line => line.trim()).filter(Boolean)
const tracked = paths(['ls-files', '--', 'lib'])
const untracked = paths(['ls-files', '--others', '--exclude-standard', '--', 'lib'])

const stale = []
for (const file of tracked) {
  const committed = git(['show', `HEAD:${file}`])
  if (committed.status !== 0) {
    stale.push(`${file} — нет в HEAD`)
    continue
  }
  let working
  try {
    working = readFileSync(file, 'utf8')
  } catch {
    stale.push(`${file} — не читается`)
    continue
  }
  if (normalize(working) !== normalize(committed.stdout)) stale.push(`${file} — расходится с HEAD`)
}
for (const file of untracked) stale.push(`${file} — не закоммичен`)

if (stale.length === 0) {
  console.log(`check-built: собранный lib/ совпадает с коммитом (${tracked.length} файлов, сборка детерминирована)`)
  process.exit(0)
}

console.error('check-built: собранный lib/ расходится с коммитом — установка из GitHub получит устаревший пакет')
for (const line of stale) console.error(`  ${line}`)
console.error('пересоберите (`npm run build`) и закоммитьте lib/')
process.exitCode = 1
