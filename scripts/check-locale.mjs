/** Exercise the built browser bundle against the real host locale runtime. */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import { test } from 'node:test'

const require = createRequire(import.meta.url)
const host = process.argv[2] ?? require.resolve('@deepseek-ai/dsh-client-locale/client')
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
const pack = load(fileURLToPath(new URL('../lib/client.js', import.meta.url)), '@ragnoryok1/dsh-client-locale-ru')
function context(locale) {
  const disposers = []
  return {
    locale,
    emit() {},
    effect(callback) {
      const dispose = callback()
      assert.equal(typeof dispose, 'function')
      disposers.push(dispose)
      return dispose
    },
    dispose() { for (const dispose of disposers.splice(0).reverse()) dispose() },
  }
}
function fresh() { return new LocaleRuntime(context(), undefined, undefined) }
function other(ctx, overlap = false) {
  ctx.effect(() => ctx.locale.addLanguage({ id: 'ru', label: 'Other Russian', fallback: 'en' }))
  ctx.effect(() => ctx.locale.register('other-plugin', 'ru', { title: 'Другой плагин' }))
  if (overlap) ctx.effect(() => ctx.locale.register('common', 'ru', { cancel: 'Чужой перевод' }))
}

test('standalone registration, disposal and reactivation', () => {
  const locale = fresh()
  const ctx = context(locale)
  pack.apply(ctx)
  assert.equal(locale.translate('common', 'cancel'), 'Отмена')
  const namespaces = [...locale.dicts.keys()]
  assert.ok(namespaces.length > 1)
  ctx.dispose()
  assert.ok(!locale.getLocale().locales.some(({ id }) => id === 'ru'))
  for (const ns of namespaces) assert.ok(!locale.dicts.get(ns).has('ru'))
  const reloaded = context(locale)
  pack.apply(reloaded)
  assert.equal(locale.translate('common', 'cancel'), 'Отмена')
  reloaded.dispose()
})

test('other pack first: preserve its language and dictionary, contribute core translations', () => {
  const locale = fresh()
  const owner = context(locale)
  other(owner)
  const ctx = context(locale)
  try {
    pack.apply(ctx)
    assert.equal(locale.translate('common', 'cancel'), 'Отмена')
    assert.equal(locale.translate('other-plugin', 'title'), 'Другой плагин')
    assert.equal(locale.getLocale().locales.find(({ id }) => id === 'ru').label, 'Other Russian')
    ctx.dispose()
    assert.equal(locale.translate('other-plugin', 'title'), 'Другой плагин')
    assert.equal(locale.getLocale().active, 'ru')
    assert.ok(!locale.dicts.get('common').has('ru'))
  } finally { ctx.dispose(); owner.dispose() }
})

test('occupied core namespace: first dictionary wins, remaining namespaces still register', () => {
  const locale = fresh()
  const owner = context(locale)
  other(owner, true)
  const ctx = context(locale)
  try {
    pack.apply(ctx)
    assert.equal(locale.translate('common', 'cancel'), 'Чужой перевод')
    assert.ok(locale.dicts.get('chat').has('ru'))
    ctx.dispose()
    assert.equal(locale.translate('common', 'cancel'), 'Чужой перевод')
    assert.ok(!locale.dicts.get('chat').has('ru'))
  } finally { ctx.dispose(); owner.dispose() }
})

test('our pack first: a duplicate-safe peer can add its own dictionary', () => {
  const locale = fresh()
  const ctx = context(locale)
  pack.apply(ctx)
  assert.throws(() => locale.addLanguage({ id: 'ru', label: 'Other Russian', fallback: 'en' }), /already registered/)
  const disposeOther = locale.register('other-plugin', 'ru', { title: 'Другой плагин' })
  assert.equal(locale.translate('common', 'cancel'), 'Отмена')
  assert.equal(locale.translate('other-plugin', 'title'), 'Другой плагин')
  ctx.dispose()
  assert.ok(locale.dicts.get('other-plugin').has('ru'))
  disposeOther()
})

for (const method of ['addLanguage', 'register']) {
  test(`unrelated ${method} errors are not swallowed`, () => {
    const locale = fresh()
    const failure = vm.runInContext('new Error("unexpected service failure")', sandbox)
    locale[method] = () => { throw failure }
    const ctx = context(locale)
    try { assert.throws(() => pack.apply(ctx), error => error === failure) }
    finally { ctx.dispose() }
  })
}
