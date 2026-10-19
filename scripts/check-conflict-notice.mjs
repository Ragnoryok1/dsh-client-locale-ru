/**
 * Proves that the pack says out loud when it loses the language to another pack.
 *
 * The locale registry gives the language to whoever registers it first, so a second
 * Russian pack keeps the language and drops its own dictionaries — silently, until the user
 * reads someone else's Russian and thinks this pack is broken. The client half has only the
 * console to say so, and this check loads the built bundle with a registry that refuses
 * every registration, then reads what was printed.
 *
 * Usage: node scripts/check-conflict-notice.mjs
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const bundle = join(ROOT, 'lib', 'client.js')

const warnings = []
const sandbox = vm.createContext({
  document: { body: null, querySelector: () => ({}) },
  navigator: { language: 'ru', languages: ['ru'] },
  console: {
    warn: message => warnings.push(String(message)),
    info: () => {},
    log: () => {},
    error: () => {},
  },
})
sandbox.window = sandbox

let apply = null
sandbox.__ModuleLoader__ = {
  load(module) {
    const factory = module.factory(() => ({}))
    if (typeof factory.apply === 'function') apply = factory.apply
  },
}
vm.runInContext(readFileSync(bundle, 'utf8'), sandbox, { filename: bundle })
assert.equal(typeof apply, 'function', 'бандл не отдал функцию apply')

/* The bundle lives in the sandbox realm, so its `instanceof Error` sees the sandbox's
   * constructor, not the host's. */
const SandboxError = vm.runInContext('Error', sandbox)

/* A registry where the language and every namespace are already taken. */
const ctx = {
  effect: callback => callback(),
  on: () => () => {},
  locale: {
    addLanguage() {
      throw new SandboxError('locale "ru" is already registered')
    },
    register(namespace) {
      throw new SandboxError(`locale namespace "${namespace}" already has locale "ru"`)
    },
    getLocale: () => ({ active: 'ru' }),
  },
}

apply(ctx)

assert.ok(warnings.length > 0, 'пакет промолчал, хотя язык заняли')
const message = warnings.join('\n')
assert.match(message, /dsh-client-locale-ru/u, 'в сообщении нет имени пакета')
assert.match(message, /ru/u, 'в сообщении нет языка')
assert.match(message, /namespace/u, 'в сообщении нет числа потерянных namespace')
console.log(`пакет сообщает о конфликте: «${message.trim()}»`)
