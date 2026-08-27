import { parseCsv } from './csv';

describe('parseCsv', () => {
  it('parses a simple table keyed by header', () => {
    const rows = parseCsv('extensionNumber,secret,displayName\n1001,s3cr3t,Alice\n1002,pw,Bob');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({
      extensionNumber: '1001',
      secret: 's3cr3t',
      displayName: 'Alice',
    });
    expect(rows[1].displayName).toBe('Bob');
  });

  it('handles quoted fields with embedded commas and escaped quotes', () => {
    const rows = parseCsv('name,note\n"Doe, John","said ""hi"""');
    expect(rows[0]).toEqual({ name: 'Doe, John', note: 'said "hi"' });
  });

  it('skips blank lines and tolerates CRLF', () => {
    const rows = parseCsv('a,b\r\n1,2\r\n\r\n3,4\r\n');
    expect(rows).toHaveLength(2);
    expect(rows[1]).toEqual({ a: '3', b: '4' });
  });

  it('returns [] for empty input', () => {
    expect(parseCsv('')).toEqual([]);
  });
});
