import { defineConfig } from 'tsdown'

const id = '@ragnoryok1/dsh-client-locale-ru'

export default defineConfig([
  {
    name: id,
    entry: { index: 'src/index.ts' },
    outDir: 'lib',
    format: ['esm'],
    platform: 'node',
    target: 'es2024',
    dts: true,
    clean: false,
    fixedExtension: false,
  },
  {
    name: `${id}/client`,
    entry: { client: 'src/client/index.ts' },
    outDir: 'lib',
    format: 'cjs',
    platform: 'browser',
    target: 'es2024',
    // The browser entry is a module for the client loader, wrapped by the banner
    // below; its shape is that loader contract, not a TypeScript API, and tsdown
    // cannot emit declarations for this CJS-plus-banner combination.
    dts: false,
    clean: false,
    sourcemap: true,
    outputOptions: {
      entryFileNames: 'client.js',
      banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(id)}, factory: (require) => {`,
      footer: 'return module.exports; } });',
      intro: 'var module = { exports: {} }; var exports = module.exports;',
    },
  },
  {
    name: `${id}/typography`,
    entry: { typography: 'src/client/typography.ts' },
    outDir: 'lib',
    format: ['esm'],
    platform: 'neutral',
    target: 'es2024',
    dts: true,
    clean: false,
  },
])
