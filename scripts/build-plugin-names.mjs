/**
 * Builds `src/client/plugin-names-ru.json` — the Russian names and descriptions of
 * the third-party plugins whose dictionaries the pack carries.
 *
 * A plugin's card in the catalogue shows the title and the description the plugin
 * publishes in its own `locale/en.json`; the locale service resolves that map
 * without consulting registered dictionaries, so a dictionary cannot reach it. The
 * vendored English of every plugin is in `plugins/<namespace>.json`, and the Russian
 * translation of the same text is in the pack's own dictionary — so the pair can be
 * taken from the two, and the DOM pass can put the Russian where the English was.
 *
 * The pairs are taken only from the fields a card shows. A field that repeats inside
 * the plugin's own settings — `name`, `label` — is not a name of the plugin, and a
 * Russian form that says the same as the English (a brand) has nothing to replace.
 *
 * Usage: node scripts/build-plugin-names.mjs [--check]
 */
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

const require = createRequire(import.meta.url)
const ROOT = fileURLToPath(new URL('..', import.meta.url))
const host = require.resolve('@deepseek-ai/dsh-client-locale/client')
const descriptors = JSON.parse(readFileSync(fileURLToPath(new URL('../src/client/descriptor-ru.json', import.meta.url)), 'utf8'))

/** The fields a plugin card shows. */
const CARD_FIELDS = ['title', 'nav', 'cardTitle', 'pluginTitle', 'displayName', 'description', 'desc', 'summary', 'shortDescription', 'tagline']

/** The namespaces that are settings pages rather than plugins. */
const NOT_A_PLUGIN = /^settings\./u

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
const packPath = fileURLToPath(new URL('../lib/client.js', import.meta.url))
const pack = load(packPath, '@ragnoryok1/dsh-client-locale-ru')
const listeners = new Map()
const ctx = {
  effect: callback => callback(),
  on(name, listener) {
    if (!listeners.has(name)) listeners.set(name, new Set())
    listeners.get(name).add(listener)
    return () => listeners.get(name)?.delete(listener)
  },
  emit(name, payload) { for (const listener of [...listeners.get(name) ?? []]) listener(payload) },
  locale: undefined,
}
const locale = new LocaleRuntime(ctx, undefined, undefined)
ctx.locale = locale
pack.apply(ctx)

/** The Russian dictionary of every namespace the pack registers. */
const russian = new Map()
for (const [namespace, byLocale] of locale.dicts) {
  const values = byLocale.get('ru')
  if (values !== undefined) russian.set(namespace, values)
}

const pluginsDir = fileURLToPath(new URL('../plugins/', import.meta.url))
const pairs = new Map()
const sources = new Map()
for (const name of readdirSync(pluginsDir).filter(entry => entry.endsWith('.json')).sort()) {
  const record = JSON.parse(readFileSync(`${pluginsDir}/${name}`, 'utf8'))
  const namespace = record.namespace
  if (NOT_A_PLUGIN.test(namespace)) continue
  const values = russian.get(namespace)
  if (values === undefined) continue
  for (const field of CARD_FIELDS) {
    const english = record.en[field]
    const russianText = values[field]
    if (typeof english !== 'string' || typeof russianText !== 'string') continue
    if (english === '' || russianText === '') continue
    /* A brand is the same in both languages: there is nothing to replace. */
    if (english === russianText) continue
    const known = pairs.get(english)
    if (known !== undefined && known !== russianText) {
      console.error(`${namespace} · ${field}: «${english}» переведён по-разному — «${known}» и «${russianText}»`)
      process.exit(1)
    }
    pairs.set(english, russianText)
    sources.set(english, `${namespace} · ${field}`)
  }
}

/* The harness's own plugins are translated in `descriptor-ru.json`; the same English
   text must not be translated two ways. */
for (const fields of Object.values(descriptors)) {
  for (const field of ['title', 'description']) {
    const english = fields.en?.[field]
    const russian = fields[field]
    if (english === undefined || russian === undefined || english === russian) continue
    const other = pairs.get(english)
    if (other !== undefined && other !== russian) {
      console.error(`«${english}» переведён по-разному: у харнесса «${russian}», у плагина «${other}»`)
      process.exit(1)
    }
  }
}

const document = {
  _comment: 'Названия и описания сторонних плагинов: английский текст из их собственной публикации и русский перевод. Сгенерировано `npm run build:plugin-names`.',
  pairs: Object.fromEntries([...pairs].sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))),
  sources: Object.fromEntries([...sources].sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))),
}

const target = fileURLToPath(new URL('../src/client/plugin-names-ru.json', import.meta.url))
const text = `${JSON.stringify(document, null, 2)}\n`
if (process.argv.includes('--check')) {
  if (!existsSync(target)) {
    console.error('src/client/plugin-names-ru.json отсутствует — перегенерируйте (`npm run build:plugin-names`)')
    process.exit(1)
  }
  const current = readFileSync(target, 'utf8').replace(/\r\n/gu, '\n')
  if (current !== text) {
    console.error('src/client/plugin-names-ru.json разошёлся с словарями — перегенерируйте (`npm run build:plugin-names`)')
    process.exit(1)
  }
  console.log(`plugin-names-ru.json совпадает со словарями (${pairs.size} пар)`)
  process.exit(0)
}
writeFileSync(target, text, 'utf8')
console.log(`plugin-names-ru.json: ${pairs.size} пар из ${sources.size} полей`)
for (const [english, russianText] of [...pairs].slice(0, 8)) console.log(`  ${JSON.stringify(english).slice(0, 60)} → ${JSON.stringify(russianText).slice(0, 60)}`)
