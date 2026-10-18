/**
 * Compose strings the way the harness does, and read them as a Russian user would.
 *
 * The audit compares a value with its own template, so a phrase that is correct in
 * isolation but wrong once the harness substitutes another dictionary value into it
 * stays invisible. `frequency.weekly` is exactly that case: the template reads
 * «Weekly on {weekdays} at {time}», the pack filled it as «По {weekdays} в {time}»,
 * and the days arrive as «Пн, Ср» — producing «По Пн, Ср в 09:00», which no
 * per-value check can see. These cases compose the real values and assert the whole
 * sentence.
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

/** Start the pack on a real runtime and hand back the runtime. */
function activate() {
  const listeners = new Map()
  const ctx = {
    effect: callback => callback(),
    on(name, listener) {
      if (!listeners.has(name)) listeners.set(name, new Set())
      listeners.get(name).add(listener)
      return () => listeners.get(name)?.delete(listener)
    },
    /* The runtime publishes catalog changes through the context, not through `on`. */
    emit(name, payload) { for (const listener of [...(listeners.get(name) ?? [])]) listener(payload) },
    locale: undefined,
  }
  const locale = new LocaleRuntime(ctx, undefined, undefined)
  ctx.locale = locale
  pack.apply(ctx)
  return locale
}

/** The ru dictionary of one namespace, as the pack registers it. */
function dictionary(locale, namespace) {
  const byLocale = locale.dicts.get(namespace)
  assert.ok(byLocale !== undefined, `namespace ${namespace} is not registered`)
  const ru = byLocale.get('ru')
  assert.ok(ru !== undefined, `namespace ${namespace} has no ru dictionary`)
  return ru
}

/** Fill `{name}` placeholders from a parameter map, the way the runtime does. */
const fill = (template, params) => template.replace(/\{(\w+)\}/gu, (_, name) => {
  assert.ok(name in params, `template ${JSON.stringify(template)} wants {${name}}`)
  return params[name]
})

const weekdaysOf = (ru, days) => days
  .map(day => ru[`frequency.weekday.${day}`])
  .join(ru['frequency.weekday.join'])

test('a weekly rule reads as a schedule row, not as «По Пн»', () => {
  const ru = dictionary(activate(), 'schedule.catalog')
  const weekdays = weekdaysOf(ru, [1, 3])
  assert.equal(weekdays, 'Пн, Ср')
  const weekly = fill(ru['frequency.weekly'], { weekdays, time: '09:00', timeZone: 'Europe/Moscow' })
  assert.equal(weekly, 'Пн, Ср в 09:00 (Europe/Moscow)')
  /*
   * «по» needs a dative plural («по понедельникам»), while these values are
   * abbreviations — so the preposition must not come back. The whole-sentence
   * assertion above already fails if it does; this states the reason.
   */
  assert.doesNotMatch(weekly, /^По\s/u)
  assert.equal(fill(ru['frequency.weeklyLocal'], { weekdays, time: '09:00' }), 'Пн, Ср в 09:00')
  assert.equal(
    fill(ru['frequency.weekly'], { weekdays: weekdaysOf(ru, [7]), time: '08:30', timeZone: 'UTC' }),
    'Вс в 08:30 (UTC)',
  )
})

test('a daily rule composes with the zone in parentheses', () => {
  const ru = dictionary(activate(), 'schedule.catalog')
  assert.equal(
    fill(ru['frequency.daily'], { time: '09:00', timeZone: 'Europe/Moscow' }),
    'Каждый день в 09:00 (Europe/Moscow)',
  )
  assert.equal(fill(ru['frequency.dailyLocal'], { time: '09:00' }), 'Каждый день в 09:00')
})

test('an interval rule composes with the inflected unit', () => {
  const ru = dictionary(activate(), 'schedule.catalog')
  const render = (value, unitKey) => fill(ru['frequency.every'], { value: String(value), unit: ru[unitKey] })
  assert.equal(render(2, 'unit.day.few'), 'Раз в 2 дня')
  assert.equal(render(5, 'unit.day.many'), 'Раз в 5 дней')
  assert.equal(render(1, 'unit.day.one'), 'Раз в 1 день')
  assert.equal(render(30, 'unit.minute.many'), 'Раз в 30 минут')
  assert.equal(render(1, 'unit.minute.one'), 'Раз в 1 минуту')
})

test('a cron rule states its repetition through the plural wrapper', () => {
  const locale = activate()
  const t = (key, params) => locale.translate('schedule.catalog', key, params)
  /*
   * `cron.time.everyMinutes` carries `{step}` and nothing else numeric, so the
   * wrapper's fallback to the first numeric parameter finds it and substitutes the
   * Russian form: «Каждые 3 минуты» for 2–4, «Каждые 5 минут» for 5 and above.
   * Without the forms the abbreviation «мин» would have to do for every count.
   */
  assert.equal(t('cron.time.everyMinutes', { step: 3 }), 'Каждые 3 минуты')
  assert.equal(t('cron.time.everyMinutes', { step: 5 }), 'Каждые 5 минут')
  assert.equal(t('cron.time.joinedEveryMinutes', { step: 2 }), 'каждые 2 минуты')
  assert.equal(t('cron.time.everyNHours', { count: 2 }), 'Каждые 2 часа')
  assert.equal(t('cron.time.everyNHours', { count: 6 }), 'Каждые 6 часов')
  assert.equal(t('cron.time.joinedEveryNHours', { count: 3 }), 'каждые 3 часа')
  /* A single minute of every hour reads as a labelled part, not as a clause. */
  const ru = dictionary(locale, 'schedule.catalog')
  assert.equal(
    fill(ru['cron.time.hourlyAt'], { minutes: '5, 30' }),
    'Каждый час, минуты: 5, 30',
  )
  assert.equal(
    fill(ru['cron.time.hoursAt'], { hours: '09–17', minutes: '5' }),
    'минуты: 5, часы: 09–17',
  )
  /*
   * The whole sentence the harness builds: a day phrase, the joining space, and the
   * lower-case time clause. «Пн–Пт каждые 5 минут» is what the schedule row shows.
   */
  const day = ru['cron.day.weekdays'].replace('{weekdays}', 'Пн–Пт').replace('{months}', '')
  const sentence = [day, t('cron.time.joinedEveryMinutes', { step: 5 })].join(ru['cron.part.join'])
  assert.equal(sentence, 'Пн–Пт каждые 5 минут')
})

test('a month-restricted rule names the month in Russian', () => {
  const ru = dictionary(activate(), 'schedule.catalog')
  /*
   * The harness builds the month names with `Intl.DateTimeFormat(t('time.locale'))`,
   * so the dictionary value is a locale tag, not UI text: 'en' produced «Каждый
   * день в January» and an English zone label in a Russian interface. The tag has
   * to be the language's own, as the harness's zh pack uses 'zh-CN'.
   */
  assert.equal(ru['time.locale'], 'ru')
  const format = new Intl.DateTimeFormat(ru['time.locale'], { month: 'long', timeZone: 'UTC' })
  const months = [1, 3].map(month => format.format(Date.UTC(2026, month - 1, 1))).join(ru['cron.list.join'])
  assert.equal(months, 'январь, март')
  const every = fill(ru['cron.day.every'], { months: fill(ru['cron.months'], { months }) })
  assert.equal(every, 'Каждый день (январь, март)')
  /* A single month reads the same way, and no English name can come back. */
  const one = fill(ru['cron.day.every'], { months: fill(ru['cron.months'], { months: 'январь' }) })
  assert.equal(one, 'Каждый день (январь)')
  assert.doesNotMatch(one, /[A-Za-z]{3,}/u)
})
