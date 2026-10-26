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
 * Where a comment begins at `cursor`, and where it ends.
 *
 * A bundle explains itself in comments, and a comment holds an apostrophe as
 * often as a word: `// the Session's cwd`. A reader that takes every quote for
 * the start of a string loses the thread of the whole file from there on and
 * ends up in the wrong object.
 *
 * @param text - the source the comment lives in.
 * @param cursor - where the comment may begin.
 * @returns the offset past the comment, or -1 when there is no comment there.
 */
function commentEnd(text, cursor) {
  if (text[cursor] !== '/') return -1
  if (text[cursor + 1] === '/') {
    const end = text.indexOf('\n', cursor)
    return end === -1 ? text.length : end + 1
  }
  if (text[cursor + 1] === '*') {
    const end = text.indexOf('*/', cursor + 2)
    return end === -1 ? text.length : end + 2
  }
  return -1
}

/**
 * Where the object literal of a property begins, inside the object at `start`.
 *
 * The property is looked for at the top level of that object: `en: {…}` of
 * `L = { zh: {…}, en: {…} }` begins at the `{` after the colon, and a
 * property of a nested object does not answer for the outer one.
 *
 * @param text - the source the object lives in.
 * @param start - the `{` of the object that holds the property.
 * @param property - the name of the property to find.
 * @returns the offset of the property's `{`, or -1 when the object has no such property.
 */
function propertyStart(text, start, property) {
  let depth = 0
  let cursor = start
  while (cursor < text.length) {
    const char = text[cursor]
    if (char === '{' || char === '[' || char === '(') {
      depth += 1
      cursor += 1
      continue
    }
    if (char === '}' || char === ']' || char === ')') {
      depth -= 1
      if (depth === 0) return -1
      cursor += 1
      continue
    }
    if (char === '"' || char === "'" || char === '`') {
      const quote = char
      let end = cursor + 1
      while (end < text.length && text[end] !== quote) {
        if (text[end] === '\\') end += 1
        end += 1
      }
      cursor = end + 1
      continue
    }
    const comment = commentEnd(text, cursor)
    if (comment !== -1) {
      cursor = comment
      continue
    }
    if (depth === 1) {
      const match = new RegExp(`^\\s*${property}\\s*:\\s*\\{`, 'u').exec(text.slice(cursor, cursor + 80))
      if (match !== null) return cursor + match[0].length - 1
    }
    cursor += 1
  }
  return -1
}

/**
 * The properties of the object literal that begins at `start`, one level deep.
 *
 * A property's value is one of three things: an object literal of its own
 * (`en: {…}`), a reference to a property of another object (`en: L.en`) or a
 * plain name (`en` in the shorthand `{ en, zh }`, where the name stands for the
 * variable of that name). Which one it is decides how the dictionary is read.
 *
 * @param text - the source the object lives in.
 * @param start - where the object literal begins.
 * @returns the properties, in the order they are written.
 */
function propertiesOf(text, start) {
  const properties = []
  let index = text.indexOf('{', start)
  if (index === -1) return properties
  let depth = 0
  let cursor = index
  while (cursor < text.length) {
    const char = text[cursor]
    if (char === '{' || char === '[' || char === '(') {
      depth += 1
      cursor += 1
      continue
    }
    if (char === '}' || char === ']' || char === ')') {
      depth -= 1
      if (depth === 0) break
      cursor += 1
      continue
    }
    if (char === '"' || char === "'" || char === '`') {
      const quote = char
      let end = cursor + 1
      let value = ''
      while (end < text.length && text[end] !== quote) {
        if (text[end] === '\\') { value += text[end + 1] ?? ''; end += 2; continue }
        value += text[end]
        end += 1
      }
      let after = end + 1
      while (after < text.length && /\s/u.test(text[after])) after += 1
      if (depth === 1 && text[after] === ':') {
        const read = readValue(text, after + 1)
        if (read !== null) properties.push({ name: value, ...read })
        cursor = read === null ? after + 1 : read.end
        continue
      }
      cursor = end + 1
      continue
    }
    if (char === '/') {
      const comment = commentEnd(text, cursor)
      if (comment !== -1) { cursor = comment; continue }
    } else if (/[A-Za-z_$]/u.test(char) && depth === 1) {
      const before = text.slice(0, cursor).replace(/\s+$/u, '').slice(-1)
      if (before === '{' || before === ',') {
        const identifier = /^([A-Za-z_$][\w$]*)\s*(:)?/u.exec(text.slice(cursor, cursor + 80))
        if (identifier !== null) {
          if (identifier[2] === ':') {
            const read = readValue(text, cursor + identifier[0].length)
            if (read !== null) properties.push({ name: identifier[1], ...read })
            cursor = read === null ? cursor + identifier[0].length : read.end
            continue
          }
          /*
           * The shorthand: `{ en, zh }` names the variable `en`, so the value of
           * the property is that variable and nothing else.
           */
          properties.push({ name: identifier[1], kind: 'name', value: identifier[1], end: cursor + identifier[0].length })
          cursor += identifier[0].length
          continue
        }
      }
    }
    cursor += 1
  }
  return properties
}

/**
 * The value of a property, read at the position the colon left off.
 *
 * @param text - the source the value lives in.
 * @param start - where the value begins.
 * @returns what the value is, or null when it is none of the three shapes.
 */
function readValue(text, start) {
  let cursor = start
  while (cursor < text.length && /\s/u.test(text[cursor])) cursor += 1
  const rest = text.slice(cursor, cursor + 120)
  const member = /^([A-Za-z_$][\w$]*)\.([A-Za-z_$][\w$]*)/u.exec(rest)
  if (member !== null) {
    return { kind: 'member', object: member[1], property: member[2], end: cursor + member[0].length }
  }
  const name = /^([A-Za-z_$][\w$]*)/u.exec(rest)
  if (name !== null) {
    return { kind: 'name', value: name[1], end: cursor + name[0].length }
  }
  if (rest.startsWith('{')) {
    return { kind: 'object', start: cursor, end: cursor }
  }
  return null
}

/**
 * The arguments of a call, as the raw text of each and where it begins.
 *
 * @param text - the source the call lives in.
 * @param open - the index of the opening parenthesis.
 * @returns the raw text of every argument, in order, with its offset.
 */
function argumentsOf(text, open) {
  const args = []
  let depth = 0
  let cursor = open + 1
  let start = cursor
  while (cursor < text.length) {
    const char = text[cursor]
    if (char === '"' || char === "'" || char === '`') {
      const quote = char
      let end = cursor + 1
      while (end < text.length && text[end] !== quote) {
        if (text[end] === '\\') end += 1
        end += 1
      }
      cursor = end + 1
      continue
    }
    if (char === '/') {
      const comment = commentEnd(text, cursor)
      if (comment !== -1) { cursor = comment; continue }
    }
    if (char === '{' || char === '[' || char === '(') {
      depth += 1
      cursor += 1
      continue
    }
    if (char === '}' || char === ']' || char === ')') {
      if (depth === 0) {
        args.push({ text: text.slice(start, cursor), start, end: cursor })
        return args
      }
      depth -= 1
      cursor += 1
      continue
    }
    if (char === ',' && depth === 0) {
      args.push({ text: text.slice(start, cursor), start, end: cursor })
      start = cursor + 1
      cursor += 1
      continue
    }
    cursor += 1
  }
  args.push({ text: text.slice(start), start, end: text.length })
  return args
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
        if (text[end] === '\\') {
          /*
           * The escape has to be decoded, not merely unescaped. A bundle writes its
           * Chinese keys as `"\u4E2A\u540C\u540D"`; a reader that drops the
           * backslash and keeps the letters produces the key `u4E2Au540Cu540D`,
           * which the plugin never looks up — and a Russian value under it would
           * never reach the screen.
           */
          const escape = text[end + 1] ?? ''
          if (escape === 'u' && /^[0-9A-Fa-f]{4}$/u.test(text.slice(end + 2, end + 6))) {
            value += String.fromCharCode(Number.parseInt(text.slice(end + 2, end + 6), 16))
            end += 6
            continue
          }
          const simple = { n: '\n', t: '\t', r: '\r', b: '\b', f: '\f', v: '\v', 0: '\0' }[escape]
          if (simple !== undefined) {
            value += simple
            end += 2
            continue
          }
          value += escape
          end += 2
          continue
        }
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
    } else if (char === '/') {
      /*
       * A comment is not code and not text. A bundle explains itself in comments,
       * and a comment holds an apostrophe as often as a word: `// the Session's
       * cwd`. A reader that takes every quote for the start of a string loses the
       * thread of the file from there on.
       */
      const comment = commentEnd(text, cursor)
      if (comment !== -1) {
        cursor = comment
        continue
      }
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
const conflicts = []
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
    /*
     * Распаковываем не весь архив, а только то, где живут словари.
     *
     * У крупных плагинов в архиве лежит ещё и рантайм (`runtime/electron-helper`,
     * 60 МБ у `dsh-pet`) — и на Windows `tar` спотыкается на таких путях, роняя всю
     * распаковку с «Archive entry has empty or unreadable filename»: два плагина
     * (`dsh-pet`, `dsh-ops`) из-за этого оставались нечитаемыми. Выборочная
     * распаковка обходит проблемные записи, а ненулевой код возврата игнорируется —
     * нужные файлы к этому моменту уже на месте.
     */
    try {
      execFileSync('tar', ['-xzf', join(work, archive), '-C', work, 'package/package.json', 'package/lib', 'package/client', 'package/dist', 'package/locale'], { stdio: 'ignore' })
    } catch {
      /* часть записей архива нечитаема — проверяем ниже, что нам нужно, на месте */
    }

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
     * The object a property of another object holds: `L.en` of `L = { zh: {…}, en: {…} }`.
     *
     * A plugin keeps both languages in one object and hands the English half to the
     * locale service: `locale.register(NS, { zh: L.zh, en: L.en })`. Reading the
     * whole `L` instead takes the Chinese half and the neighbours of the object
     * along with it — a theme, a set of style tokens — and every one of them looks
     * like a dictionary entry.
     *
     * @param identifier - the name the outer object is bound to.
     * @param property - the name of the property to read.
     * @param seen - the names already read, so a cycle cannot run forever.
     * @returns the pairs of the property, or null when it holds no object.
     */
    const propertyOf = (identifier, property, seen = new Set()) => {
      if (seen.has(`${identifier}.${property}`)) return null
      seen.add(`${identifier}.${property}`)
      const pattern = new RegExp(`(?<![.\\w$])${identifier}\\s*=\\s*(?:Object\\.freeze\\(\\s*)?\\{`, 'gu')
      for (const text of texts.values()) {
        for (const match of text.matchAll(pattern)) {
          const at = match.index + match[0].length - 1
          const inner = propertyStart(text, at, property)
          if (inner === -1) continue
          const pairs = pairsOf(text, inner, name => objectOf(name, seen))
          if (pairs.size > 0) return pairs
        }
      }
      return null
    }
    /**
     * The registrations this package makes: the namespace of each and the bundle
     * that makes it.
     *
     * The first argument of `locale.register` is the namespace, and it is read from
     * every call whatever the rest of the arguments look like: a plugin may register
     * one language at a time (`register(NS, "en", en)`), hand over both
     * (`register(NS, { zh, en })`) or wrap the call in a helper of its own
     * (`addLocale("en", KL_en)` → `register(NS, locale, dictionary)`).
     *
     * A package may register more than one namespace — `dsh-commandcode-provider`
     * registers its panel under a namespace of its own — and each registration
     * carries a dictionary of its own. So the calls are read in full, and the
     * namespace and the dictionary are taken from the same call.
     */
    const registrations = (() => {
      const found = []
      for (const [bundle, text] of texts) {
        /*
         * Регистрация бывает не только `locale.register`: плагины пишут
         * `localeService.register(...)` и `defineLocale(ID, { zh, en })`. Строгое
         * совпадение по `locale.register(` пропускало оба случая, и дальше в дело шёл
         * запасной путь — первый строковый литерал, похожий на имя. На этом и выросли
         * два призрака.
         */
        for (const call of text.matchAll(/(?:\w*[Ll]ocale\w*\.register|defineLocale)\(/gu)) {
          const open = call.index + call[0].length - 1
          const args = argumentsOf(text, open)
          if (args.length < 2) continue
          const first = args[0].text.trim()
          let namespace = null
          const literal = /^["'`]([\w.-]+)["'`]$/u.exec(first)
          if (literal !== null) namespace = literal[1]
          else if (/^[A-Za-z_$][\w$]*$/u.test(first)) namespace = constantOf(first)
          if (namespace === null || namespace.endsWith('.')) continue
          found.push({ namespace, bundle, text, args })
        }
      }
      return found
    })()
    const registration = registrations[0] ?? null
    /**
     * The English dictionary one registration hands over.
     *
     * The dictionary is the value of the `en` property of the second argument, and
     * the property may be written in three ways: an object literal of its own
     * (`{ en: {…} }`), a reference to a property of another object (`{ en: L.en }`)
     * or the shorthand (`{ en, zh }`, where `en` names the variable of that name).
     * A registration that names its language instead (`register(NS, "en", KL_en)`)
     * hands the dictionary over as the third argument.
     *
     * The namespace and the dictionary come from the same call: a package may
     * register a second namespace of its own — `dsh-commandcode-provider` has a
     * panel besides its settings — and the dictionary of one is not the dictionary
     * of the other.
     */
    const englishOfRegistration = (() => {
      for (const entry of registrations) {
        const { text, args } = entry
        const second = args[1].text.trim()
        /*
         * `register(NS, "en", KL_en)` — the dictionary is the third argument.
         */
        if (/^["'`]en["'`]$/u.test(second)) {
          const third = (args[2]?.text ?? '').trim()
          if (/^[A-Za-z_$][\w$]*$/u.test(third)) {
            const pairs = objectOf(third)
            if (pairs !== null) return pairs
          }
          continue
        }
        if (!second.startsWith('{')) continue
        const brace = text.indexOf('{', args[1].start)
        const properties = propertiesOf(text, brace)
        for (const property of properties) {
          if (property.name !== 'en') continue
          if (property.kind === 'object') {
            const pairs = pairsOf(text, property.start, name => objectOf(name))
            if (pairs.size > 0) return pairs
          }
          if (property.kind === 'member') {
            const pairs = propertyOf(property.object, property.property)
            if (pairs !== null) return pairs
          }
          if (property.kind === 'name') {
            const pairs = objectOf(property.value)
            if (pairs !== null) return pairs
          }
          break
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
        /*
         * Имя, кончающееся точкой, — это префикс, а не namespace: так в пакет попали
         * `dsh-graph.hidden-versions.` (префикс ключа localStorage) и
         * `h3.internal.event.` (префикс `Symbol.for` из h3). Оба словаря лежали под
         * именами, которые никто не спрашивает, — 1 316 строк не показывались ни разу.
         */
        if (found !== null && !found[1].endsWith('.')) return { namespace: found[1], bundle: null }
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
    /*
     * Two plugins may claim one namespace. The locale service gives it to whoever
     * registers first, and this pack registers before any plugin does — so a
     * vendored dictionary would take the namespace away from the plugin that owns
     * it. The clash is recorded, and the second claim is left out: the namespace
     * belongs to the plugin that got there first.
     */
    if (existsSync(file)) {
      const previous = JSON.parse(readFileSync(file, 'utf8'))
      conflicts.push({ namespace, kept: previous.package, dropped: name })
      report.push(`${namespace}: ПРОТИВОРЕЧИЕ — ${name}@${meta.version} и ${previous.package}@${previous.version}; оставлен ${previous.package}`)
      continue
    }
    writeFileSync(file, `${JSON.stringify(record, null, 2)}\n`, 'utf8')
    report.push(`${namespace}: ${Object.keys(record.en).length} ключей из ${name}@${meta.version}`)
  } catch (error) {
    report.push(`${name}: ПРОВАЛ — ${error.message}`)
  } finally {
    rmSync(work, { recursive: true, force: true })
  }
}
console.log(report.join('\n'))
if (conflicts.length > 0) {
  const file = join(OUT, '_conflicts.json')
  const previous = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : []
  writeFileSync(file, `${JSON.stringify([...previous, ...conflicts], null, 2)}\n`, 'utf8')
  console.log(`противоречий по namespace: ${conflicts.length}`)
}
