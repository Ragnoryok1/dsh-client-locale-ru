/**
 * Record and verify that the three READMEs move together.
 *
 * `check:readmes` compares structure — headings, tables, images, paragraph counts —
 * and that is what let one fact drift: the Russian README said «пять случаев» while
 * the script had six, and the English one repeated the stale number, so a count could
 * be wrong in two languages while every structural rule passed.
 *
 * The harness solves the same problem for its own documentation with a recorded hash
 * per section (`README.i18n.yaml`): editing one side of a pair without the other
 * breaks the record, and the fix is to bring the other side along and re-record. This
 * is that idea, for three languages, keyed by section position — the structure gate
 * already guarantees the three files have the same shape, so section 4 is «Проверки»
 * in Russian and «Checks» in English at the same time.
 *
 *   node scripts/readmes-pairs.mjs --record   # after editing, with all three updated
 *   node scripts/readmes-pairs.mjs            # in `verify`: any drift fails
 *
 * A hash mismatch does not say the translation is wrong — it says one language was
 * edited and another was not, which is exactly the moment a human can still fix it.
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const RECORD = join(ROOT, 'scripts', 'readme-pairs.json')
const LANGUAGES = ['ru', 'en', 'zh']
const FILES = { ru: 'README.md', en: 'README.en.md', zh: 'README.zh.md' }

/**
 * Split a README into sections in document order.
 *
 * Fenced code blocks are kept apart from the heading scan: a `# comment` inside a
 * shell block is not a heading, and counting it as one would shift every section
 * number below it.
 */
function sections(path) {
  const text = readFileSync(path, 'utf8').replace(/\r\n/gu, '\n')
  const out = []
  let fence = null
  let current = { heading: '/', lines: [] }
  for (const line of text.split('\n')) {
    const fenceMatch = /^\s*(```+|~~~+)/u.exec(line)
    if (fenceMatch !== null) {
      if (fence === null) fence = fenceMatch[1]
      else if (fenceMatch[1].startsWith(fence[0])) fence = null
      current.lines.push(line)
      continue
    }
    const heading = fence === null ? /^#{1,2}\s+(.*)$/u.exec(line) : null
    if (heading !== null) {
      out.push(current)
      current = { heading: heading[1].trim(), lines: [] }
      continue
    }
    current.lines.push(line)
  }
  out.push(current)
  // A section with no body carries no prose to keep in sync — the text before the
  // first heading is often empty, and hashing it would compare three empty strings.
  return out.filter(section => section.lines.join('\n').trim() !== '')
}

const digest = text => createHash('sha256').update(text, 'utf8').digest('hex').slice(0, 16)

const perLanguage = {}
for (const language of LANGUAGES) {
  const path = join(ROOT, FILES[language])
  if (!existsSync(path)) {
    console.error(`нет ${FILES[language]}`)
    process.exit(2)
  }
  perLanguage[language] = sections(path)
  if (perLanguage[language].length < 8) {
    console.error(`${FILES[language]}: найдено ${perLanguage[language].length} разделов — разбор сломан, а не документ`)
    process.exit(2)
  }
}
const counts = new Set(LANGUAGES.map(language => perLanguage[language].length))
if (counts.size !== 1) {
  console.error(`у README разное число разделов: ${LANGUAGES.map(language => `${language}=${perLanguage[language].length}`).join(', ')}`)
  console.error('сначала приведите структуру: `npm run check:readmes`')
  process.exit(2)
}
const total = perLanguage.ru.length

const current = []
for (let index = 0; index < total; index += 1) {
  const entry = { section: index, heading: perLanguage.ru[index].heading }
  for (const language of LANGUAGES) entry[language] = digest(perLanguage[language][index].lines.join('\n').trimEnd())
  current.push(entry)
}

if (process.argv.includes('--record')) {
  const payload = `${JSON.stringify(current, null, 2)}\n`
  const previous = existsSync(RECORD) ? readFileSync(RECORD, 'utf8') : ''
  if (previous.replace(/\r\n/gu, '\n') === payload) {
    console.log('readmes-pairs: запись уже соответствует документам')
    process.exit(0)
  }
  writeFileSync(RECORD, payload, 'utf8')
  console.log(`readmes-pairs: запись обновлена (${total} разделов × ${LANGUAGES.length} языка)`)
  process.exit(0)
}

if (!existsSync(RECORD)) {
  console.error('scripts/readme-pairs.json отсутствует — выполните `npm run readmes:record`')
  process.exit(1)
}
const record = JSON.parse(readFileSync(RECORD, 'utf8'))
const drift = []
if (record.length !== total) drift.push(`число разделов: было ${record.length}, стало ${total} — приведите структуру и запишите заново`)
for (let index = 0; index < Math.min(record.length, total); index += 1) {
  const changed = LANGUAGES.filter(language => record[index][language] !== current[index][language])
  if (changed.length === 0) continue
  const settled = LANGUAGES.filter(language => !changed.includes(language))
  drift.push(`раздел ${index} «${current[index].heading}»: изменён ${changed.join(', ')}${settled.length > 0 ? `, а ${settled.join(', ')} — нет` : ''}`)
}
if (drift.length > 0) {
  console.error(`readmes-pairs: документы разошлись (${drift.length}):`)
  for (const line of drift) console.error(`  ${line}`)
  console.error('после правки остальных языков: `npm run readmes:record`')
  process.exit(1)
}
console.log(`readmes-pairs: три README совпадают с записью (${total} разделов × ${LANGUAGES.length} языка)`)
