import test from 'node:test';
import assert from 'node:assert/strict';
import { compile } from '@altopelago/aeon-core';
import { trimtickStringPattern } from '../src/literal-patterns.js';

function matchAt(source, offset) {
  trimtickStringPattern.lastIndex = offset;
  return trimtickStringPattern.exec(source)?.[0];
}

for (const literal of ['>`hello`', '> `hello`', '>\t`hello`', '> \t `hello`', '>`a\\`b`']) {
  test(`highlights a single trimtick marker: ${JSON.stringify(literal)}`, () => {
    const source = `value = ${literal}`;
    assert.equal(matchAt(source, 8), literal);
    assert.deepEqual(compile(source).errors, []);
  });
}

for (const literal of ['>>`hello`', '>>>`hello`', '>>>>`hello`', '>> `hello`', '>>\t`hello`']) {
  test(`does not highlight a repeated marker as trimticks: ${JSON.stringify(literal)}`, () => {
    const source = `value = ${literal}`;
    // The editor retries every token offset. A suffix '>' must not be accepted.
    for (let index = 8; index < source.indexOf('`'); index += 1) {
      assert.equal(matchAt(source, index), undefined);
    }
    assert.ok(compile(source).errors.length > 0);
  });
}

test('plain backticks, quoted strings and incomplete trimticks are not trimtick tokens', () => {
  for (const literal of ['`hello`', '"hello"', "'hello'", '>`hello', '>\n`hello`']) {
    assert.equal(matchAt(literal, 0), undefined);
  }
});

test('sticky matching respects offsets and resets after a failed match', () => {
  const source = 'bad >>`x` good > `y`';
  assert.equal(matchAt(source, 5), undefined);
  assert.equal(matchAt(source, source.lastIndexOf('>')), '> `y`');
  assert.equal(matchAt(source, 0), undefined);
});

test('escaped backslashes do not hide the closing delimiter or consume following tokens', () => {
  const literal = '>`a' + '\\'.repeat(2) + '`';
  assert.equal(matchAt(literal + ' next = 1', 0), literal);
  assert.equal(matchAt('>`' + '\\'.repeat(4096), 0), undefined);
});
