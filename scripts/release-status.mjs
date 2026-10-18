/**
 * Reports whether the release story is consistent: the version in the manifest, the newest
 * changelog section, the git tag, and the artifact the registry actually serves.
 *
 * The three can drift apart silently — a tag cut before the last content commit, a publish
 * made from a dirty tree, a changelog entry that never shipped. This prints each fact and
 * the disagreements between them; it changes nothing.
 *
 * Usage: node scripts/release-status.mjs [--json]
 */
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = path => readFileSync(join(ROOT, path), 'utf8').replace(/\r\n/gu, '\n')
const git = args => {
  try {
    return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim()
  } catch {
    return ''
  }
}

const manifest = JSON.parse(read('package.json'))
const version = manifest.version
const changelog = /^## \[([^\]]+)\]\s+—\s+(\S+)$/mu.exec(read('CHANGELOG.md'))
const changelogVersion = changelog?.[1] ?? null
const changelogDate = changelog?.[2] ?? null

const head = git(['rev-parse', 'HEAD'])
const tagAtHead = git(['tag', '--points-at', 'HEAD']).split('\n').filter(Boolean)
const tagTargets = {}
for (const tag of git(['tag', '--list', 'v*']).split('\n').filter(Boolean)) {
  tagTargets[tag] = git(['rev-list', '-n', '1', tag])
}
const versionTag = `v${version}`
const tagCommit = tagTargets[versionTag] ?? null
const publishedAtTag = tagCommit === null ? null : git(['rev-list', '-n', '1', versionTag])

/* The registry serves bytes; compare them with the tree that claims to produce them. */
let registry = null
let registryError = null
const encoded = manifest.name.replace('/', '%2F')
try {
  const response = await fetch(`https://registry.npmjs.org/${encoded}/${version}`, {
    headers: { 'User-Agent': 'dsh-release-status' },
  })
  if (response.ok) {
    const body = await response.json()
    registry = { shasum: body.dist?.shasum ?? null, publishedAt: body.dist?.tarball ?? null }
  } else {
    registryError = `HTTP ${response.status}`
  }
} catch (error) {
  registryError = error.message
}

let localShasum = null
try {
  const output = execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], {
    cwd: ROOT,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  })
  localShasum = JSON.parse(output)[0]?.shasum ?? null
} catch (error) {
  localShasum = null
}

/*
 * Problems mean the release story is broken. Notes mean the tree simply moved on after the
 * release, which is the normal state of a repository between releases and must not read as
 * a failure: the tag marks the published content, and later commits are unreleased work.
 */
const problems = []
const notes = []
if (changelogVersion !== version) problems.push(`CHANGELOG начинается с ${changelogVersion ?? '—'}, а версия в манифесте ${version}`)
if (tagCommit === null) problems.push(`нет тега ${versionTag}`)
if (tagCommit !== null && tagCommit !== head) {
  const commits = Number(git(['rev-list', '--count', `${tagCommit}..${head}`]) || '0')
  notes.push(`после релиза в ветке ${commits} коммит(ов); тег ${versionTag} помечает опубликованное содержимое`)
}
if (registry === null) problems.push(`реестр не отдал ${version}: ${registryError ?? 'нет ответа'}`)
if (registry !== null && localShasum !== null && registry.shasum !== localShasum) {
  const message = `shasum в реестре ${registry.shasum}, а текущее дерево собирается в ${localShasum}`
  if (tagCommit === head) problems.push(`тег ${versionTag} стоит на рабочем дереве, но ${message}`)
  else notes.push(`${message} — это неопубликованные изменения`)
}

const summary = {
  name: manifest.name,
  version,
  changelogVersion,
  changelogDate,
  head: head.slice(0, 7),
  tagsAtHead: tagAtHead,
  tag: tagCommit === null ? null : { name: versionTag, commit: tagCommit.slice(0, 7) },
  registry: registry === null ? { error: registryError } : { shasum: registry.shasum },
  localShasum,
  problems,
  notes,
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(summary, null, 2))
  process.exit(problems.length === 0 ? 0 : 1)
}

console.log(`пакет:      ${manifest.name}@${version}`)
console.log(`CHANGELOG:  ${changelogVersion ?? '—'} (${changelogDate ?? '—'})`)
console.log(`HEAD:       ${head.slice(0, 7)}${tagAtHead.length > 0 ? ` (теги: ${tagAtHead.join(', ')})` : ''}`)
console.log(`тег ${versionTag}:  ${tagCommit === null ? 'отсутствует' : tagCommit.slice(0, 7)}`)
console.log(`реестр:     ${registry === null ? `нет версии (${registryError})` : registry.shasum}`)
console.log(`дерево:     ${localShasum ?? 'не удалось посчитать'}`)
console.log('')
if (problems.length === 0) {
  console.log(`релиз ${version} согласован: версия, CHANGELOG, тег и опубликованный артефакт совпадают`)
} else {
  console.log(`расхождений: ${problems.length}`)
  for (const problem of problems) console.log(`  ${problem}`)
}
if (notes.length > 0) {
  console.log('')
  for (const note of notes) console.log(`замечание: ${note}`)
}
process.exit(problems.length === 0 ? 0 : 1)
