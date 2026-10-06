/**
 * Drift guard for the translated READMEs.
 *
 * Three files describe the same document — `README.md` (Russian, the primary
 * one), `README.en.md` and `README.zh.md`. Nothing stops a later edit from
 * touching one of them and leaving the others behind, and a stale translation
 * announces nothing on its own. The harness solves this with a per-section hash
 * record (`README.i18n.yaml`); this is a smaller, honest version of the same
 * idea: it compares the *structure* the three files must share, so any drift
 * fails the build instead of being discovered by a reader.
 *
 * What is compared:
 *   — headings: same order and same levels;
 *   — fenced code blocks: same count;
 *   — tables: same row count per table, in order;
 *   — image references: same files, in order;
 *   — the language switcher: present in every file and pointing at all three.
 *
 * What is NOT compared: the words themselves. Structure parity cannot prove a
 * translation is accurate, and this script does not pretend otherwise.
 *
 * Usage: node scripts/check-readmes.mjs
 */
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const FILES = ['README.md', 'README.en.md', 'README.zh.md']

/** Structural fingerprint of one README, ignoring everything inside code fences. */
function fingerprint(text) {
  const lines = text.split('\n')
  const headings = []
  const tables = []
  const images = []
  let fences = 0
  let inFence = false
  let rows = 0
  for (const line of lines) {
    if (/^\s*```/u.test(line)) {
      fences += 1
      inFence = !inFence
      continue
    }
    // A `#` inside a fenced block is a shell comment, not a heading, and a `|`
    // there is not a table row. Counting them would invent differences.
    if (inFence) continue
    const heading = /^(#{1,6})\s+(.*)$/u.exec(line)
    if (heading !== null) headings.push(`${heading[1].length}:${stripMarkup(heading[2])}`)
    for (const image of line.matchAll(/!\[[^\]]*\]\(([^)]+)\)/gu)) images.push(image[1])
    if (/^\|/u.test(line)) rows += 1
    else if (rows > 0) { tables.push(rows); rows = 0 }
  }
  if (rows > 0) tables.push(rows)
  return { headings, fences: fences / 2, images, tables }
}

/** Drop inline emphasis and links so heading text compares by structure only. */
function stripMarkup(text) {
  return text.replace(/[*_`]/gu, '').replace(/\[([^\]]*)\]\([^)]*\)/gu, '$1').trim()
}

const problems = []
const prints = new Map()
for (const file of FILES) {
  const path = join(ROOT, file)
  if (!existsSync(path)) { problems.push(`нет файла ${file}`); continue }
  const text = readFileSync(path, 'utf8')
  prints.set(file, fingerprint(text))

  // The switcher must offer all three languages from every file.
  for (const target of FILES) {
    if (target === file) continue
    if (!text.includes(`](${target})`)) problems.push(`${file}: нет ссылки на ${target}`)
  }
}

const primary = prints.get(FILES[0])
if (primary !== undefined) {
  for (const file of FILES.slice(1)) {
    const print = prints.get(file)
    if (print === undefined) continue
    if (print.fences !== primary.fences) {
      problems.push(`${file}: блоков кода ${print.fences}, а в README.md ${primary.fences}`)
    }
    if (print.images.join('|') !== primary.images.join('|')) {
      problems.push(`${file}: картинки [${print.images.join(', ')}], а в README.md [${primary.images.join(', ')}]`)
    }
    if (print.tables.join(',') !== primary.tables.join(',')) {
      problems.push(`${file}: строки таблиц [${print.tables.join(', ')}], а в README.md [${primary.tables.join(', ')}]`)
    }
    if (print.headings.length !== primary.headings.length) {
      problems.push(`${file}: заголовков ${print.headings.length}, а в README.md ${primary.headings.length}`)
      continue
    }
    for (const [index, heading] of primary.headings.entries()) {
      const level = heading.split(':')[0]
      const otherLevel = print.headings[index].split(':')[0]
      if (level !== otherLevel) {
        problems.push(`${file}: заголовок №${index + 1} уровня ${otherLevel}, а в README.md уровня ${level}`)
      }
    }
  }
}

console.log(`сверяю ${FILES.length} файла README`)
for (const [file, print] of prints) {
  console.log(`  ${file.padEnd(16)} заголовков ${String(print.headings.length).padStart(2)}, блоков кода ${String(print.fences).padStart(2)}, таблиц ${print.tables.length}, картинок ${print.images.length}`)
}
if (problems.length === 0) {
  console.log('\nструктура совпадает — расхождений нет')
  process.exit(0)
}
console.log(`\nРАСХОЖДЕНИЯ (${problems.length}):`)
for (const problem of problems) console.log('  ' + problem)
console.log('\nпосле правки одного README приведите остальные к той же структуре')
process.exit(1)
