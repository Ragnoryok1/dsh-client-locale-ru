/**
 * Check the Russian typography rules on the cases that matter, including the
 * ones that must stay untouched. Run by `npm run check`, so the rules fail
 * loudly instead of drifting.
 *
 * Usage: node scripts/check-typography.mjs
 */
import { applyRussianTypography } from '../lib/typography.js'

const NBSP = '\u00A0'

/** @type {Array<[string, string, string]>} input, expected, why */
const cases = [
  ['Нажмите "Сохранить" для продолжения', `Нажмите «Сохранить» для продолжения`, 'кавычки'],
  ['параметр - значение', 'параметр — значение', 'тире между словами'],
  ['Ожидание... ещё', 'Ожидание… ещё', 'многоточие'],
  ['187 плагинов', `187${NBSP}плагинов`, 'неразрывный пробел у числа и слова'],
  ['за 5 ч', `за 5${NBSP}ч`, 'единица измерения'],
  ['размер 12 МБ', `размер 12${NBSP}МБ`, 'размер в мегабайтах'],
  // must not change
  ['187 плагинов', `187${NBSP}плагинов`, 'повторный проход идемпотентен'],
  ['Настройки - Плагины - Профиль', 'Настройки — Плагины — Профиль', 'тире в диапазоне'],
  ['- Настройки\n- Плагины', '- Настройки\n- Плагины', 'маркеры списка не тире'],
  ['диалог(ы) и option', 'диалог(ы) и option', 'латиница и скобки не трогаются'],
  ['version 0.1.7-rc.2', 'version 0.1.7-rc.2', 'версии и дефисы не трогаются'],
  ['"НЕПРАВИЛЬНЫЙ"', `«НЕПРАВИЛЬНЫЙ»`, 'кавычки вокруг заглавных'],
]

let failed = 0
for (const [input, expected, why] of cases) {
  const actual = applyRussianTypography(input)
  if (actual === expected) {
    console.log(`  ok    ${why}`)
  } else {
    failed += 1
    console.log(`  FAIL  ${why}`)
    console.log(`        вход:     ${JSON.stringify(input)}`)
    console.log(`        ожидалось: ${JSON.stringify(expected)}`)
    console.log(`        получено:  ${JSON.stringify(actual)}`)
  }
}

// A second pass must be a no-op, so repeated DOM visits cannot churn text.
for (const [input] of cases) {
  const once = applyRussianTypography(input)
  const twice = applyRussianTypography(once)
  if (once !== twice) {
    failed += 1
    console.log(`  FAIL  идемпотентность: ${JSON.stringify(input)} → ${JSON.stringify(once)} → ${JSON.stringify(twice)}`)
  }
}

console.log(failed === 0 ? `\nтипографика: ${cases.length} правил проверено, все прошли` : `\nтипографика: провалено ${failed}`)
process.exit(failed === 0 ? 0 : 1)

