/**
 * Generate `NAMESPACES.md` — the inventory of everything the pack translates — and
 * check that the committed file still matches the dictionaries.
 *
 * The list must not be maintained by hand: a namespace added to `dicts.ts` without a
 * row here would leave the reference silently incomplete, and a row for a namespace
 * the pack no longer registers would advertise coverage that does not exist. The
 * label comes from the namespace's own `title`/`nav`/`trigger` value, so it is the
 * text a user actually sees rather than a second hand-written name.
 *
 * Usage: node scripts/namespaces.mjs [--check]
 */
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

const require = createRequire(import.meta.url)
const host = process.argv[2] && !process.argv[2].startsWith('--')
  ? process.argv[2]
  : require.resolve('@deepseek-ai/dsh-client-locale/client')
const sandbox = vm.createContext({ document: { body: null, querySelector: () => ({}) }, navigator: { language: 'ru', languages: ['ru'] } })
sandbox.window = sandbox
function load(file, id, dependencies = {}) {
  let result
  sandbox.__ModuleLoader__ = { load(module) {
    assert.equal(module.id, id)
    result = module.factory(name => {
      assert.ok(name in dependencies, `unexpected dependency: ${name}`)
      return dependencies[name]
    })
  } }
  vm.runInContext(readFileSync(file, 'utf8'), sandbox, { filename: String(file) })
  assert.ok(result, `bundle not loaded: ${id}`)
  return result
}
const { LocaleRuntime } = load(host, '@deepseek-ai/dsh-client-locale', {
  'react/jsx-runtime': {},
  react: {},
  '@deepseek-ai/dsh-client-ui-primitives': {},
  '@deepseek-ai/dsh-client-store': { defineStore: () => ({}) },
})
/**
 * The pack bundle to read. `--pack <path>` lets the tarball check ask the same question
 * of the artifact that would be published — the unpacked `lib/client.js` — instead of
 * trusting that the checkout's build equals it.
 */
const packArg = process.argv.indexOf('--pack')
const packPath = packArg === -1
  ? fileURLToPath(new URL('../lib/client.js', import.meta.url))
  : process.argv[packArg + 1]
const pack = load(packPath, '@ragnoryok1/dsh-client-locale-ru')

const listeners = new Map()
const ctx = {
  effect: callback => callback(),
  on(name, listener) {
    if (!listeners.has(name)) listeners.set(name, new Set())
    listeners.get(name).add(listener)
    return () => listeners.get(name)?.delete(listener)
  },
  emit(name, payload) { for (const listener of [...(listeners.get(name) ?? [])]) listener(payload) },
  locale: undefined,
}
const locale = new LocaleRuntime(ctx, undefined, undefined)
ctx.locale = locale
pack.apply(ctx)

const LABEL_KEYS = ['title', 'nav', 'trigger', 'panel', 'label', 'sectionTitle', 'name', 'heading']
const namespaces = []
for (const [namespace, byLocale] of locale.dicts) {
  const ru = byLocale.get('ru')
  if (ru === undefined) continue
  const keys = Object.keys(ru)
  const count = keys.length
  let label = ''
  for (const key of LABEL_KEYS) {
    const value = ru[key]
    if (typeof value !== 'string') continue
    if (value === '' || /\{\w+\}/u.test(value) || value.length > 40) continue
    label = value
    break
  }
  namespaces.push({ namespace, label, count })
}
namespaces.sort((left, right) => left.namespace.localeCompare(right.namespace, 'en'))

const total = namespaces.reduce((sum, item) => sum + item.count, 0)
const escape = text => text.replace(/\|/gu, '\\|')

/* Vendored plugin dictionaries: namespace -> package@version, recorded beside the text. */
const pluginsDir = new URL('../plugins/', import.meta.url)
const external = new Map()
try {
  for (const name of readdirSync(pluginsDir).filter(entry => entry.endsWith('.json'))) {
    const record = JSON.parse(readFileSync(new URL(name, pluginsDir), 'utf8'))
    /* в записи некоторых словарей поле package уже содержит версию */
    const origin = record.package.endsWith(`@${record.version}`) ? record.package : `${record.package}@${record.version}`
    external.set(record.namespace, origin)
  }
} catch {
  /* No vendored plugins: the inventory is the harness alone. */
}

const rows = namespaces.map(({ namespace, label, count }) => {
  const source = external.get(namespace) ?? 'харнесс'
  return `| \`${namespace}\` | ${label === '' ? '—' : escape(label)} | ${count} | ${escape(source)} |`
}).join('\n')

const document = `<!-- Сгенерировано \`npm run namespaces\`; проверяется \`npm run check:namespaces\`. -->
# Что переведено

Пакет переводит **${namespaces.length} namespace** — ${total} строк. Колонка «как это выглядит»
берёт заголовок самого namespace (то, что читает пользователь), а не отдельное описание:
список нельзя разойтись с переводами.

Колонка «источник» говорит, откуда взят английский текст: «харнесс» — собственные словари
клиента, «пакет@версия» — словарь стороннего плагина, выгруженный из его собственной
публикации (\`npm run fetch:plugins\`). Плагины проверяются теми же правилами, поэтому
список — это обещание, а не перечень.

| namespace | как это выглядит | строк | источник |
|---|---|---|---|
${rows}

Итого: **${namespaces.length}** namespace, **${total}** строк.
`

const target = fileURLToPath(new URL('../NAMESPACES.md', import.meta.url))
const countFile = fileURLToPath(new URL('./pack-count.json', import.meta.url))
/*
 * One authoritative count for the whole project: the inventory writes it, the audit
 * reads it to check what the READMEs advertise, and `check:namespaces` fails when the
 * file no longer matches the bundle. Without it the READMEs would compare against a
 * static parser's unique-key count while the inventory reported the values the pack
 * actually registers — two numbers for one fact.
 */
const counts = `${JSON.stringify({ namespaces: namespaces.length, values: total }, null, 2)}\n`
if (process.argv.includes('--check')) {
  let current = ''
  try {
    current = readFileSync(target, 'utf8')
  } catch {
    console.error('NAMESPACES.md отсутствует — выполните `npm run check:namespaces` без --check')
    process.exit(1)
  }
  const normalize = text => text.replace(/\r\n/gu, '\n').trimEnd()
  let recorded = ''
  try {
    recorded = readFileSync(countFile, 'utf8')
  } catch {
    console.error('scripts/pack-count.json отсутствует — выполните генерацию заново')
    process.exit(1)
  }
  if (normalize(recorded) !== normalize(counts)) {
    console.error(`scripts/pack-count.json разошёлся с пакетом: в файле ${recorded.trim().replace(/\s+/gu, ' ')}, а в пакете ${counts.trim().replace(/\s+/gu, ' ')}`)
    process.exit(1)
  }
  if (normalize(current) !== normalize(document)) {
    console.error('NAMESPACES.md разошёлся с пакетом — выполните `npm run namespaces` и закоммитьте файлы')
    const currentRows = new Set((current.match(/^\| `([^`]+)`(?: \(плагин\))?/gmu) ?? []).map(row => row.slice(3).replace(/`.*$/u, '')))
    for (const { namespace } of namespaces) {
      if (!currentRows.has(namespace)) console.error(`  нет строки: ${namespace}`)
    }
    for (const row of currentRows) {
      if (!namespaces.some(item => item.namespace === row)) console.error(`  лишняя строка: ${row}`)
    }
    process.exit(1)
  }
  console.log(`check:namespaces: NAMESPACES.md сходится с пакетом (${namespaces.length} namespace, ${total} значений)`)
  process.exit(0)
}

writeFileSync(target, document, 'utf8')
writeFileSync(countFile, counts, 'utf8')
console.log(`NAMESPACES.md: ${namespaces.length} namespace, ${total} значений; scripts/pack-count.json обновлён`)
