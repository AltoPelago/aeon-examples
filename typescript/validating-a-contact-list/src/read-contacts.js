/**
 * Demonstrates the straightforward app-facing AEON flow:
 * 1. read AEON text,
 * 2. let @altopelago/aeon-sdk enforce compile/finalize success,
 * 3. map finalized data into ordinary application objects,
 * 4. apply domain-specific checks before using it.
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { readAeonChecked } from '@altopelago/aeon-sdk';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+\d{7,15}$/;
const COUNTRY_RE = /^[A-Z]{2}$/;

function fail(message) {
  throw new Error(message);
}

function asRecord(input, path) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    fail(`${path} must be an object`);
  }
  return input;
}

function asString(input, path) {
  if (typeof input !== 'string' || input.trim().length === 0) {
    fail(`${path} must be a non-empty string`);
  }
  return input.trim();
}

function expectKeys(obj, expected, path) {
  const actual = Object.keys(obj).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((value, idx) => value !== wanted[idx])) {
    fail(`${path} must contain exactly: ${wanted.join(', ')}`);
  }
}

function parseAeon(text) {
  // AEON handles parsing plus "no compile/finalize errors" before we trust the document.
  return readAeonChecked(text, { finalize: { mode: 'loose' } }).finalized.document;
}

/**
 * @typedef {import('./contact').Contact} Contact
 */

/**
 * @param {unknown} input
 * @param {number} index
 * @returns {Contact}
 */
function toContact(input, index) {
  const base = `contacts[${index}]`;
  const obj = asRecord(input, base);
  expectKeys(obj, ['countryCode', 'email', 'firstName', 'lastName', 'phone'], base);

  // After AEON materialization, the rest of the work is plain application mapping.
  const contact = {
    firstName: asString(obj.firstName, `${base}.firstName`),
    lastName: asString(obj.lastName, `${base}.lastName`),
    email: asString(obj.email, `${base}.email`),
    phone: asString(obj.phone, `${base}.phone`),
    countryCode: asString(obj.countryCode, `${base}.countryCode`),
  };

  if (!EMAIL_RE.test(contact.email)) fail(`${base}.email has invalid format`);
  if (!PHONE_RE.test(contact.phone)) fail(`${base}.phone must match +<digits>`);
  if (!COUNTRY_RE.test(contact.countryCode)) fail(`${base}.countryCode must be ISO alpha-2 uppercase`);

  return contact;
}

async function main() {
  const filename = process.argv[2] ?? './data/contacts.aeon';
  const target = resolve(filename);
  const text = await readFile(target, 'utf8');
  const document = parseAeon(text);

  // These checks validate the app's expected root shape, not AEON syntax itself.
  const root = asRecord(document, 'root');
  expectKeys(root, ['aeon:encoding', 'aeon:mode', 'aeon:profile', 'aeon:schema', 'aeon:version', 'contacts'], 'root');
  if (root['aeon:encoding'] !== 'utf-8') fail('root.aeon:encoding must be utf-8');
  if (root['aeon:mode'] !== 'transport') fail('root.aeon:mode must be transport');
  if (root['aeon:version'] !== '1') fail('root.aeon:version must be 1');
  if (root['aeon:profile'] !== 'aeon.gp.profile.v1') fail('root.aeon:profile must be aeon.gp.profile.v1');
  if (root['aeon:schema'] !== 'altopelago.contact-list.schema.v1') fail('root.aeon:schema must be altopelago.contact-list.schema.v1');
  if (!Array.isArray(root.contacts)) fail('root.contacts must be a list');

  const contacts = root.contacts.map((entry, index) => toContact(entry, index));
  console.log(`Loaded ${contacts.length} contact(s) from ${target}`);
  console.table(contacts);
}

main().catch((error) => {
  console.error(`Invalid contacts AEON: ${error.message}`);
  process.exit(1);
});
