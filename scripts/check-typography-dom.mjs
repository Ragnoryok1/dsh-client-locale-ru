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
function setup(html) {
  const dom = new JSDOM(`<!doctype html><html><body>${html}</body></html>`, { pretendToBeVisual: true })
  globalThis.MutationObserver = dom.window.MutationObserver
  globalThis.Node = dom.window.Node
  const dispose = startRussianTypography(dom.window.document)
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

test('the disposer stops the pass', async () => {
  const { dom, body, dispose } = setup('<span>за 5 ч</span>')
  dispose()
  dom.window.document.querySelector('span').firstChild.data = 'за 4 ч'
  await settle()
  assert.equal(body.textContent, 'за 4 ч')
})
