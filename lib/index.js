//#region src/options.ts
/**
* The switches that turn the pack's extra passes off.
*
* The pack is more than a dictionary: it substitutes Russian plural forms, rewrites
* plugin titles the harness cannot translate, and applies Russian screen typography.
* Each extra can disagree with a reader who wants only the translation — typography
* in particular rewrites text the user may have typed into a form or a prompt. A
* switch disables one pass without touching the dictionaries, so the interface stays
* Russian and only the extra behaviour disappears.
*
* The switches arrive from the profile's `cordis.yml` row:
*
* ```yaml
* - id: locale-ru
*   config:
*     typography: false
* ```
*
* The browser half cannot read that row — the client boot graph carries no config —
* so the host half hands the resolved switches to the page through the webserver's
* index-injection table (see `src/index.ts`), and the browser half reads the global
* this module names. Omitting a switch means «on», so an existing profile needs no
* edit, and a surface without the webserver simply keeps the defaults.
*/
/** The switches, by their name in the config. */
const SWITCHES = [
	"typography",
	"plurals",
	"pluginNames"
];
/** The global the host half writes and the browser half reads. */
const BOOT_OPTIONS_KEY = "__DSH_RU_OPTIONS__";
/**
* Config schema without a runtime dependency.
*
* The loader accepts any Standard Schema (`~standard.validate`), and this pack ships no
* dependencies on purpose — a language pack that pulls a validator into every profile
* to read three booleans is a bad trade. An unknown switch is an error rather than a
* silent no-op: a typo in `typografy: false` would otherwise leave the pass running and
* look like the option does not work.
*/
const Config = { "~standard": {
	version: 1,
	vendor: "dsh-client-locale-ru",
	validate(value) {
		if (value === void 0 || value === null) return { value: {} };
		if (typeof value !== "object" || Array.isArray(value)) return { issues: [{ message: `опции пакета — объект: ${SWITCHES.join(", ")}` }] };
		const source = value;
		const unknown = Object.keys(source).filter((key) => !SWITCHES.includes(key));
		if (unknown.length > 0) return { issues: [{ message: `неизвестные опции: ${unknown.join(", ")}; известны: ${SWITCHES.join(", ")}` }] };
		const normalized = {};
		for (const key of SWITCHES) {
			const raw = source[key];
			if (raw === void 0) continue;
			if (typeof raw !== "boolean") return { issues: [{ message: `${key} — true или false, получено ${typeof raw}` }] };
			normalized[key] = raw;
		}
		return { value: normalized };
	}
} };
/**
* Normalize any candidate into the switches the passes read.
*
* Only booleans count: a switch that arrived as a string (`"false"`, a common YAML
* mistake) is ignored rather than treated as a truthy value, because «off» and «on»
* must not depend on how generous a cast was.
*
* @param value - the candidate, typically the row config or the injected global.
* @returns the switches that were explicitly set.
*/
function normalizeOptions(value) {
	if (value === null || typeof value !== "object" || Array.isArray(value)) return {};
	const source = value;
	const normalized = {};
	for (const key of SWITCHES) {
		const raw = source[key];
		if (typeof raw === "boolean") normalized[key] = raw;
	}
	return normalized;
}
//#endregion
//#region src/index.ts
/**
* Host plugin body.
*
* `webServer` is optional on purpose: the pack also loads on surfaces that serve no
* HTML (a desktop shell, a headless boot), and requiring the service there would keep
* the whole plugin from activating — dictionaries and all.
*
* @param ctx - host root context.
* @param config - the switches from the profile row; omitted means all on.
*/
function apply(ctx, config = {}) {
	const options = normalizeOptions(config);
	ctx.on("webserver/index-inject", (table) => {
		table.push({
			kind: "global",
			name: BOOT_OPTIONS_KEY,
			value: options
		});
	});
}
//#endregion
export { Config, apply };
