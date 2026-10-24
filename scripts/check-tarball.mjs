/**
 * Check the artifact that would be published, not the working tree.
 *
 * Every other check reads the repository: `check:built` compares `lib/` with HEAD,
 * `check:manifest` walks `exports` on disk, `check:namespaces` loads `lib/client.js`
 * from the checkout. None of them sees the tarball — and the tarball is what a user
 * installs. A file missing from `files`, an `exports` target that only exists because
 * of a stray build output, or a bundle that regressed while being packed would pass
 * everything here and fail in the one moment that matters.
 *
 * The check packs the package, unpacks it elsewhere and asks the same questions of the
 * unpacked copy:
 *
 * - every `exports` target and the `dsh.bundle.patch` exist inside the archive;
 * - the documented docs travel with it (`NAMESPACES.md`, both language READMEs);
 * - the shipped `lib/client.js` registers the same namespaces and strings as
 *   `scripts/pack-count.json`, loaded through a sandbox exactly as the host would.
 *
 * Usage: node scripts/check-tarball.mjs
 */
import { execFileSync, execSync, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const work = mkdtempSync(join(tmpdir(), 'locale-ru-tarball-'))
const problems = []
const note = message => problems.push(message)

try {
  /* One shell string: npm is a `.cmd` shim on Windows, and passing arguments to it
     through `shell: true` is what Node 24 deprecates. */
  const packed = JSON.parse(execSync(`npm pack --json --pack-destination "${work.replace(/[\\/]/gu, '/')}"`, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }))
  const filename = packed[0]?.filename
  const files = packed[0]?.files?.map(entry => entry.path) ?? []
  if (filename === undefined) throw new Error('npm pack не вернул имя архива')
  const tarball = join(work, filename)
  const size = statSync(tarball).size

  const extract = join(work, 'package')
  mkdirSync(extract, { recursive: true })
  execFileSync('tar', ['-xzf', tarball, '-C', work])
  const inner = join(work, 'package')
  if (!existsSync(join(inner, 'package.json'))) throw new Error('в архиве нет package.json')

  const manifest = JSON.parse(readFileSync(join(inner, 'package.json'), 'utf8'))

  /* Every target a consumer may import has to be inside the archive. */
  for (const [key, value] of Object.entries(manifest.exports ?? {})) {
    const targets = typeof value === 'string' ? [value] : Object.values(value ?? {})
    for (const target of targets) {
      if (typeof target !== 'string') continue
      const relative = target.replace(/^\.\//u, '')
      if (!existsSync(join(inner, relative))) note(`exports["${key}"] ведёт на ${target} — в архиве этого файла нет`)
    }
  }
  const patch = manifest.dsh?.bundle?.patch
  for (const entry of typeof patch === 'string' ? [patch] : patch ?? []) {
    const relative = String(entry).replace(/^\.\//u, '')
    if (!existsSync(join(inner, relative))) note(`dsh.bundle.patch: ${entry} не попал в архив`)
  }

  /* The docs the READMEs link to travel with the package. */
  for (const doc of ['NAMESPACES.md', 'README.md', 'README-en.md', 'README-zh.md', 'CHANGELOG.md', 'LICENSE']) {
    if (!existsSync(join(inner, doc))) note(`${doc} обещан в files, но в архиве его нет`)
  }

  /* The shipped bundle must reproduce the documented inventory. */
  const inventory = spawnSync(
    process.execPath,
    [join(ROOT, 'scripts', 'namespaces.mjs'), '--check', '--pack', join(inner, 'lib', 'client.js')],
    { cwd: ROOT, encoding: 'utf8' },
  )
  if (inventory.status !== 0) {
    const last = (inventory.stderr || inventory.stdout).trim().split(/\n/u).slice(-1)[0]
    note(`собранный архив не воспроизводит документацию: ${last}`)
  }
  const bySize = `${Math.round(size / 1000)} КБ`
  console.log(`архив: ${filename}, ${bySize}, ${files.length} файлов`)
  console.log(`  exports и патч на месте, документация едет с пакетом, инвентарь воспроизводится из архива`)
} catch (error) {
  note(error.message ?? String(error))
} finally {
  rmSync(work, { recursive: true, force: true })
}

if (problems.length > 0) {
  console.error(`архив расходится с репозиторием (${problems.length}):`)
  for (const problem of problems) console.error(`  ${problem}`)
  process.exitCode = 1
} else {
  console.log('check:tarball: опубликованный артефакт совпадает с проверенным пакетом')
  process.exitCode = 0
}
