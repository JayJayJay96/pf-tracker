import { describe, expect, it } from 'vitest';

import { toCsv } from './csv';

describe('toCsv', () => {
  it('escapes commas, quotes, and line breaks and emits a stable header', () => {
    expect(toCsv(
      ['description', 'amount_sen', 'note'],
      [{ description: 'Dinner, shared', amount_sen: 6250, note: 'He said "thanks"\nPaid' }],
    )).toBe(
      '\uFEFFdescription,amount_sen,note\r\n'
      + '"Dinner, shared",6250,"He said ""thanks""\nPaid"\r\n',
    );
  });

  it('does not spreadsheet-evaluate untrusted text', () => {
    expect(toCsv(['description'], [{ description: '=HYPERLINK("bad")' }]))
      .toContain('"\'=HYPERLINK(""bad"")"');
  });
});
