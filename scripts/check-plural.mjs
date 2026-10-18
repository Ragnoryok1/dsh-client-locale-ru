/**
 * Prove the Russian plural pass: the form follows the count, not the key the
 * caller picked, and everything else keeps the previous behaviour.
 *
 * Runs the built browser bundle against the real host locale runtime, with only
 * the DOM and the effect-owning context stubbed, the same way `check-locale.mjs`
 * exercises coexistence.
 */
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
  const listeners = new Map()
  return {
    locale,
    emit(name, payload) {
      for (const listener of [...(listeners.get(name) ?? [])]) listener(payload)
    },
    on(name, listener) {
      if (!listeners.has(name)) listeners.set(name, new Set())
      listeners.get(name).add(listener)
      return () => listeners.get(name)?.delete(listener)
    },
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

test('the count chooses the form, not the key the caller passed', () => {
  const locale = fresh()
  const ctx = context(locale)
  pack.apply(ctx)
  assert.equal(locale.getLocale().active, 'ru')
  const t = locale.bind('chat')

  assert.equal(t('message.turnProcess.toolCalls.one', { count: 1 }), '1 вызов инструмента')
  assert.equal(t('message.turnProcess.toolCalls.other', { count: 2 }), '2 вызова инструментов')
  assert.equal(t('message.turnProcess.toolCalls.other', { count: 3 }), '3 вызова инструментов')
  assert.equal(t('message.turnProcess.toolCalls.other', { count: 4 }), '4 вызова инструментов')
  assert.equal(t('message.turnProcess.toolCalls.other', { count: 5 }), '5 вызовов инструментов')
  assert.equal(t('message.turnProcess.toolCalls.other', { count: 0 }), '0 вызовов инструментов')
  assert.equal(t('message.turnProcess.toolCalls.other', { count: 11 }), '11 вызовов инструментов')
  assert.equal(t('message.turnProcess.toolCalls.other', { count: 21 }), '21 вызов инструмента')
  assert.equal(t('message.turnProcess.toolCalls.other', { count: 22 }), '22 вызова инструментов')
  // A caller that only knows the harness convention is corrected, not obeyed.
  assert.equal(t('message.turnProcess.toolCalls.one', { count: 22 }), '22 вызова инструментов')

  ctx.dispose()
})

test('the `n` keys pluralise too, and keys without extra forms keep their value', () => {
  const locale = fresh()
  const ctx = context(locale)
  pack.apply(ctx)

  const workspace = locale.bind('workspace')
  assert.equal(workspace('sessions.count.other', { n: 1 }), '1 сессия')
  assert.equal(workspace('sessions.count.other', { n: 3 }), '3 сессии')
  assert.equal(workspace('sessions.count.other', { n: 8 }), '8 сессий')
  assert.equal(workspace('archive.confirm.jobs.other', { n: 2, names: 'a, b' }), '2 фоновые задачи: a, b')

  const job = locale.bind('job')
  assert.equal(job('count.live.other', { count: 2 }), '2 фоновые задачи выполняются')
  assert.equal(job('count.idle.other', { count: 5 }), '5 фоновых задач')

  // `unit.day` carries `.few` / `.many` now, so the count picks the Russian form;
  // `.other` stays the fallback for a fractional count, where CLDR has no form to
  // substitute and the dictionary's own value («1,5 минуты») is the right one.
  const schedule = locale.bind('schedule.catalog')
  assert.equal(schedule('unit.day.one', { count: 1 }), 'день')
  assert.equal(schedule('unit.day.other', { count: 2 }), 'дня')
  assert.equal(schedule('unit.day.other', { count: 5 }), 'дней')
  assert.equal(schedule('unit.hour.other', { count: 3 }), 'часа')
  assert.equal(schedule('unit.minute.other', { count: 1.5 }), 'минуты')

  ctx.dispose()
})

test('a key the harness never paired gets the forms the pack adds to it', () => {
  const locale = fresh()
  const ctx = context(locale)
  pack.apply(ctx)

  // `terminal.expand` is called with `{ n }` and no suffix, so the harness has no
  // pair to redirect; the pack carries `.one` / `.few` / `.many` for it and the
  // count still chooses between them.
  const job = locale.bind('job')
  assert.equal(job('terminal.expand', { n: 1 }), 'Показать ещё 1 строку')
  assert.equal(job('terminal.expand', { n: 3 }), 'Показать ещё 3 строки')
  assert.equal(job('terminal.expand', { n: 7 }), 'Показать ещё 7 строк')
  assert.equal(job('terminal.expandAria', { n: 2 }), 'Развернуть 2 скрытые строки вывода')
  // Fractional counts keep the plain value, which is the neutral wording.
  assert.equal(job('terminal.expand', { n: 1.5 }), 'Показать ещё 1.5 строк')

  const plugins = locale.bind('pluginManager')
  assert.equal(plugins('terminalExpand', { n: 5 }), '… ещё 5 строк')

  ctx.dispose()
})

test('a call without a count, and a non-Russian locale, are left alone', () => {
  const locale = fresh()
  const ctx = context(locale)
  pack.apply(ctx)
  const t = locale.bind('chat')

  // No count: the guard cannot know a form, so the caller's key is honoured.
  assert.equal(t('message.turnProcess.toolCalls.other', { other: 'x' }), 'Вызовов инструментов: {count}')
  assert.equal(t('message.turnProcess.toolCalls.other'), 'Вызовов инструментов: {count}')

  /*
   * Switching to another language must leave the wrapper inert: the runtime now
   * resolves the same keys through the English dictionary, and a rewritten
   * `…other.few` would miss it. Registering a real `en` block is what makes this
   * observable — with no English text every key falls through anyway, so the test
   * would pass even if the wrapper rewrote it.
   */
  locale.register('chat', 'en', {
    'message.turnProcess.toolCalls.one': '1 tool call',
    'message.turnProcess.toolCalls.other': '{count} tool calls',
  })
  locale.setLocale('en')
  assert.equal(locale.getLocale().active, 'en')
  assert.equal(t('message.turnProcess.toolCalls.one', { count: 1 }), '1 tool call')
  assert.equal(t('message.turnProcess.toolCalls.other', { count: 2 }), '2 tool calls')
  // …and switching back restores the Russian forms on the same binding.
  locale.setLocale('ru')
  assert.equal(t('message.turnProcess.toolCalls.other', { count: 2 }), '2 вызова инструментов')
  assert.equal(t('message.turnProcess.toolCalls.other', { count: 5 }), '5 вызовов инструментов')

  ctx.dispose()
})

test('another language pack keeps its own forms: our rules never touch it', () => {
  const locale = fresh()
  const ctx = context(locale)
  pack.apply(ctx)
  /*
   * Our wrapper selects forms with `Intl.PluralRules('ru')`. If it ran while another
   * language was active, it would rewrite the key to the *Russian* category — a
   * Polish pack's `.few` would then answer a call that asked for its `.other`, and
   * the reader would see the wrong inflection from a dictionary that is not ours.
   * The guard is what makes the English case in the test above indistinguishable
   * from a rewrite: English has no `.few`, so only a pack that does have one can
   * show the difference.
   */
  locale.addLanguage({ id: 'pl', label: 'Polski', fallback: 'en' })
  locale.register('chat', 'pl', {
    'message.turnProcess.toolCalls.one': 'PL one',
    'message.turnProcess.toolCalls.few': 'PL few',
    'message.turnProcess.toolCalls.other': 'PL other',
  })
  locale.setLocale('pl')
  const t = locale.bind('chat')
  assert.equal(t('message.turnProcess.toolCalls.other', { count: 2 }), 'PL other')
  assert.equal(t('message.turnProcess.toolCalls.other', { count: 5 }), 'PL other')
  assert.equal(t('message.turnProcess.toolCalls.one', { count: 1 }), 'PL one')

  ctx.dispose()
})

test('two activations share one wrapper, and disposal releases it once', () => {
  const locale = fresh()
  const first = context(locale)
  const second = context(locale)
  pack.apply(first)
  pack.apply(second)
  const t = locale.bind('chat')

  assert.equal(t('message.turnProcess.toolCalls.other', { count: 2 }), '2 вызова инструментов')

  // The second activation owns only skipped registrations, so disposing it has
  // to leave both the dictionaries and the wrapper in place: were the wrapper
  // released here, the neutral `.other` value would come back.
  second.dispose()
  assert.equal(t('message.turnProcess.toolCalls.other', { count: 2 }), '2 вызова инструментов')

  // The first activation owns the dictionaries; disposing it removes them, and
  // the wrapper leaves with the last holder.
  first.dispose()
  assert.equal(t('message.turnProcess.toolCalls.other', { count: 2 }), 'message.turnProcess.toolCalls.other')
})
