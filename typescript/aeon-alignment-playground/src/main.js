import { processWithRustWasm, processWithTypeScriptCore } from './playground-processor.js';

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
    { path: '$.app.tags[*]', constraints: { type: 'StringLiteral' } },
  ],
};

const outputState = {
  canonical: '',
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
      schemaText: JSON.stringify(SAMPLE_SCHEMA, null, 2),
    },
  },
  loose: {
    source: `//# Loose validation sample
aeon:header = {
  mode:string = "transport"
  encoding:string = "utf-8"
  profile:string = "aeon.gp.profile.v1"
  version:string = "1"
}

app = {
  name = "loose playground"
  enabled = on
  port = 8080
  retries = 3
}`,
    settings: {
      validationMode: 'loose',
      separatorDepth: '8',
      attributeDepth: '1',
      genericDepth: '1',
      materializationMode: 'all',
      finalizeScope: 'payload',
      includePaths: '',
      schemaEnabled: false,
      schemaText: JSON.stringify({ ...SAMPLE_SCHEMA, world: 'open' }, null, 2),
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
      schemaText: JSON.stringify(SAMPLE_SCHEMA, null, 2),
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
const schemaBuilderModalEl = document.getElementById('schema-builder-modal');
const schemaBuilderCloseBtn = document.getElementById('schema-builder-close');
const schemaBuilderApplyBtn = document.getElementById('schema-builder-apply');
const schemaBuilderWorldEl = document.getElementById('schema-builder-world');
const schemaAddPeerBtn = document.getElementById('schema-add-peer');
const schemaAddChildBtn = document.getElementById('schema-add-child');
const schemaAddChildManyBtn = document.getElementById('schema-add-child-many');
const schemaSeedSourceBtn = document.getElementById('schema-seed-source');
const schemaRuleListEl = document.getElementById('schema-rule-list');
const outputEl = document.getElementById('output');
const diagnosticsEl = document.getElementById('diagnostics');
const runMetaEl = document.getElementById('run-meta');
const viewMetaEl = document.getElementById('view-meta');
const runStatusEl = document.getElementById('run-status');
const diagStatusEl = document.getElementById('diag-status');
const tabCanonicalBtn = document.getElementById('tab-canonical');
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
const sourceTabInsertsTabEl = document.getElementById('source-tab-inserts-tab');
const fileOpenBtn = document.getElementById('file-open');
const fileSaveBtn = document.getElementById('file-save');
const fileSaveAsBtn = document.getElementById('file-save-as');
const importImageBase64Btn = document.getElementById('import-image-base64');
const currentFilePathEl = document.getElementById('current-file-path');
const menuToggleBtn = document.getElementById('menu-toggle');
const menuPanelEl = document.getElementById('menu-panel');
const filePickerEl = document.createElement('input');
filePickerEl.type = 'file';
filePickerEl.accept = '.aeon,text/plain';
filePickerEl.hidden = true;
document.body.append(filePickerEl);

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
    const schema = JSON.parse(options.schemaText || '{}');
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
  return escapeHtml(source).replace(
    /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|[{}\[\],:]/g,
    (match, stringValue, keySuffix, literalValue) => {
      if (stringValue) {
        return keySuffix
          ? `<span class="json-key">${stringValue}</span>${keySuffix}`
          : `<span class="json-string">${stringValue}</span>`;
      }
      if (literalValue === 'null') {
        return `<span class="json-null">${literalValue}</span>`;
      }
      if (literalValue) {
        return `<span class="json-bool">${literalValue}</span>`;
      }
      if (/^-?\d/.test(match)) {
        return `<span class="json-number">${match}</span>`;
      }
      return `<span class="json-punct">${match}</span>`;
    },
  );
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
  tabFinalizedBtn.classList.toggle('is-active', view === 'finalized');
  tabAnnotationsBtn.classList.toggle('is-active', view === 'annotations');
  tabComparisonBtn.classList.toggle('is-active', view === 'comparison');
  outputEl.innerHTML = renderOutputHtml(view);
  if (view === 'canonical') {
    viewMetaEl.textContent = describeCanonicalText(outputState.canonical || '');
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
  return `${binding}@{mime="${image.mime}",binname="${image.name}",binkind="image"}:base64 = $${image.base64}\n`;
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

function insertSourceText(text) {
  const start = sourceEl.selectionStart ?? 0;
  const end = sourceEl.selectionEnd ?? start;
  sourceEl.setRangeText(text, start, end, 'end');
  syncSourceHighlight();
  setStatus(runStatusEl, 'stale', 'warn');
  setStatus(diagStatusEl, 'stale', 'warn');
}

function applyValidationMode(source, mode) {
  if (mode === 'none') {
    return source;
  }

  const compileMode = mode === 'loose' ? 'transport' : mode;
  const trivia = String.raw`(?:(?:\/#[\s\S]*?#\/)|(?:\/\*[\s\S]*?\*\/)|[ \t\r\n])*`;
  const structuredHeaderRe = new RegExp(`(aeon${trivia}:${trivia}header${trivia}=${trivia}\\{)([\\s\\S]*?)(\\n\\})`, 'm');
  const shorthandModeRe = new RegExp(`aeon${trivia}:${trivia}mode${trivia}=${trivia}"[^"]*"`, 'm');
  const structuredModeRe = new RegExp(`(^[ \\t]*mode${trivia}(?::[\\s\\S]*?)?${trivia}=${trivia})"[^"]*"`, 'm');

  if (structuredHeaderRe.test(source)) {
    return source.replace(structuredHeaderRe, (match, open, body, close) => {
      if (structuredModeRe.test(body)) {
        return `${open}${body.replace(structuredModeRe, `$1"${compileMode}"`)}${close}`;
      }
      return `${open}${body}\n  mode = "${compileMode}"${close}`;
    });
  }

  if (shorthandModeRe.test(source)) {
    return source.replace(shorthandModeRe, `aeon:mode = "${compileMode}"`);
  }

  return `aeon:mode = "${compileMode}"\n${source}`;
}

function describeValidationSource(mode) {
  if (mode === 'none') {
    return 'raw input';
  }
  if (mode === 'loose') {
    return 'validation-adjusted input (mode forced to transport)';
  }
  if (mode === 'strict') {
    return 'validation-adjusted input (mode forced to strict)';
  }
  if (mode === 'custom') {
    return 'validation-adjusted input (mode forced to custom)';
  }
  return 'validation-adjusted input';
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

function renderResult(result, options) {
  outputState.canonical = result.canonical?.text ?? '';
  outputState.finalized = result.finalized?.document !== null && result.finalized?.document !== undefined
    ? JSON.stringify(result.finalized.document, null, 2)
    : 'Unavailable in "none" mode.';
  outputState.annotations = JSON.stringify(result.annotations ?? [], null, 2);
  outputState.comparison = '';
  setOutputView(outputState.view);

  runMetaEl.textContent = `processor: ${options.processor} · materialization: ${options.materializationMode} · finalize scope: ${describeFinalizeScope(options.finalizeScope)} · validation mode: ${options.validationMode} · ${describeSchemaOptions(options)} · display source: raw input · validation source: ${describeValidationSource(options.validationMode)}`;

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
    outputState.finalized = tsResult.finalized?.document !== null && tsResult.finalized?.document !== undefined
      ? JSON.stringify(tsResult.finalized.document, null, 2)
      : 'Unavailable in "none" mode.';
    outputState.annotations = JSON.stringify(tsResult.annotations ?? [], null, 2);
    outputState.comparison = renderEngineComparison(tsResult, rustResult, options);
    setOutputView('comparison');

    const mismatch = outputState.comparison.startsWith('status: mismatch');
    runMetaEl.textContent = `processor: compare · materialization: ${options.materializationMode} · finalize scope: ${describeFinalizeScope(options.finalizeScope)} · validation mode: ${options.validationMode} · ${describeSchemaOptions(options)} · display source: raw input · validation source: ${describeValidationSource(options.validationMode)}`;
    diagnosticsEl.textContent = mismatch
      ? '1. TypeScript and Rust WASM normalized outputs differ. See Comparison.'
      : 'processor: compare\nstatus: normalized outputs match';
    setStatus(runStatusEl, mismatch ? 'mismatch' : 'match', mismatch ? 'error' : 'ok');
    setStatus(diagStatusEl, mismatch ? '1 mismatch' : 'clean', mismatch ? 'error' : 'ok');
  } catch (error) {
    outputState.canonical = '';
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
  schemaInputEl.value = settings.schemaText ?? JSON.stringify(SAMPLE_SCHEMA, null, 2);
  schemaInputEl.disabled = !schemaEnabledEl.checked;
  includePathsEl.disabled = settings.materializationMode !== 'projected';
}

function parseSchemaTextOrDefault() {
  const text = schemaInputEl.value.trim();
  if (!text) {
    return structuredClone(SAMPLE_SCHEMA);
  }
  const schema = JSON.parse(text);
  return {
    world: schema.world === 'closed' ? 'closed' : 'open',
    rules: Array.isArray(schema.rules) ? schema.rules : [],
  };
}

function schemaTypeOptions(selected) {
  return [
    'StringLiteral',
    'NumberLiteral',
    'IntegerLiteral',
    'FloatLiteral',
    'BooleanLiteral',
    'ToggleLiteral',
    'ObjectNode',
    'ListNode',
    'TupleNode',
    'NodeLiteral',
    'NullLiteral',
    'InfinityLiteral',
    'NaNLiteral',
    'HexLiteral',
    'EncodingLiteral',
    'RadixLiteral',
    'SeparatorLiteral',
    'DateLiteral',
    'TimeLiteral',
    'DateTimeLiteral',
  ].map((type) => `<option value="${type}"${type === selected ? ' selected' : ''}>${type}</option>`).join('');
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
const NUMERIC_WIDENING_TYPES = new Set(['NumberLiteral', 'IntegerLiteral', 'FloatLiteral']);
const CONTAINER_CONSTRAINT_TYPES = new Set(['ObjectNode', 'ListNode', 'TupleNode', 'NodeLiteral']);
const BUILTIN_SCHEMA_TYPES_BY_DATATYPE = new Map([
  ['string', 'StringLiteral'],
  ['str', 'StringLiteral'],
  ['s', 'StringLiteral'],
  ['number', 'NumberLiteral'],
  ['num', 'NumberLiteral'],
  ['n', 'NumberLiteral'],
  ['integer', 'IntegerLiteral'],
  ['int', 'IntegerLiteral'],
  ['float', 'FloatLiteral'],
  ['boolean', 'BooleanLiteral'],
  ['bool', 'BooleanLiteral'],
  ['b', 'BooleanLiteral'],
  ['toggle', 'ToggleLiteral'],
  ['object', 'ObjectNode'],
  ['obj', 'ObjectNode'],
  ['o', 'ObjectNode'],
  ['list', 'ListNode'],
  ['tuple', 'TupleNode'],
  ['node', 'NodeLiteral'],
]);

function schemaRuleHtml(rule, index, selectedPath) {
  const constraints = rule.constraints ?? {};
  const type = constraints.type ?? '';
  const path = rule.path ?? '$.field';
  return `
    <div class="schema-rule" data-index="${index}">
      <input name="schema-selected-rule" type="radio" ${path === selectedPath ? 'checked' : ''} />
      <label class="control-field">
        <span>Path</span>
        <input data-field="path" type="text" value="${escapeHtml(path)}" />
      </label>
      <label class="control-field">
        <span>Type</span>
        <select data-field="type"><option value="">any</option>${schemaTypeOptions(type)}</select>
      </label>
      <label class="control-field">
        <span>Custom datatype</span>
        <input data-field="datatype" type="text" value="${escapeHtml(constraints.datatype ?? '')}" placeholder="optional tag" />
      </label>
      <label class="inline-toggle">
        <input data-field="required" type="checkbox" ${constraints.required === true ? 'checked' : ''} />
        <span>Required</span>
      </label>
      <div class="constraint-grid">
        <label class="inline-toggle" data-constraint-kind="nullable">
          <input data-field="nullable" type="checkbox" ${constraints.nullable === true ? 'checked' : ''} />
          <span>Allow null</span>
        </label>
        <input data-field="null_value" data-constraint-kind="null" type="text" placeholder="null value" value="${escapeHtml(constraints.null_value ?? '')}" />
        <input data-field="min_length" data-constraint-kind="string" type="number" min="0" placeholder="min length" value="${constraints.min_length ?? ''}" />
        <input data-field="max_length" data-constraint-kind="string" type="number" min="0" placeholder="max length" value="${constraints.max_length ?? ''}" />
        <input data-field="pattern" data-constraint-kind="string" type="text" placeholder="pattern" value="${escapeHtml(constraints.pattern ?? '')}" />
        <input data-field="length_exact" data-constraint-kind="container" type="number" min="0" placeholder="exact children" value="${constraints.length_exact ?? ''}" />
        <input data-field="min_children" data-constraint-kind="container" type="number" min="0" placeholder="min children" value="${constraints.min_children ?? ''}" />
        <input data-field="max_children" data-constraint-kind="container" type="number" min="0" placeholder="max children" value="${constraints.max_children ?? ''}" />
        <select data-field="sign" data-constraint-kind="numeric">
          <option value="">any sign</option>
          <option value="signed"${constraints.sign === 'signed' ? ' selected' : ''}>signed</option>
          <option value="unsigned"${constraints.sign === 'unsigned' ? ' selected' : ''}>unsigned</option>
        </select>
        <input data-field="min_value" data-constraint-kind="numeric" type="text" placeholder="min value" value="${escapeHtml(constraints.min_value ?? '')}" />
        <input data-field="max_value" data-constraint-kind="numeric" type="text" placeholder="max value" value="${escapeHtml(constraints.max_value ?? '')}" />
        <label class="inline-toggle" data-constraint-kind="numeric-widening">
          <input data-field="allow_infinity" type="checkbox" ${constraints.allow_infinity === true ? 'checked' : ''} />
          <span>Allow infinity</span>
        </label>
        <label class="inline-toggle" data-constraint-kind="numeric-widening">
          <input data-field="allow_nan" type="checkbox" ${constraints.allow_nan === true ? 'checked' : ''} />
          <span>Allow NaN</span>
        </label>
        <select data-field="type_is" data-constraint-kind="container-kind">
          <option value="">container kind</option>
          <option value="list"${constraints.type_is === 'list' ? ' selected' : ''}>list</option>
          <option value="tuple"${constraints.type_is === 'tuple' ? ' selected' : ''}>tuple</option>
        </select>
        <select data-field="toggle_pair" data-constraint-kind="toggle">
          <option value="">any toggle</option>
          <option value="yes_no"${constraints.toggle_pair === 'yes_no' ? ' selected' : ''}>yes / no</option>
          <option value="on_off"${constraints.toggle_pair === 'on_off' ? ' selected' : ''}>on / off</option>
        </select>
      </div>
      <button class="schema-rule-remove" type="button" aria-label="Remove rule">×</button>
    </div>
  `;
}

function schemaConstraintKindsForType(type) {
  if (!type) {
    return new Set(['nullable', 'null', 'string', 'numeric', 'numeric-widening', 'container', 'container-kind', 'toggle']);
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
  if (type === 'ListNode' || type === 'TupleNode') {
    kinds.add('container-kind');
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
}

function updateAllSchemaConstraintStates() {
  for (const row of schemaRuleListEl.querySelectorAll('.schema-rule')) {
    updateSchemaConstraintState(row);
  }
}

function isSchemaChildPath(parent, child) {
  return child.startsWith(`${parent}.`) || child.startsWith(`${parent}[`);
}

function compareSchemaRulePaths(a, b) {
  const left = a.path ?? '';
  const right = b.path ?? '';
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

function selectSchemaRuleRow(row) {
  const radio = row?.querySelector('input[name="schema-selected-rule"]');
  if (radio instanceof HTMLInputElement) {
    radio.checked = true;
  }
  updateSchemaChildActionState();
  scrollSchemaRuleIntoView(row);
}

function scrollSchemaRuleIntoView(row) {
  if (!(row instanceof HTMLElement)) {
    return;
  }
  row.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

function renderSchemaBuilder(schema, selectedPath = null) {
  const sortedSchema = sortSchemaRules(schema);
  schemaBuilderWorldEl.value = schema.world === 'closed' ? 'closed' : 'open';
  const activePath = selectedPath ?? sortedSchema.rules[0]?.path ?? null;
  schemaRuleListEl.innerHTML = sortedSchema.rules.map((rule, index) => schemaRuleHtml(rule, index, activePath)).join('');
  updateAllSchemaConstraintStates();
  updateSchemaChildActionState();
  scrollSchemaRuleIntoView(schemaRuleListEl.querySelector('.schema-rule input[type="radio"]:checked')?.closest('.schema-rule'));
}

function collectSchemaFromBuilder() {
  const rules = Array.from(schemaRuleListEl.querySelectorAll('.schema-rule')).map((row) => {
    const read = (field) => row.querySelector(`[data-field="${field}"]`);
    const constraints = {};
    const type = read('type')?.value.trim();
    const datatype = read('datatype')?.value.trim();
    const required = read('required')?.checked;
    const nullable = read('nullable')?.checked;
    const allowInfinity = read('allow_infinity')?.checked;
    const allowNan = read('allow_nan')?.checked;
    const sign = read('sign')?.value;
    const typeIs = read('type_is')?.value;
    const togglePair = read('toggle_pair')?.value;
    const pattern = read('pattern')?.value.trim();
    const nullValue = read('null_value')?.value.trim();
    const minValue = read('min_value')?.value.trim();
    const maxValue = read('max_value')?.value.trim();

    if (type) constraints.type = type;
    if (datatype) constraints.datatype = datatype;
    if (required) constraints.required = true;
    if (nullable && !read('nullable')?.disabled) constraints.nullable = true;
    if (allowInfinity && !read('allow_infinity')?.disabled) constraints.allow_infinity = true;
    if (allowNan && !read('allow_nan')?.disabled) constraints.allow_nan = true;
    if (sign && !read('sign')?.disabled) constraints.sign = sign;
    if (typeIs && !read('type_is')?.disabled) constraints.type_is = typeIs;
    if (togglePair && !read('toggle_pair')?.disabled) constraints.toggle_pair = togglePair;
    if (nullValue && !read('null_value')?.disabled) constraints.null_value = nullValue;
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

    return {
      path: read('path')?.value.trim() || '$.field',
      constraints,
    };
  });

  return {
    world: schemaBuilderWorldEl.value === 'closed' ? 'closed' : 'open',
    rules,
  };
}

function selectedSchemaRulePath() {
  const selected = schemaRuleListEl.querySelector('.schema-rule input[type="radio"]:checked')?.closest('.schema-rule');
  return selected?.querySelector('[data-field="path"]')?.value.trim() || '$.app';
}

function selectedSchemaRuleAllowsChildren() {
  const selected = schemaRuleListEl.querySelector('.schema-rule input[type="radio"]:checked')?.closest('.schema-rule');
  if (!selected) {
    return false;
  }

  const type = selected.querySelector('[data-field="type"]')?.value;
  const typeIs = selected.querySelector('[data-field="type_is"]')?.value;
  const datatype = selected.querySelector('[data-field="datatype"]')?.value.trim().toLowerCase();
  return CHILD_CAPABLE_SCHEMA_TYPES.has(type)
    || typeIs === 'list'
    || typeIs === 'tuple'
    || CHILD_CAPABLE_DATATYPES.has(datatype);
}

function updateSchemaChildActionState() {
  const allowsChildren = selectedSchemaRuleAllowsChildren();
  for (const button of [schemaAddChildBtn, schemaAddChildManyBtn]) {
    button.disabled = !allowsChildren;
    button.title = allowsChildren ? '' : CHILD_ACTION_HINT;
  }
}

function parentPath(path) {
  const bracket = path.lastIndexOf('[');
  const dot = path.lastIndexOf('.');
  const cut = Math.max(bracket, dot);
  return cut > 0 ? path.slice(0, cut) : '$';
}

function childPath(base, key, many = false) {
  const prefix = many ? `${base}[*]` : base;
  return `${prefix}.${key}`;
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
  const path = childPath(base, kind === 'peer' ? `peer${index}` : `child${index}`, kind === 'child-many');
  schema.rules.push({
    path,
    constraints: { type: 'StringLiteral', required: true },
  });
  renderSchemaBuilder(schema, path);
}

function seedSchemaFromSource() {
  const schema = {
    world: schemaBuilderWorldEl.value === 'closed' ? 'closed' : 'open',
    rules: [],
  };
  const bindingRe = /^\s*([A-Za-z_][A-Za-z0-9_]*)(?::([A-Za-z_][A-Za-z0-9_]*))?\s*=/gm;
  for (const match of sourceEl.value.matchAll(bindingRe)) {
    if (match[1] === 'aeon') continue;
    const datatype = match[2] ?? '';
    const normalizedDatatype = datatype.toLowerCase();
    const builtinType = BUILTIN_SCHEMA_TYPES_BY_DATATYPE.get(normalizedDatatype);
    const type = builtinType ?? 'StringLiteral';
    schema.rules.push({
      path: `$.${match[1]}`,
      constraints: {
        type,
        ...(datatype && !builtinType ? { datatype } : {}),
        required: true,
      },
    });
  }
  if (schema.rules.length === 0) {
    schema.rules = structuredClone(SAMPLE_SCHEMA.rules);
  }
  renderSchemaBuilder(schema);
}

function openSchemaBuilder() {
  try {
    renderSchemaBuilder(parseSchemaTextOrDefault());
    schemaBuilderModalEl.hidden = false;
  } catch (error) {
    diagnosticsEl.textContent = `1. ${error instanceof Error ? error.message : String(error)}`;
    setStatus(runStatusEl, 'schema invalid', 'error');
    setStatus(diagStatusEl, '1 error', 'error');
  }
}

function closeSchemaBuilder() {
  schemaBuilderModalEl.hidden = true;
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
  setStatus(runStatusEl, 'stale', 'warn');
  setStatus(diagStatusEl, 'stale', 'warn');
});
finalizeScopeEl.addEventListener('change', () => {
  setStatus(runStatusEl, 'stale', 'warn');
  setStatus(diagStatusEl, 'stale', 'warn');
});

tabCanonicalBtn.addEventListener('click', () => setOutputView('canonical'));
tabFinalizedBtn.addEventListener('click', () => setOutputView('finalized'));
tabAnnotationsBtn.addEventListener('click', () => setOutputView('annotations'));
tabComparisonBtn.addEventListener('click', () => setOutputView('comparison'));
tabSourceBtn.addEventListener('click', () => setInputView('source'));
tabSchemaBtn.addEventListener('click', () => setInputView('schema'));
tabOptionsBtn.addEventListener('click', () => setInputView('options'));
schemaSampleBtn.addEventListener('click', () => {
  schemaEnabledEl.checked = true;
  schemaInputEl.disabled = false;
  schemaInputEl.value = JSON.stringify(SAMPLE_SCHEMA, null, 2);
  setStatus(runStatusEl, 'schema sample', 'ok');
  setStatus(diagStatusEl, 'stale', 'warn');
});
schemaBuilderOpenBtn.addEventListener('click', openSchemaBuilder);
schemaBuilderCloseBtn.addEventListener('click', closeSchemaBuilder);
schemaBuilderApplyBtn.addEventListener('click', () => {
  schemaInputEl.value = JSON.stringify(collectSchemaFromBuilder(), null, 2);
  schemaEnabledEl.checked = true;
  schemaInputEl.disabled = false;
  closeSchemaBuilder();
  setStatus(runStatusEl, 'schema updated', 'ok');
  setStatus(diagStatusEl, 'stale', 'warn');
});
schemaAddPeerBtn.addEventListener('click', () => addSchemaRule('peer'));
schemaAddChildBtn.addEventListener('click', () => addSchemaRule('child'));
schemaAddChildManyBtn.addEventListener('click', () => addSchemaRule('child-many'));
schemaSeedSourceBtn.addEventListener('click', seedSchemaFromSource);
schemaRuleListEl.addEventListener('focusin', (event) => {
  if (!(event.target instanceof HTMLElement)) {
    return;
  }
  selectSchemaRuleRow(event.target.closest('.schema-rule'));
});
schemaRuleListEl.addEventListener('focusout', (event) => {
  if (!(event.target instanceof HTMLInputElement) || event.target.dataset.field !== 'path') {
    return;
  }
  const selectedPath = event.target.value.trim() || '$.field';
  window.setTimeout(() => {
    renderSchemaBuilder(collectSchemaFromBuilder(), selectedPath);
  }, 0);
});
schemaRuleListEl.addEventListener('click', (event) => {
  if (!(event.target instanceof HTMLElement) || !event.target.classList.contains('schema-rule-remove')) {
    if (event.target instanceof HTMLElement) {
      selectSchemaRuleRow(event.target.closest('.schema-rule'));
    }
    updateSchemaChildActionState();
    return;
  }
  const row = event.target.closest('.schema-rule');
  row?.remove();
  if (!schemaRuleListEl.querySelector('.schema-rule input[type="radio"]:checked')) {
    schemaRuleListEl.querySelector('.schema-rule input[type="radio"]')?.click();
  }
  updateSchemaChildActionState();
});
schemaRuleListEl.addEventListener('change', (event) => {
  if (event.target instanceof HTMLElement) {
    updateSchemaConstraintState(event.target.closest('.schema-rule'));
  }
  updateSchemaChildActionState();
});
schemaBuilderModalEl.addEventListener('click', (event) => {
  if (event.target === schemaBuilderModalEl) {
    closeSchemaBuilder();
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
setStatus(runStatusEl, 'sample loaded', 'ok');
setStatus(diagStatusEl, 'waiting', 'warn');

void run('typescript');
