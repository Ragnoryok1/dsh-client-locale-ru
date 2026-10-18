/**
 * The CI workflows must run what `verify` runs.
 *
 * A check that exists only in `package.json` protects the person who runs it and
 * nobody else: `check:compat` was added to the chain and the workflow step silently
 * did not appear (a CRLF file and a `\n` pattern), so the promise in the README was
 * again checked on one laptop. `check:namespaces` and `check:readmes:pairs` had the
 * same shape of hole on the release path.
 *
 * The rule is mechanical, with two documented exceptions:
 *
 * - `build` runs in CI and not in `verify`, because `verify` checks the *committed*
 *   bundle (`check:built`) and CI has to produce one first;
 * - `check:compat` runs in CI and not in `verify`, because it downloads every claimed
 *   harness version — the one step that needs the registry.
 *
 * Everything else must appear in both workflows. In `publish.yml` a step also counts
 * as covered when `check:compat` runs it transitively (locale, plurals, phrases).
 *
 * Usage: node scripts/check-workflows.mjs
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = path => readFileSync(join(ROOT, path), 'utf8').replace(/\r\n/gu, '\n')

const CI_ONLY = new Set(['build', 'check:compat'])
const COVERED_BY = new Map([['check:compat', new Set(['check:locale', 'check:plural', 'check:composition', 'check:peers'])]])

const scripts = JSON.parse(read('package.json')).scripts ?? {}
const verify = scripts.verify ?? ''
if (verify.trim() === '') {
  console.error('package.json: нет скрипта verify — проверять нечего')
  process.exit(2)
}

/** `npm run x` commands of a shell chain, in order, deduplicated. */
const chainOf = text => {
  const out = []
  for (const match of text.matchAll(/npm run ([\w:-]+)/gu)) {
    if (!out.includes(match[1])) out.push(match[1])
  }
  return out
}
const chain = chainOf(verify)
if (chain.length < 8) {
  console.error(`verify распознан как ${chain.length} команд — разбор сломан, а не цепочка`)
  process.exit(2)
}

const workflowSteps = file => chainOf(read(`.github/workflows/${file}`))
const inVerify = workflowSteps('verify.yml')
const inPublish = workflowSteps('publish.yml')

const coveredIn = (steps, name) => {
  if (steps.includes(name)) return true
  for (const [carrier, covered] of COVERED_BY) {
    if (steps.includes(carrier) && covered.has(name)) return true
  }
  return false
}

const problems = []
for (const name of chain) {
  if (!coveredIn(inVerify, name)) problems.push(`verify.yml не запускает «${name}» из цепочки verify`)
  if (!coveredIn(inPublish, name)) problems.push(`publish.yml не запускает «${name}» из цепочки verify`)
}
for (const name of inVerify) {
  if (chain.includes(name) || CI_ONLY.has(name)) continue
  problems.push(`verify.yml запускает «${name}», которого нет ни в verify, ни в списке CI-only`)
}
for (const name of inPublish) {
  if (chain.includes(name) || CI_ONLY.has(name)) continue
  /* A release may add its own checks (tag and metadata guards); they are steps, but
     not part of the verify chain, and that is what this loop is here to notice. */
  if (/^(?:check:|build)/u.test(name)) problems.push(`publish.yml запускает «${name}», которого нет ни в verify, ни в списке CI-only`)
}

if (problems.length > 0) {
  console.error(`workflows и verify разошлись (${problems.length}):`)
  for (const problem of problems) console.error(`  ${problem}`)
  process.exit(1)
}
console.log(`workflows запускают все ${chain.length} проверок цепочки verify (verify.yml и publish.yml; CI-only: ${[...CI_ONLY].join(', ')})`)
