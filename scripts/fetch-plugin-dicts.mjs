/**
 * Vendor the English dictionary of a third-party plugin.
 *
 * The pack translates the harness itself; a plugin family outside the harness tree is
 * a different matter — we can only translate what we can read, and copying another
 * pack's Russian is neither honest nor verifiable. So each covered plugin's own
 * English is *vendored*: downloaded from the registry, extracted from the published
 * bundle, and stored with its provenance (`package@version`, licence). The audit then
 * holds our translation to that text: same keys, same placeholders, same typography —
 * the rules the harness dictionaries already get.
 *
 * Usage:
 *   node scripts/fetch-plugin-dicts.mjs @linxin666/dsh-update [more packages…]
 *
 * The namespace comes from the bundle (`const NS = '...'`), never from the package
 * name: `@linxin666/dsh-client-ui-git-graph` registers `git-graph`.
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'plugins')
mkdirSync(OUT, { recursive: true })

const packages = process.argv.slice(2).filter(argument => !argument.startsWith('-'))
if (packages.length === 0) {
  console.error('укажите пакеты: node scripts/fetch-plugin-dicts.mjs <package…>')
  process.exit(2)
}

/** Every string-literal pair of an object literal starting at `start`, flattened. */
function pairsOf(text, start) {
  const pairs = new Map()
  let index = text.indexOf('{', start)
  if (index === -1) return pairs
  let depth = 0
  let cursor = index
  let key = null
  while (cursor < text.length) {
    const char = text[cursor]
    if (char === '{' || char === '[' || char === '(') depth += 1
    else if (char === '}' || char === ']' || char === ')') {
      depth -= 1
      if (depth === 0) break
    } else if (char === "'" || char === '"' || char === '`') {
      const quote = char
      let end = cursor + 1
      let value = ''
      while (end < text.length) {
        if (text[end] === '\\') { value += text[end + 1] ?? ''; end += 2; continue }
        if (text[end] === quote) break
        value += text[end]
        end += 1
      }
      let after = end + 1
      while (after < text.length && /\s/u.test(text[after])) after += 1
      if (text[after] === ':') {
        key = value
      } else if (key !== null) {
        pairs.set(key, value)
        key = null
      }
      cursor = end + 1
      continue
    }
    cursor += 1
  }
  return pairs
}

const report = []
for (const name of packages) {
  const work = mkdtempSync(join(tmpdir(), 'plugin-dict-'))
  try {
    const meta = JSON.parse(execFileSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['view', name, '--json'], {
      encoding: 'utf8',
      shell: process.platform === 'win32',
    }))
    execFileSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['pack', name, '--pack-destination', work, '--silent'], {
      cwd: work,
      encoding: 'utf8',
      shell: process.platform === 'win32',
    })
    const archive = readdirSync(work).find(entry => entry.endsWith('.tgz'))
    if (archive === undefined) throw new Error('npm pack не создал архив')
    execFileSync('tar', ['-xzf', join(work, archive), '-C', work])

    const bundleDir = join(work, 'package', 'lib')
    if (!existsSync(bundleDir)) throw new Error('в пакете нет lib/ — опубликован только исходник?')
    const bundles = readdirSync(bundleDir).filter(entry => entry.endsWith('.js'))
    let namespace = null
    let english = null
    for (const bundle of bundles) {
      const text = readFileSync(join(bundleDir, bundle), 'utf8')
      /*
       * The namespace comes from the registration call first: `ctx.locale.register("pet", {
       * zh, en })` is what the host actually sees. Bundles that inline the call are common;
       * a package whose settings namespace happens to differ (`const PET_SETTINGS_NS`)
       * would otherwise be recorded under the wrong id.
       */
      const namespaceOf = (() => {
        /*
         * The registration is authoritative, and its first argument may be a constant:
         * `locale.register(MARKET_NS, { zh, en })` with `const MARKET_NS = "dsh-web-ui-market"`
         * above it. Reading the literal only from a bare `.register(` call picks up
         * unrelated registries — one bundle exposed `market-like` (a Turnstile action) as
         * its namespace that way.
         */
        for (const call of text.matchAll(/locale\.register\(\s*(?:["']([\w.-]+)["']|([A-Za-z_$][\w$]*))\s*,\s*\{([\s\S]{0,160})/gu)) {
          const [, literal, identifier, body] = call
          if (!/\ben\b/u.test(body)) continue
          if (literal !== undefined) return literal
          const constant = new RegExp(`(?:const|var|let)\\s+${identifier}\\s*=\\s*["']([\\w.-]+)["']`, 'u').exec(text)
          if (constant !== null) return constant[1]
        }
        const fallback = /(?:const|var|let)\s+NS\s*=\s*['"]([\w.-]+)['"]/u.exec(text)
          ?? /(?:const|var|let)\s+\w*NS\w*\s*=\s*['"]([\w.-]+)['"]/u.exec(text)
          ?? /['"]([\w.-]{3,48})['"]\s*,\s*\{\s*zh\s*:/u.exec(text)
        return fallback === null ? null : fallback[1]
      })()
      if (namespaceOf === null) continue
      /*
       * `String#search` returns -1, not null: `??` never fired here, so a bundle that
       * declares `var en =` (or `en =`) instead of `const en =` was reported as having no
       * dictionary at all — three family packages were skipped for exactly this reason.
       */
      const strict = text.search(/\bconst en(?::[^=]+)?\s*=\s*\{/u)
      const loose = text.search(/\b(?:const|var|let)?\s*en\s*[:=]\s*\{/u)
      const start = strict !== -1 ? strict : loose
      if (start === -1) continue
      const pairs = pairsOf(text, start)
      if (pairs.size === 0) continue
      namespace = namespaceOf
      english = pairs
      break
    }
    if (namespace === null || english === null) throw new Error('не нашёл namespace и английский словарь в бандле')

    const record = {
      namespace,
      package: name,
      version: meta.version,
      license: meta.license ?? null,
      repository: typeof meta.repository === 'object' ? meta.repository?.url ?? null : meta.repository ?? null,
      fetched: new Date().toISOString().slice(0, 10),
      en: Object.fromEntries([...english.entries()].sort(([left], [right]) => left.localeCompare(right, 'en'))),
    }
    const file = join(OUT, `${namespace}.json`)
    writeFileSync(file, `${JSON.stringify(record, null, 2)}\n`, 'utf8')
    report.push(`${namespace}: ${Object.keys(record.en).length} ключей из ${name}@${meta.version}`)
  } catch (error) {
    report.push(`${name}: ПРОВАЛ — ${error.message}`)
  } finally {
    rmSync(work, { recursive: true, force: true })
  }
}
console.log(report.join('\n'))
