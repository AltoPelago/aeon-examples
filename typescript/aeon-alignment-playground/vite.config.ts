import { defineConfig } from 'vite';

const aeonPackageSource = process.env.AEON_PACKAGE_SOURCE === 'local' ? 'local' : 'npm';
const localPackageRoot = new URL(
  '../../../aeon/implementations/typescript/packages/',
  import.meta.url,
).pathname;
const localSansaEntry = new URL(
  '../../../sansa/src/index.js',
  import.meta.url,
).pathname;

const aeonAliases = aeonPackageSource === 'local'
  ? {
      '@altopelago/aeon-aes': `${localPackageRoot}aes/dist/index.js`,
      '@altopelago/aeon-annotation-stream': `${localPackageRoot}annotation-stream/dist/index.js`,
      '@altopelago/aeon-canonical': `${localPackageRoot}canonical/dist/index.js`,
      '@altopelago/aeon-core': `${localPackageRoot}core/dist/index.js`,
      '@altopelago/aeon-finalize': `${localPackageRoot}finalize/dist/index.js`,
      '@altopelago/aeon-lexer': `${localPackageRoot}lexer/dist/index.js`,
      '@altopelago/aeon-parser': `${localPackageRoot}parser/dist/index.js`,
      '@altopelago/aeon-wasm': `${localPackageRoot}wasm/dist/index.js`,
      '@altopelago/sansa': localSansaEntry,
    }
  : {};

const wasmArtifactPath = aeonPackageSource === 'local'
  ? `${localPackageRoot}wasm/pkg/aeon_wasm_bg.wasm`
  : new URL(
      './node_modules/@altopelago/aeon-wasm/pkg/aeon_wasm_bg.wasm',
      import.meta.url,
    ).pathname;

function aeonWasmArtifactPlugin() {
  return {
    name: 'aeon-playground-wasm-artifact',
    resolveId(id: string) {
      return id === '@aeon-playground/wasm-artifact' ? id : null;
    },
    load(id: string) {
      if (id !== '@aeon-playground/wasm-artifact') {
        return null;
      }

      return `import wasmUrl from ${JSON.stringify(`${wasmArtifactPath}?url`)};\nexport default wasmUrl;\n`;
    },
  };
}

export default defineConfig({
  clearScreen: false,
  plugins: [aeonWasmArtifactPlugin()],
  resolve: {
    alias: aeonAliases,
  },
  server: {
    fs: {
      allow: [
        new URL('../../..', import.meta.url).pathname,
      ],
    },
    port: 5173,
    strictPort: true,
  },
});
