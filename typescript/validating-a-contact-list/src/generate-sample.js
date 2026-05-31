/**
 * Demonstrates AEON as a generated application data format.
 * This script creates ordinary JS contact objects and then emits them
 * as a small AEON document shaped the way the readers expect.
 */
import { randomInt } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const FIRST_NAMES = ['Ava', 'Liam', 'Mia', 'Noah', 'Zoe', 'Ethan', 'Ruby', 'Lucas', 'Nina', 'Kai'];
const LAST_NAMES = ['Parker', 'Singh', 'Nguyen', 'Hughes', 'Patel', 'Murphy', 'Khan', 'Evans', 'Lopez', 'Wright'];
const COUNTRY_CODES = ['AU', 'US', 'GB', 'NZ', 'CA'];
const CALLING_CODES = {
  AU: '61',
  US: '1',
  GB: '44',
  NZ: '64',
  CA: '1',
};

function pick(list) {
  return list[randomInt(0, list.length)];
}

function escapeString(value) {
  return JSON.stringify(value);
}

function randomDigits(length) {
  return Array.from({ length }, () => randomInt(0, 10)).join('');
}

function randomContact() {
  const firstName = pick(FIRST_NAMES);
  const lastName = pick(LAST_NAMES);
  const countryCode = pick(COUNTRY_CODES);
  const email = `${firstName}.${lastName}${randomInt(10, 99)}@example.com`.toLowerCase();
  const phone = `+${CALLING_CODES[countryCode]}${randomDigits(8)}`;
  return { firstName, lastName, email, phone, countryCode };
}

function renderContactsAeon(contacts) {
  // This keeps the sample intentionally simple and readable rather than fully generic.
  const lines = [
    'aeon:header = {',
    '  encoding:string = "utf-8"',
    '  mode:string = "transport"',
    '  version = "1"',
    '  profile = "aeon.gp.profile.v1"',
    '  schema = "altopelago.contact-list.schema.v1"',
    '}',
    'contacts:contactList = [',
  ];

  for (const contact of contacts) {
    lines.push('  {');
    lines.push(`    firstName:string = ${escapeString(contact.firstName)}`);
    lines.push(`    lastName:string = ${escapeString(contact.lastName)}`);
    lines.push(`    email:string = ${escapeString(contact.email)}`);
    lines.push(`    phone:string = ${escapeString(contact.phone)}`);
    lines.push(`    countryCode:string = ${escapeString(contact.countryCode)}`);
    lines.push('  }');
  }

  lines.push(']');
  return `${lines.join('\n')}\n`;
}

async function main() {
  const output = process.argv[2] ?? './data/contacts.aeon';
  const contacts = Array.from({ length: 5 }, () => randomContact());

  // The generated AEON stays close to the application object model so the
  // matching reader examples can focus on validation and mapping.
  const text = renderContactsAeon(contacts);

  const target = resolve(output);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, text, 'utf8');
  console.log(`Wrote ${contacts.length} random contacts to ${target}`);
}

main().catch((error) => {
  console.error(`Error generating sample: ${error.message}`);
  process.exit(1);
});
