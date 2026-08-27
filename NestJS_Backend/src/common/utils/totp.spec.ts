import { generateTotpSecret, otpauthUri, verifyTotp } from './totp';

// RFC 6238 Appendix B reference secret ("12345678901234567890" ASCII) in base32,
// with the documented SHA-1 TOTP values (truncated to 6 digits).
const RFC_SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
const VECTORS: Array<[number, string]> = [
  [59, '287082'],
  [1111111109, '081804'],
  [1111111111, '050471'],
  [1234567890, '005924'],
  [2000000000, '279037'],
];

describe('totp', () => {
  it('matches RFC 6238 SHA-1 test vectors', () => {
    for (const [t, code] of VECTORS) {
      expect(verifyTotp(RFC_SECRET, code, 0, 30, t * 1000)).toBe(true);
    }
  });

  it('rejects an incorrect code', () => {
    expect(verifyTotp(RFC_SECRET, '000000', 0, 30, 59 * 1000)).toBe(false);
  });

  it('rejects malformed codes', () => {
    expect(verifyTotp(RFC_SECRET, '12345', 1, 30, 59 * 1000)).toBe(false);
    expect(verifyTotp(RFC_SECRET, 'abcdef', 1, 30, 59 * 1000)).toBe(false);
  });

  it('accepts a code within the drift window but not outside it', () => {
    // T=59 code is valid one step later (T=89) with window=1, not window=0.
    expect(verifyTotp(RFC_SECRET, '287082', 1, 30, 89 * 1000)).toBe(true);
    expect(verifyTotp(RFC_SECRET, '287082', 0, 30, 120 * 1000)).toBe(false);
  });

  it('generates a usable secret and otpauth URI', () => {
    const secret = generateTotpSecret();
    expect(secret).toMatch(/^[A-Z2-7]+$/);
    expect(secret.length).toBeGreaterThanOrEqual(32);
    const uri = otpauthUri(secret, 'alice', 'PBX Suite');
    expect(uri).toContain('otpauth://totp/');
    expect(uri).toContain(`secret=${secret}`);
  });
});
