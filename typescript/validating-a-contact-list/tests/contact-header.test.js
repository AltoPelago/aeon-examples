import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { readAeonChecked } from '@altopelago/aeon-sdk';
import { validateContactHeader } from '../src/contact-header.js';

const source = await readFile(new URL('../data/contacts.aeon', import.meta.url), 'utf8');
const scripts = ['read-contacts.js', 'read-contacts-assignment.js'];

test('header metadata stays outside the application payload', () => {
  const parsed = readAeonChecked(source, { finalize: { mode: 'loose' } });
  assert.deepEqual(Object.keys(parsed.finalized.document), ['contacts']);
  assert.doesNotThrow(() => validateContactHeader(parsed.compile));
});

for (const [label, transform, succeeds] of [
  ['valid contacts', text => text, true],
  ['wrong schema declaration', text => text.replace('altopelago.contact-list.schema.v1', 'wrong.schema'), false],
  ['missing header', text => text.slice(text.indexOf('contacts:')), false],
  ['unexpected header field', text => text.replace('  encoding:', '  extra = "unexpected"\n  encoding:'), false],
  ['invalid email', text => text.replace('ruby.nguyen52@example.com', 'invalid-email'), false],
]) {
  test(label, async t => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'aeon-contacts-test-'));
    t.after(() => rm(directory, { recursive: true, force: true }));
    const file = path.join(directory, 'contacts.aeon');
    await writeFile(file, transform(source));
    for (const script of scripts) {
      const result = spawnSync(process.execPath, [new URL(`../src/${script}`, import.meta.url).pathname, file], { encoding: 'utf8' });
      assert.equal(result.status, succeeds ? 0 : 1, `${script}: ${result.stderr}`);
      assert.match(succeeds ? result.stdout : result.stderr, succeeds ? /5 contact\(s\)/ : /Invalid/);
    }
  });
}
