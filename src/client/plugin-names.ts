/**
 * Russian names and descriptions for the plugins the harness cannot translate.
 *
 * A plugin's title comes from `locale/<language>.json` inside its own package, and the
 * locale service resolves that map without consulting registered dictionaries — its own
 * documentation says «maps do not consult registered dictionaries». A language pack
 * therefore cannot translate a plugin's name while the plugin ships no Russian locale:
 * the English title is the only title there is.
 *
 * The rendered DOM is the one place where that title passes through, so this module
 * rewrites it in place, the way the typography rules rewrite punctuation. The pack
 * carries the translations itself, with the English text they were made from, so a
 * match is exact: a title is replaced only when the whole string is one of the names
 * this pack knows. Text that merely mentions a name is left alone, and so is code,
 * form fields and the conversation.
 *
 * The pass follows the active language like the typography pass: the names are Russian,
 * so an English interface must keep its English names.
 */
import descriptors from './descriptor-ru.json'
import { SKIP_SELECTOR } from './typography.ts'

/** One plugin's English text and the Russian text that replaces it. */
export interface PluginText {
  /** The English title or description, exactly as the plugin ships it. */
  readonly english: string
  /** The Russian title or description. */
  readonly russian: string
}

/** The English text of one plugin, with the translation made from it. */
interface Descriptor {
  readonly title?: string
  readonly description?: string
  readonly en?: { readonly title?: string, readonly description?: string }
}

/**
 * The texts the pass replaces, longest English first: a shorter name that is a prefix
 * of a longer one must not claim the longer one's place.
 */
function collectTexts(): PluginText[] {
  const texts: PluginText[] = []
  for (const fields of Object.values(descriptors) as Descriptor[]) {
    for (const field of ['title', 'description'] as const) {
      const english = fields.en?.[field]
      const russian = fields[field]
      /* A name that is the same in both languages — a brand — has nothing to replace. */
      if (english === undefined || russian === undefined || english === russian) continue
      texts.push({ english, russian })
    }
  }
  return texts.sort((left, right) => right.english.length - left.english.length)
}

/** Every text the pass knows, by its English form. */
const TEXTS = collectTexts()

/** The English text of each plugin title and description, longest first. */
const ENGLISH = TEXTS.map(text => text.english)

/** The Russian text of each plugin title and description, by its English form. */
const RUSSIAN = new Map(TEXTS.map(text => [text.english, text.russian]))

/** The attributes that carry a plugin name: an accessible name and a tooltip. */
const NAME_ATTRIBUTES = ['aria-label', 'title']

/**
 * Whether the node sits inside content that must not be rewritten: code, data, user
 * input, and the conversation.
 *
 * @param node - the text node or element to test.
 * @returns whether the node is off limits.
 */
function isSkipped(node: Node): boolean {
  const element = node.nodeType === Node.ELEMENT_NODE
    ? (node as Element)
    : (node as Text).parentElement
  return element === null || element.closest(SKIP_SELECTOR) !== null
}

/**
 * The Russian text for an exact English title or description.
 *
 * @param text - the rendered text.
 * @returns the Russian text, or undefined when the text is not a known plugin name.
 */
function russianFor(text: string): string | undefined {
  const trimmed = text.trim()
  if (trimmed === '') return undefined
  return RUSSIAN.get(trimmed)
}

/**
 * Replace a name inside a longer string, such as an accessible name that reads
 * «Открыть Session Log».
 *
 * @param value - the attribute value.
 * @returns the value with every known name replaced.
 */
function russianNamesIn(value: string): string {
  let out = value
  for (const english of ENGLISH) {
    if (!out.includes(english)) continue
    out = out.split(english).join(RUSSIAN.get(english) as string)
  }
  return out
}

/**
 * Start the plugin-name pass on a document and keep it current as the app renders.
 * Returns a disposer that stops observing.
 *
 * @param doc - document whose body carries the rendered interface.
 * @param isActive - whether the pass may run; the names are Russian, so a pack
 *   installed while another language is active must not translate that language's
 *   plugin names. Checked before every rewrite, so a language switch takes effect on
 *   the next render.
 * @returns disposer removing the observer.
 */
export function startRussianPluginNames(doc: Document, isActive: () => boolean = () => true): () => void {
  const root = doc.body
  if (root === null) return () => {}

  function rewriteElement(element: Element): void {
    if (!isActive()) return
    for (const name of NAME_ATTRIBUTES) {
      const value = element.getAttribute(name)
      if (value === null) continue
      const after = russianNamesIn(value)
      if (after !== value) element.setAttribute(name, after)
    }
    for (const child of element.childNodes) rewriteNode(child)
  }

  function rewriteNode(node: Node): void {
    if (!isActive()) return
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node as Text
      const russian = russianFor(text.data)
      if (russian !== undefined) text.data = text.data.replace(text.data.trim(), russian)
      return
    }
    if (node.nodeType !== Node.ELEMENT_NODE || isSkipped(node)) return
    rewriteElement(node as Element)
  }

  rewriteNode(root)
  const observer = new MutationObserver(records => {
    for (const record of records) {
      if (record.type === 'characterData') {
        rewriteNode(record.target)
        continue
      }
      if (record.type === 'attributes') {
        const element = record.target
        if (element.nodeType !== Node.ELEMENT_NODE || isSkipped(element)) continue
        rewriteElement(element as Element)
        continue
      }
      for (const added of record.addedNodes) rewriteNode(added)
    }
  })
  observer.observe(root, {
    childList: true,
    characterData: true,
    subtree: true,
    attributes: true,
    attributeFilter: NAME_ATTRIBUTES,
  })
  return () => observer.disconnect()
}
