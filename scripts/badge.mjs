/**
 * Shield endpoint JSON for plugin authors.
 *
 * An author embeds one line in their README and the badge shows, without us asking:
 *
 *   ![Русский](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/Ragnoryok1/dsh-client-locale-ru/main/badge.json)
 *
 * The numbers come from `coverage.json`, so the badge cannot drift from the pack the
 * way hand-written prose did twice.
 *
 * Usage: node scripts/badge.mjs [--check]
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const coverage = JSON.parse(readFileSync(join(ROOT, 'coverage.json'), 'utf8'))

const { namespaces, strings, plugins } = coverage.totals
const spaces = value => value.toLocaleString('en-US').replaceAll(',', ' ')

/* Один значок на пакет: разделы и строки — всё, что видит автор плагина. */
const badge = {
  schemaVersion: 1,
  label: 'русский',
  message: `${namespaces} раздела · ${spaces(strings)} строк`,
  color: 'blue',
}

const text = `${JSON.stringify(badge, null, 2)}\n`
const target = join(ROOT, 'badge.json')

if (process.argv.includes('--check')) {
  let current = ''
  try {
    current = readFileSync(target, 'utf8')
  } catch {
    console.error('badge.json отсутствует — выполните `npm run badge`')
    process.exit(1)
  }
  if (current.trimEnd() !== text.trimEnd()) {
    console.error('badge.json разошёлся с coverage.json — выполните `npm run badge` и закоммитьте файл')
    process.exit(1)
  }
  console.log(`check:badge: значок сходится с покрытием (${namespaces} раздела, ${spaces(strings)} строк, ${plugins} плагинов)`)
  process.exit(0)
}

writeFileSync(target, text, 'utf8')
console.log(`badge.json: ${badge.message}`)
