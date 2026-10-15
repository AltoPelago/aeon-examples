// Headers belong to compile metadata, not the materialized application payload.
// Checking a declaration here does not authenticate a profile/schema contract.
export function validateContactHeader(compiled) {
  const expected = {
    encoding: 'utf-8',
    mode: 'transport',
    version: '1',
    profile: 'aeon.gp.profile.v1',
    schema: 'altopelago.contact-list.schema.v1',
  };
  const fields = compiled.header?.fields;
  if (!fields || fields.size !== Object.keys(expected).length) {
    throw new Error('contacts header must contain exactly encoding, mode, version, profile, schema');
  }
  for (const [key, value] of Object.entries(expected)) {
    const literal = fields.get(key);
    if (literal?.type !== 'StringLiteral' || literal.value !== value) {
      throw new Error(`header.${key} must be ${JSON.stringify(value)}`);
    }
  }
}
