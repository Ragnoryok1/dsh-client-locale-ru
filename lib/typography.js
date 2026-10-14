//#region src/client/typography.ts
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
/** Straight double quotes around a span become Russian guillemets. */
const QUOTED = /"([^"\n]{1,200})"/g;
/** A spaced hyphen between two words is an em dash in Russian typography. */
const SPACED_HYPHEN = /(?<=[\p{L}\p{N}»\)]) - (?=[\p{L}\p{N}«\(])/gu;
/** Three dots in running text are an ellipsis. */
const ELLIPSIS = /\.{3}(?=\s|$)/g;
/** A digit followed by a lowercase letter keeps a non-breaking space. */
const NUMBER_UNIT = /(\d) ([а-яё]{1,24})(?![а-яё])/giu;
/** Non-breaking space keeps a number attached to a short unit-like token. */
const NUMBER_SYMBOL = /(\d) ([%°₽$€£]|кб|КБ|МБ|ГБ)(?=\s|$)/giu;
/**
* A short word — a preposition, a conjunction or a particle — keeps the word
* that follows it, so a line break cannot leave it alone at the end of a line.
* Russian typography forbids a one-letter word there and discourages a
* two-letter one, and the list holds only the words that never carry stress.
*
* A numeric range rule would be the obvious neighbour — Russian writes ranges
* with an en dash — but the pack's only digit-hyphen-digit string is the cron
* example `0 9 * * 1-5`, which an en dash would corrupt. Measured, and left out.
*/
const SHORT_WORD = /(?<=^|[\s(«"—])((?:в|во|на|за|к|ко|с|со|о|об|от|до|по|из|у|и|а|но|да|не|ни|же|ли|бы|то)) (?=[«"(]?[а-яё])/giu;
/** Guillemets, em dash, ellipsis, and non-breaking spaces in running text. */
function applyRussianTypography(text) {
	return text.replace(QUOTED, "«$1»").replace(SPACED_HYPHEN, " — ").replace(ELLIPSIS, "…").replace(NUMBER_UNIT, "$1\xA0$2").replace(NUMBER_SYMBOL, "$1\xA0$2").replace(SHORT_WORD, "$1\xA0");
}
/** Elements whose text is code, data or user input and must stay verbatim. */
const SKIP_SELECTOR = [
	"code",
	"pre",
	"kbd",
	"samp",
	"var",
	"textarea",
	"input",
	"select",
	"option",
	"[contenteditable]:not([contenteditable=\"false\"])",
	"[data-typography=\"off\"]"
].join(",");
/** Whether the node sits inside content that must not be rewritten. */
function isSkipped(node) {
	const element = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
	return element === null || element.closest(SKIP_SELECTOR) !== null;
}
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
function startRussianTypography(doc, isActive = () => true) {
	const root = doc.body;
	if (root === null) return () => {};
	/** Text nodes already rewritten, so a batch of mutations does not re-walk them. */
	const processed = /* @__PURE__ */ new WeakSet();
	function rewriteNode(node) {
		if (!isActive()) return;
		if (node.nodeType === Node.TEXT_NODE) {
			if (processed.has(node)) return;
			processed.add(node);
			const before = node.data;
			const after = applyRussianTypography(before);
			if (after !== before) node.data = after;
			return;
		}
		if (node.nodeType !== Node.ELEMENT_NODE || isSkipped(node)) return;
		for (const child of node.childNodes) rewriteNode(child);
	}
	rewriteNode(root);
	const observer = new MutationObserver((records) => {
		for (const record of records) {
			if (record.type === "characterData") {
				if (isSkipped(record.target)) continue;
				processed.delete(record.target);
				rewriteNode(record.target);
				continue;
			}
			for (const added of record.addedNodes) rewriteNode(added);
		}
	});
	observer.observe(root, {
		childList: true,
		characterData: true,
		subtree: true
	});
	return () => observer.disconnect();
}
//#endregion
export { applyRussianTypography, startRussianTypography };
