/**
 * Prove the typography pass on a real document, not on a string.
 *
 * The pure-function cases live in `check-typography.mjs`; this file exercises the
 * DOM half — what the pass walks, what it refuses to touch, and what it does when
 * text changes after the first pass. That last one was broken: a live counter or a
 * running timer kept its value but lost the non-breaking space, because the node
 * stayed marked as already processed.
 *
 * `lib/typography.js` reads `MutationObserver` and `Node` as globals, the way a
 * browser provides them, so the test installs jsdom's.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { JSDOM } from 'jsdom'
import { startRussianTypography } from '../lib/typography.js'

const NBSP = '\u00A0'

/** Fresh window with the globals the module expects, and a body to observe. */
function setup(html, isActive) {
  const dom = new JSDOM(`<!doctype html><html><body>${html}</body></html>`, { pretendToBeVisual: true })
  globalThis.MutationObserver = dom.window.MutationObserver
  globalThis.Node = dom.window.Node
  const dispose = startRussianTypography(dom.window.document, isActive)
  return { dom, dispose, body: dom.window.document.body }
}

/** Let queued mutation records be delivered. */
const settle = () => new Promise(resolve => setTimeout(resolve, 0))

test('rendered text is rewritten on the first pass', () => {
  const { body, dispose } = setup('<p>Нажмите "Сохранить" для продолжения</p>')
  assert.equal(body.textContent, 'Нажмите «Сохранить» для продолжения')
  dispose()
})

test('text that changes later is rewritten again', async () => {
  const { dom, body, dispose } = setup('<span>за 5 ч</span>')
  assert.equal(body.textContent, `за 5${NBSP}ч`)

  // A live counter, a timer, a progress figure: the node object stays, its value
  // does not.
  dom.window.document.querySelector('span').firstChild.data = 'за 4 ч'
  await settle()
  assert.equal(body.textContent, `за 4${NBSP}ч`)
  dispose()
})

test('added subtrees are rewritten, and code is left alone', async () => {
  const { dom, body, dispose } = setup('<code>Нажмите "Сохранить"</code>')
  assert.equal(body.textContent, 'Нажмите "Сохранить"')

  const paragraph = dom.window.document.createElement('p')
  paragraph.textContent = 'параметр - значение'
  body.appendChild(paragraph)
  await settle()
  assert.equal(paragraph.textContent, 'параметр — значение')
  dispose()
})

test('the conversation is left alone, the interface around it is not', () => {
  const { body, dispose } = setup(
    '<p>Нажмите "Сохранить" для продолжения</p>'
    + '<div data-conversation-region="chat"><p>Он сказал: "это важно" - и ушёл</p></div>',
  )
  // The label is the pack's own text: it is rewritten.
  assert.equal(body.querySelector('p').textContent, 'Нажмите «Сохранить» для продолжения')
  // The message is the user's and the model's: it stays as it was written.
  assert.equal(
    body.querySelector('[data-conversation-region="chat"] p').textContent,
    'Он сказал: "это важно" - и ушёл',
  )
  dispose()
})

test('the disposer stops the pass', async () => {
  const { dom, body, dispose } = setup('<span>за 5 ч</span>')
  dispose()
  dom.window.document.querySelector('span').firstChild.data = 'за 4 ч'
  await settle()
  assert.equal(body.textContent, 'за 4 ч')
})

test('the pass stays out of a language whose punctuation it does not own', async () => {
  const { dom, body, dispose } = setup('<p>Settings - Plugins and "quotes"</p><span>за 5 ч</span>', () => false)
  assert.equal(body.textContent, 'Settings - Plugins and "quotes"за 5 ч')
  dispose()
})

test('a language switch takes effect on the next render', async () => {
  let russian = false
  const { dom, body, dispose } = setup('<p>"quotes" and a - dash</p>', () => russian)

  // English is active: the text is left exactly as rendered.
  assert.equal(body.textContent, '"quotes" and a - dash')

  russian = true
  dom.window.document.querySelector('p').firstChild.data = '"quotes" and a - dash'
  await settle()
  assert.equal(body.textContent, '«quotes» and a — dash')

  // Switching back leaves the text alone again.
  russian = false
  dom.window.document.querySelector('p').firstChild.data = 'plain - text'
  await settle()
  assert.equal(body.textContent, 'plain - text')
  dispose()
})
