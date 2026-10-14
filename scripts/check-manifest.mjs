/**
 * Check the plugin manifest against the rules the harness applies to it.
 *
 * Read out of the harness sources rather than guessed:
 *
 * - `parseDshClient` (client/modules) accepts `platform` as any string, while the
 *   consumers keep only rows whose `platform === 'web'` — so a typo like `'Web'`
 *   silently drops the client half, with no error anywhere;
 * - `client-modules` throws «declares dsh.client but exports no "./client" bundle»
 *   when the declaration exists without that export;
 * - `profile.ts` requires `dsh.bundle.patch` to be a file path or a list of them.
 *
 * Each of those is a failure the user would meet first, in a plugin manager or a
 * boot log. This checks them here instead, on the files that will be published.
 *
 * Usage: node scripts/check-manifest.mjs
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, isAbsolute, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const manifest = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
const problems = []
const note = (message) => problems.push(message)

/** Resolve an export target such as `./lib/client.js` to a path on disk. */
function targetPath(target) {
  const relative = target.replace(/^\.\//u, '')
  return isAbsolute(relative) ? relative : join(ROOT, relative)
}

const client = manifest.dsh?.client
if (client !== undefined) {
  if (typeof client !== 'object' || client === null || Array.isArray(client)) {
    note('dsh.client должен быть объектом')
  } else {
    // The value is what matters, not the type: consumers filter on `platform === 'web'`.
    if (client.platform !== 'web') {
      note(`dsh.client.platform = ${JSON.stringify(client.platform)} — потребители отбирают только 'web', с другим значением клиентская половина молча выключится`)
    }
    for (const field of ['inject', 'external']) {
      const value = client[field]
      if (value === undefined) continue
      if (!Array.isArray(value) || value.some(item => typeof item !== 'string' || item.trim() === '')) {
        note(`dsh.client.${field} должен быть списком непустых строк`)
      }
    }
    if (client.immediately !== undefined && typeof client.immediately !== 'boolean') {
      note('dsh.client.immediately должен быть boolean')
    }
    // `client-modules` throws when the declaration exists without this export.
    const clientExport = manifest.exports?.['./client']
    if (clientExport === undefined) {
      note('объявлен dsh.client, но в exports нет "./client" — харнесс бросит ошибку при загрузке')
    } else {
      const target = typeof clientExport === 'string' ? clientExport : clientExport.default
      if (typeof target !== 'string' || !existsSync(targetPath(target))) {
        note(`exports["./client"] ведёт на ${JSON.stringify(target)} — файла нет`)
      }
    }
  }
}

const bundle = manifest.dsh?.bundle
if (bundle !== undefined) {
  const patches = typeof bundle.patch === 'string' ? [bundle.patch] : bundle.patch
  if (!Array.isArray(patches) || patches.length === 0
    || patches.some(patch => typeof patch !== 'string' || patch.trim() === '')) {
    note('dsh.bundle.patch должен быть путём или списком путей')
  } else {
    for (const patch of patches) {
      if (!existsSync(targetPath(patch))) note(`dsh.bundle.patch: файла ${patch} нет`)
    }
  }
}

if (problems.length === 0) {
  console.log(`манифест проходит правила харнесса: dsh.client=${JSON.stringify(client?.platform ?? '—')}, ` +
    `экспорт ./client=${manifest.exports?.['./client'] === undefined ? 'нет' : 'есть'}, ` +
    `патч=${JSON.stringify(bundle?.patch ?? '—')}`)
  process.exitCode = 0
} else {
  console.error(`манифест нарушает правила харнесса (${problems.length}):`)
  for (const problem of problems) console.error(`  ${problem}`)
  process.exitCode = 1
}
