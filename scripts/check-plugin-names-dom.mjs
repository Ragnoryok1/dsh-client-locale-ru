/**
 * Prove the plugin-name pass on the built browser bundle and a real document.
 *
 * A plugin's name comes from the plugin's own locale file, and the locale service
 * resolves that map without consulting dictionaries, so a language pack cannot ask the
 * host to translate it. The pass rewrites the rendered name instead; this file pins
 * down what it rewrites, what it refuses to touch, and what it does when a plugin is
 * rendered after the pass has started.
 *
 * The bundle is the published one: `lib/client.js` is a CJS module wrapped in the
 * harness's loader banner, so it is loaded in a sandbox with a fake
 * `window.__ModuleLoader__`, against a jsdom document that provides the globals the
 * pass reads.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import { test } from 'node:test'
import { JSDOM } from 'jsdom'

const bundle = fileURLToPath(new URL('../lib/client.js', import.meta.url))

/** The harness's card markup: the name opens the page, the one-liner sits below it. */
const card = `
  <li data-plugin-package="@deepseek-ai/dsh-experimental-session-search" data-plugin-status="running">
    <div class="cardHead">
      <span class="cardIcon"></span>
      <div class="cardMain">
        <div class="titleRow">
          <button type="button" class="cardTitle cardOpen" aria-label="Открыть Session search" aria-describedby="one">Session search</button>
        </div>
        <span class="cardDesc" id="one">Give Agents tools to search and read earlier sessions from the current workspace.</span>
      </div>
    </div>
  </li>`

/** The harness's row markup: a bundle part, with its name and its technical id. */
const row = `
  <li class="row" data-plugin-row="dsh-terminal">
    <div class="rowLine">
      <div class="rowMain">
        <span class="rowId">Persistent terminals</span>
        <code class="rowModule">dsh-terminal</code>
      </div>
    </div>
  </li>`

/** The harness's detail markup: the name in a heading, the one-liner under it. */
const detail = `
  <div class="detail" data-plugin-detail="@deepseek-ai/dsh-subagent-codex">
    <div class="detailMain">
      <div class="titleRow"><h3 class="detailTitle">Codex subagent</h3></div>
      <p class="detailDesc">Delegate one task to Codex using its native authentication and settings.</p>
    </div>
  </div>`

/**
 * A window with the pack loaded and applied.
 *
 * @param html - the rendered interface.
 * @param active - the language the pack sees; a test changes it to check a switch.
 * @returns the document, the pack's disposers, and the language holder.
 */
function setup(html, active = { value: 'ru' }) {
  const dom = new JSDOM(`<!doctype html><html><body>${html}</body></html>`, { pretendToBeVisual: true })
  const sandbox = vm.createContext({
    console,
    document: dom.window.document,
    MutationObserver: dom.window.MutationObserver,
    Node: dom.window.Node,
  })
  sandbox.window = sandbox
  let pack
  sandbox.__ModuleLoader__ = {
    load(module) {
      pack = module.factory(name => { throw new Error(`unexpected dependency: ${name}`) })
    },
  }
  vm.runInContext(readFileSync(bundle, 'utf8'), sandbox, { filename: bundle })
  const disposers = []
  const listeners = new Map()
  const ctx = {
    locale: {
      addLanguage: () => () => {},
      register: () => () => {},
      getLocale: () => ({ active: active.value }),
    },
    on(name, listener) {
      if (!listeners.has(name)) listeners.set(name, new Set())
      listeners.get(name).add(listener)
      return () => listeners.get(name)?.delete(listener)
    },
    effect(callback) {
      const dispose = callback()
      disposers.push(dispose)
      return dispose
    },
  }
  pack.apply(ctx)
  return {
    dom,
    body: dom.window.document.body,
    active,
    emit(name) { for (const listener of [...(listeners.get(name) ?? [])]) listener() },
    dispose() { for (const dispose of disposers.splice(0).reverse()) dispose() },
  }
}

/** Let queued mutation records be delivered. */
const settle = () => new Promise(resolve => setTimeout(resolve, 0))

/**
 * The text without the non-breaking spaces the typography pass adds.
 *
 * The two passes compose: the name pass puts the Russian text in place, and the
 * typography pass then keeps a short word with the word that follows it. Comparing
 * the plain text keeps these cases about the name, and one case below pins the
 * composition itself.
 *
 * @param text - the rendered text.
 * @returns the text with ordinary spaces.
 */
const plain = text => text.replace(/ /gu, ' ')

test('the name and the one-liner of a card are translated', () => {
  const { body, dispose } = setup(card)
  assert.equal(plain(body.querySelector('button').textContent), 'Поиск по сессиям')
  assert.equal(
    plain(body.querySelector('.cardDesc').textContent),
    'Даёт агентам инструменты для поиска и чтения прежних сессий этой рабочей области.',
  )
  dispose()
})

test('the Russian name keeps the typography of a short word', async () => {
  const { body, dispose } = setup(card)
  await settle()
  assert.equal(body.querySelector('button').textContent, 'Поиск по сессиям')
  dispose()
})

test('the accessible name carries the Russian name too', () => {
  const { body, dispose } = setup(card)
  assert.equal(plain(body.querySelector('button').getAttribute('aria-label')), 'Открыть Поиск по сессиям')
  dispose()
})

test('a row of a bundle is translated, its technical id is not', () => {
  const { body, dispose } = setup(row)
  assert.equal(body.querySelector('.rowId').textContent, 'Постоянные терминалы')
  assert.equal(body.querySelector('code').textContent, 'dsh-terminal')
  dispose()
})

test('the name and the one-liner of a detail page are translated', () => {
  const { body, dispose } = setup(detail)
  assert.equal(body.querySelector('h3').textContent, 'Субагент Codex')
  assert.equal(
    plain(body.querySelector('.detailDesc').textContent),
    'Передаёт одну задачу в Codex с его собственными настройками и авторизацией.',
  )
  dispose()
})

test('a sentence that mentions a name keeps its wording', () => {
  const { body, dispose } = setup('<p>Install Session search to find a conversation faster</p>')
  assert.equal(body.querySelector('p').textContent, 'Install Session search to find a conversation faster')
  dispose()
})

test('code, form fields and the conversation are left alone', () => {
  const { body, dispose } = setup(`
    <code>Session search</code>
    <input value="Persistent terminals">
    <div data-conversation-region="chat"><p>Persistent terminals</p></div>`)
  assert.equal(body.querySelector('code').textContent, 'Session search')
  assert.equal(body.querySelector('input').getAttribute('value'), 'Persistent terminals')
  assert.equal(body.querySelector('[data-conversation-region="chat"] p').textContent, 'Persistent terminals')
  dispose()
})

test('a plugin rendered after the pass started is translated', async () => {
  const { dom, body, dispose } = setup('<p>Plugins</p>')
  const list = dom.window.document.createElement('li')
  list.setAttribute('data-plugin-package', '@deepseek-ai/dsh-experimental-session-search')
  list.innerHTML = '<button>Session search</button>'
  body.appendChild(list)
  await settle()
  assert.equal(plain(body.querySelector('button').textContent), 'Поиск по сессиям')
  dispose()
})

test('the pass stays out of a language whose names it does not own', async () => {
  const { dom, body, dispose } = setup('<p>Plugins</p>', { value: 'en' })
  const list = dom.window.document.createElement('li')
  list.innerHTML = '<button>Session search</button>'
  body.appendChild(list)
  await settle()
  assert.equal(body.querySelector('button').textContent, 'Session search')
  dispose()
})

test('a language switch takes effect on the next render', async () => {
  const { dom, body, active, emit, dispose } = setup('<p>Plugins</p>')
  const list = dom.window.document.createElement('li')
  list.innerHTML = '<button>Session search</button>'
  body.appendChild(list)
  await settle()
  assert.equal(plain(body.querySelector('button').textContent), 'Поиск по сессиям')

  active.value = 'en'
  emit('locale/change')
  dom.window.document.querySelector('button').firstChild.data = 'Session search'
  await settle()
  assert.equal(body.querySelector('button').textContent, 'Session search')
  dispose()
})

test('the disposer stops the pass', async () => {
  const { dom, body, dispose } = setup('<p>Plugins</p>')
  dispose()
  const list = dom.window.document.createElement('li')
  list.innerHTML = '<button>Session search</button>'
  body.appendChild(list)
  await settle()
  assert.equal(body.querySelector('button').textContent, 'Session search')
})
