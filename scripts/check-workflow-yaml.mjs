/**
 * Checks that the workflow files are structurally sound before they are pushed.
 *
 * A workflow with broken indentation does not fail loudly: GitHub refuses to parse it and
 * reports the run by file path, with no jobs at all, while the local gates — which only read
 * the step names — stay green. That is exactly what happened to the 0.2.4 release, so the
 * shape is checked here: header, jobs, steps at one indentation level, every step carrying
 * a `run:` or `uses:`, and no tabs.
 *
 * Usage: node scripts/check-workflow-yaml.mjs
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = path => readFileSync(join(ROOT, path), 'utf8').replace(/\r\n/gu, '\n')

const problems = []

for (const file of ['.github/workflows/verify.yml', '.github/workflows/publish.yml']) {
  const text = read(file)
  const lines = text.split('\n')

  if (!/^name:\s*\S/u.test(lines[0] ?? '')) problems.push(`${file}: первая строка должна быть «name: …»`)
  if (!/^on:/mu.test(text)) problems.push(`${file}: нет раздела on:`)
  if (!/^jobs:/mu.test(text)) problems.push(`${file}: нет раздела jobs:`)

  const tabbed = lines.findIndex(line => line.includes('\t'))
  if (tabbed !== -1) problems.push(`${file}: строка ${tabbed + 1} содержит табуляцию`)

  const stepLines = lines
    .map((line, index) => ({ line, index }))
    .filter(entry => /^\s*- name:\s*\S/u.test(entry.line))
  if (stepLines.length === 0) problems.push(`${file}: нет ни одного шага`)

  const indents = new Set(stepLines.map(entry => entry.line.match(/^ */u)[0].length))
  if (indents.size > 1) {
    problems.push(`${file}: шаги с разным отступом (${[...indents].join(', ')}) — список шагов вложен друг в друга`)
  }

  for (const entry of stepLines) {
    /* A step may carry `if:` or `env:` between its name and its body. */
    let cursor = entry.index + 1
    let body = null
    while (cursor < lines.length) {
      const line = lines[cursor]
      if (/^\s*-\s/u.test(line)) break
      if (/^\s{2,}(run|uses):/u.test(line)) {
        body = line
        break
      }
      cursor += 1
    }
    if (body === null) {
      problems.push(`${file}: шаг «${entry.line.trim()}» (строка ${entry.index + 1}) не имеет run: или uses:`)
      continue
    }
    const stepIndent = entry.line.match(/^ */u)[0].length
    const bodyIndent = body.match(/^ */u)[0].length
    if (bodyIndent !== stepIndent + 2) {
      problems.push(`${file}: у шага «${entry.line.trim()}» тело с отступом ${bodyIndent}, а у шага ${stepIndent}`)
    }
  }
}

if (problems.length > 0) {
  console.error(`workflows не разбираются (${problems.length}):`)
  for (const problem of problems) console.error(`  ${problem}`)
  process.exit(1)
}
console.log('оба workflow разбираются: заголовок, jobs, шаги на одном уровне, у каждого шага есть run: или uses:')
