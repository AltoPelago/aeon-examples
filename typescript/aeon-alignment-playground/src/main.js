import { processWithRustWasm, processWithTypeScriptCore } from './playground-processor.js';
import { parseSchemaText, schemaToAeon } from './schema-codec.js';
import { BUILTIN_SCHEMA_TYPES_BY_DATATYPE, seedSchemaFromAeonSource } from './schema-seed.js';
import { compile, formatPath } from '@altopelago/aeon-core';

const SAMPLE = `//# AEON alignment playground sample
aeon:header = {
  mode:string = "strict"
  encoding:string = "utf-8"
  profile:string = "aeon.gp.profile.v1"
  version:string = "1"
}

app:object = {
  name:string = "alignment playground"
  enabled:boolean = true
  port:number = 8080
  tags:list = ["browser", "wasm", "aeon"]
  note:string = "Select Rust or TypeScript, then process."
}`;

const SAMPLE_SCHEMA = {
  world: 'open',
  rules: [
    { path: '$.app', constraints: { type: 'ObjectNode', required: true } },
    { path: '$.app.name', constraints: { type: 'StringLiteral', required: true, min_length: 1 } },
    { path: '$.app.enabled', constraints: { type: 'BooleanLiteral', required: true } },
    { path: '$.app.port', constraints: { type: 'NumberLiteral', required: true, sign: 'unsigned', min_value: '1', max_value: '65535' } },
    { path: '$.app.tags', constraints: { type: 'ListNode', required: true } },
    { selector: '$.app.tags.*', constraints: { type: 'StringLiteral' } },
  ],
};

const outputState = {
  canonical: '',
  aes: '',
  finalized: '',
  annotations: '',
  comparison: '',
  view: 'canonical',
};

const SAMPLE_PRESETS = {
  strict: {
    source: SAMPLE,
    settings: {
      validationMode: 'strict',
      separatorDepth: '8',
      attributeDepth: '1',
      genericDepth: '1',
      materializationMode: 'all',
      finalizeScope: 'payload',
      includePaths: '',
      schemaEnabled: false,
      schemaText: schemaToAeon(SAMPLE_SCHEMA),
    },
  },
  transport: {
    source: `//# Transport validation sample
aeon:header = {
  mode:string = "transport"
  encoding:string = "utf-8"
  profile:string = "aeon.gp.profile.v1"
  version:string = "1"
}

app = {
  name = "transport playground"
  enabled = on
  port = 8080
  retries = 3
}`,
    settings: {
      validationMode: 'transport',
      separatorDepth: '8',
      attributeDepth: '1',
      genericDepth: '1',
      materializationMode: 'all',
      finalizeScope: 'payload',
      includePaths: '',
      schemaEnabled: false,
      schemaText: schemaToAeon({ ...SAMPLE_SCHEMA, world: 'open' }),
    },
  },
  sansa: {
    source: `//# SANSA Address literal sample
aeon:header = {
  mode:string = "strict"
  encoding:string = "utf-8"
  profile:string = "aeon.gp.profile.v1"
  version:string = "1"
}

csv:sansa = $.inventory:csv[","]
ctx:sansa = ?.name
sku:sansa = $.inventory.items[2].sku`,
    settings: {
      validationMode: 'strict',
      separatorDepth: '8',
      attributeDepth: '1',
      genericDepth: '1',
      materializationMode: 'all',
      finalizeScope: 'payload',
      includePaths: '',
      schemaEnabled: false,
      schemaText: schemaToAeon({ ...SAMPLE_SCHEMA, world: 'open' }),
    },
  },
  custom: {
    source: `//# Custom datatype sample
aeon:header = {
  mode:string = "strict"
  encoding:string = "utf-8"
  profile:string = "aeon.gp.profile.v1"
  version:string = "1"
}

app:object = {
  name:string = "custom playground"
  accent:brandcolor = "neon-sunrise"
  status:phase = "prototype"
}`,
    settings: {
      validationMode: 'custom',
      separatorDepth: '8',
      attributeDepth: '1',
      genericDepth: '1',
      materializationMode: 'all',
      finalizeScope: 'payload',
      includePaths: '',
      schemaEnabled: false,
      schemaText: schemaToAeon(SAMPLE_SCHEMA),
    },
  },
};

let currentFilePath = null;
let lastProcessor = 'typescript';

const sourceEl = document.getElementById('source');
const processTsBtn = document.getElementById('process-ts');
const processRustBtn = document.getElementById('process-rust');
const processCompareBtn = document.getElementById('process-compare');
const validationModeEl = document.getElementById('validation-mode');
const separatorDepthEl = document.getElementById('separator-depth');
const attributeDepthEl = document.getElementById('attribute-depth');
const genericDepthEl = document.getElementById('generic-depth');
const materializationModeEl = document.getElementById('materialization-mode');
const finalizeScopeEl = document.getElementById('finalize-scope');
const includePathsEl = document.getElementById('include-paths');
const schemaEnabledEl = document.getElementById('schema-enabled');
const schemaInputEl = document.getElementById('schema-input');
const schemaBuilderOpenBtn = document.getElementById('schema-builder-open');
const schemaSampleBtn = document.getElementById('schema-sample');
const sourceBuilderOpenBtn = document.getElementById('source-builder-open');
const sourceBuilderModalEl = document.getElementById('source-builder-modal');
const sourceBuilderCloseBtn = document.getElementById('source-builder-close');
const sourceBuilderApplyBtn = document.getElementById('source-builder-apply');
const sourceBuilderLoadSourceBtn = document.getElementById('source-builder-load-source');
const sourceAddPeerBtn = document.getElementById('source-add-peer');
const sourceAddChildBtn = document.getElementById('source-add-child');
const sourceAddAttributeBtn = document.getElementById('source-add-attribute');
const sourceRuleListEl = document.getElementById('source-rule-list');
const sourceDetailEl = document.getElementById('source-detail');
const schemaBuilderModalEl = document.getElementById('schema-builder-modal');
const schemaBuilderCloseBtn = document.getElementById('schema-builder-close');
const schemaBuilderApplyBtn = document.getElementById('schema-builder-apply');
const schemaBuilderWorldEl = document.getElementById('schema-builder-world');
const schemaAddPeerBtn = document.getElementById('schema-add-peer');
const schemaAddChildBtn = document.getElementById('schema-add-child');
const schemaAddChildManyBtn = document.getElementById('schema-add-child-many');
const schemaAddAttributeBtn = document.getElementById('schema-add-attribute');
const schemaSeedSourceBtn = document.getElementById('schema-seed-source');
const schemaRuleListEl = document.getElementById('schema-rule-list');
const schemaDetailEl = document.getElementById('schema-detail');
const outputEl = document.getElementById('output');
const diagnosticsEl = document.getElementById('diagnostics');
const viewMetaEl = document.getElementById('view-meta');
const runStatusEl = document.getElementById('run-status');
const diagStatusEl = document.getElementById('diag-status');
const tabCanonicalBtn = document.getElementById('tab-canonical');
const tabAesBtn = document.getElementById('tab-aes');
const tabFinalizedBtn = document.getElementById('tab-finalized');
const tabAnnotationsBtn = document.getElementById('tab-annotations');
const tabComparisonBtn = document.getElementById('tab-comparison');
const tabSourceBtn = document.getElementById('tab-source');
const tabSchemaBtn = document.getElementById('tab-schema');
const tabOptionsBtn = document.getElementById('tab-options');
const paneSourceEl = document.getElementById('pane-source');
const paneSchemaEl = document.getElementById('pane-schema');
const paneOptionsEl = document.getElementById('pane-options');
const sourceHighlightEl = document.getElementById('source-highlight');
const sourceGutterEl = document.getElementById('source-gutter');
const schemaHighlightEl = document.getElementById('schema-highlight');
const schemaGutterEl = document.getElementById('schema-gutter');
const sourceTabInsertsTabEl = document.getElementById('source-tab-inserts-tab');
const fileOpenBtn = document.getElementById('file-open');
const fileSaveBtn = document.getElementById('file-save');
const fileSaveAsBtn = document.getElementById('file-save-as');
const sampleStrictBtn = document.getElementById('sample-strict');
const sampleTransportBtn = document.getElementById('sample-transport');
const sampleSansaBtn = document.getElementById('sample-sansa');
const sampleCustomBtn = document.getElementById('sample-custom');
const aeosImportBtn = document.getElementById('aeos-import');
const aeosExportBtn = document.getElementById('aeos-export');
const importImageBase64Btn = document.getElementById('import-image-base64');
const currentFilePathEl = document.getElementById('current-file-path');
const menuToggleBtn = document.getElementById('menu-toggle');
const menuPanelEl = document.getElementById('menu-panel');
const filePickerEl = document.createElement('input');
filePickerEl.type = 'file';
filePickerEl.accept = '.aeon,text/plain';
filePickerEl.hidden = true;
document.body.append(filePickerEl);
const aeosPickerEl = document.createElement('input');
aeosPickerEl.type = 'file';
aeosPickerEl.accept = '.aeos,.aeon,text/plain';
aeosPickerEl.hidden = true;
document.body.append(aeosPickerEl);

function setStatus(el, text, tone) {
  el.textContent = text;
  el.dataset.tone = tone;
}

function readPositiveInt(el, fallback) {
  const value = Number.parseInt(el.value, 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function readIncludePaths() {
  return includePathsEl.value
    .split('\n')
    .map((value) => value.trim())
    .filter(Boolean);
}

function writeIncludePaths(paths) {
  includePathsEl.value = [...new Set(paths.map((value) => value.trim()).filter(Boolean))].join('\n');
}

function setIncludePath(path, enabled) {
  const paths = readIncludePaths();
  const next = enabled
    ? [...paths, path]
    : paths.filter((candidate) => candidate !== path);
  writeIncludePaths(next);
  if (enabled) {
    materializationModeEl.value = 'projected';
  }
  includePathsEl.disabled = materializationModeEl.value !== 'projected';
  setStatus(runStatusEl, 'stale', 'warn');
  setStatus(diagStatusEl, 'stale', 'warn');
}

function readSchemaOptions() {
  return {
    schemaEnabled: schemaEnabledEl.checked,
    schemaText: schemaInputEl.value,
  };
}

function describeSchemaOptions(options) {
  if (!options.schemaEnabled) {
    return 'schema: inactive';
  }
  try {
    const schema = parseSchemaText(options.schemaText, options);
    const rules = Array.isArray(schema.rules) ? schema.rules.length : 0;
    return `schema: active (${schema.world === 'closed' ? 'closed' : 'open'} · ${rules} rule${rules === 1 ? '' : 's'})`;
  } catch {
    return 'schema: invalid';
  }
}

function describeCanonicalText(text) {
  const bytes = new TextEncoder().encode(text).length;
  const finalNewline = text.endsWith('\n') ? 'present' : 'absent';
  return `Canonical AEON is shown as exact text with soft-wrap disabled. Bytes: ${bytes}. Final newline: ${finalNewline}.`;
}

function highlightJson(source) {
  const tokenRe = /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|[{}\[\],:]/g;
  let html = '';
  let cursor = 0;

  for (const match of source.matchAll(tokenRe)) {
    html += escapeHtml(source.slice(cursor, match.index));
    const [token, stringValue, keySuffix, literalValue] = match;

    if (stringValue) {
      html += keySuffix
        ? `<span class="json-key">${escapeHtml(stringValue)}</span>${escapeHtml(keySuffix)}`
        : `<span class="json-string">${escapeHtml(stringValue)}</span>`;
    } else if (literalValue === 'null') {
      html += `<span class="json-null">${escapeHtml(literalValue)}</span>`;
    } else if (literalValue) {
      html += `<span class="json-bool">${escapeHtml(literalValue)}</span>`;
    } else if (/^-?\d/.test(token)) {
      html += `<span class="json-number">${escapeHtml(token)}</span>`;
    } else {
      html += `<span class="json-punct">${escapeHtml(token)}</span>`;
    }
    cursor = match.index + token.length;
  }

  return html + escapeHtml(source.slice(cursor));
}

function highlightComparison(source) {
  return source
    .split('\n')
    .map((line) => {
      if (/^\s*[{}\[\],]/.test(line) || /^\s*"[^"]*"\s*:/.test(line)) {
        return highlightJson(line);
      }
      if (line === 'Sections' || line.startsWith('Mismatch:')) {
        return `<span class="comparison-heading">${escapeHtml(line)}</span>`;
      }
      if (line.startsWith('--- ')) {
        return `<span class="comparison-marker">${escapeHtml(line)}</span>`;
      }
      if (line.startsWith('match:')) {
        return `<span class="comparison-ok">match</span>${escapeHtml(line.slice('match'.length))}`;
      }
      if (line.startsWith('mismatch:')) {
        return `<span class="comparison-error">mismatch</span>${escapeHtml(line.slice('mismatch'.length))}`;
      }
      if (line.startsWith('status:')) {
        const value = line.slice('status:'.length).trim();
        const className = value === 'match' ? 'comparison-ok' : 'comparison-error';
        return `<span class="comparison-label">status:</span> <span class="${className}">${escapeHtml(value)}</span>`;
      }
      const meta = /^([^:]+):\s*(.*)$/.exec(line);
      if (meta) {
        return `<span class="comparison-label">${escapeHtml(meta[1])}:</span> ${escapeHtml(meta[2])}`;
      }
      return escapeHtml(line);
    })
    .join('\n');
}

function renderOutputHtml(view) {
  const value = outputState[view] || '';
  if (view === 'canonical') {
    return highlightAeon(value);
  }
  if (view === 'finalized' || view === 'annotations') {
    return highlightJson(value);
  }
  if (view === 'comparison') {
    return highlightComparison(value);
  }
  return escapeHtml(value);
}

function setOutputView(view) {
  outputState.view = view;
  tabCanonicalBtn.classList.toggle('is-active', view === 'canonical');
  tabAesBtn.classList.toggle('is-active', view === 'aes');
  tabFinalizedBtn.classList.toggle('is-active', view === 'finalized');
  tabAnnotationsBtn.classList.toggle('is-active', view === 'annotations');
  tabComparisonBtn.classList.toggle('is-active', view === 'comparison');
  outputEl.innerHTML = renderOutputHtml(view);
  if (view === 'canonical') {
    viewMetaEl.textContent = describeCanonicalText(outputState.canonical || '');
  } else if (view === 'aes') {
    viewMetaEl.textContent = 'AES shows normalized compile events as path-addressed rows.';
  } else if (view === 'finalized') {
    viewMetaEl.textContent = 'Finalized JSON is materialized from the validation-mode compile/finalize pipeline.';
  } else if (view === 'annotations') {
    viewMetaEl.textContent = 'Annotation Stream reflects the structured comments found in the current source.';
  } else if (view === 'comparison') {
    viewMetaEl.textContent = 'Comparison shows normalized TypeScript and Rust WASM outputs for the same source and options.';
  }
}

function setInputView(view) {
  tabSourceBtn.classList.toggle('is-active', view === 'source');
  tabSchemaBtn.classList.toggle('is-active', view === 'schema');
  tabOptionsBtn.classList.toggle('is-active', view === 'options');
  paneSourceEl.classList.toggle('is-active', view === 'source');
  paneSchemaEl.classList.toggle('is-active', view === 'schema');
  paneOptionsEl.classList.toggle('is-active', view === 'options');
}

function refreshCurrentFilePath() {
  currentFilePathEl.textContent = currentFilePath ?? 'Unsaved playground buffer';
}

function setMenuOpen(open) {
  menuPanelEl.hidden = !open;
  menuToggleBtn.setAttribute('aria-expanded', String(open));
}

function closeMenu() {
  setMenuOpen(false);
}

function sanitizeBindingName(value) {
  const cleaned = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (!cleaned) {
    return 'image_asset';
  }
  return /^[a-z_]/.test(cleaned) ? cleaned : `image_${cleaned}`;
}

function buildImageBase64Snippet(image) {
  const stem = image.name.replace(/\.[^.]+$/, '');
  const binding = sanitizeBindingName(stem);
  const base64url = image.base64.replace(/\+/g, '-').replace(/\//g, '_');
  return `${binding}@{mime="${image.mime}",binname="${image.name}",binkind="image"}:base64 = &${base64url}\n`;
}

function appendSourceSnippet(snippet) {
  const separator = sourceEl.value.endsWith('\n\n') || sourceEl.value.length === 0 ? '' : '\n';
  sourceEl.value += `${separator}${snippet}`;
  syncSourceHighlight();
  setStatus(runStatusEl, 'source updated', 'ok');
  setStatus(diagStatusEl, 'stale', 'warn');
}

function formatPosition(span) {
  const start = span?.start;
  return start ? `line ${start.line}, column ${start.column}` : null;
}

function formatDiagnostic(diag, index) {
  const code = diag.code ? `[${diag.code}] ` : '';
  const where = formatPosition(diag.span);
  const path = diag.path && !(diag.path === '$' && where) ? ` at ${diag.path}` : '';
  const suffix = where ? ` at ${where}` : '';
  return `${index + 1}. ${code}${diag.message}${path}${suffix}`;
}

function escapeHtml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function wrapToken(type, value) {
  return `<span class="tok-${type}">${escapeHtml(value)}</span>`;
}

function wrapRaw(type, html) {
  return `<span class="tok-${type}">${html}</span>`;
}

const AEON_IDENTIFIER = '[A-Za-z_][A-Za-z0-9_]*';
const AEON_QUOTED = '"(?:\\\\.|[^"])*"|\'(?:\\\\.|[^\'])*\'';
const AEON_QUOTED_KEY = `(?:${AEON_QUOTED})`;
const AEON_KEY = `(?:${AEON_IDENTIFIER}|${AEON_QUOTED})`;
const AEON_TYPE = `:${AEON_IDENTIFIER}(?:<[^>\\n]+>)?(?:\\[\\s*[A-Za-z0-9!#$%&*+\\-.:;=?@^_|~<>]\\s*\\])*`;
const AEON_REFERENCE =
  '\\$?(?:' +
  `${AEON_IDENTIFIER}|${AEON_QUOTED}|\\[\\d+\\]|\\["(?:\\\\.|[^"])*"\\]` +
  `|\\.${AEON_IDENTIFIER}|\\.\\["(?:\\\\.|[^"])*"\\]` +
  `|@${AEON_IDENTIFIER}|@\\["(?:\\\\.|[^"])*"\\]` +
  ')+';

const AEON_BLOCK_COMMENT_TYPES = [
  { begin: '/#', end: '#/', type: 'comment-doc' },
  { begin: '/@', end: '@/', type: 'comment-annotation' },
  { begin: '/?', end: '?/', type: 'comment-hint' },
  { begin: '/{', end: '}/', type: 'comment-structure' },
  { begin: '/[', end: ']/', type: 'comment-profile' },
  { begin: '/(', end: ')/', type: 'comment-future' },
  { begin: '/*', end: '*/', type: 'comment' },
];

const AEON_LINE_COMMENT_TYPES = [
  { begin: '//#', type: 'comment-doc' },
  { begin: '//@', type: 'comment-annotation' },
  { begin: '//?', type: 'comment-hint' },
  { begin: '//!', type: 'comment-host' },
  { begin: '//{', type: 'comment-structure' },
  { begin: '//[', type: 'comment-profile' },
  { begin: '//(', type: 'comment-future' },
  { begin: '//', type: 'comment' },
];

function renderAndInline(value) {
  const parts = [];
  const pattern = /(\\[\[\]|\\]|\[\*[\s\S]*?\]|\[\/[\s\S]*?\]|\[\$[\s\S]*?\]|\[@[\s\S]*?\]|\[(?: |x|=|\.|_|<)[^\]]*\]|\|)/g;
  let index = 0;

  for (const match of value.matchAll(pattern)) {
    const token = match[0];
    const start = match.index ?? 0;
    if (start > index) {
      parts.push(escapeHtml(value.slice(index, start)));
    }

    if (token.startsWith('\\')) {
      parts.push(wrapToken('and-escape', token));
    } else if (token === '|') {
      parts.push(wrapToken('and-table-pipe', token));
    } else if (/^\[(?: |x|=|\.|_|<)/.test(token)) {
      parts.push(wrapToken('and-invalid', token));
    } else if (token.startsWith('[*')) {
      parts.push(wrapToken('and-strong', token));
    } else if (token.startsWith('[/')) {
      parts.push(wrapToken('and-emphasis', token));
    } else if (token.startsWith('[$')) {
      parts.push(wrapToken('and-code', token));
    } else if (token.startsWith('[@')) {
      const link = /^(\[@)(.*?)(\|)(.*)(\])$/.exec(token);
      if (link) {
        parts.push(
          wrapToken('and-link', link[1] + link[2]) +
            wrapToken('and-link-separator', link[3]) +
            wrapToken('and-link-target', link[4]) +
            wrapToken('and-link', link[5]),
        );
      } else {
        parts.push(wrapToken('and-link', token));
      }
    }

    index = start + token.length;
  }

  if (index < value.length) {
    parts.push(escapeHtml(value.slice(index)));
  }

  return parts.join('');
}

function renderDocCommentContent(line) {
  const header = /^(\s*)(&ND)(\s+v[0-9]+)?(.*)$/.exec(line);
  if (header) {
    return `${escapeHtml(header[1])}${wrapToken('and-header', header[2])}${header[3] ? wrapToken('and-version', header[3]) : ''}${wrapRaw('comment-doc', renderAndInline(header[4]))}`;
  }

  const codeFence = /^(\s*)(`{3,})([A-Za-z0-9_+.-]+)?(.*)$/.exec(line);
  if (codeFence) {
    return `${escapeHtml(codeFence[1])}${wrapToken('and-fence', codeFence[2])}${codeFence[3] ? wrapToken('and-fence-label', codeFence[3]) : ''}${wrapRaw('comment-doc', renderAndInline(codeFence[4]))}`;
  }

  const extensionFence = /^(\s*)(\+{3})([A-Za-z0-9_./+-]+|fallback)?(.*)$/.exec(line);
  if (extensionFence) {
    return `${escapeHtml(extensionFence[1])}${wrapToken('and-extension-fence', extensionFence[2])}${extensionFence[3] ? wrapToken('and-extension-name', extensionFence[3]) : ''}${wrapRaw('comment-doc', renderAndInline(extensionFence[4]))}`;
  }

  const rule = /^(\s*)(---)(\s*)$/.exec(line);
  if (rule) {
    return `${escapeHtml(rule[1])}${wrapToken('and-rule', rule[2])}${escapeHtml(rule[3])}`;
  }

  const quote = /^(\s*(?:>\s*)+)(.*)$/.exec(line);
  if (quote) {
    return `${wrapToken('and-quote', quote[1])}${wrapRaw('and-quote-text', renderAndInline(quote[2]))}`;
  }

  const heading = /^(\s{0,3})(#{1,6})(\s+.*)$/.exec(line);
  if (heading) {
    return `${escapeHtml(heading[1])}${wrapToken('and-heading-marker', heading[2])}${wrapRaw('and-heading', renderAndInline(heading[3]))}`;
  }

  const list = /^(\s*)(-\s+|\d+\.\s+)(.*)$/.exec(line);
  if (list) {
    return `${escapeHtml(list[1])}${wrapToken('and-list-marker', list[2])}${wrapRaw('and-list-text', renderAndInline(list[3]))}`;
  }

  return wrapRaw('comment-doc', renderAndInline(line));
}

function renderDocComment(value) {
  return value
    .split('\n')
    .map((line) => {
      const marker = /^(\s*)(\/\/#|\/#|#\/)(\s?)(.*)$/.exec(line);
      if (marker) {
        const prefix = `${marker[2]}${marker[3]}`;
        return `${escapeHtml(marker[1])}${wrapToken('comment-doc', prefix)}${renderDocCommentContent(marker[4])}`;
      }
      return renderDocCommentContent(line);
    })
    .join('\n');
}

function renderComment(comment, value) {
  return comment.type === 'comment-doc' ? renderDocComment(value) : wrapToken(comment.type, value);
}

function findCommentStart(line) {
  let quote = null;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (quote) {
      if (char === quote && line[index - 1] !== '\\') {
        quote = null;
      }
      continue;
    }

    if (char === '"' || char === '\'' || char === '`') {
      quote = char;
      continue;
    }

    if (char !== '/') {
      continue;
    }

    for (const candidate of AEON_LINE_COMMENT_TYPES) {
      if (!line.startsWith(candidate.begin, index)) {
        continue;
      }
      const previous = index > 0 ? line[index - 1] : '';
      if (previous === '$') {
        continue;
      }
      return { index, line: true, ...candidate };
    }

    for (const candidate of AEON_BLOCK_COMMENT_TYPES) {
      if (line.startsWith(candidate.begin, index)) {
        return { index, line: false, ...candidate };
      }
    }
  }

  return null;
}

function tokenizeAeonLine(line, state) {
  if (state.blockComment) {
    const current = state.blockComment;
    const endIndex = line.indexOf(current.end);
    if (endIndex === -1) {
      return renderComment(current, line);
    }

    state.blockComment = null;
    return (
      renderComment(current, line.slice(0, endIndex + current.end.length)) +
      tokenizeAeonLine(line.slice(endIndex + current.end.length), state)
    );
  }

  const comment = findCommentStart(line);
  if (comment) {
    const before = tokenizeAeonLine(line.slice(0, comment.index), state);
    const after = line.slice(comment.index);

    if (comment.line) {
      return before + renderComment(comment, after);
    }

    const endIndex = after.indexOf(comment.end, comment.begin.length);
    if (endIndex === -1) {
      state.blockComment = comment;
      return before + renderComment(comment, after);
    }

    return (
      before +
      renderComment(comment, after.slice(0, endIndex + comment.end.length)) +
      tokenizeAeonLine(after.slice(endIndex + comment.end.length), state)
    );
  }

  const patterns = [
    ['space', /\s+/y],
    ['directive', /\baeon:[A-Za-z][A-Za-z0-9_.:-]*\b/y],
    ['node-open', new RegExp(`<${AEON_IDENTIFIER}`, 'y')],
    ['attr-open', /@\{/y],
    ['attr-close', /\}/y],
    ['quoted-key', new RegExp(`${AEON_QUOTED_KEY}(?=\\s*(?:${AEON_TYPE}\\s*=|@\\{|=))`, 'y')],
    ['typed-key', new RegExp(`${AEON_KEY}(?=\\s*${AEON_TYPE}\\s*=)`, 'y')],
    ['typed-value', new RegExp(`${AEON_TYPE}(?=\\s*=)`, 'y')],
    ['key', new RegExp(`${AEON_KEY}(?=\\s*(?:@\\{|=))`, 'y')],
    ['trimtick-string', />{1,4}`(?:\\.|[^`])*`/y],
    ['string-template', /`(?:\\.|[^`])*`/y],
    ['string', /"(?:\\.|[^"])*"|'(?:\\.|[^'])*'/y],
    ['literal', /\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z)?&[A-Za-z0-9_./+-]+\b/y],
    ['literal', /\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z\b/y],
    ['literal', /\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\b/y],
    ['literal', /\b\d{2}:\d{2}:\d{2}(?:Z)?\b/y],
    ['literal', /\b\d{4}-\d{2}-\d{2}\b/y],
    ['literal', /\b(?:Z&|&)(?:[A-Za-z0-9_./+-]+)\b/y],
    ['literal', /-?(?:Infinity|NaN)\b/y],
    ['literal', /![A-Za-z_][A-Za-z0-9_]*\b/y],
    ['literal', /\b(?:true|false|yes|no|on|off)\b/y],
    ['literal', /[#%$^][^\s,\])}]+/y],
    ['literal', /(?<![A-Za-z0-9_])[+-]?\d[\d_]*\.\d[\d_]*(?:[eE][+-]?\d[\d_]*)?(?![A-Za-z0-9_])/y],
    ['literal', /(?<![A-Za-z0-9_])[+-]?\d[\d_]*(?:\.\d[\d_]*)?(?![A-Za-z0-9_])/y],
    ['binding', new RegExp(`~>\\s*${AEON_REFERENCE}`, 'y')],
    ['binding', new RegExp(`~(?!>)${AEON_REFERENCE}`, 'y')],
    ['operator', /=/y],
    ['punct', /[,()[\]{}<>.]/y],
    ['type', new RegExp(AEON_TYPE, 'y')],
    ['attribute-key', new RegExp(`${AEON_IDENTIFIER}(?=\\s*=)`, 'y')],
    ['identifier', new RegExp(AEON_IDENTIFIER, 'y')],
  ];

  let html = '';
  let index = 0;

  while (index < line.length) {
    let matched = false;

    for (const [type, pattern] of patterns) {
      pattern.lastIndex = index;
      const match = pattern.exec(line);
      if (!match) {
        continue;
      }

      matched = true;
      index = pattern.lastIndex;
      switch (type) {
        case 'space':
          html += match[0];
          break;
        case 'node-open':
          html += wrapToken('tag-punct', '<') + wrapToken('tag', match[0].slice(1));
          break;
        case 'attr-open':
        case 'attr-close':
          html += wrapToken('attribute-punct', match[0]);
          break;
        case 'typed-key':
        case 'key':
          html += wrapToken('key', match[0]);
          break;
        case 'quoted-key':
          html += wrapToken('quoted-key', match[0]);
          break;
        case 'typed-value':
        case 'type':
          html += wrapToken('punct', ':') + wrapToken('type', match[0].slice(1));
          break;
        case 'attribute-key':
          html += wrapToken('attribute', match[0]);
          break;
        case 'string-template':
        case 'trimtick-string':
          html += wrapToken('string', match[0]);
          break;
        default:
          html += wrapToken(type, match[0]);
      }
      break;
    }

    if (!matched) {
      html += escapeHtml(line[index]);
      index += 1;
    }
  }

  return html;
}

function highlightAeon(source) {
  const state = { blockComment: null };
  return source
    .split('\n')
    .map((line) => tokenizeAeonLine(line, state))
    .join('\n');
}

function renderLineNumbers(source) {
  const lineCount = source.split('\n').length;
  return Array.from({ length: lineCount }, (_, index) => String(index + 1)).join('\n');
}

function syncSourceHighlight() {
  const code = sourceHighlightEl.querySelector('code');
  code.innerHTML = `${highlightAeon(sourceEl.value)}\n`;
  sourceGutterEl.textContent = renderLineNumbers(sourceEl.value);
}

function syncSchemaHighlight() {
  const code = schemaHighlightEl.querySelector('code');
  code.innerHTML = `${highlightAeon(schemaInputEl.value)}\n`;
  schemaGutterEl.textContent = renderLineNumbers(schemaInputEl.value);
}

function insertSourceText(text) {
  const start = sourceEl.selectionStart ?? 0;
  const end = sourceEl.selectionEnd ?? start;
  sourceEl.setRangeText(text, start, end, 'end');
  syncSourceHighlight();
  setStatus(runStatusEl, 'stale', 'warn');
  setStatus(diagStatusEl, 'stale', 'warn');
}

function describeValidationSource(mode) {
  if (mode === 'none') {
    return 'raw input';
  }
  if (mode === 'transport') {
    return 'raw input with transport validation';
  }
  if (mode === 'strict') {
    return 'raw input with strict validation';
  }
  if (mode === 'custom') {
    return 'raw input with custom datatype validation';
  }
  return 'raw input with validation';
}

function describeFinalizeScope(scope) {
  if (scope === 'full') {
    return 'full document (header + payload)';
  }
  if (scope === 'header') {
    return 'header only';
  }
  return 'payload only';
}

function formatAesCell(value) {
  if (value === null || value === undefined || value === '') {
    return '·';
  }
  if (typeof value === 'string') {
    return value.replace(/\s+/g, ' ');
  }
  return JSON.stringify(value);
}

function pathSegments(path) {
  const segments = [];
  const tokenRe = /\.([A-Za-z_][A-Za-z0-9_]*)|\["((?:\\.|[^"\\])*)"\]|\[(\d+)\]/g;
  for (const match of path.matchAll(tokenRe)) {
    if (match[1] !== undefined) {
      segments.push(match[1]);
    } else if (match[2] !== undefined) {
      try {
        segments.push(JSON.parse(`"${match[2]}"`));
      } catch {
        segments.push(match[2]);
      }
    } else if (match[3] !== undefined) {
      segments.push(Number.parseInt(match[3], 10));
    }
  }
  return segments;
}

function readNestedValue(root, segments) {
  let value = root;
  for (const segment of segments) {
    if (value === null || value === undefined) {
      return undefined;
    }
    value = value[segment];
  }
  return value;
}

function valueFromFinalizedPath(path, document) {
  if (!document || typeof path !== 'string') {
    return undefined;
  }

  const segments = pathSegments(path);
  if (segments.length === 0) {
    return document;
  }

  const first = segments[0];
  if (typeof first === 'string' && first.startsWith('aeon:')) {
    const headerKey = first.slice('aeon:'.length);
    return readNestedValue(document.header ?? document, [headerKey, ...segments.slice(1)]);
  }

  const bodyRoot = document && typeof document === 'object' && 'payload' in document
    ? document.payload
    : document;
  return readNestedValue(bodyRoot, segments);
}

function formatAesValue(event, document) {
  if (event.raw !== null && event.raw !== undefined) {
    return String(event.raw);
  }
  if (event.value !== null && event.value !== undefined) {
    return formatAesCell(event.value);
  }
  const finalizedValue = valueFromFinalizedPath(event.path, document);
  if (finalizedValue !== undefined && (finalizedValue === null || typeof finalizedValue !== 'object')) {
    return formatAesCell(finalizedValue);
  }
  return '·';
}

function padCell(value, width) {
  const text = String(value);
  return `${text}${' '.repeat(Math.max(0, width - text.length))}`;
}

function renderAesTable(events, document) {
  if (!events || events.length === 0) {
    return 'No AES events available.';
  }

  const rows = events.map((event, index) => [
    String(index + 1),
    formatAesCell(event.path),
    formatAesCell(event.key),
    formatAesCell(event.valueType),
    formatAesCell(event.datatype),
    formatAesValue(event, document),
  ]);
  const headers = ['#', 'Path', 'Key', 'Value Type', 'Datatype', 'Value'];
  const widths = headers.map((header, column) => Math.max(
    header.length,
    ...rows.map((row) => row[column].length),
  ));
  const formatRow = (row) => row.map((cell, column) => padCell(cell, widths[column])).join('  ');
  const divider = widths.map((width) => '-'.repeat(width)).join('  ');

  return [
    formatRow(headers),
    divider,
    ...rows.map(formatRow),
  ].join('\n');
}

function renderResult(result, options) {
  outputState.canonical = result.canonical?.text ?? '';
  outputState.aes = renderAesTable(result.events ?? [], result.finalized?.document);
  outputState.finalized = result.finalized?.document !== null && result.finalized?.document !== undefined
    ? JSON.stringify(result.finalized.document, null, 2)
    : 'Unavailable in "none" mode.';
  outputState.annotations = JSON.stringify(result.annotations ?? [], null, 2);
  outputState.comparison = '';
  setOutputView(outputState.view);

  if (result.errors.length > 0) {
    diagnosticsEl.textContent = result.errors.map(formatDiagnostic).join('\n');
    setStatus(runStatusEl, 'error', 'error');
    setStatus(diagStatusEl, `${result.errors.length} error${result.errors.length === 1 ? '' : 's'}`, 'error');
    return;
  }

  const lines = [
    `processor: ${options.processor}`,
    `validation mode: ${options.validationMode}`,
    describeSchemaOptions(options),
    `materialization: ${options.materializationMode}`,
    `finalize scope: ${describeFinalizeScope(options.finalizeScope)}`,
    `event count: ${result.events.length}`,
  ];

  if (options.materializationMode === 'projected') {
    lines.push(`include paths: ${options.includePaths.length}`);
    lines.push(...options.includePaths.map((path) => `- ${path}`));
  }

  if (result.warnings.length > 0) {
    lines.push('');
    lines.push('Warnings:');
    lines.push(...result.warnings.map(formatDiagnostic));
  }

  diagnosticsEl.textContent = lines.join('\n');
  setStatus(runStatusEl, 'ready', 'ok');
  setStatus(diagStatusEl, result.warnings.length > 0 ? 'warnings' : 'clean', result.warnings.length > 0 ? 'warn' : 'ok');
}

function flattenKeys(value, keys = {}) {
  if (Array.isArray(value)) {
    for (const item of value) {
      flattenKeys(item, keys);
    }
    return keys;
  }
  if (value && typeof value === 'object') {
    for (const [key, nested] of Object.entries(value)) {
      keys[key] = true;
      flattenKeys(nested, keys);
    }
  }
  return keys;
}

function stableJson(value) {
  return JSON.stringify(value, Object.keys(flattenKeys(value)).sort(), 2);
}

function comparablePayload(result) {
  return {
    ok: result.ok,
    canonical: result.canonical,
    finalized: result.finalized,
    events: result.events,
    annotations: result.annotations,
    diagnostics: result.diagnostics,
  };
}

function compareSection(label, left, right) {
  const leftText = stableJson(left);
  const rightText = stableJson(right);
  return {
    label,
    match: leftText === rightText,
    leftText,
    rightText,
  };
}

function renderEngineComparison(tsResult, rustResult, options) {
  const sections = [
    compareSection('canonical', tsResult.canonical, rustResult.canonical),
    compareSection('finalized', tsResult.finalized, rustResult.finalized),
    compareSection('events', tsResult.events, rustResult.events),
    compareSection('annotations', tsResult.annotations, rustResult.annotations),
    compareSection('diagnostics', tsResult.diagnostics, rustResult.diagnostics),
    compareSection('all normalized fields', comparablePayload(tsResult), comparablePayload(rustResult)),
  ];
  const mismatches = sections.filter((section) => !section.match);

  const lines = [
    `status: ${mismatches.length === 0 ? 'match' : 'mismatch'}`,
    `validation mode: ${options.validationMode}`,
    describeSchemaOptions(options),
    `materialization: ${options.materializationMode}`,
    `finalize scope: ${describeFinalizeScope(options.finalizeScope)}`,
    `typescript ok: ${tsResult.ok}`,
    `rust wasm ok: ${rustResult.ok}`,
    '',
    'Sections',
    ...sections.map((section) => `${section.match ? 'match' : 'mismatch'}: ${section.label}`),
  ];

  for (const section of mismatches) {
    lines.push('');
    lines.push(`Mismatch: ${section.label}`);
    lines.push('--- TypeScript');
    lines.push(section.leftText);
    lines.push('--- Rust WASM');
    lines.push(section.rightText);
  }

  return lines.join('\n');
}

async function processWithTypeScript(source, options) {
  return processWithTypeScriptCore(source, options);
}

async function processWithRust(source, options) {
  return processWithRustWasm(source, options);
}

async function compareEngines(source, options) {
  const [tsResult, rustResult] = await Promise.all([
    processWithTypeScriptCore(source, options),
    processWithRustWasm(source, options),
  ]);
  return { tsResult, rustResult };
}

async function run(processor) {
  lastProcessor = processor;
  const options = {
    processor,
    validationMode: validationModeEl.value,
    maxSeparatorDepth: readPositiveInt(separatorDepthEl, 8),
    maxAttributeDepth: readPositiveInt(attributeDepthEl, 1),
    maxGenericDepth: readPositiveInt(genericDepthEl, 1),
    materializationMode: materializationModeEl.value,
    finalizeScope: finalizeScopeEl.value,
    includePaths: readIncludePaths(),
    ...readSchemaOptions(),
  };

  if (options.materializationMode === 'projected' && options.includePaths.length === 0 && options.validationMode !== 'none') {
    outputState.canonical = '';
    outputState.aes = '';
    outputState.finalized = '';
    outputState.annotations = '';
    outputState.comparison = '';
    setOutputView(outputState.view);
    diagnosticsEl.textContent = '1. Projected materialization requires at least one include path.';
    setStatus(runStatusEl, 'error', 'error');
    setStatus(diagStatusEl, '1 error', 'error');
    return;
  }

  setStatus(runStatusEl, `running ${processor}`, 'warn');
  setStatus(diagStatusEl, 'working', 'warn');

  try {
    const result = processor === 'rust'
      ? await processWithRust(sourceEl.value, options)
      : await processWithTypeScript(sourceEl.value, options);
    renderResult(result, options);
  } catch (error) {
    outputState.canonical = '';
    outputState.aes = '';
    outputState.finalized = '';
    outputState.annotations = '';
    outputState.comparison = '';
    setOutputView(outputState.view);
    diagnosticsEl.textContent = `1. ${error instanceof Error ? error.message : String(error)}`;
    setStatus(runStatusEl, 'error', 'error');
    setStatus(diagStatusEl, '1 error', 'error');
  }
}

async function runComparison() {
  const options = {
    processor: 'compare',
    validationMode: validationModeEl.value,
    maxSeparatorDepth: readPositiveInt(separatorDepthEl, 8),
    maxAttributeDepth: readPositiveInt(attributeDepthEl, 1),
    maxGenericDepth: readPositiveInt(genericDepthEl, 1),
    materializationMode: materializationModeEl.value,
    finalizeScope: finalizeScopeEl.value,
    includePaths: readIncludePaths(),
    ...readSchemaOptions(),
  };

  if (options.materializationMode === 'projected' && options.includePaths.length === 0 && options.validationMode !== 'none') {
    outputState.canonical = '';
    outputState.aes = '';
    outputState.finalized = '';
    outputState.annotations = '';
    outputState.comparison = '';
    setOutputView('comparison');
    diagnosticsEl.textContent = '1. Projected materialization requires at least one include path.';
    setStatus(runStatusEl, 'error', 'error');
    setStatus(diagStatusEl, '1 error', 'error');
    return;
  }

  setStatus(runStatusEl, 'comparing', 'warn');
  setStatus(diagStatusEl, 'working', 'warn');

  try {
    const { tsResult, rustResult } = await compareEngines(sourceEl.value, options);
    outputState.canonical = tsResult.canonical?.text ?? '';
    outputState.aes = renderAesTable(tsResult.events ?? [], tsResult.finalized?.document);
    outputState.finalized = tsResult.finalized?.document !== null && tsResult.finalized?.document !== undefined
      ? JSON.stringify(tsResult.finalized.document, null, 2)
      : 'Unavailable in "none" mode.';
    outputState.annotations = JSON.stringify(tsResult.annotations ?? [], null, 2);
    outputState.comparison = renderEngineComparison(tsResult, rustResult, options);
    setOutputView('comparison');

    const mismatch = outputState.comparison.startsWith('status: mismatch');
    diagnosticsEl.textContent = mismatch
      ? '1. TypeScript and Rust WASM normalized outputs differ. See Comparison.'
      : 'processor: compare\nstatus: normalized outputs match';
    setStatus(runStatusEl, mismatch ? 'mismatch' : 'match', mismatch ? 'error' : 'ok');
    setStatus(diagStatusEl, mismatch ? '1 mismatch' : 'clean', mismatch ? 'error' : 'ok');
  } catch (error) {
    outputState.canonical = '';
    outputState.aes = '';
    outputState.finalized = '';
    outputState.annotations = '';
    outputState.comparison = '';
    setOutputView('comparison');
    diagnosticsEl.textContent = `1. ${error instanceof Error ? error.message : String(error)}`;
    setStatus(runStatusEl, 'error', 'error');
    setStatus(diagStatusEl, '1 error', 'error');
  }
}

function applySettings(settings) {
  validationModeEl.value = settings.validationMode;
  separatorDepthEl.value = settings.separatorDepth;
  attributeDepthEl.value = settings.attributeDepth;
  genericDepthEl.value = settings.genericDepth;
  materializationModeEl.value = settings.materializationMode;
  finalizeScopeEl.value = settings.finalizeScope;
  includePathsEl.value = settings.includePaths;
  schemaEnabledEl.checked = Boolean(settings.schemaEnabled);
  schemaInputEl.value = settings.schemaText ?? schemaToAeon(SAMPLE_SCHEMA);
  schemaInputEl.disabled = !schemaEnabledEl.checked;
  syncSchemaHighlight();
  includePathsEl.disabled = settings.materializationMode !== 'projected';
}

function parseSchemaTextOrDefault() {
  const text = schemaInputEl.value.trim();
  if (!text) {
    return structuredClone(SAMPLE_SCHEMA);
  }
  return parseSchemaText(text, {
    validationMode: validationModeEl.value,
    maxSeparatorDepth: readPositiveInt(separatorDepthEl, 8),
    maxAttributeDepth: readPositiveInt(attributeDepthEl, 1),
    maxGenericDepth: readPositiveInt(genericDepthEl, 1),
  });
}

const SCHEMA_TYPE_OPTIONS = [
    'StringLiteral',
    'NumberLiteral',
    'IntegerLiteral',
    'FloatLiteral',
    'BooleanLiteral',
    'ToggleLiteral',
    'NullLiteral',
    'NaNLiteral',
    'InfinityLiteral',
    'ObjectNode',
    'ListNode',
    'TupleNode',
    'NodeLiteral',
    'HexLiteral',
    'EncodingLiteral',
    'RadixLiteral',
    'SeparatorLiteral',
    'DateLiteral',
    'TimeLiteral',
    'DateTimeLiteral',
];

function schemaTypeOptions(selected, restrictToContainers = false) {
  const options = restrictToContainers
    ? SCHEMA_TYPE_OPTIONS.filter((type) => CHILD_CAPABLE_SCHEMA_TYPES.has(type))
    : SCHEMA_TYPE_OPTIONS;
  const selectedIsAvailable = !selected || options.includes(selected);
  const invalidSelectedOption = selected && !selectedIsAvailable
    ? `<option value="${selected}" selected disabled>${selected} (invalid with children)</option>`
    : '';

  return `${invalidSelectedOption}${options.map((type) => `<option value="${type}"${type === selected ? ' selected' : ''}>${type}</option>`).join('')}`;
}

const CHILD_CAPABLE_SCHEMA_TYPES = new Set(['ObjectNode', 'ListNode', 'TupleNode', 'NodeLiteral']);
const CHILD_CAPABLE_DATATYPES = new Set(['object', 'obj', 'o', 'list', 'tuple', 'node']);
const CHILD_ACTION_HINT = 'Select an object, list, tuple, or node rule first.';
const STRING_CONSTRAINT_TYPES = new Set([
  'StringLiteral',
  'EncodingLiteral',
  'RadixLiteral',
  'SeparatorLiteral',
  'DateLiteral',
  'TimeLiteral',
  'DateTimeLiteral',
]);
const NUMERIC_CONSTRAINT_TYPES = new Set([
  'NumberLiteral',
  'IntegerLiteral',
  'FloatLiteral',
  'RadixLiteral',
]);
const NUMERIC_WIDENING_TYPES = new Set(['NumberLiteral', 'IntegerLiteral', 'FloatLiteral', 'HexLiteral', 'RadixLiteral']);
const CONTAINER_CONSTRAINT_TYPES = new Set(['ObjectNode', 'ListNode', 'TupleNode', 'NodeLiteral']);
let schemaBuilderSchema = structuredClone(SAMPLE_SCHEMA);
let schemaBuilderSelectedPath = null;
let schemaBuilderOpenPaths = new Set();
let schemaBuilderOpenPathsInitialized = false;

function schemaRuleFieldsHtml(rule, hasChildRules = false) {
  const constraints = rule.constraints ?? {};
  const type = constraints.type ?? '';
  const path = schemaRuleAddress(rule) || '$.field';
  const isSelector = schemaRuleAddressKind(rule) === 'selector';
  const nullValue = typeof constraints.null_value === 'string' ? constraints.null_value : '';
  const nullValuePreset = nullValue === ''
    ? ''
    : ['none', 'notApplicable'].includes(nullValue)
      ? nullValue
      : 'custom';
  const customNullValue = nullValuePreset === 'custom' ? nullValue : '';
  return `
      <label class="control-field schema-field-full">
        <span>${isSelector ? 'Selector' : 'Key'}${hasChildRules ? '<small>has child rules</small>' : ''}</span>
        <input data-field="path" type="text" value="${escapeHtml(isSelector ? path : pathEditableName(path))}" ${!isSelector && pathAllowsNameEdit(path) ? '' : 'disabled'} />
      </label>
      <label class="control-field schema-field-full">
        <span>Type</span>
        <select data-field="type">${hasChildRules ? '' : '<option value="">any</option>'}${schemaTypeOptions(type, hasChildRules)}</select>
      </label>
      <label class="control-field schema-field-full">
        <span>Custom datatype</span>
        <input data-field="datatype" type="text" value="${escapeHtml(constraints.datatype ?? '')}" placeholder="optional tag" />
      </label>
      <label class="inline-toggle schema-field-full">
        <input data-field="required" type="checkbox" ${constraints.required === true ? 'checked' : ''} />
        <span>Required</span>
      </label>
      <div class="constraint-grid">
        <div class="schema-pair" data-constraint-kind="string">
          <input data-field="min_length" type="number" min="0" placeholder="min length" value="${constraints.min_length ?? ''}" />
          <input data-field="max_length" type="number" min="0" placeholder="max length" value="${constraints.max_length ?? ''}" />
        </div>
        <input data-field="pattern" data-constraint-kind="string" type="text" placeholder="pattern" value="${escapeHtml(constraints.pattern ?? '')}" />
        <input data-field="length_exact" data-constraint-kind="container" type="number" min="0" placeholder="exact children" value="${constraints.length_exact ?? ''}" />
        <div class="schema-pair" data-constraint-kind="container">
          <input data-field="min_children" type="number" min="0" placeholder="min children" value="${constraints.min_children ?? ''}" />
          <input data-field="max_children" type="number" min="0" placeholder="max children" value="${constraints.max_children ?? ''}" />
        </div>
        <select data-field="sign" data-constraint-kind="numeric">
          <option value="">any sign</option>
          <option value="signed"${constraints.sign === 'signed' ? ' selected' : ''}>signed</option>
          <option value="unsigned"${constraints.sign === 'unsigned' ? ' selected' : ''}>unsigned</option>
        </select>
        <div class="schema-pair" data-constraint-kind="numeric">
          <input data-field="min_value" type="text" placeholder="min value" value="${escapeHtml(constraints.min_value ?? '')}" />
          <input data-field="max_value" type="text" placeholder="max value" value="${escapeHtml(constraints.max_value ?? '')}" />
        </div>
        <select data-field="toggle_pair" data-constraint-kind="toggle">
          <option value="">any toggle</option>
          <option value="yes_no"${constraints.toggle_pair === 'yes_no' ? ' selected' : ''}>yes / no</option>
          <option value="on_off"${constraints.toggle_pair === 'on_off' ? ' selected' : ''}>on / off</option>
        </select>
        <label class="inline-toggle schema-toggle-row" data-constraint-kind="nullable">
          <input data-field="nullable" type="checkbox" ${constraints.nullable === true ? 'checked' : ''} />
          <span>Allow null</span>
        </label>
        <select data-field="null_value_preset" data-constraint-kind="null">
          <option value="">any null</option>
          <option value="none"${nullValuePreset === 'none' ? ' selected' : ''}>!none</option>
          <option value="notApplicable"${nullValuePreset === 'notApplicable' ? ' selected' : ''}>!notApplicable</option>
          <option value="custom"${nullValuePreset === 'custom' ? ' selected' : ''}>custom null</option>
        </select>
        <input data-field="null_value_custom" data-constraint-kind="null" type="text" placeholder="custom null value" value="${escapeHtml(customNullValue)}" />
        <div class="schema-pair schema-toggle-pair" data-constraint-kind="numeric-widening">
          <label class="inline-toggle schema-toggle-row">
            <input data-field="allow_infinity" type="checkbox" ${constraints.allow_infinity === true ? 'checked' : ''} />
            <span>Allow infinity</span>
          </label>
          <label class="inline-toggle schema-toggle-row">
            <input data-field="allow_nan" type="checkbox" ${constraints.allow_nan === true ? 'checked' : ''} />
            <span>Allow NaN</span>
          </label>
        </div>
      </div>
  `;
}

function schemaConstraintKindsForType(type) {
  if (!type) {
    return new Set(['nullable', 'null', 'string', 'numeric', 'numeric-widening', 'container', 'toggle']);
  }
  const kinds = new Set(['nullable']);
  if (type === 'NullLiteral') {
    kinds.add('null');
  }
  if (STRING_CONSTRAINT_TYPES.has(type)) {
    kinds.add('string');
  }
  if (NUMERIC_CONSTRAINT_TYPES.has(type)) {
    kinds.add('numeric');
  }
  if (NUMERIC_WIDENING_TYPES.has(type)) {
    kinds.add('numeric-widening');
  }
  if (CONTAINER_CONSTRAINT_TYPES.has(type)) {
    kinds.add('container');
  }
  if (type === 'ToggleLiteral') {
    kinds.add('toggle');
  }
  return kinds;
}

function updateSchemaConstraintState(row) {
  if (!(row instanceof HTMLElement)) {
    return;
  }
  const type = row.querySelector('[data-field="type"]')?.value ?? '';
  const activeKinds = schemaConstraintKindsForType(type);
  if (row.querySelector('[data-field="nullable"]')?.checked) {
    activeKinds.add('null');
  }
  for (const control of row.querySelectorAll('[data-constraint-kind]')) {
    const kind = control.dataset.constraintKind;
    const active = activeKinds.has(kind);
    control.disabled = !active;
    for (const input of control.querySelectorAll?.('input, select, textarea') ?? []) {
      input.disabled = !active;
    }
    control.hidden = !active;
  }
  updateNullValueCustomState(row);
  validateSchemaRuleRow(row);
}

function updateNullValueCustomState(row) {
  const preset = row.querySelector('[data-field="null_value_preset"]');
  const custom = row.querySelector('[data-field="null_value_custom"]');
  if (!(preset instanceof HTMLSelectElement) || !(custom instanceof HTMLInputElement)) {
    return;
  }
  const active = !preset.disabled && preset.value === 'custom';
  custom.disabled = !active;
  custom.hidden = !active;
}

function clearSchemaRuleValidation(row) {
  for (const control of row.querySelectorAll('[data-field]')) {
    control.removeAttribute('aria-invalid');
    control.removeAttribute('data-invalid');
    control.removeAttribute('title');
  }
}

function markSchemaRuleInvalid(row, fields, message) {
  for (const field of fields) {
    const control = row.querySelector(`[data-field="${field}"]`);
    if (!control || control.disabled || control.hidden) {
      continue;
    }
    control.setAttribute('aria-invalid', 'true');
    control.setAttribute('data-invalid', 'true');
    control.setAttribute('title', message);
  }
}

function readSchemaNumber(row, field) {
  const control = row.querySelector(`[data-field="${field}"]`);
  if (!control || control.disabled || control.hidden || control.value.trim() === '') {
    return null;
  }
  const value = Number(control.value);
  return Number.isFinite(value) ? value : null;
}

function validateSchemaRuleRow(row) {
  if (!(row instanceof HTMLElement)) {
    return;
  }
  clearSchemaRuleValidation(row);
  const keyInput = row.querySelector('[data-field="path"]');
  const currentPath = row.dataset.path ?? schemaBuilderSelectedPath ?? '';
  const candidatePath = row.dataset.ruleKind === 'selector'
    ? currentPath
    : pathWithEditableName(currentPath, keyInput?.value.trim() ?? '');
  if (hasDuplicatePath(schemaBuilderSchema.rules, candidatePath, currentPath)) {
    markSchemaRuleInvalid(row, ['path'], 'Duplicate binding name at this level.');
  }

  const minLength = readSchemaNumber(row, 'min_length');
  const maxLength = readSchemaNumber(row, 'max_length');
  if (minLength !== null && maxLength !== null && maxLength < minLength) {
    markSchemaRuleInvalid(row, ['min_length', 'max_length'], 'Max length must be greater than or equal to min length.');
  }

  const minChildren = readSchemaNumber(row, 'min_children');
  const maxChildren = readSchemaNumber(row, 'max_children');
  const exactChildren = readSchemaNumber(row, 'length_exact');
  if (minChildren !== null && maxChildren !== null && maxChildren < minChildren) {
    markSchemaRuleInvalid(row, ['min_children', 'max_children'], 'Max children must be greater than or equal to min children.');
  }
  if (exactChildren !== null && minChildren !== null && exactChildren < minChildren) {
    markSchemaRuleInvalid(row, ['length_exact', 'min_children'], 'Exact children must be greater than or equal to min children.');
  }
  if (exactChildren !== null && maxChildren !== null && exactChildren > maxChildren) {
    markSchemaRuleInvalid(row, ['length_exact', 'max_children'], 'Exact children must be less than or equal to max children.');
  }

  const minValue = readSchemaNumber(row, 'min_value');
  const maxValue = readSchemaNumber(row, 'max_value');
  if (minValue !== null && maxValue !== null && maxValue < minValue) {
    markSchemaRuleInvalid(row, ['min_value', 'max_value'], 'Max value must be greater than or equal to min value.');
  }

  const nullPreset = row.querySelector('[data-field="null_value_preset"]');
  const customNull = row.querySelector('[data-field="null_value_custom"]');
  if (
    nullPreset instanceof HTMLSelectElement
    && customNull instanceof HTMLInputElement
    && !nullPreset.disabled
    && nullPreset.value === 'custom'
    && customNull.value.trim() === ''
  ) {
    markSchemaRuleInvalid(row, ['null_value_custom'], 'Custom null value is required.');
  }
}

function updateAllSchemaConstraintStates() {
  updateSchemaConstraintState(schemaDetailEl.querySelector('.schema-rule'));
}

function schemaRuleAddress(rule) {
  return rule?.selector ?? rule?.path ?? '';
}

function schemaRuleAddressKind(rule) {
  return rule?.selector ? 'selector' : 'path';
}

function withSchemaRuleAddress(rule, address) {
  const { path, selector, ...rest } = rule;
  return schemaRuleAddressKind(rule) === 'selector'
    ? { ...rest, selector: address }
    : { ...rest, path: address };
}

function isSchemaChildPath(parent, child) {
  return child.startsWith(`${parent}.`) || child.startsWith(`${parent}[`);
}

function compareSchemaRulePaths(a, b) {
  const left = schemaRuleAddress(a);
  const right = schemaRuleAddress(b);
  if (left === right) {
    return 0;
  }
  if (isSchemaChildPath(left, right)) {
    return -1;
  }
  if (isSchemaChildPath(right, left)) {
    return 1;
  }
  return left.localeCompare(right, undefined, { numeric: true });
}

function sortSchemaRules(schema) {
  return {
    ...schema,
    rules: [...schema.rules].sort(compareSchemaRulePaths),
  };
}

function schemaRuleHasDescendants(rule, rules) {
  const path = schemaRuleAddress(rule);
  return path.length > 0 && rules.some((candidate) => candidate !== rule && isSchemaChildPath(path, schemaRuleAddress(candidate)));
}

function schemaParentPath(path, rules) {
  const parents = rules
    .map((rule) => schemaRuleAddress(rule))
    .filter((candidate) => candidate && candidate !== path && isSchemaChildPath(candidate, path))
    .sort((left, right) => right.length - left.length);
  return parents[0] ?? parentPath(path);
}

function schemaRuleIsVisible(rule, rules) {
  let current = schemaParentPath(schemaRuleAddress(rule), rules);
  while (current && current !== '$') {
    const parent = rules.find((candidate) => schemaRuleAddress(candidate) === current);
    if (parent && schemaRuleHasDescendants(parent, rules) && !schemaBuilderOpenPaths.has(current)) {
      return false;
    }
    current = schemaParentPath(current, rules);
  }
  return true;
}

function schemaTreeItemHtml(rule, rules, selectedPath) {
  const path = schemaRuleAddress(rule) || '$.field';
  const hasChildren = schemaRuleHasDescendants(rule, rules);
  const isOpen = schemaBuilderOpenPaths.has(path);
  const segments = parseSourceBuilderPath(path);
  const isAttribute = segments.at(-1)?.type === 'attr';
  const depth = Math.max(0, segments.filter((segment) => segment.type !== 'attr').length - 1) + (isAttribute ? 1 : 0);
  const name = segments.at(-1);
  const label = isAttribute ? `@${name?.key ?? 'attr'}` : name?.type === 'index' ? `[${name.index}]` : name?.key ?? path;
  const type = rule.constraints?.type || 'any';
  const toggle = hasChildren
    ? `<span class="source-tree-toggle" data-action="toggle" aria-hidden="true">${isOpen ? '▾' : '▸'}</span>`
    : '<span class="source-tree-toggle" aria-hidden="true"></span>';
  return `
    <button class="source-tree-item schema-tree-item${path === selectedPath ? ' is-selected' : ''}" type="button" data-path="${escapeHtml(path)}" data-source-type="${escapeHtml(type)}" data-source-kind="${isAttribute ? 'attribute' : 'binding'}" aria-expanded="${hasChildren ? String(isOpen) : 'false'}" style="--source-depth: ${Math.min(depth, 6)};">
      ${toggle}
      <span class="source-tree-name">${escapeHtml(label)}${hasChildren ? '<small>children</small>' : ''}</span>
      <span class="source-tree-meta">${escapeHtml(rule.constraints?.datatype || type)}</span>
    </button>
  `;
}

function schemaRuleDetailHtml(rule, rules) {
  if (!rule) {
    return '<div class="source-empty-detail">Select a rule to edit it.</div>';
  }
  const hasChildRules = schemaRuleHasDescendants(rule, rules);
  const path = schemaRuleAddress(rule) || '$.field';
  return `
    <div class="source-detail-head">
      <div>
        <h3>${escapeHtml(path)}</h3>
        <p><span class="source-detail-type">${escapeHtml(rule.constraints?.type || 'any')}</span></p>
      </div>
      <button id="schema-remove-selected" type="button">Remove</button>
    </div>
    <div class="schema-rule source-detail-grid" data-path="${escapeHtml(path)}" data-rule-kind="${escapeHtml(schemaRuleAddressKind(rule))}">
      ${schemaRuleFieldsHtml(rule, hasChildRules)}
    </div>
  `;
}

function selectSchemaRulePath(path) {
  syncSelectedSchemaDetail();
  schemaBuilderSelectedPath = path;
  renderSchemaBuilder(schemaBuilderSchema, schemaBuilderSelectedPath);
}

function scrollSchemaRuleIntoView(row) {
  if (!(row instanceof HTMLElement)) {
    return;
  }
  row.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

function readSchemaRuleFromRow(row) {
  const read = (field) => row.querySelector(`[data-field="${field}"]`);
  const constraints = {};
  const type = read('type')?.value.trim();
  const datatype = read('datatype')?.value.trim();
  const required = read('required')?.checked;
  const nullable = read('nullable')?.checked;
  const allowInfinity = read('allow_infinity')?.checked;
  const allowNan = read('allow_nan')?.checked;
  const sign = read('sign')?.value;
  const togglePair = read('toggle_pair')?.value;
  const pattern = read('pattern')?.value.trim();
  const nullValuePreset = read('null_value_preset')?.value;
  const customNullValue = read('null_value_custom')?.value.trim();
  const minValue = read('min_value')?.value.trim();
  const maxValue = read('max_value')?.value.trim();

  if (type) constraints.type = type;
  if (datatype) constraints.datatype = datatype;
  if (required) constraints.required = true;
  if (nullable && !read('nullable')?.disabled) constraints.nullable = true;
  if (allowInfinity && !read('allow_infinity')?.disabled) constraints.allow_infinity = true;
  if (allowNan && !read('allow_nan')?.disabled) constraints.allow_nan = true;
  if (sign && !read('sign')?.disabled) constraints.sign = sign;
  if (togglePair && !read('toggle_pair')?.disabled) constraints.toggle_pair = togglePair;
  if (!read('null_value_preset')?.disabled) {
    if (nullValuePreset === 'custom' && customNullValue) {
      constraints.null_value = customNullValue;
    } else if (nullValuePreset && nullValuePreset !== 'custom') {
      constraints.null_value = nullValuePreset;
    }
  }
  if (pattern && !read('pattern')?.disabled) constraints.pattern = pattern;
  if (minValue && !read('min_value')?.disabled) constraints.min_value = minValue;
  if (maxValue && !read('max_value')?.disabled) constraints.max_value = maxValue;

  for (const key of ['min_length', 'max_length', 'length_exact', 'min_children', 'max_children']) {
    if (read(key)?.disabled) {
      continue;
    }
    const value = Number.parseInt(read(key)?.value ?? '', 10);
    if (Number.isFinite(value)) constraints[key] = value;
  }

  const ruleKind = row.dataset.ruleKind === 'selector' ? 'selector' : 'path';
  const currentAddress = row.dataset.path ?? schemaBuilderSelectedPath ?? '$.field';
  return {
    [ruleKind]: ruleKind === 'selector'
      ? currentAddress
      : pathWithEditableName(currentAddress, read('path')?.value.trim() || pathEditableName(currentAddress)),
    constraints,
  };
}

function syncSelectedSchemaDetail() {
  const row = schemaDetailEl.querySelector('.schema-rule');
  if (!(row instanceof HTMLElement) || !schemaBuilderSelectedPath) {
    return;
  }
  const index = schemaBuilderSchema.rules.findIndex((rule) => schemaRuleAddress(rule) === schemaBuilderSelectedPath);
  if (index < 0) {
    return;
  }
  const nextRule = readSchemaRuleFromRow(row);
  const nextAddress = schemaRuleAddress(nextRule);
  if (hasDuplicatePath(schemaBuilderSchema.rules, nextAddress, schemaBuilderSelectedPath)) {
    setPathControlInvalid(row.querySelector('[data-field="path"]'), true, 'Duplicate binding name at this level.');
    return;
  }
  const oldPath = schemaBuilderSelectedPath;
  if (nextAddress !== oldPath) {
    schemaBuilderSchema.rules = schemaBuilderSchema.rules.map((rule) => {
      if (schemaRuleAddress(rule) === oldPath) {
        return nextRule;
      }
      return withSchemaRuleAddress(rule, rebaseChildPath(schemaRuleAddress(rule), oldPath, nextAddress));
    });
  } else {
    schemaBuilderSchema.rules[index] = nextRule;
  }
  schemaBuilderSelectedPath = nextAddress;
}

function removeSelectedSchemaRule() {
  syncSelectedSchemaDetail();
  const selected = schemaBuilderSelectedPath;
  schemaBuilderSchema.rules = schemaBuilderSchema.rules.filter((rule) => schemaRuleAddress(rule) !== selected && !isSchemaChildPath(selected, schemaRuleAddress(rule)));
  schemaBuilderOpenPaths.delete(selected);
  renderSchemaBuilder(schemaBuilderSchema, schemaRuleAddress(schemaBuilderSchema.rules[0]) || null);
}

function selectedSchemaRule() {
  syncSelectedSchemaDetail();
  return schemaBuilderSchema.rules.find((rule) => schemaRuleAddress(rule) === schemaBuilderSelectedPath);
}

function selectedSchemaRulePath() {
  return selectedSchemaRule()?.path || '$.app';
}

function selectedSchemaRuleAllowsChildren() {
  const selected = selectedSchemaRule();
  if (!selected) {
    return false;
  }

  const type = selected.constraints?.type;
  const datatype = String(selected.constraints?.datatype ?? '').trim().toLowerCase();
  return CHILD_CAPABLE_SCHEMA_TYPES.has(type)
    || CHILD_CAPABLE_DATATYPES.has(datatype);
}

function selectSchemaRuleRow(row) {
  if (row instanceof HTMLElement) {
    selectSchemaRulePath(row.dataset.path);
  }
  updateSchemaChildActionState();
  scrollSchemaRuleIntoView(row);
}

function renderSchemaBuilder(schema, selectedPath = null) {
  const sortedSchema = sortSchemaRules(schema);
  schemaBuilderSchema = sortedSchema;
  schemaBuilderWorldEl.value = schema.world === 'closed' ? 'closed' : 'open';
  const activePath = selectedPath ?? (schemaRuleAddress(sortedSchema.rules[0]) || null);
  schemaBuilderSelectedPath = activePath;
  if (!schemaBuilderOpenPathsInitialized) {
    for (const rule of sortedSchema.rules) {
      if (schemaRuleHasDescendants(rule, sortedSchema.rules)) {
        schemaBuilderOpenPaths.add(schemaRuleAddress(rule));
      }
    }
    schemaBuilderOpenPathsInitialized = true;
  }
  schemaRuleListEl.innerHTML = sortedSchema.rules
    .filter((rule) => schemaRuleIsVisible(rule, sortedSchema.rules))
    .map((rule) => schemaTreeItemHtml(rule, sortedSchema.rules, activePath))
    .join('');
  schemaDetailEl.innerHTML = schemaRuleDetailHtml(sortedSchema.rules.find((rule) => schemaRuleAddress(rule) === activePath), sortedSchema.rules);
  updateAllSchemaConstraintStates();
  updateSchemaChildActionState();
  scrollSchemaRuleIntoView(schemaRuleListEl.querySelector('.schema-tree-item.is-selected'));
}

function collectSchemaFromBuilder() {
  syncSelectedSchemaDetail();
  return {
    world: schemaBuilderWorldEl.value === 'closed' ? 'closed' : 'open',
    rules: schemaBuilderSchema.rules,
  };
}

function updateSchemaChildActionState() {
  const allowsChildren = selectedSchemaRuleAllowsChildren();
  for (const button of [schemaAddChildBtn, schemaAddChildManyBtn]) {
    button.disabled = !allowsChildren;
    button.title = allowsChildren ? '' : CHILD_ACTION_HINT;
  }
  schemaAddAttributeBtn.disabled = !schemaBuilderSelectedPath;
}

function parentPath(path) {
  const attribute = path.lastIndexOf('.@.');
  if (attribute >= 0) {
    const tail = path.slice(attribute + 3);
    if (!tail.includes('.') && !tail.includes('[')) {
      return attribute > 0 ? path.slice(0, attribute) : '$';
    }
  }
  const bracket = path.lastIndexOf('[');
  const dot = path.lastIndexOf('.');
  const cut = Math.max(bracket, dot);
  return cut > 0 ? path.slice(0, cut) : '$';
}

function childPath(base, key) {
  return `${base}.${key}`;
}

function childSelector(base, key) {
  return `${base}.*.${key}`;
}

function indexedChildPath(base, rows) {
  const indexes = rows
    .filter((row) => parentPath(row.path) === base)
    .map((row) => parseSourceBuilderPath(row.path).at(-1))
    .filter((segment) => segment?.type === 'index')
    .map((segment) => segment.index);
  const nextIndex = indexes.length > 0 ? Math.max(...indexes) + 1 : 0;
  return `${base}[${nextIndex}]`;
}

function attributePath(base, key) {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(key)
    ? `${base}.@.${key}`
    : `${base}.@.[${JSON.stringify(key)}]`;
}

function pathEditableName(path) {
  const last = parseSourceBuilderPath(path).at(-1);
  if (last?.type === 'key' || last?.type === 'attr') {
    return last.key;
  }
  if (last?.type === 'index') {
    return `[${last.index}]`;
  }
  return path;
}

function pathAllowsNameEdit(path) {
  const last = parseSourceBuilderPath(path).at(-1);
  return last?.type === 'key' || last?.type === 'attr';
}

function pathWithEditableName(path, name) {
  const last = parseSourceBuilderPath(path).at(-1);
  if (!name || (last?.type !== 'key' && last?.type !== 'attr')) {
    return path;
  }
  const base = parentPath(path);
  return last.type === 'attr' ? attributePath(base, name) : childPath(base, name);
}

function hasDuplicatePath(rows, path, currentPath) {
  return rows.some((row) => schemaRuleAddress(row) === path && schemaRuleAddress(row) !== currentPath);
}

function setPathControlInvalid(control, invalid, message = '') {
  if (!control) {
    return;
  }
  if (invalid) {
    control.setAttribute('aria-invalid', 'true');
    control.setAttribute('data-invalid', 'true');
    control.setAttribute('title', message);
  } else {
    control.removeAttribute('aria-invalid');
    control.removeAttribute('data-invalid');
    control.removeAttribute('title');
  }
}

function rebaseChildPath(path, oldBase, newBase) {
  if (path === oldBase) {
    return newBase;
  }
  if (!isSchemaChildPath(oldBase, path)) {
    return path;
  }
  return `${newBase}${path.slice(oldBase.length)}`;
}

function addSchemaRule(kind) {
  if ((kind === 'child' || kind === 'child-many') && !selectedSchemaRuleAllowsChildren()) {
    updateSchemaChildActionState();
    return;
  }

  const schema = collectSchemaFromBuilder();
  const selected = selectedSchemaRulePath();
  const base = kind === 'peer' ? parentPath(selected) : selected;
  const index = schema.rules.length + 1;
  const address = kind === 'attribute'
    ? attributePath(base, `attr${index}`)
    : kind === 'child-many'
      ? childSelector(base, `child${index}`)
      : childPath(base, kind === 'peer' ? `peer${index}` : `child${index}`);
  schema.rules.push({
    ...(kind === 'child-many' ? { selector: address } : { path: address }),
    constraints: { type: 'StringLiteral', required: true },
  });
  renderSchemaBuilder(schema, address);
}

function seedSchemaFromSource() {
  const schema = {
    world: schemaBuilderWorldEl.value === 'closed' ? 'closed' : 'open',
    rules: [],
  };
  schema.rules = seedSchemaFromAeonSource(sourceEl.value, {
    validationMode: validationModeEl.value,
    maxSeparatorDepth: readPositiveInt(separatorDepthEl, 8),
    maxAttributeDepth: readPositiveInt(attributeDepthEl, 1),
    maxGenericDepth: readPositiveInt(genericDepthEl, 1),
  });
  if (schema.rules.length === 0) {
    schema.rules = structuredClone(SAMPLE_SCHEMA.rules);
  }
  renderSchemaBuilder(schema);
}

function openSchemaBuilder() {
  try {
    schemaBuilderOpenPaths = new Set();
    schemaBuilderOpenPathsInitialized = false;
    renderSchemaBuilder(parseSchemaTextOrDefault());
    schemaBuilderModalEl.hidden = false;
  } catch (error) {
    diagnosticsEl.textContent = `1. ${error instanceof Error ? error.message : String(error)}`;
    setStatus(runStatusEl, 'source invalid', 'error');
    setStatus(diagStatusEl, '1 error', 'error');
  }
}

function closeSchemaBuilder() {
  schemaBuilderModalEl.hidden = true;
}

const SOURCE_CONTAINER_TYPES = new Set(['ObjectNode', 'ListNode', 'TupleNode', 'NodeLiteral']);
const SOURCE_VALUELESS_CONTAINER_TYPES = new Set(['ObjectNode', 'ListNode', 'TupleNode']);
const SOURCE_RESERVED_NULL_VALUES = ['none', 'notSet', 'notApplicable', 'tombstone'];
const SOURCE_DATATYPE_BY_TYPE = {
  StringLiteral: 'string',
  NumberLiteral: 'number',
  IntegerLiteral: 'integer',
  FloatLiteral: 'float',
  BooleanLiteral: 'boolean',
  ToggleLiteral: 'toggle',
  NullLiteral: 'null',
  NaNLiteral: 'nan',
  InfinityLiteral: 'infinity',
  ObjectNode: 'object',
  ListNode: 'list',
  TupleNode: 'tuple',
  NodeLiteral: 'node',
  HexLiteral: 'hex',
  EncodingLiteral: 'encoding',
  RadixLiteral: 'radix',
  SeparatorLiteral: 'separator',
  DateLiteral: 'date',
  TimeLiteral: 'time',
  DateTimeLiteral: 'datetime',
};

const SOURCE_TYPE_BY_VALUE_TYPE = new Map([
  ['StringLiteral', 'StringLiteral'],
  ['TrimtickStringLiteral', 'StringLiteral'],
  ['NumberLiteral', 'NumberLiteral'],
  ['IntegerLiteral', 'IntegerLiteral'],
  ['FloatLiteral', 'FloatLiteral'],
  ['BooleanLiteral', 'BooleanLiteral'],
  ['ToggleLiteral', 'ToggleLiteral'],
  ['NullLiteral', 'NullLiteral'],
  ['NaNLiteral', 'NaNLiteral'],
  ['InfinityLiteral', 'InfinityLiteral'],
  ['ObjectNode', 'ObjectNode'],
  ['ListNode', 'ListNode'],
  ['TupleLiteral', 'TupleNode'],
  ['TupleNode', 'TupleNode'],
  ['NodeLiteral', 'NodeLiteral'],
  ['HexLiteral', 'HexLiteral'],
  ['EncodingLiteral', 'EncodingLiteral'],
  ['RadixLiteral', 'RadixLiteral'],
  ['SeparatorLiteral', 'SeparatorLiteral'],
  ['DateLiteral', 'DateLiteral'],
  ['TimeLiteral', 'TimeLiteral'],
  ['DateTimeLiteral', 'DateTimeLiteral'],
  ['WTCDateTimeLiteral', 'WTCDateTimeLiteral'],
]);

let sourceBuilderRows = [];
let sourceBuilderSelectedPath = null;
let sourceBuilderOpenPaths = new Set();
let sourceBuilderOpenPathsInitialized = false;

function sourceTypeOptions(selected) {
  return SCHEMA_TYPE_OPTIONS
    .map((type) => `<option value="${type}"${type === selected ? ' selected' : ''}>${type}</option>`)
    .join('');
}

function sourceTypeOptionsForRow(row, rows) {
  const hasChildren = sourceRowHasChildren(row, rows);
  if (!hasChildren) {
    return sourceTypeOptions(row.type);
  }
  const allowed = row.type === 'ListNode' || row.type === 'TupleNode'
    ? ['ListNode', 'TupleNode']
    : [row.type];
  return allowed
    .map((type) => `<option value="${type}"${type === row.type ? ' selected' : ''}>${type}</option>`)
    .join('');
}

function sourceDatatypeForType(type) {
  return SOURCE_DATATYPE_BY_TYPE[type] ?? '';
}

function sourceDefaultValueForType(type) {
  if (type === 'StringLiteral') return '';
  if (type === 'NumberLiteral' || type === 'IntegerLiteral') return '0';
  if (type === 'FloatLiteral') return '0.0';
  if (type === 'BooleanLiteral') return 'true';
  if (type === 'ToggleLiteral') return 'on';
  if (type === 'NullLiteral') return 'none';
  if (type === 'NaNLiteral') return 'NaN';
  if (type === 'InfinityLiteral') return 'Infinity';
  if (type === 'HexLiteral') return '#00';
  if (type === 'EncodingLiteral') return '';
  if (type === 'RadixLiteral') return '%0';
  if (type === 'SeparatorLiteral') return ' ';
  if (type === 'DateLiteral') return '2026-01-01';
  if (type === 'TimeLiteral') return '12:00:00';
  if (type === 'DateTimeLiteral') return '2026-01-01T12:00:00Z';
  if (type === 'NodeLiteral') return 'node';
  return '';
}

function sourceNullUiValue(value) {
  const raw = String(value?.raw ?? '');
  const literalValue = String(value?.value ?? raw.replace(/^!/, '') ?? 'none');
  if (raw.startsWith('!"') || raw.startsWith("!'")) {
    return `custom:${literalValue}`;
  }
  if (SOURCE_RESERVED_NULL_VALUES.includes(literalValue)) {
    return literalValue;
  }
  return literalValue ? `custom:${literalValue}` : 'none';
}

function sourceTypeForEvent(event) {
  const datatype = typeof event.datatype === 'string' ? event.datatype : '';
  return BUILTIN_SCHEMA_TYPES_BY_DATATYPE.get(datatype.toLowerCase())
    ?? SOURCE_TYPE_BY_VALUE_TYPE.get(event.value?.valueType ?? event.value?.type ?? event.valueType)
    ?? 'StringLiteral';
}

function sourceTypeForValue(value) {
  return SOURCE_TYPE_BY_VALUE_TYPE.get(value?.valueType ?? value?.type) ?? 'StringLiteral';
}

function sourceUiValueForEvent(event, type) {
  const value = event.value ?? {};
  if (type === 'StringLiteral') return value.value ?? value.raw ?? '';
  if (type === 'BooleanLiteral') return value.value === false ? 'false' : 'true';
  if (type === 'NullLiteral') return sourceNullUiValue(value);
  if (type === 'NaNLiteral') return String(value.raw ?? value.value ?? 'NaN');
  if (type === 'InfinityLiteral') return String(value.raw ?? value.value ?? 'Infinity');
  if (type === 'NodeLiteral') return value.tag ?? 'node';
  if (SOURCE_CONTAINER_TYPES.has(type)) return '';
  return String(value.raw ?? value.value ?? sourceDefaultValueForType(type));
}

function sourceUiValueForValue(value, type) {
  if (type === 'StringLiteral') return value?.value ?? value?.raw ?? '';
  if (type === 'BooleanLiteral') return value?.value === false ? 'false' : 'true';
  if (type === 'NullLiteral') return sourceNullUiValue(value);
  if (type === 'NaNLiteral') return String(value?.raw ?? value?.value ?? 'NaN');
  if (type === 'InfinityLiteral') return String(value?.raw ?? value?.value ?? 'Infinity');
  if (type === 'NodeLiteral') return value?.tag ?? 'node';
  if (SOURCE_CONTAINER_TYPES.has(type)) return '';
  return String(value?.raw ?? value?.value ?? sourceDefaultValueForType(type));
}

function datatypeName(datatype) {
  if (typeof datatype === 'string') {
    return datatype;
  }
  return datatype?.name ?? '';
}

function addSourceAttributeRows(attributes, ownerPath, rows, seen) {
  for (const attribute of attributes ?? []) {
    const entries = attribute?.entries instanceof Map
      ? attribute.entries
      : new Map(Object.entries(attribute?.entries ?? {}));
    for (const [key, entry] of entries) {
      const path = attributePath(ownerPath, key);
      if (seen.has(path)) {
        continue;
      }
      const type = sourceTypeForValue(entry?.value);
      rows.push({
        path,
        type,
        datatype: datatypeName(entry?.datatype) || sourceDatatypeForType(type),
        value: sourceUiValueForValue(entry?.value, type),
      });
      seen.add(path);
      addSourceAttributeRows(entry?.attributes, path, rows, seen);
      addSourceAttributeRowsFromValue(entry?.value, path, rows, seen);
    }
  }
}

function addSourceAnnotationRows(annotations, ownerPath, rows, seen) {
  const entries = annotations instanceof Map
    ? annotations
    : new Map(Object.entries(annotations ?? {}));
  for (const [key, entry] of entries) {
    const path = attributePath(ownerPath, key);
    if (seen.has(path)) {
      continue;
    }
    const type = sourceTypeForValue(entry?.value);
    rows.push({
      path,
      type,
      datatype: datatypeName(entry?.datatype) || sourceDatatypeForType(type),
      value: sourceUiValueForValue(entry?.value, type),
    });
    seen.add(path);
    addSourceAnnotationRows(entry?.annotations, path, rows, seen);
    addSourceAttributeRows(entry?.attributes, path, rows, seen);
    addSourceAttributeRowsFromValue(entry?.value, path, rows, seen);
  }
}

function addSourceAttributeRowsFromValue(value, path, rows, seen) {
  addSourceAttributeRows(value?.attributes, path, rows, seen);
  if (value?.type === 'ObjectNode') {
    for (const binding of value.bindings ?? []) {
      const child = childPath(path, binding.key);
      addSourceAttributeRows(binding.attributes, child, rows, seen);
      addSourceAttributeRowsFromValue(binding.value, child, rows, seen);
    }
  }
  if (value?.type === 'ListNode' || value?.type === 'TupleNode') {
    for (const [index, element] of (value.elements ?? []).entries()) {
      addSourceAttributeRowsFromValue(element, `${path}[${index}]`, rows, seen);
    }
  }
  if (value?.type === 'NodeLiteral') {
    for (const [index, child] of (value.children ?? []).entries()) {
      addSourceAttributeRowsFromValue(child, `${path}[${index}]`, rows, seen);
    }
  }
}

function sourceValueControlHtml(row, hasChildren) {
  const valueDisabled = SOURCE_VALUELESS_CONTAINER_TYPES.has(row.type) || (row.type === 'NodeLiteral' && hasChildren);
  const disabled = valueDisabled ? ' disabled' : '';
  const value = escapeHtml(row.value ?? sourceDefaultValueForType(row.type));
  if (row.type === 'BooleanLiteral') {
    return `<select data-field="value"${disabled}>
      <option value="true"${row.value !== 'false' ? ' selected' : ''}>true</option>
      <option value="false"${row.value === 'false' ? ' selected' : ''}>false</option>
    </select>`;
  }
  if (row.type === 'ToggleLiteral') {
    return `<select data-field="value"${disabled}>
      <option value="on"${row.value !== 'off' && row.value !== 'yes' && row.value !== 'no' ? ' selected' : ''}>on</option>
      <option value="off"${row.value === 'off' ? ' selected' : ''}>off</option>
      <option value="yes"${row.value === 'yes' ? ' selected' : ''}>yes</option>
      <option value="no"${row.value === 'no' ? ' selected' : ''}>no</option>
    </select>`;
  }
  if (row.type === 'NullLiteral') {
    const rawValue = row.value ?? sourceDefaultValueForType(row.type);
    const isReserved = SOURCE_RESERVED_NULL_VALUES.includes(rawValue);
    const customValue = rawValue.startsWith('custom:') ? rawValue.slice('custom:'.length) : isReserved ? '' : rawValue;
    const customDisabled = disabled || isReserved || !rawValue ? ' disabled' : '';
    return `<select data-field="value"${disabled}>
      <option value="none"${rawValue === 'none' || !rawValue ? ' selected' : ''}>!none</option>
      <option value="notSet"${rawValue === 'notSet' ? ' selected' : ''}>!notSet</option>
      <option value="notApplicable"${rawValue === 'notApplicable' ? ' selected' : ''}>!notApplicable</option>
      <option value="tombstone"${rawValue === 'tombstone' ? ' selected' : ''}>!tombstone</option>
      <option value="custom:${escapeHtml(customValue)}"${!isReserved && rawValue ? ' selected' : ''}>custom</option>
    </select>
    <input data-field="null-custom" type="text" placeholder="custom null" value="${escapeHtml(customValue)}"${customDisabled} />`;
  }
  if (row.type === 'NaNLiteral') {
    return `<select data-field="value"${disabled}>
      <option value="NaN"${row.value !== '-NaN' ? ' selected' : ''}>NaN</option>
      <option value="-NaN"${row.value === '-NaN' ? ' selected' : ''}>-NaN</option>
    </select>`;
  }
  if (row.type === 'InfinityLiteral') {
    return `<select data-field="value"${disabled}>
      <option value="Infinity"${row.value !== '-Infinity' ? ' selected' : ''}>Infinity</option>
      <option value="-Infinity"${row.value === '-Infinity' ? ' selected' : ''}>-Infinity</option>
    </select>`;
  }
  return `<textarea data-field="value" rows="2"${disabled}>${value}</textarea>`;
}

function sourceTreeItemHtml(row, rows, selectedPath) {
  const hasChildren = sourceRowHasChildren(row, rows);
  const isOpen = sourceBuilderOpenPaths.has(row.path);
  const segments = parseSourceBuilderPath(row.path);
  const isAttribute = segments.at(-1)?.type === 'attr';
  const depth = Math.max(0, segments.filter((segment) => segment.type !== 'attr').length - 1) + (isAttribute ? 1 : 0);
  const selected = row.path === selectedPath;
  const name = segments.at(-1);
  const label = isAttribute ? `@${name?.key ?? 'attr'}` : name?.type === 'index' ? `[${name.index}]` : name?.key ?? row.path;
  const toggle = hasChildren
    ? `<span class="source-tree-toggle" data-action="toggle" aria-hidden="true">${isOpen ? '▾' : '▸'}</span>`
    : '<span class="source-tree-toggle" aria-hidden="true"></span>';
  return `
    <button class="source-tree-item${selected ? ' is-selected' : ''}" type="button" data-path="${escapeHtml(row.path)}" data-source-type="${escapeHtml(row.type)}" data-source-kind="${isAttribute ? 'attribute' : 'binding'}" aria-expanded="${hasChildren ? String(isOpen) : 'false'}" style="--source-depth: ${Math.min(depth, 6)};">
      ${toggle}
      <span class="source-tree-name">${escapeHtml(label)}${hasChildren ? '<small>children</small>' : ''}</span>
      <span class="source-tree-meta">${escapeHtml(row.datatype || sourceDatatypeForType(row.type))}</span>
    </button>
  `;
}

function sourceDetailHtml(row, rows) {
  if (!row) {
    return '<div class="source-empty-detail">Select a binding to edit it.</div>';
  }
  const hasChildren = sourceRowHasChildren(row, rows);
  const isAttribute = parseSourceBuilderPath(row.path).at(-1)?.type === 'attr';
  const valueLabel = row.type === 'NodeLiteral' ? 'Tag' : 'Value';
  const projectedDisabled = isAttribute ? ' disabled' : '';
  const projectedChecked = readIncludePaths().includes(row.path) ? ' checked' : '';
  return `
    <div class="source-detail-head">
      <div>
        <h3>${escapeHtml(row.path)}</h3>
        <p><span class="source-detail-type">${isAttribute ? 'Attribute' : escapeHtml(row.type)}</span></p>
      </div>
      <button id="source-remove-selected" type="button">Remove</button>
    </div>
    <div class="source-detail-grid">
      <label class="control-field source-detail-path">
        <span>Key${hasChildren ? '<small>has children</small>' : ''}</span>
        <input data-source-detail="path" type="text" value="${escapeHtml(pathEditableName(row.path))}" ${pathAllowsNameEdit(row.path) ? '' : 'disabled'} />
      </label>
      <label class="control-field">
        <span>Type</span>
        <select class="source-type-control" data-source-detail="type">${sourceTypeOptionsForRow(row, rows)}</select>
      </label>
      <label class="control-field">
        <span>Datatype</span>
        <input class="source-datatype-control" data-source-detail="datatype" type="text" value="${escapeHtml(row.datatype ?? sourceDatatypeForType(row.type))}" />
      </label>
      <label class="control-field source-detail-value">
        <span>${valueLabel}</span>
        ${sourceValueControlHtml(row, hasChildren).replaceAll('data-field=', 'data-source-detail=')}
      </label>
      <label class="inline-toggle source-detail-projection">
        <input data-source-detail="projected" type="checkbox"${projectedChecked}${projectedDisabled} />
        <span>Materialize projected</span>
      </label>
    </div>
  `;
}

function sourceRowsFromSource() {
  const result = compile(sourceEl.value, {
    recovery: true,
    maxSeparatorDepth: readPositiveInt(separatorDepthEl, 8),
    maxAttributeDepth: readPositiveInt(attributeDepthEl, 1),
    maxGenericDepth: readPositiveInt(genericDepthEl, 1),
    ...(validationModeEl.value === 'strict'
      ? { datatypePolicy: 'reserved_only' }
      : validationModeEl.value === 'custom'
        ? { datatypePolicy: 'allow_custom' }
        : {}),
  });
  const rows = [];
  const seen = new Set();
  for (const event of result.events ?? []) {
    const path = formatPath(event.path);
    if (!path || path === '$' || path.includes('[*]') || path.startsWith('$.["aeon:') || seen.has(path)) {
      continue;
    }
    const type = sourceTypeForEvent(event);
    const isAnonymousIndexed = parseSourceBuilderPath(path).at(-1)?.type === 'index';
    rows.push({
      path,
      type,
      datatype: event.datatype ?? (isAnonymousIndexed ? '' : sourceDatatypeForType(type)),
      value: sourceUiValueForEvent(event, type),
    });
    seen.add(path);
    addSourceAnnotationRows(event.annotations, path, rows, seen);
    addSourceAttributeRowsFromValue(event.value, path, rows, seen);
  }
  if (rows.length > 0) {
    return rows;
  }
  return structuredClone(SAMPLE_SCHEMA.rules)
    .filter((rule) => rule.path)
    .map((rule) => ({
      path: rule.path,
      type: rule.constraints?.type ?? 'StringLiteral',
      datatype: rule.constraints?.datatype ?? sourceDatatypeForType(rule.constraints?.type ?? 'StringLiteral'),
      value: sourceDefaultValueForType(rule.constraints?.type ?? 'StringLiteral'),
    }));
}

function orderSourceRows(rows) {
  const pathSet = new Set(rows.map((row) => row.path));
  const visited = new Set();
  const ordered = [];
  const childrenByParent = new Map();

  for (const row of rows) {
    const parent = parentPath(row.path);
    if (!childrenByParent.has(parent)) {
      childrenByParent.set(parent, []);
    }
    childrenByParent.get(parent).push(row);
  }

  const append = (row) => {
    if (!row?.path || visited.has(row.path)) {
      return;
    }
    visited.add(row.path);
    ordered.push(row);
    for (const child of childrenByParent.get(row.path) ?? []) {
      append(child);
    }
  };

  for (const row of rows) {
    const parent = parentPath(row.path);
    if (parent === '$' || !pathSet.has(parent)) {
      append(row);
    }
  }
  for (const row of rows) {
    append(row);
  }

  return ordered;
}

function sourceRowIsVisible(row, rows) {
  let current = parentPath(row.path);
  while (current && current !== '$') {
    const parent = rows.find((candidate) => candidate.path === current);
    if (parent && sourceRowHasChildren(parent, rows) && !sourceBuilderOpenPaths.has(current)) {
      return false;
    }
    current = parentPath(current);
  }
  return true;
}

function visibleSourceRows(rows) {
  return rows.filter((row) => sourceRowIsVisible(row, rows));
}

function openSourceAncestors(path) {
  let current = parentPath(path);
  while (current && current !== '$') {
    sourceBuilderOpenPaths.add(current);
    current = parentPath(current);
  }
}

function renderSourceBuilder(rows = sourceRowsFromSource(), selectedPath = null) {
  sourceBuilderRows = orderSourceRows([...rows]);
  if (!sourceBuilderOpenPathsInitialized) {
    for (const row of sourceBuilderRows) {
      if (sourceRowHasChildren(row, sourceBuilderRows)) {
        sourceBuilderOpenPaths.add(row.path);
      }
    }
    sourceBuilderOpenPathsInitialized = true;
  }
  sourceBuilderSelectedPath = selectedPath && sourceBuilderRows.some((row) => row.path === selectedPath)
    ? selectedPath
    : sourceBuilderRows[0]?.path ?? null;
  sourceRuleListEl.innerHTML = visibleSourceRows(sourceBuilderRows)
    .map((row) => sourceTreeItemHtml(row, sourceBuilderRows, sourceBuilderSelectedPath))
    .join('');
  const selected = sourceBuilderRows.find((row) => row.path === sourceBuilderSelectedPath);
  sourceDetailEl.innerHTML = sourceDetailHtml(selected, sourceBuilderRows);
  updateSourceChildActionState();
  scrollSchemaRuleIntoView(sourceRuleListEl.querySelector('.source-tree-item.is-selected'));
}

function openSourceBuilder() {
  try {
    sourceBuilderOpenPaths = new Set();
    sourceBuilderOpenPathsInitialized = false;
    renderSourceBuilder();
    sourceBuilderModalEl.hidden = false;
  } catch (error) {
    diagnosticsEl.textContent = `1. ${error instanceof Error ? error.message : String(error)}`;
    setStatus(runStatusEl, 'source invalid', 'error');
    setStatus(diagStatusEl, '1 error', 'error');
  }
}

function closeSourceBuilder() {
  sourceBuilderModalEl.hidden = true;
}

function readSourceBuilderRows() {
  syncSelectedSourceDetail();
  return sourceBuilderRows
    .map((row) => ({ ...row }))
    .filter((row) => row.path && row.path !== '$');
}

function parseSourceBuilderPath(path) {
  if (!path.startsWith('$.')) {
    return [];
  }
  const segments = [];
  const pattern = /\.@\.([A-Za-z_][A-Za-z0-9_-]*)|\.@\.\["((?:[^"\\]|\\.)*)"\]|\.@\.\['((?:[^'\\]|\\.)*)'\]|\.([A-Za-z_][A-Za-z0-9_-]*|"([^"\\]|\\.)*"|'([^'\\]|\\.)*')|\[(\d+)\]|\["((?:[^"\\]|\\.)*)"\]|\['((?:[^'\\]|\\.)*)'\]/g;
  let match;
  while ((match = pattern.exec(path)) !== null) {
    const token = match[0];
    if (match[1] !== undefined || match[2] !== undefined || match[3] !== undefined) {
      segments.push({ type: 'attr', key: match[1] ?? (match[2] !== undefined ? JSON.parse(`"${match[2]}"`) : match[3]) });
    } else if (token.startsWith('.')) {
      const key = token.slice(1);
      segments.push({ type: 'key', key: key.startsWith('"') ? JSON.parse(key) : key.startsWith("'") ? key.slice(1, -1) : key });
    } else if (match[7] !== undefined) {
      segments.push({ type: 'index', index: Number.parseInt(match[7], 10) });
    } else if (match[8] !== undefined || match[9] !== undefined) {
      segments.push({ type: 'key', key: match[8] !== undefined ? JSON.parse(`"${match[8]}"`) : match[9] });
    }
  }
  return segments;
}

function aeonBindingKey(key) {
  return /^[A-Za-z_][A-Za-z0-9_-]*$/.test(key) ? key : JSON.stringify(key);
}

function sourceRowHasChildren(row, rows) {
  return SOURCE_CONTAINER_TYPES.has(row.type)
    && rows.some((candidate) => candidate !== row && parentPath(candidate.path) === row.path && !candidate.path.includes('.@.'));
}

function selectedSourceRowPath() {
  syncSelectedSourceDetail();
  return sourceBuilderSelectedPath || '$.app';
}

function selectedSourceRowAllowsChildren() {
  syncSelectedSourceDetail();
  const selected = sourceBuilderRows.find((row) => row.path === sourceBuilderSelectedPath);
  return SOURCE_CONTAINER_TYPES.has(selected?.type)
    && !parseSourceBuilderPath(selected?.path ?? '').some((segment) => segment.type === 'attr');
}

function updateSourceChildActionState() {
  const allowsChildren = selectedSourceRowAllowsChildren();
  sourceAddChildBtn.disabled = !allowsChildren;
  sourceAddChildBtn.title = allowsChildren ? '' : CHILD_ACTION_HINT;
  sourceAddAttributeBtn.disabled = !sourceBuilderSelectedPath;
}

function syncSelectedSourceDetail() {
  if (!sourceBuilderSelectedPath) {
    return;
  }
  const index = sourceBuilderRows.findIndex((row) => row.path === sourceBuilderSelectedPath);
  if (index < 0) {
    return;
  }
  const read = (field) => sourceDetailEl.querySelector(`[data-source-detail="${field}"]`);
  const currentPath = sourceBuilderRows[index].path;
  const path = pathWithEditableName(currentPath, read('path')?.value.trim() || pathEditableName(currentPath));
  if (hasDuplicatePath(sourceBuilderRows, path, currentPath)) {
    setPathControlInvalid(read('path'), true, 'Duplicate binding name at this level.');
    return;
  }
  setPathControlInvalid(read('path'), false);
  const type = read('type')?.value || sourceBuilderRows[index].type;
  let value = read('value')?.value.trim() ?? sourceBuilderRows[index].value;
  if (type === 'NullLiteral' && value?.startsWith('custom:')) {
    value = `custom:${read('null-custom')?.value.trim() ?? value.slice('custom:'.length)}`;
  }
  const nextRow = {
    ...sourceBuilderRows[index],
    path,
    type,
    datatype: read('datatype')?.value.trim() ?? sourceBuilderRows[index].datatype,
    value,
  };
  if (path !== currentPath) {
    sourceBuilderRows = sourceBuilderRows.map((row) => {
      if (row.path === currentPath) {
        return nextRow;
      }
      return { ...row, path: rebaseChildPath(row.path, currentPath, path) };
    });
    const includePaths = readIncludePaths();
    if (includePaths.some((includePath) => includePath === currentPath || isSchemaChildPath(currentPath, includePath))) {
      writeIncludePaths(includePaths.map((includePath) => rebaseChildPath(includePath, currentPath, path)));
    }
  } else {
    sourceBuilderRows[index] = nextRow;
  }
  sourceBuilderSelectedPath = path;
}

function selectSourceRow(path) {
  syncSelectedSourceDetail();
  sourceBuilderSelectedPath = path;
  renderSourceBuilder(sourceBuilderRows, sourceBuilderSelectedPath);
}

function addSourceRow(kind) {
  syncSelectedSourceDetail();
  if (kind === 'child' && !selectedSourceRowAllowsChildren()) {
    updateSourceChildActionState();
    return;
  }
  const selected = selectedSourceRowPath();
  const selectedIsAttribute = parseSourceBuilderPath(selected).at(-1)?.type === 'attr';
  const base = kind === 'attribute'
    ? (selectedIsAttribute ? parentPath(selected) : selected)
    : kind === 'peer'
      ? parentPath(selected)
      : selected;
  const baseRow = sourceBuilderRows.find((row) => row.path === base);
  const index = sourceBuilderRows.length + 1;
  const attrIndex = sourceBuilderRows.filter((row) => parentPath(row.path) === base && parseSourceBuilderPath(row.path).at(-1)?.type === 'attr').length + 1;
  const path = kind === 'attribute'
    ? attributePath(base, `attr${attrIndex}`)
    : baseRow?.type === 'ListNode' || baseRow?.type === 'TupleNode' || baseRow?.type === 'NodeLiteral'
      ? indexedChildPath(base, sourceBuilderRows)
      : childPath(base, kind === 'peer' ? `peer${index}` : `child${index}`);
  sourceBuilderRows.push({
    path,
    type: 'StringLiteral',
    datatype: sourceDatatypeForType('StringLiteral'),
    value: sourceDefaultValueForType('StringLiteral'),
  });
  if (kind === 'child') {
    sourceBuilderOpenPaths.add(selected);
    openSourceAncestors(path);
  } else if (kind === 'attribute') {
    sourceBuilderOpenPaths.add(base);
  }
  renderSourceBuilder(sourceBuilderRows, path);
}

function removeSelectedSourceRow() {
  syncSelectedSourceDetail();
  const selected = sourceBuilderSelectedPath;
  sourceBuilderRows = sourceBuilderRows.filter((row) => row.path !== selected && !isSchemaChildPath(selected, row.path));
  sourceBuilderOpenPaths.delete(selected);
  renderSourceBuilder(sourceBuilderRows, sourceBuilderRows[0]?.path ?? null);
}

function directChildrenForPath(rows, path) {
  return rows
    .filter((row) => row.path !== path && parentPath(row.path) === path && parseSourceBuilderPath(row.path).at(-1)?.type !== 'attr');
}

function attributeRowsForPath(rows, path) {
  return rows
    .filter((row) => row.path.startsWith(`${path}.@.`) && parentPath(row.path) === path);
}

function renderSourceAttributes(rows, path) {
  const attrs = attributeRowsForPath(rows, path);
  if (attrs.length === 0) {
    return '';
  }
  const body = attrs.map((row) => {
    const key = parseSourceBuilderPath(row.path).at(-1)?.key ?? 'attr';
    const datatype = row.datatype ? `:${row.datatype}` : '';
    return `${aeonBindingKey(key)}${datatype} = ${sourceLiteral(row)}`;
  }).join(', ');
  return ` @{${body}}`;
}

function renderAnonymousSourceHead(row, rows) {
  const attrs = renderSourceAttributes(rows, row.path).trimStart();
  const datatype = row.datatype ? `:${row.datatype}` : '';
  return `${attrs}${datatype}`;
}

function renderAnonymousSourceValue(row, rows, depth = 0) {
  const head = renderAnonymousSourceHead(row, rows);
  const value = renderSourceValue(row, rows, depth);
  return head ? `${head} = ${value}` : value;
}

function renderSourceValue(row, rows, depth = 0) {
  const children = SOURCE_CONTAINER_TYPES.has(row.type) ? directChildrenForPath(rows, row.path) : [];
  if (children.length === 0) {
    return sourceLiteral(row);
  }
  const indent = '  '.repeat(depth);
  const childIndent = '  '.repeat(depth + 1);
  const isArrayLike = row.type === 'ListNode' || row.type === 'TupleNode';
  if (isArrayLike) {
    const values = children.map((child) => `${childIndent}${renderAnonymousSourceValue(child, rows, depth + 1)}`);
    const [open, close] = row.type === 'TupleNode' ? ['(', ')'] : ['[', ']'];
    return `${open}\n${values.join(',\n')}\n${indent}${close}`;
  }
  if (row.type === 'NodeLiteral') {
    const values = children.map((child) => `${childIndent}${renderAnonymousSourceValue(child, rows, depth + 1)}`);
    return `<${aeonBindingKey(row.value || 'node')}(\n${values.join('\n')}\n${indent})>`;
  }
  const bindings = children.map((child) => renderSourceBinding(child, rows, depth + 1));
  return `{\n${bindings.join('\n')}\n${indent}}`;
}

function sourceLiteral(row) {
  const value = String(row.value ?? sourceDefaultValueForType(row.type));
  if (row.type === 'StringLiteral') return JSON.stringify(value);
  if (row.type === 'BooleanLiteral') return value === 'false' ? 'false' : 'true';
  if (row.type === 'ToggleLiteral') return ['off', 'yes', 'no'].includes(value) ? value : 'on';
  if (row.type === 'NullLiteral') {
    if (value.startsWith('custom:')) return `!${JSON.stringify(value.slice('custom:'.length))}`;
    if (SOURCE_RESERVED_NULL_VALUES.includes(value)) return `!${value}`;
    return value ? `!${JSON.stringify(value)}` : '!none';
  }
  if (row.type === 'NaNLiteral') return value === '-NaN' ? '-NaN' : 'NaN';
  if (row.type === 'InfinityLiteral') return value === '-Infinity' ? '-Infinity' : 'Infinity';
  if (row.type === 'EncodingLiteral') return value.startsWith('%') ? value : `%${value}`;
  if (row.type === 'SeparatorLiteral') return value.startsWith('/') ? value : `/${value || ' '}/`;
  if (row.type === 'ObjectNode') return '{}';
  if (row.type === 'ListNode') return '[]';
  if (row.type === 'TupleNode') return '()';
  if (row.type === 'NodeLiteral') return `<${aeonBindingKey(value || 'node')}()>`;
  return value || sourceDefaultValueForType(row.type);
}

function renderSourceBinding(row, rows, depth = 0) {
  const segments = parseSourceBuilderPath(row.path);
  const last = segments.at(-1);
  const key = last?.type === 'key' ? last.key : `item${last?.index ?? 0}`;
  const datatype = row.datatype ? `:${row.datatype}` : '';
  const attrs = renderSourceAttributes(rows, row.path);
  return `${'  '.repeat(depth)}${aeonBindingKey(key)}${attrs}${datatype} = ${renderSourceValue(row, rows, depth)}`;
}

function buildSourceFromBuilder() {
  const rows = orderSourceRows(readSourceBuilderRows());
  const topLevel = rows
    .filter((row) => parseSourceBuilderPath(row.path).length === 1 && !parseSourceBuilderPath(row.path).some((segment) => segment.type === 'attr'))
    .filter((row) => !row.path.includes('.@.'));
  return topLevel.map((row) => renderSourceBinding(row, rows)).join('\n\n');
}

async function applySample(name) {
  const sample = SAMPLE_PRESETS[name];
  if (!sample) {
    return;
  }

  currentFilePath = null;
  refreshCurrentFilePath();
  sourceEl.value = sample.source;
  applySettings(sample.settings);
  syncSourceHighlight();
  setStatus(runStatusEl, `${name} sample`, 'ok');
  await run('typescript');
}

async function openAeonFile() {
  try {
    filePickerEl.value = '';
    const file = await new Promise((resolve) => {
      filePickerEl.onchange = () => resolve(filePickerEl.files?.[0] ?? null);
      filePickerEl.click();
    });
    if (!file) {
      setStatus(runStatusEl, 'open cancelled', 'warn');
      return;
    }
    currentFilePath = file.name;
    refreshCurrentFilePath();
    sourceEl.value = await file.text();
    syncSourceHighlight();
    setStatus(runStatusEl, 'file opened', 'ok');
    await run(lastProcessor);
  } catch (error) {
    setStatus(runStatusEl, 'open failed', 'error');
    diagnosticsEl.textContent = `1. ${error instanceof Error ? error.message : String(error)}`;
    setStatus(diagStatusEl, '1 error', 'error');
  }
}

async function saveAeonFile(saveAs = false) {
  try {
    const filename = saveAs || !currentFilePath ? 'playground.aeon' : currentFilePath;
    const href = URL.createObjectURL(new Blob([sourceEl.value], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = href;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(href);
    currentFilePath = filename;
    refreshCurrentFilePath();
    setStatus(runStatusEl, 'downloaded', 'ok');
  } catch (error) {
    setStatus(runStatusEl, 'save failed', 'error');
    diagnosticsEl.textContent = `1. ${error instanceof Error ? error.message : String(error)}`;
    setStatus(diagStatusEl, '1 error', 'error');
  }
}

async function importAeosOptions() {
  try {
    aeosPickerEl.value = '';
    const file = await new Promise((resolve) => {
      aeosPickerEl.onchange = () => resolve(aeosPickerEl.files?.[0] ?? null);
      aeosPickerEl.click();
    });
    if (!file) {
      setStatus(runStatusEl, 'import cancelled', 'warn');
      return;
    }

    schemaInputEl.value = await file.text();
    schemaEnabledEl.checked = true;
    schemaInputEl.disabled = false;
    syncSchemaHighlight();
    setInputView('schema');
    setStatus(runStatusEl, 'aeos imported', 'ok');
    setStatus(diagStatusEl, 'stale', 'warn');
  } catch (error) {
    setStatus(runStatusEl, 'aeos import failed', 'error');
    diagnosticsEl.textContent = `1. ${error instanceof Error ? error.message : String(error)}`;
    setStatus(diagStatusEl, '1 error', 'error');
  }
}

function exportAeosOptions() {
  try {
    const href = URL.createObjectURL(new Blob([schemaInputEl.value], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = href;
    link.download = 'playground.aeos';
    link.click();
    URL.revokeObjectURL(href);
    setStatus(runStatusEl, 'aeos exported', 'ok');
  } catch (error) {
    setStatus(runStatusEl, 'aeos export failed', 'error');
    diagnosticsEl.textContent = `1. ${error instanceof Error ? error.message : String(error)}`;
    setStatus(diagStatusEl, '1 error', 'error');
  }
}

async function chooseImageImport() {
  try {
    const picker = document.createElement('input');
    picker.type = 'file';
    picker.accept = 'image/*';
    const file = await new Promise((resolve) => {
      picker.onchange = () => resolve(picker.files?.[0] ?? null);
      picker.click();
    });
    if (!file) {
      setStatus(runStatusEl, 'import cancelled', 'warn');
      return;
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    let binary = '';
    for (const byte of bytes) {
      binary += String.fromCharCode(byte);
    }
    appendSourceSnippet(buildImageBase64Snippet({
      name: file.name,
      mime: file.type || 'application/octet-stream',
      base64: btoa(binary),
    }));
    await run(lastProcessor);
  } catch (error) {
    setStatus(runStatusEl, 'import failed', 'error');
    diagnosticsEl.textContent = `1. ${error instanceof Error ? error.message : String(error)}`;
    setStatus(diagStatusEl, '1 error', 'error');
  }
}

sourceEl.addEventListener('input', () => {
  syncSourceHighlight();
  setStatus(runStatusEl, 'stale', 'warn');
  setStatus(diagStatusEl, 'stale', 'warn');
});

sourceEl.addEventListener('keydown', (event) => {
  if (event.key === 'Tab' && sourceTabInsertsTabEl.checked) {
    event.preventDefault();
    insertSourceText('\t');
  }
});

sourceEl.addEventListener('scroll', () => {
  sourceHighlightEl.scrollTop = sourceEl.scrollTop;
  sourceHighlightEl.scrollLeft = sourceEl.scrollLeft;
  sourceGutterEl.scrollTop = sourceEl.scrollTop;
});

materializationModeEl.addEventListener('change', () => {
  includePathsEl.disabled = materializationModeEl.value !== 'projected';
  setStatus(runStatusEl, 'stale', 'warn');
  setStatus(diagStatusEl, 'stale', 'warn');
});
schemaEnabledEl.addEventListener('change', () => {
  schemaInputEl.disabled = !schemaEnabledEl.checked;
  setStatus(runStatusEl, 'stale', 'warn');
  setStatus(diagStatusEl, 'stale', 'warn');
});
schemaInputEl.addEventListener('input', () => {
  syncSchemaHighlight();
  setStatus(runStatusEl, 'stale', 'warn');
  setStatus(diagStatusEl, 'stale', 'warn');
});
schemaInputEl.addEventListener('scroll', () => {
  schemaHighlightEl.scrollTop = schemaInputEl.scrollTop;
  schemaHighlightEl.scrollLeft = schemaInputEl.scrollLeft;
  schemaGutterEl.scrollTop = schemaInputEl.scrollTop;
});
finalizeScopeEl.addEventListener('change', () => {
  setStatus(runStatusEl, 'stale', 'warn');
  setStatus(diagStatusEl, 'stale', 'warn');
});

tabCanonicalBtn.addEventListener('click', () => setOutputView('canonical'));
tabAesBtn.addEventListener('click', () => setOutputView('aes'));
tabFinalizedBtn.addEventListener('click', () => setOutputView('finalized'));
tabAnnotationsBtn.addEventListener('click', () => setOutputView('annotations'));
tabComparisonBtn.addEventListener('click', () => setOutputView('comparison'));
tabSourceBtn.addEventListener('click', () => setInputView('source'));
tabSchemaBtn.addEventListener('click', () => setInputView('schema'));
tabOptionsBtn.addEventListener('click', () => setInputView('options'));
schemaSampleBtn.addEventListener('click', () => {
  schemaEnabledEl.checked = true;
  schemaInputEl.disabled = false;
  schemaInputEl.value = schemaToAeon(SAMPLE_SCHEMA);
  syncSchemaHighlight();
  setStatus(runStatusEl, 'schema sample', 'ok');
  setStatus(diagStatusEl, 'stale', 'warn');
});
schemaBuilderOpenBtn.addEventListener('click', openSchemaBuilder);
schemaBuilderCloseBtn.addEventListener('click', closeSchemaBuilder);
schemaBuilderApplyBtn.addEventListener('click', () => {
  schemaInputEl.value = schemaToAeon(collectSchemaFromBuilder());
  schemaEnabledEl.checked = true;
  schemaInputEl.disabled = false;
  syncSchemaHighlight();
  closeSchemaBuilder();
  setStatus(runStatusEl, 'schema updated', 'ok');
  setStatus(diagStatusEl, 'stale', 'warn');
});
sourceBuilderOpenBtn.addEventListener('click', openSourceBuilder);
sourceBuilderCloseBtn.addEventListener('click', closeSourceBuilder);
sourceBuilderLoadSourceBtn.addEventListener('click', () => {
  sourceBuilderOpenPaths = new Set();
  sourceBuilderOpenPathsInitialized = false;
  renderSourceBuilder();
});
sourceBuilderApplyBtn.addEventListener('click', () => {
  sourceEl.value = buildSourceFromBuilder();
  syncSourceHighlight();
  closeSourceBuilder();
  setStatus(runStatusEl, 'source updated', 'ok');
  setStatus(diagStatusEl, 'stale', 'warn');
});
sourceAddPeerBtn.addEventListener('click', () => addSourceRow('peer'));
sourceAddChildBtn.addEventListener('click', () => addSourceRow('child'));
sourceAddAttributeBtn.addEventListener('click', () => addSourceRow('attribute'));
sourceRuleListEl.addEventListener('click', (event) => {
  if (!(event.target instanceof HTMLElement)) {
    return;
  }
  const item = event.target.closest('.source-tree-item');
  if (item instanceof HTMLElement) {
    if (event.target instanceof HTMLElement && event.target.dataset.action === 'toggle') {
      const path = item.dataset.path;
      if (sourceBuilderOpenPaths.has(path)) {
        sourceBuilderOpenPaths.delete(path);
        if (sourceBuilderSelectedPath && isSchemaChildPath(path, sourceBuilderSelectedPath)) {
          sourceBuilderSelectedPath = path;
        }
      } else if (path) {
        sourceBuilderOpenPaths.add(path);
      }
      renderSourceBuilder(sourceBuilderRows, sourceBuilderSelectedPath);
      return;
    }
    selectSourceRow(item.dataset.path);
  }
});
sourceDetailEl.addEventListener('change', (event) => {
  if (!(event.target instanceof HTMLElement)) {
    return;
  }
  if (event.target.id === 'source-remove-selected') {
    return;
  }
  if (event.target.dataset.sourceDetail === 'type') {
    const type = event.target.value;
    const datatype = sourceDetailEl.querySelector('[data-source-detail="datatype"]');
    const value = sourceDetailEl.querySelector('[data-source-detail="value"]');
    if (datatype instanceof HTMLInputElement) {
      datatype.value = sourceDatatypeForType(type);
    }
    if (value instanceof HTMLInputElement || value instanceof HTMLTextAreaElement || value instanceof HTMLSelectElement) {
      value.value = sourceDefaultValueForType(type);
    }
    syncSelectedSourceDetail();
    renderSourceBuilder(sourceBuilderRows, sourceBuilderSelectedPath);
  }
  if (event.target.dataset.sourceDetail === 'value') {
    const selected = sourceBuilderRows.find((row) => row.path === sourceBuilderSelectedPath);
    if (selected?.type === 'NullLiteral') {
      syncSelectedSourceDetail();
      renderSourceBuilder(sourceBuilderRows, sourceBuilderSelectedPath);
    }
  }
  if (event.target.dataset.sourceDetail === 'projected') {
    syncSelectedSourceDetail();
    setIncludePath(sourceBuilderSelectedPath, event.target.checked);
    renderSourceBuilder(sourceBuilderRows, sourceBuilderSelectedPath);
  }
  updateSourceChildActionState();
});
sourceDetailEl.addEventListener('click', (event) => {
  if (event.target instanceof HTMLElement && event.target.id === 'source-remove-selected') {
    removeSelectedSourceRow();
  }
});
sourceDetailEl.addEventListener('focusout', (event) => {
  if (!(event.target instanceof HTMLInputElement) || event.target.dataset.sourceDetail !== 'path') {
    return;
  }
  window.setTimeout(() => {
    syncSelectedSourceDetail();
    renderSourceBuilder(sourceBuilderRows, sourceBuilderSelectedPath);
  }, 0);
});
schemaAddPeerBtn.addEventListener('click', () => addSchemaRule('peer'));
schemaAddChildBtn.addEventListener('click', () => addSchemaRule('child'));
schemaAddChildManyBtn.addEventListener('click', () => addSchemaRule('child-many'));
schemaAddAttributeBtn.addEventListener('click', () => addSchemaRule('attribute'));
schemaSeedSourceBtn.addEventListener('click', seedSchemaFromSource);
schemaRuleListEl.addEventListener('click', (event) => {
  if (!(event.target instanceof HTMLElement)) {
    return;
  }
  const item = event.target.closest('.schema-tree-item');
  if (item instanceof HTMLElement) {
    if (event.target.dataset.action === 'toggle') {
      const path = item.dataset.path;
      if (schemaBuilderOpenPaths.has(path)) {
        schemaBuilderOpenPaths.delete(path);
        if (schemaBuilderSelectedPath && isSchemaChildPath(path, schemaBuilderSelectedPath)) {
          schemaBuilderSelectedPath = path;
        }
      } else if (path) {
        schemaBuilderOpenPaths.add(path);
      }
      renderSchemaBuilder(schemaBuilderSchema, schemaBuilderSelectedPath);
      return;
    }
    selectSchemaRulePath(item.dataset.path);
  }
});
schemaDetailEl.addEventListener('change', (event) => {
  if (event.target instanceof HTMLElement) {
    updateSchemaConstraintState(schemaDetailEl.querySelector('.schema-rule'));
  }
  updateSchemaChildActionState();
});
schemaDetailEl.addEventListener('input', (event) => {
  if (event.target instanceof HTMLElement) {
    validateSchemaRuleRow(schemaDetailEl.querySelector('.schema-rule'));
  }
});
schemaDetailEl.addEventListener('click', (event) => {
  if (event.target instanceof HTMLElement && event.target.id === 'schema-remove-selected') {
    removeSelectedSchemaRule();
  }
});
schemaDetailEl.addEventListener('focusout', (event) => {
  if (!(event.target instanceof HTMLInputElement) || event.target.dataset.field !== 'path') {
    return;
  }
  window.setTimeout(() => {
    syncSelectedSchemaDetail();
    renderSchemaBuilder(schemaBuilderSchema, schemaBuilderSelectedPath);
  }, 0);
});
schemaBuilderModalEl.addEventListener('click', (event) => {
  if (event.target === schemaBuilderModalEl) {
    closeSchemaBuilder();
  }
});
sourceBuilderModalEl.addEventListener('click', (event) => {
  if (event.target === sourceBuilderModalEl) {
    closeSourceBuilder();
  }
});
menuToggleBtn.addEventListener('click', (event) => {
  event.stopPropagation();
  setMenuOpen(menuPanelEl.hidden);
});
document.addEventListener('click', (event) => {
  if (menuPanelEl.hidden) {
    return;
  }
  const target = event.target;
  if (target instanceof Node && !menuPanelEl.contains(target) && !menuToggleBtn.contains(target)) {
    closeMenu();
  }
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    closeMenu();
    closeSchemaBuilder();
  }
});
processTsBtn.addEventListener('click', () => {
  void run('typescript');
});
processRustBtn.addEventListener('click', () => {
  void run('rust');
});
processCompareBtn.addEventListener('click', () => {
  void runComparison();
});
fileOpenBtn.addEventListener('click', () => {
  closeMenu();
  void openAeonFile();
});
fileSaveBtn.addEventListener('click', () => {
  closeMenu();
  void saveAeonFile(false);
});
fileSaveAsBtn.addEventListener('click', () => {
  closeMenu();
  void saveAeonFile(true);
});
sampleStrictBtn.addEventListener('click', () => {
  closeMenu();
  void applySample('strict');
});
sampleTransportBtn.addEventListener('click', () => {
  closeMenu();
  void applySample('transport');
});
sampleSansaBtn.addEventListener('click', () => {
  closeMenu();
  void applySample('sansa');
});
sampleCustomBtn.addEventListener('click', () => {
  closeMenu();
  void applySample('custom');
});
aeosImportBtn.addEventListener('click', () => {
  closeMenu();
  void importAeosOptions();
});
aeosExportBtn.addEventListener('click', () => {
  closeMenu();
  exportAeosOptions();
});
importImageBase64Btn.addEventListener('click', () => {
  closeMenu();
  void chooseImageImport();
});

sourceEl.value = SAMPLE_PRESETS.strict.source;
applySettings(SAMPLE_PRESETS.strict.settings);
setInputView('source');
setOutputView('canonical');
refreshCurrentFilePath();
syncSourceHighlight();
syncSchemaHighlight();
setStatus(runStatusEl, 'sample loaded', 'ok');
setStatus(diagStatusEl, 'waiting', 'warn');

void run('typescript');
