/**
 * Machine-readable coverage: what the pack translates, package by package.
 *
 * The file answers one question a catalogue cannot answer on its own — "does this
 * plugin have Russian, and how much of it" — using only facts that are already
 * public: the vendored records under `plugins/`, the pack's own counts and the
 * list of harness versions the pack claims. It deliberately carries nothing about
 * third-party packs, pricing or scoreboards: a catalogue needs coverage, not a
 * comparison.
 *
 * Usage: node scripts/coverage.mjs [--check]
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = relative => readFileSync(join(ROOT, relative), 'utf8')

const pkg = JSON.parse(read('package.json'))
const counts = JSON.parse(read('scripts/pack-count.json'))
const meta = JSON.parse(/<!--\s*deepseek-harness-meta\s*([\s\S]*?)-->/u.exec(read('README.md'))[1])

/* Записи словарей: один плагин может занимать несколько namespace. */
const plugins = new Map()
for (const entry of readdirSync(join(ROOT, 'plugins')).filter(name => name.endsWith('.json') && !name.startsWith('_'))) {
  const record = JSON.parse(read(`plugins/${entry}`))
  if (typeof record.package !== 'string' || typeof record.namespace !== 'string') continue
  const current = plugins.get(record.package) ?? {
    package: record.package,
    version: record.version ?? null,
    license: record.license ?? null,
    repository: typeof record.repository === 'string' ? record.repository.replace(/^git\+/u, '') : null,
    namespaces: [],
    strings: 0,
  }
  current.namespaces.push(record.namespace)
  current.strings += Object.keys(record.en ?? {}).length
  /* Самый свежий снимок плагина: версии в записях одного пакета совпадают, но на всякий случай берём максимум. */
  if (current.version === null || compareVersions(record.version ?? '0', current.version) > 0) {
    current.version = record.version ?? current.version
  }
  if (current.license === null && typeof record.license === 'string') current.license = record.license
  if (current.repository === null && typeof record.repository === 'string') current.repository = record.repository.replace(/^git\+/u, '')
  plugins.set(record.package, current)
}

/** Сравнение версий по числовым частям: `0.10.0` новее `0.9.1`. */
function compareVersions(left, right) {
  const parse = value => value.split(/[.-]/u).map(part => (/^\d+$/u.test(part) ? Number(part) : 0))
  const a = parse(left)
  const b = parse(right)
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0)
    if (diff !== 0) return diff
  }
  return 0
}

const list = [...plugins.values()]
  .map(item => ({ ...item, namespaces: item.namespaces.sort() }))
  .sort((left, right) => left.package.localeCompare(right.package, 'en'))

const document = {
  schema: 'dsh-locale-coverage/1',
  generated: new Date().toISOString().slice(0, 10),
  pack: {
    name: pkg.name,
    version: pkg.version,
    license: pkg.license ?? null,
    repository: 'https://github.com/Ragnoryok1/dsh-client-locale-ru',
    install: 'dsh plugin --profile web add @ragnoryok1/dsh-client-locale-ru',
  },
  harness: {
    audited_against: meta.compatible_versions[0],
    compatible_versions: meta.compatible_versions,
  },
  totals: {
    namespaces: counts.namespaces,
    strings: counts.values,
    plugins: list.length,
    plugin_strings: list.reduce((sum, item) => sum + item.strings, 0),
  },
  /*
   * Один плагин — одна запись: `strings` складывается по его namespace,
   * `namespaces` перечисляет их, чтобы каталог мог показать и «92 строки»,
   * и «секция agency-agents».
   */
  plugins: list,
}

const target = join(ROOT, 'coverage.json')
const text = `${JSON.stringify(document, null, 2)}\n`

if (process.argv.includes('--check')) {
  let current = ''
  try {
    current = read('coverage.json')
  } catch {
    console.error('coverage.json отсутствует — выполните `npm run coverage`')
    process.exit(1)
  }
  const normalize = value => value.replace(/\r\n/gu, '\n').replace(/"generated": "[^"]*"/u, '"generated": ""').trimEnd()
  if (normalize(current) !== normalize(text)) {
    console.error('coverage.json разошёлся с пакетом — выполните `npm run coverage` и закоммитьте файл')
    process.exit(1)
  }
  console.log(`check:coverage: покрытие сходится с пакетом (${list.length} плагинов, ${counts.values} строк)`)
  process.exit(0)
}

writeFileSync(target, text, 'utf8')
console.log(`coverage.json: ${list.length} плагинов, ${counts.namespaces} namespace, ${counts.values} строк`)
