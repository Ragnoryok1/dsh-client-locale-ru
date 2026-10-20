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
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync, readdirSync, existsSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
/*
 * Where the vendored dictionaries land. The default is the pack's own `plugins/`;
 * `PLUGIN_DICT_OUT` points it elsewhere, which is how a wide sweep over the
 * ecosystem is measured before anything is kept.
 */
const OUT = process.env.PLUGIN_DICT_OUT ?? join(ROOT, 'plugins')
mkdirSync(OUT, { recursive: true })

const packages = process.argv.slice(2).filter(argument => !argument.startsWith('-'))
if (packages.length === 0) {
  console.error('укажите пакеты: node scripts/fetch-plugin-dicts.mjs <package…>')
  process.exit(2)
}

/**
 * Every string-literal pair of an object literal starting at `start`, flattened.
 *
 * A key is either a quoted string (`"cancel": "Cancel"`) or a bare identifier
 * (`cancel: "Cancel"`) — a bundler that keeps the source shape writes the second, and
 * a dictionary read only in the first form came back empty for every such package.
 *
 * A dictionary may also be assembled from parts — `const en = { ...enCommon, ...enSkills }` —
 * and then the parts are merged in through `resolve`, which answers with the pairs of
 * the named object.
 *
 * @param text - the source the object lives in.
 * @param start - where the object literal begins.
 * @param resolve - the pairs of a named object, when a part is spread into it.
 * @returns the pairs of the object, the spread parts included.
 */
function pairsOf(text, start, resolve) {
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
    } else if (/[A-Za-z_$]/u.test(char)) {
      /*
       * A bare key, and only where an object member can start: after `{` or `,`.
       * Elsewhere an identifier before a colon is an expression (`a ? b : c`), and
       * reading it as a key would put nonsense in the dictionary.
       */
      const before = text.slice(0, cursor).replace(/\s+$/u, '').slice(-1)
      if (before === '{' || before === ',') {
        const identifier = /^([A-Za-z_$][\w$]*)\s*:/u.exec(text.slice(cursor, cursor + 80))
        if (identifier !== null) {
          key = identifier[1]
          cursor += identifier[0].length
          continue
        }
      }
      /*
       * A spread part: `...enCommon`. The dictionary is assembled from parts, and the
       * part's own pairs belong to the dictionary.
       */
      if (before === '.' && resolve !== undefined) {
        const spread = /^\.\.\.([A-Za-z_$][\w$]*)/u.exec(text.slice(cursor - 3, cursor + 60))
        if (spread !== null) {
          const part = resolve(spread[1])
          if (part !== undefined && part !== null) for (const [partKey, partValue] of part) pairs.set(partKey, partValue)
          cursor += spread[0].length - 3
          continue
        }
      }
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

    /*
     * The client bundle is not always in `lib/`: `dshmarket` ships it in `client/`, and
     * a scan of `lib/` alone found there a host module's dictionary of 18 keys — not the
     * interface dictionary. A vendored snapshot that is not the plugin's dictionary
     * would make our translation look complete while covering a fraction of it, so the
     * scan reads every published bundle the package ships.
     */
    const packageDir = join(work, 'package')
    if (!existsSync(packageDir)) throw new Error('в архиве нет package/ — публикация устроена не так?')
    const bundles = []
    for (const directory of readdirSync(packageDir)) {
      const path = join(packageDir, directory)
      if (!statSync(path).isDirectory()) continue
      for (const entry of readdirSync(path)) {
        if (entry.endsWith('.js')) bundles.push(join(directory, entry))
      }
    }
    if (bundles.length === 0) throw new Error('в пакете нет собранных бандлей — опубликован только исходник?')
    const texts = new Map(bundles.map(bundle => [bundle, readFileSync(join(packageDir, bundle), 'utf8')]))

    /*
     * The namespace comes from the registration call: `ctx.locale.register("pet", { zh,
     * en })` is what the host actually sees. Its first argument may be a constant —
     * `locale.register(LOCALE_NS, { zh, en })` — and the constant may live in another
     * bundle of the same package, so the whole package answers the question.
     *
     * A minified bundle names both the constant and the value differently: the
     * namespace is `let Au=\`dsh-context\`` — a template literal, not a quoted string —
     * and the identifier is a single letter reused for everything else in the file.
     */
    const constantOf = identifier => {
      const pattern = new RegExp(`(?<![.\\w$])${identifier}\\s*=\\s*["'\`]([\\w.-]+)["'\`]`, 'u')
      for (const text of texts.values()) {
        const found = pattern.exec(text)
        if (found !== null) return found[1]
      }
      return null
    }
    /**
     * The object literal an identifier holds, wherever it is defined.
     *
     * A minified bundle hands the dictionary over by name — `h={"tab.context":…}` — and
     * the same letter is reused for local variables, so the candidate with the most
     * pairs is the dictionary and the rest are not. A dictionary assembled from parts
     * (`{ ...enCommon, ...enSkills }`) answers with the parts merged in.
     *
     * @param identifier - the name the object is bound to.
     * @param seen - the names already read, so a cycle cannot run forever.
     * @returns the pairs of the object, or null when the name holds no object.
     */
    const objectOf = (identifier, seen = new Set()) => {
      if (seen.has(identifier)) return null
      seen.add(identifier)
      const pattern = new RegExp(`(?<![.\\w$])${identifier}\\s*=\\s*(?:Object\\.freeze\\(\\s*)?\\{`, 'gu')
      let best = null
      for (const text of texts.values()) {
        for (const match of text.matchAll(pattern)) {
          const pairs = pairsOf(text, match.index + match[0].length - 1, name => objectOf(name, seen))
          if (pairs.size > 0 && (best === null || pairs.size > best.size)) best = pairs
        }
      }
      return best
    }
    /**
     * The namespace this package registers, and the bundle that registers it.
     *
     * The first argument of `locale.register` is the namespace, and it is read from
     * every call whatever the rest of the arguments look like: a plugin may register
     * one language at a time (`register(NS, "en", en)`), hand over both
     * (`register(NS, { zh, en })`) or wrap the call in a helper of its own
     * (`addLocale("en", KL_en)` → `register(NS, locale, dictionary)`).
     */
    const registration = (() => {
      for (const [bundle, text] of texts) {
        for (const call of text.matchAll(/locale\.register\(\s*(?:["'`]([\w.-]+)["'`]|([A-Za-z_$][\w$]*))\s*(?=[,)])/gu)) {
          const [, literal, identifier] = call
          if (literal !== undefined) return { namespace: literal, bundle, body: null }
          const constant = constantOf(identifier)
          if (constant !== null) return { namespace: constant, bundle, body: null }
        }
      }
      return null
    })()
    /**
     * The English dictionary the registration hands over.
     *
     * Three shapes carry it: the object of the `en` property
     * (`register(NS, { zh, en })`), the object named by the third argument
     * (`register(NS, "en", KL_en)`) and the shorthand (`register(NS, { zh, en })` where
     * `en` is a variable of its own).
     */
    const englishOfRegistration = (() => {
      for (const [bundle, text] of texts) {
        for (const call of text.matchAll(/locale\.register\(\s*(?:["'`]([\w.-]+)["'`]|([A-Za-z_$][\w$]*))\s*,\s*(?:\{([\s\S]{0,200})|"en"\s*,\s*([A-Za-z_$][\w$]*))/gu)) {
          const [, , , body, named] = call
          if (named !== undefined) {
            const pairs = objectOf(named)
            if (pairs !== null) return pairs
          }
          if (body === undefined) continue
          if (!/\ben\b/u.test(body)) continue
          const property = /\ben\s*:\s*([A-Za-z_$][\w$]*)/u.exec(body)
          if (property !== null) {
            const pairs = objectOf(property[1])
            if (pairs !== null) return pairs
          }
          if (/(?:^|[{,]\s*)en\s*[,}]/u.test(body) || /(?:^|[{,]\s*)en\s*[,}][\s\S]*$/u.test(body)) {
            const pairs = objectOf('en')
            if (pairs !== null) return pairs
          }
          const inline = pairsOf(text, call.index + call[0].length - 1, name => objectOf(name))
          if (inline.size > 0) return inline
        }
      }
      return null
    })()
    /*
     * A package that registers through a constant the bundles do not define falls back
     * to a namespace-shaped constant: `const BETTER_SIDEBAR_NS = "betterSidebar"`.
     */
    const fallback = (() => {
      for (const text of texts.values()) {
        const found = /(?:const|var|let)\s+\w*NS\w*\s*=\s*['"]([\w.-]+)['"]/u.exec(text)
        if (found !== null) return { namespace: found[1], bundle: null }
      }
      return null
    })()
    const namespace = registration?.namespace ?? fallback?.namespace ?? null

    /*
     * The English dictionary is the `en` object the registration hands over. A bundle
     * split repeats the same object in several chunks, so the candidate with the most
     * pairs is the dictionary and the smaller ones belong to other features.
     */
    const english = (() => {
      if (englishOfRegistration !== null) return englishOfRegistration
      const candidates = []
      for (const [bundle, text] of texts) {
        const strict = text.search(/\bconst en(?::[^=]+)?\s*=\s*\{/u)
        const loose = text.search(/\b(?:const|var|let)?\s*en\s*[:=]\s*\{/u)
        const start = strict !== -1 ? strict : loose
        if (start === -1) continue
        const pairs = pairsOf(text, start, name => objectOf(name))
        if (pairs.size > 0) candidates.push({ bundle, pairs })
      }
      if (candidates.length > 0) {
        const own = candidates.find(candidate => candidate.bundle === registration?.bundle)
        return (own ?? candidates.reduce((best, candidate) => candidate.pairs.size > best.pairs.size ? candidate : best)).pairs
      }
      /*
       * A plugin that registers through a helper of its own — `addLocale("en", KL_en)` —
       * keeps the dictionary in a name of its own. The name that ends in `en` and holds
       * the most text is the English dictionary.
       */
      let best = null
      for (const text of texts.values()) {
        for (const match of text.matchAll(/(?<![.\w$])([A-Za-z_$][\w$]*en)\s*=\s*(?:Object\.freeze\(\s*)?\{/giu)) {
          const pairs = objectOf(match[1])
          if (pairs !== null && pairs.size > 0 && (best === null || pairs.size > best.size)) best = pairs
        }
      }
      return best
    })()
    if (namespace === null || english === null) throw new Error('не нашёл namespace и английский словарь в бандле')

    /*
     * A plugin's own name lives in `locale/en.json` next to the package, and the loader
     * reads it from there. It is vendored too: the name is what a user reads on the
     * Plugins page, and a pack that translates a plugin's strings can translate its name
     * only by carrying the name itself.
     */
    let descriptors = null
    const localeFile = join(work, 'package', 'locale', 'en.json')
    if (existsSync(localeFile)) {
      try {
        const locale = JSON.parse(readFileSync(localeFile, 'utf8'))
        const meta = locale.meta ?? {}
        if (typeof meta.title === 'string' || typeof meta.description === 'string') {
          descriptors = {
            ...(typeof meta.title === 'string' ? { title: meta.title } : {}),
            ...(typeof meta.description === 'string' ? { description: meta.description } : {}),
          }
        }
      } catch {
        /* A broken locale file is the plugin's problem, not ours. */
      }
    }

    const record = {
      namespace,
      package: name,
      version: meta.version,
      license: meta.license ?? null,
      repository: typeof meta.repository === 'object' ? meta.repository?.url ?? null : meta.repository ?? null,
      fetched: new Date().toISOString().slice(0, 10),
      ...(descriptors === null ? {} : { meta: descriptors }),
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
