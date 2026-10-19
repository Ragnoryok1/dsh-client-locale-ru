/**
 * The patch that carries the Russian plugin names into the harness.
 *
 * A plugin's name comes from `locale/<language>.json` inside its own package, and the
 * locale service resolves that map without consulting dictionaries, so the only way to
 * give a plugin a Russian name is to add that file to the package. This module builds
 * that patch: one new `locale/ru.json` per translated plugin, with the `meta` keys the
 * package's own `locale/en.json` declares and no others.
 *
 * The patch is a build artefact, not a source: it is generated from the translations
 * and the tree, and the gate fails when the committed file and the generated one differ.
 */
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { basename, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

/** The translations the patch carries. */
export function readTranslations() {
  return JSON.parse(readFileSync(new URL('../src/client/descriptor-ru.json', import.meta.url), 'utf8'))
}

/** Package name -> directory of its `locale` folder, for every package that ships one. */
function localeByPackage(directory, out = new Map()) {
  let manifest = null
  try {
    manifest = JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8'))
  } catch {
    /* Not a package directory. */
  }
  const localeDirectory = join(directory, 'locale')
  if (manifest?.name !== undefined && existsSync(join(localeDirectory, 'en.json'))) {
    out.set(manifest.name, localeDirectory)
    return out
  }
  for (const entry of readdirSync(directory)) {
    if (entry === 'node_modules' || entry === 'lib' || entry === 'dist' || entry === 'locale') continue
    const path = join(directory, entry)
    if (statSync(path).isDirectory()) localeByPackage(path, out)
  }
  return out
}

/** The git blob hash of a file's content, as the `index` line of a diff carries it. */
function blobHash(content) {
  const bytes = Buffer.from(content, 'utf8')
  return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex').slice(0, 10)
}

/** One new-file diff, in the shape `git apply` reads. */
function newFileDiff(path, content) {
  const lines = content.split('\n')
  const body = lines.slice(0, -1).map(line => `+${line}`).join('\n')
  return [
    `diff --git a/${path} b/${path}`,
    'new file mode 100644',
    `index 0000000000..${blobHash(content)}`,
    '--- /dev/null',
    `+++ b/${path}`,
    `@@ -0,0 +1,${lines.length - 1} @@`,
    body,
  ].join('\n')
}

/**
 * Build the patch for a harness tree.
 *
 * @param root - the tree's `packages` directory.
 * @returns the patch text, and the packages the tree did not carry.
 */
export function buildPatch(root, translations = readTranslations()) {
  const located = localeByPackage(root)
  /* The patch is applied from the repository root, so the paths carry the tree's own name. */
  const prefix = `${basename(root)}/`
  const files = []
  const missing = []
  for (const [specifier, fields] of Object.entries(translations)) {
    const localeDirectory = located.get(specifier)
    if (localeDirectory === undefined) {
      missing.push(specifier)
      continue
    }
    const english = JSON.parse(readFileSync(join(localeDirectory, 'en.json'), 'utf8'))
    const wanted = {}
    /* Only the fields English declares: an extra key would be a shape mismatch, not a translation. */
    if (english.meta?.title !== undefined && fields.title !== undefined) wanted.title = fields.title
    if (english.meta?.description !== undefined && fields.description !== undefined) wanted.description = fields.description
    if (Object.keys(wanted).length === 0) continue
    const content = `${JSON.stringify({ meta: wanted }, null, 2)}\n`
    files.push({ path: prefix + relative(root, join(localeDirectory, 'ru.json')).replace(/\\/gu, '/'), content })
  }
  files.sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0)
  return { patch: `${files.map(file => newFileDiff(file.path, file.content)).join('\n')}\n`, files, missing }
}

/** The committed patch, with its line endings as the working tree holds them. */
export function readCommittedPatch() {
  return readFileSync(fileURLToPath(new URL('../docs/harness-descriptors-ru.patch', import.meta.url)), 'utf8')
}
