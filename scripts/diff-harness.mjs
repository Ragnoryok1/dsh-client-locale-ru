/**
 * What a harness bump changed in the English text the pack translates.
 *
 * Every gate answers "is the pack complete for one tree". None answers "did the
 * harness reword something we already translated": a key whose English became
 * «Copy the transcript to the clipboard» from «Copy transcript to clipboard» keeps our
 * Russian and keeps every gate green, while the sentence a reader sees no longer says
 * what the English says. The only way to see that list is to compare two harness trees.
 *
 * Usage:
 *   node scripts/diff-harness.mjs <old-tree> <new-tree>
 *
 * Both arguments are directories with harness packages (`packages/` inside, or the
 * tree root itself). Output is a worklist: changed wording first (with our Russian, so
 * the judgement is one line away), then new keys, then keys the harness dropped.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const [oldRoot, newRoot] = process.argv.slice(2)
if (oldRoot === undefined || newRoot === undefined) {
  console.error('нужны два дерева: node scripts/diff-harness.mjs <старое> <новое>')
  process.exit(2)
}
for (const root of [oldRoot, newRoot]) {
  if (!existsSync(root)) {
    console.error(`нет дерева: ${root}`)
    process.exit(2)
  }
}

const walk = (dir, out = []) => {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'lib' || entry === 'dist' || entry === '.git') continue
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) walk(path, out)
    else if (/locales?\.ts$/u.test(path)) out.push(path)
  }
  return out
}

/** The `en` block of a dictionary file: key -> template. */
function englishOf(file) {
  const text = readFileSync(file, 'utf8')
  const namespace = /export const NS\s*(?::\s*string)?\s*=\s*'([\w.-]+)'/u.exec(text)?.[1]
    ?? /const namespace\s*(?::\s*string)?\s*=\s*'([\w.-]+)'/u.exec(text)?.[1]
    ?? null
  const start = text.search(/export const en(?::[^=]+)? = \{/u)
  if (start === -1) return { namespace, entries: new Map() }
  const body = text.slice(start)
  const end = body.search(/^\}\s*(?:satisfies|as const|;)?$/mu)
  const entries = new Map()
  for (const match of (end === -1 ? body : body.slice(0, end)).matchAll(/^\s*'?([\w.-]+)'?:\s*(?:'((?:[^'\\]|\\.)*)'|`((?:[^`\\]|\\.)*)`)/gmu)) {
    entries.set(match[1], (match[2] ?? match[3]).replace(/\\(['"\\`])/gu, '$1'))
  }
  return { namespace, entries }
}

function collect(root) {
  const map = new Map()
  for (const file of walk(root)) {
    const { namespace, entries } = englishOf(file)
    for (const [key, value] of entries) {
      const id = namespace === null ? key : `${namespace} · ${key}`
      if (!map.has(id)) map.set(id, value)
    }
  }
  return map
}

const before = collect(oldRoot)
const after = collect(newRoot)
console.log(`старое дерево: ${before.size} английских строк; новое: ${after.size}\n`)

const changed = []
const added = []
for (const [id, value] of after) {
  if (!before.has(id)) {
    added.push(id)
    continue
  }
  const previous = before.get(id)
  if (previous !== value) changed.push({ id, previous, value })
}
const removed = [...before.keys()].filter(id => !after.has(id))

/* Our Russian, so the diff is reviewable in one screen per line. */
const pack = readFileSync(join(import.meta.dirname, '..', 'src', 'client', 'dicts.ts'), 'utf8')
const russian = new Map()
const russianByKey = new Map()
let namespace = null
for (const line of pack.split(/\r?\n/u)) {
  const head = /^ {2}'([\w.-]+)':\s*\{/u.exec(line)
  if (head !== null) {
    namespace = head[1]
    continue
  }
  const pair = /^\s*'([^']+)':\s*'((?:[^'\\]|\\.)*)'/u.exec(line)
  if (pair === null || namespace === null) continue
  russian.set(`${namespace} · ${pair[1]}`, pair[2])
  if (!russianByKey.has(pair[1])) russianByKey.set(pair[1], [])
  russianByKey.get(pair[1]).push({ namespace, value: pair[2] })
}
const oursOf = id => {
  const direct = russian.get(id)
  if (direct !== undefined) return [{ namespace: id.split(' · ')[0], value: direct }]
  return russianByKey.get(id) ?? []
}
const ours = changed.filter(entry => oursOf(entry.id).length > 0)

console.log(`=== переформулировано: ${changed.length} (из них ${ours.length} с нашим переводом) ===`)
for (const entry of changed.slice(0, 60)) {
  console.log(`  ${entry.id}`)
  console.log(`    было:  ${JSON.stringify(entry.previous)}`)
  console.log(`    стало: ${JSON.stringify(entry.value)}`)
  for (const match of oursOf(entry.id)) console.log(`    наш (${match.namespace}): «${match.value}»`)
}
if (changed.length > 60) console.log(`  … ещё ${changed.length - 60}`)
console.log(`\n=== новых строк: ${added.length} ===`)
for (const id of added.slice(0, 40)) console.log(`  ${id}`)
if (added.length > 40) console.log(`  … ещё ${added.length - 40}`)
console.log(`\n=== строк, которых больше нет: ${removed.length} ===`)
for (const id of removed.slice(0, 40)) console.log(`  ${id}`)
if (removed.length > 40) console.log(`  … ещё ${removed.length - 40}`)

void relative
