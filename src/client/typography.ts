/**
 * Russian screen typography for translated strings.
 *
 * The harness locale contract is a flat `Record<string, string>`, so a
 * language pack cannot reach the composed sentences a component builds from
 * several keys, and cannot ask the host to insert typography. The rendered DOM
 * is the one place where every translated string passes through, so this module
 * rewrites text nodes in place. The rules are deliberately conservative: they
 * only fire on unambiguous straight-quote and spaced-hyphen patterns, and the
 * DOM pass skips code, form fields and editable content.
 */

/** Straight double quotes around a span become Russian guillemets. */
const QUOTED = /"([^"\n]{1,200})"/g

/** A spaced hyphen between two words is an em dash in Russian typography. */
const SPACED_HYPHEN = /(?<=[\p{L}\p{N}»\)]) - (?=[\p{L}\p{N}«\(])/gu

/** Three dots in running text are an ellipsis. */
const ELLIPSIS = /\.{3}(?=\s|$)/g

/** A digit followed by a lowercase letter keeps a non-breaking space. */
const NUMBER_UNIT = /(\d) ([а-яё]{1,24})(?![а-яё])/giu

/** Non-breaking space keeps a number attached to a short unit-like token. */
const NUMBER_SYMBOL = /(\d) ([%°₽$€£]|кб|КБ|МБ|ГБ)(?=\s|$)/giu

/** Guillemets, em dash, ellipsis, and non-breaking spaces in running text. */
export function applyRussianTypography(text: string): string {
  return text
    .replace(QUOTED, '«$1»')
    .replace(SPACED_HYPHEN, ' — ')
    .replace(ELLIPSIS, '…')
    .replace(NUMBER_UNIT, '$1\u00A0$2')
    .replace(NUMBER_SYMBOL, '$1\u00A0$2')
}

/** Elements whose text is code, data or user input and must stay verbatim. */
const SKIP_SELECTOR = [
  'code', 'pre', 'kbd', 'samp', 'var', 'textarea', 'input', 'select', 'option',
  '[contenteditable]:not([contenteditable="false"])',
  '[data-typography="off"]',
].join(',')

/** Text nodes already rewritten, so a later pass leaves them alone. */
const processed = new WeakSet<Text>()

/** Whether the node sits inside content that must not be rewritten. */
function isSkipped(node: Node): boolean {
  const element = node.nodeType === Node.ELEMENT_NODE
    ? (node as Element)
    : (node as Text).parentElement
  return element === null || element.closest(SKIP_SELECTOR) !== null
}

function rewriteNode(node: Node): void {
  if (node.nodeType === Node.TEXT_NODE) {
    if (processed.has(node as Text)) return
    processed.add(node as Text)
    const before = (node as Text).data
    const after = applyRussianTypography(before)
    if (after !== before) (node as Text).data = after
    return
  }
  if (node.nodeType !== Node.ELEMENT_NODE || isSkipped(node)) return
  for (const child of (node as Element).childNodes) rewriteNode(child)
}

/**
 * Start the typography pass on a document and keep it current as the app
 * renders. Returns a disposer that stops observing.
 *
 * @param doc - document whose body carries the rendered interface.
 * @returns disposer removing the observer.
 */
export function startRussianTypography(doc: Document): () => void {
  const root = doc.body
  if (root === null) return () => {}
  rewriteNode(root)
  const observer = new MutationObserver(records => {
    for (const record of records) {
      if (record.type === 'characterData') {
        if (isSkipped(record.target)) continue
        rewriteNode(record.target)
        continue
      }
      for (const added of record.addedNodes) rewriteNode(added)
    }
  })
  observer.observe(root, { childList: true, characterData: true, subtree: true })
  return () => observer.disconnect()
}
