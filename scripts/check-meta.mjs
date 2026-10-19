/**
 * Keeps the marketplace metadata block in step with the package version.
 *
 * The block is what the plugin catalogue reads, and the publish workflow compares it with
 * `package.json`. That comparison only ran in CI, so a version bump could leave the block
 * stale until the release pipeline failed on its second step. This checks it locally, in
 * all three READMEs, and the count it states must match the package as well.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = path => readFileSync(join(ROOT, path), 'utf8').replace(/\r\n/gu, '\n')

const manifest = JSON.parse(read('package.json'))
const version = manifest.version
const problems = []

for (const file of ['README.md', 'README.en.md', 'README.zh.md']) {
  const text = read(file)
  const block = /<!--\s*deepseek-harness-meta\s*([\s\S]*?)-->/u.exec(text)
  if (block === null) {
    problems.push(`${file}: нет блока deepseek-harness-meta`)
    continue
  }
  let meta
  try {
    meta = JSON.parse(block[1])
  } catch (error) {
    problems.push(`${file}: блок метаданных не разбирается — ${error.message}`)
    continue
  }
  if (meta.version !== version) {
    problems.push(`${file}: в метаданных версия ${meta.version}, а в package.json ${version}`)
  }
  const stated = /(\d+)\s*translated strings/u.exec(meta.description ?? '')
  if (stated !== null) {
    const claimed = Number(stated[1])
    const count = JSON.parse(read('scripts/pack-count.json'))
    if (claimed !== count.values) {
      problems.push(`${file}: метаданные заявляют ${claimed} строк, а в пакете ${count.values}`)
    }
  }
}

if (problems.length > 0) {
  console.error(`метаданные расходятся с пакетом (${problems.length}):`)
  for (const problem of problems) console.error(`  ${problem}`)
  process.exit(1)
}
console.log(`метаданные в трёх README совпадают с пакетом: версия ${version}`)
