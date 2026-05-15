/**
 * Demonstrates the AEON assignment-stream validation pattern:
 * 1. read AEON text,
 * 2. inspect compile.events before trusting finalized output,
 * 3. validate normalized paths and datatypes on the assignment stream,
 * 4. only then map finalized values into application objects.
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { formatPath, readAeonChecked } from '@altopelago/aeon-sdk';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+\d{7,15}$/;
const COUNTRY_RE = /^[A-Z]{2}$/;

function fail(message) {
  throw new Error(message);
}

function normalizePath(path) {
  // Collapse list indexes so one rule can validate every contact entry.
  return path.replace(/\[\d+\]/g, '[*]').replace(/\.\[\*\]/g, '[*]');
}

function scalarValue(event) {
  if (!event.value || typeof event.value !== 'object') return undefined;
  if (!('value' in event.value)) return undefined;
  return event.value.value;
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isEmail(value) {
  return isNonEmptyString(value) && EMAIL_RE.test(value);
}

function isPhone(value) {
  return isNonEmptyString(value) && PHONE_RE.test(value);
}

function isCountryCode(value) {
  return isNonEmptyString(value) && COUNTRY_RE.test(value);
}

function validateBySwitch(rawPath, value) {
  const path = normalizePath(rawPath);
  let success = false;
  // This switch treats the assignment stream like a lightweight schema layer.
  switch (path) {
    case 'contacts[*].firstName':
      success = isNonEmptyString(value);
      break;
    case 'contacts[*].lastName':
      success = isNonEmptyString(value);
      break;
    case 'contacts[*].email':
      success = isEmail(value);
      break;
    case 'contacts[*].phone':
      success = isPhone(value);
      break;
    case 'contacts[*].countryCode':
      success = isCountryCode(value);
      break;
    default:
      return;
  }
  if (!success) fail(`assignment validation failed at ${rawPath} (normalized: ${path})`);
}

function validateAssignments(parsed) {
  if (parsed.compile.errors.length > 0) {
    fail(`AEON compile failed with ${parsed.compile.errors.length} error(s)`);
  }

  // AEON keeps datatype information on each assignment event, so we can validate
  // the stream shape before we consume the finalized document.
  const contactsEvent = parsed.compile.events.find((event) => normalizePath(formatPath(event.path).replace(/^\$\./, '')) === 'contacts');
  if (!contactsEvent) fail('missing contacts assignment');
  if (contactsEvent.datatype !== 'contactList') {
    fail(`contacts datatype must be contactList (got ${String(contactsEvent.datatype)})`);
  }

  for (const event of parsed.compile.events) {
    const rawPath = formatPath(event.path).replace(/^\$\./, '');
    const value = scalarValue(event);
    validateBySwitch(rawPath, value);
  }
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

function toContact(input, index) {
  const base = `contacts[${index}]`;
  const obj = asRecord(input, base);
  return {
    firstName: asString(obj.firstName, `${base}.firstName`),
    lastName: asString(obj.lastName, `${base}.lastName`),
    email: asString(obj.email, `${base}.email`),
    phone: asString(obj.phone, `${base}.phone`),
    countryCode: asString(obj.countryCode, `${base}.countryCode`),
  };
}

async function main() {
  const filename = process.argv[2] ?? './data/contacts.aeon';
  const target = resolve(filename);
  const text = await readFile(target, 'utf8');

  // readAeonChecked gives us both the assignment stream and finalized document.
  const parsed = readAeonChecked(text, { finalize: { mode: 'loose' } });
  validateAssignments(parsed);

  const root = asRecord(parsed.finalized.document, 'root');
  if (!Array.isArray(root.contacts)) fail('root.contacts must be a list');
  const contacts = root.contacts.map((entry, idx) => toContact(entry, idx));

  console.log(`Assignment-stream validation passed for ${contacts.length} contact(s):`);
  console.table(contacts);
}

main().catch((error) => {
  console.error(`Invalid AEON assignment flow: ${error.message}`);
  process.exit(1);
});
