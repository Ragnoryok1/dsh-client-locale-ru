#!/usr/bin/env node
/**
 * The source map embeds the sources verbatim, line endings included.
 *
 * tsdown inlines `sourcesContent` exactly as the files are read, so a Windows
 * build carries `\r\n` inside the map while a Linux one carries `\n` — and that
 * made the map the one artifact that differed between the two, although the
 * bundle and every type file came out byte-identical. Git stores the sources with
 * LF, so LF is the truthful form; normalising here makes the map deterministic
 * and platform-independent, which is what `npm run check:built` compares against
 * the commit.
 */
import { readFileSync, writeFileSync } from 'node:fs'

const path = new URL('../lib/client.js.map', import.meta.url)
let map
try {
  map = JSON.parse(readFileSync(path, 'utf8'))
} catch (error) {
  console.error(`normalize-map: lib/client.js.map не разобрать: ${error.message}`)
  process.exit(1)
}

let changed = 0
const normalize = (text) => {
  const next = text.replace(/\r\n/gu, '\n')
  if (next !== text) changed += 1
  return next
}
if (Array.isArray(map.sourcesContent)) {
  map.sourcesContent = map.sourcesContent.map(text => typeof text === 'string' ? normalize(text) : text)
}

writeFileSync(path, JSON.stringify(map))
const total = Array.isArray(map.sourcesContent) ? map.sourcesContent.length : 0
console.log(`normalize-map: переводы строк в sourcesContent приведены к LF (${changed} из ${total} исходников)`)
