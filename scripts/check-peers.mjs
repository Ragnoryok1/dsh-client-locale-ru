/**
 * Check the compatibility declaration against the rule the harness applies.
 *
 * A plugin's `peerDependencies` are not read the way npm reads them. The harness
 * runs `evaluatePluginCompatibility`, which keeps the peers named
 * `@deepseek-ai/dsh` or `@deepseek-ai/dsh-*` and requires each range to satisfy
 * the **running dsh version** with `includePrerelease`; what those packages'
 * own versions are does not enter into it. A range that fails is a warning the
 * user sees — «Plugin … is incompatible with dsh …» — and an installation that
 * asks for an exemption.
 *
 * So the range in `peerDependencies` and the versions the README claims have to
 * agree under that rule, and nothing was checking it: the range is a chain of
 * prerelease windows that a later edit can quietly break.
 *
 * Usage: node scripts/check-peers.mjs
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import semver from 'semver'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const manifest = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
const readme = readFileSync(join(ROOT, 'README.md'), 'utf8')
const meta = /<!--\s*deepseek-harness-meta\s*([\s\S]*?)-->/u.exec(readme)
if (meta === null) {
  console.error('нет meta-блока в README.md')
  process.exit(2)
}
const versions = (JSON.parse(meta[1]).compatible_versions ?? []).map(tag => String(tag).replace(/^v/u, ''))
if (versions.length === 0) {
  console.error('compatible_versions пуст — проверять нечего')
  process.exit(2)
}

/** Peers the harness evaluates, with their declared ranges. */
const peers = Object.entries(manifest.peerDependencies ?? {})
  .filter(([name]) => name === '@deepseek-ai/dsh' || name.startsWith('@deepseek-ai/dsh-'))

if (peers.length === 0) {
  console.log('в peerDependencies нет пакетов @deepseek-ai/dsh* — харнесс ничего не проверяет')
  process.exit(0)
}

const failures = []
console.log(`заявлено версий: ${versions.length}; проверяются ${peers.length} peer-диапазон(а)\n`)
for (const version of versions) {
  const results = peers.map(([name, range]) => {
    // The harness's own call: `semver.satisfies(runtimeVersion, range, { includePrerelease: true })`.
    const ok = semver.satisfies(version, range, { includePrerelease: true })
    if (!ok) failures.push(`${version} не удовлетворяет ${name} ${range}`)
    return `${name.replace('@deepseek-ai/', '')}: ${ok ? 'ok' : 'НЕ СОВПАДАЕТ'}`
  })
  console.log(`  ${version.padEnd(16)} ${results.join(', ')}`)
}

console.log(failures.length === 0
  ? `\nобъявление совместимости проходит правило харнесса для всех ${versions.length} версий`
  : `\nпровалы (${failures.length}) — харнесс предупредит о несовместимости:\n  ${failures.join('\n  ')}`)
process.exitCode = failures.length === 0 ? 0 : 1
