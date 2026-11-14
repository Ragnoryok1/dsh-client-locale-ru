/**
 * Claims about the whole pack must match it.
 *
 * Badges and `pack-count.json` are already checked, but the prose drifted twice:
 * «587 разделов» and «520 словарей» survived two releases because nothing compared
 * them with the package. Only sentences that speak about the pack as a whole are
 * checked — per-plugin counts («13 словарей» у семейства, «261 строка» у одного
 * плагина) законно отличаются и проверке не подлежат.
 *
 * Usage: node scripts/check-readme-claims.mjs
 */
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const counts = JSON.parse(readFileSync(join(ROOT, 'scripts/pack-count.json'), 'utf8'))
const PLUGINS = readdirSync(join(ROOT, 'plugins')).filter(name => name.endsWith('.json') && !name.startsWith('_')).length

const EXPECTED = { sections: counts.namespaces, strings: counts.values, dictionaries: PLUGINS }

/* Строки, которые говорят о пакете целиком, а не об отдельном плагине. */
const PACK_LINE = /в пакете|pack currently holds|目前包里|NAMESPACES\.md|complete inventory|完整清单/iu

const CLAIMS = [
  { key: 'sections', pattern: /([\d][\d\s, ]*)\s*(?:раздел\p{L}*|секци\p{L}*|sections?|个分区|个 namespace)/gu },
  { key: 'dictionaries', pattern: /([\d][\d\s, ]*)\s*(?:словар\p{L}*|dictionaries|dictionary|份.*?词典|个词典)/gu },
  { key: 'strings', pattern: /([\d][\d\s, ]*)\s*(?:строк\p{L}*|strings?|条文案|条字符串)/gu },
]

const parse = text => Number(text.replace(/[\s, ]/gu, ''))
const FILES = ['README.md', 'README-en.md', 'README-zh.md']
const problems = []
let checked = 0

for (const file of FILES) {
  const lines = readFileSync(join(ROOT, file), 'utf8').split('\n')
  for (let index = 0; index < lines.length; index += 1) {
    if (!PACK_LINE.test(lines[index])) continue
    for (const { key, pattern } of CLAIMS) {
      for (const match of lines[index].matchAll(pattern)) {
        const value = parse(match[1])
        checked += 1
        if (value === EXPECTED[key]) continue
        problems.push(`${file}:${index + 1}: «${match[0].trim().slice(0, 40)}» — ${value}, а в пакете ${EXPECTED[key]} (${key})`)
      }
    }
  }
}

console.log(`утверждений проверено: ${checked} (разделы ${EXPECTED.sections}, строки ${EXPECTED.strings}, словари ${EXPECTED.dictionaries})`)
if (problems.length > 0) {
  for (const problem of problems) console.error(`  ${problem}`)
  console.error(`check:readme-claims: числа в README разошлись с пакетом (${problems.length})`)
  process.exit(1)
}
console.log('check:readme-claims: числа в README сходятся с пакетом')
