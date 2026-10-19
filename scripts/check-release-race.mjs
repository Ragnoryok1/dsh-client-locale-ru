/**
 * Protects the release from the race between a publish made elsewhere and the one this
 * workflow makes.
 *
 * The registry can answer `npm view` a couple of minutes after a version appears there.
 * A release cut by hand and then tagged hits exactly that window: the guard says «not
 * published», npm refuses to publish over an existing version, and the run fails on a
 * package that is already out.
 *
 * The check has two halves. The static one reads the workflow and requires that the guard
 * retries and that the publish re-checks the registry after a refusal and ends the run
 * successfully. The dynamic one — when a POSIX shell is available — runs both steps with a
 * stub `npm` and requires the expected exit codes.
 *
 * Usage: node scripts/check-release-race.mjs
 */
import { execFileSync } from 'node:child_process'
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { delimiter } from 'node:path'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = path => readFileSync(join(ROOT, path), 'utf8').replace(/\r\n/gu, '\n')

const workflow = read('.github/workflows/publish.yml')
const problems = []

/* The body of a step, as the workflow spells it. */
function stepBody(name) {
  const lines = workflow.split('\n')
  const at = lines.findIndex(line => line.trim() === `- name: ${name}`)
  if (at === -1) {
    problems.push(`в publish.yml нет шага «${name}»`)
    return ''
  }
  let runAt = at + 1
  while (runAt < lines.length && !/^\s*run:/u.test(lines[runAt])) runAt += 1
  if (!/^\s*run:\s*\|/u.test(lines[runAt])) {
    problems.push(`шаг «${name}» не с блоком run: |`)
    return ''
  }
  const body = []
  for (let index = runAt + 1; index < lines.length; index += 1) {
    if (/^\s{6}- name:/u.test(lines[index])) break
    body.push(lines[index].trim())
  }
  return body.join('\n')
}

const guard = stepBody('Is this version already on the registry')
const publish = stepBody('Publish')

if (!/for\s+\w+\s+in\s+1\s+2\s+3/u.test(guard)) {
  problems.push('страж спрашивает реестр один раз: задержку ответа он не переживает')
}
if (!/npm view/u.test(publish)) {
  problems.push('шаг публикации не перепроверяет реестр после отказа npm')
}
if (!/exit 0/u.test(publish)) {
  problems.push('шаг публикации не заканчивается успешно, когда версия уже в реестре')
}

/* The dynamic half, when a shell is around. */
const shells = ['/bin/sh', 'C:\\Program Files\\Git\\bin\\sh.exe']
const shell = shells.find(candidate => existsSync(candidate))
if (shell !== undefined) {
  const stubDirectory = join(tmpdir(), `dsh-npm-stub-${Date.now()}`)
  mkdirSync(stubDirectory, { recursive: true })
  const stub = join(stubDirectory, 'npm')
  writeFileSync(stub, '#!/bin/sh\nif [ "$1" = "view" ]; then echo "0.0.0"; exit 0; fi\nif [ "$1" = "publish" ]; then exit 1; fi\nexit 0\n')
  chmodSync(stub, 0o755)
  const script = join(stubDirectory, 'step.sh')
  const output = join(stubDirectory, 'out.txt')

  const run = body => {
    writeFileSync(script, body)
    try {
      execFileSync(shell, [script], {
        cwd: ROOT,
        encoding: 'utf8',
        env: { ...process.env, PATH: `${stubDirectory}${delimiter}${process.env.PATH}`, GITHUB_OUTPUT: output },
        stdio: ['ignore', 'pipe', 'pipe'],
      })
      return 0
    } catch (error) {
      return error.status ?? 1
    }
  }

  /*
   * The steps are only meaningful if they ran against the stub: with the real npm on the
   * PATH the publish would reach the registry, which is not what this check is about.
   */
  const which = (() => {
    try {
      return execFileSync(shell, ['-c', 'command -v npm'], {
        cwd: ROOT,
        encoding: 'utf8',
        env: { ...process.env, PATH: `${stubDirectory}${delimiter}${process.env.PATH}` },
        stdio: ['ignore', 'pipe', 'pipe'],
      }).trim()
    } catch {
      return ''
    }
  })()
  if (!which.includes(basename(stubDirectory))) {
    problems.push(`подмена npm не сработала: шаги увидят "${which || 'ничего'}" вместо заглушки`)
  }

  if (run(publish) !== 0) {
    problems.push('шаг публикации падает, когда версия уже в реестре')
  }
  if (run(guard) !== 0) {
    problems.push('страж падает, когда версия в реестре')
  }
  const recorded = existsSync(output) ? readFileSync(output, 'utf8') : ''
  if (!recorded.includes('exists=true')) {
    problems.push('страж не помечает версию как уже опубликованную')
  }
} else {
  console.log('POSIX-shell не найден — динамическая половина проверки пропущена')
}

if (problems.length > 0) {
  console.error(`публикация не идемпотентна (${problems.length}):`)
  for (const problem of problems) console.error(`  ${problem}`)
  process.exit(1)
}
console.log('публикация идемпотентна: страж повторяет запрос, отказ npm перепроверяется по реестру')
