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
 */
/** Guillemets, em dash, ellipsis, and non-breaking spaces in running text. */
declare function applyRussianTypography(text: string): string;
/**
 * Start the typography pass on a document and keep it current as the app
 * renders. Returns a disposer that stops observing.
 *
 * @param doc - document whose body carries the rendered interface.
 * @returns disposer removing the observer.
 */
declare function startRussianTypography(doc: Document): () => void;
//#endregion
export { applyRussianTypography, startRussianTypography };