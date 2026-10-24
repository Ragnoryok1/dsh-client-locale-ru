#!/usr/bin/env node
/**
 * The size claim in the install paragraph.
 *
 * «Публикуемый пакет занимает 354 КБ» was written when the bundle was smaller and
 * then stayed, while the READMEs' own rule is that a stale claim is a wrong claim:
 * a reader comparing packs sees this number, and it is the kind of fact nobody
 * re-measures by hand. So the claim is checked against a real pack.
 *
 * The comparison allows two kilobytes of slack, and that is honest rather than
 * lazy: npm compresses the tarball with whatever zlib the Node build carries, and
 * the payload contains the READMEs and the changelog, whose line endings are CRLF
 * in a Windows checkout and LF on the Linux CI (git stores LF), so the packed
 * byte count legitimately differs between the two by more than noise. The
 * sentence rounds to whole kilobytes anyway, and the drift it was written to catch
 * was 27 of them.
 */
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const windows = process.platform === 'win32'
const pack = windows
  ? spawnSync(process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', 'npm pack --dry-run --json'], { encoding: 'utf8' })
  : spawnSync('npm', ['pack', '--dry-run', '--json'], { encoding: 'utf8' })
if (pack.status !== 0) {
  console.error('check-size: npm pack не отработал — заявленный размер не сверить')
  console.error(`${pack.stdout ?? ''}${pack.stderr ?? ''}`.trimEnd())
  process.exit(1)
}

let packed
try {
  packed = JSON.parse(pack.stdout)[0]
} catch {
  console.error('check-size: npm pack вернул не JSON — заявленный размер не сверить')
  process.exit(1)
}
const kilobytes = Math.round(packed.size / 1000)
const files = packed.entryCount

const CLAIM = /(\d+)\s*(?:КБ|kB|KB|Кб)/gu
const wrong = []
for (const file of ['README.md', 'README-en.md', 'README-zh.md']) {
  const text = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')
  const claims = [...text.matchAll(CLAIM)]
  if (claims.length === 0) continue
  for (const claim of claims) {
    const advertised = Number(claim[1])
    /*
     * Only a package size is a claim about this pack. The prose explaining the
     * tolerance («allow 1 KB of slack») is written in kilobytes as well, and a
     * real payload is never tens of kilobytes: the dictionaries alone are 250.
     */
    if (advertised < 100) continue
    if (Math.abs(advertised - kilobytes) > 1) {
      wrong.push(`${file}: заявляет ${advertised} КБ, а пакет собирается в ${kilobytes} КБ`)
    }
  }
}

if (wrong.length === 0) {
  console.log(`check-size: заявленный размер сходится с пакетом (${kilobytes} КБ, файлов ${files}, ${packed.size} байт)`)
  process.exit(0)
}
for (const line of wrong) console.error(`check-size: ${line}`)
console.error('перемерить: `npm pack --dry-run --json` и поправить число в трёх README')
process.exitCode = 1
