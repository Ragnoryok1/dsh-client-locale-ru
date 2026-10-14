/**
 * Run the runtime suites against every harness locale version the pack claims.
 *
 * `compatible_versions` in the README meta is a promise: the pack says it works
 * with those harness releases. Nothing checked it — the suites ran against one
 * host, the pinned tag, and an API that exists there may be missing elsewhere.
 * This script takes the promise literally: it downloads each claimed version's
 * locale client from the registry, extracts it and runs coexistence and plural
 * forms against it.
 *
 * Usage: node scripts/check-compat.mjs
 *   COMPAT_VERSIONS=a,b   override the list (defaults to the README meta)
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const WORK = join(ROOT, 'node_modules', '.cache', 'compat')

/** Versions to verify: an override, or the promise the README makes. */
function claimedVersions() {
  const override = process.env.COMPAT_VERSIONS
  if (override !== undefined && override.trim() !== '') return override.split(',').map(v => v.trim())
  const readme = readFileSync(join(ROOT, 'README.md'), 'utf8')
  const meta = /<!--\s*deepseek-harness-meta\s*([\s\S]*?)-->/u.exec(readme)
  if (meta === null) throw new Error('нет meta-блока в README.md')
  const parsed = JSON.parse(meta[1])
  // The README lists tags (`v0.2.1-alpha.3`); the registry wants bare versions.
  return (parsed.compatible_versions ?? []).map(tag => String(tag).replace(/^v/u, ''))
}

/**
 * Fetch and unpack one version's locale client.
 *
 * @param {string} version - registry version, without the leading `v`.
 * @returns {Promise<string>} path of the extracted `lib/client.js`.
 */
async function prepare(version) {
  const dir = join(WORK, version)
  const bundle = join(dir, 'package', 'lib', 'client.js')
  if (existsSync(bundle)) return bundle
  mkdirSync(dir, { recursive: true })
  const url = `https://registry.npmjs.org/@deepseek-ai/dsh-client-locale/-/dsh-client-locale-${version}.tgz`
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(response.status === 404
      ? `версии ${version} нет в реестре — проверьте compatible_versions в README`
      : `реестр ответил HTTP ${response.status}`)
  }
  const archive = join(dir, 'pkg.tgz')
  writeFileSync(archive, Buffer.from(await response.arrayBuffer()))
  execFileSync('tar', ['-xzf', archive, '-C', dir], { stdio: 'ignore' })
  if (!existsSync(bundle)) throw new Error(`${version}: в архиве нет lib/client.js`)
  return bundle
}

/**
 * Run one suite against one host.
 *
 * @param {string} script - suite to run.
 * @param {string} host - extracted host bundle.
 * @returns {{ok: boolean, output: string}} result and the tail of its output.
 */
function runSuite(script, host) {
  try {
    const output = execFileSync(process.execPath, [join(ROOT, 'scripts', script), host], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
    return { ok: true, output }
  } catch (error) {
    return { ok: false, output: `${error.stdout ?? ''}${error.stderr ?? ''}` }
  }
}

const versions = claimedVersions()
rmSync(WORK, { recursive: true, force: true })
console.log(`проверяю совместимость с ${versions.length} заявленными версиями харнесса\n`)

const failures = []
for (const version of versions) {
  let host
  try {
    host = await prepare(version)
  } catch (error) {
    failures.push(`${version}: ${error.message}`)
    console.log(`  ${version.padEnd(16)} НЕ ПОДГОТОВИЛСЯ — ${error.message}`)
    continue
  }
  const results = [
    ['локали', runSuite('check-locale.mjs', host)],
    ['формы числа', runSuite('check-plural.mjs', host)],
  ]
  const summary = results.map(([name, { ok, output }]) => {
    const passed = /pass (\d+)/u.exec(output)?.[1]
    return `${name}: ${ok ? `${passed ?? '?'} ok` : 'ПРОВАЛ'}`
  }).join(', ')
  console.log(`  ${version.padEnd(16)} ${summary}`)
  for (const [name, { ok, output }] of results) {
    if (ok) continue
    failures.push(`${version} (${name})`)
    // A failed suite says why in its own words; show the lines that carry it.
    const reason = output.split('\n')
      .filter(line => /✖|fail|Error|not loaded|AssertionError/u.test(line))
      .slice(0, 4)
    console.log(`      ${reason.length === 0 ? output.trim().split('\n').slice(-3).join('\n      ') : reason.join('\n      ')}`)
  }
}

console.log(failures.length === 0
  ? `\nсовместимость подтверждена: ${versions.length} версий, оба набора прошли`
  : `\nпровалы: ${failures.join(', ')}`)
process.exitCode = failures.length === 0 ? 0 : 1

// Keep the cache small: the archives themselves are not needed afterwards.
for (const version of versions) rmSync(join(WORK, version, 'pkg.tgz'), { force: true })
writeFileSync(join(WORK, 'checked.txt'), `${versions.join('\n')}\n`)
