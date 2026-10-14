//#region src/client/typography.d.ts
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
 *
 * Text that changes after the first pass — counters, timers, progress — is
 * rewritten again, so a live «4 с» keeps its non-breaking space.
 */
/** Guillemets, em dash, ellipsis, and non-breaking spaces in running text. */
declare function applyRussianTypography(text: string): string;
/**
 * Start the typography pass on a document and keep it current as the app
 * renders. Returns a disposer that stops observing.
 *
 * @param doc - document whose body carries the rendered interface.
 * @param isActive - whether the pass may run; the rules are Russian, so a pack
 *   installed while another language is active must not rewrite that language's
 *   punctuation. Checked before every rewrite, so a language switch takes effect
 *   on the next render.
 * @returns disposer removing the observer.
 */
declare function startRussianTypography(doc: Document, isActive?: () => boolean): () => void;
//#endregion
export { applyRussianTypography, startRussianTypography };