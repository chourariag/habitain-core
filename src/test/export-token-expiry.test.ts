import { describe, expect, it } from 'vitest';
import { tokenExpired, tokenExpiry } from '../../supabase/functions/_shared/export-token-expiry';
describe('P4f export token expiry', () => {
  it('defaults to 180 days from creation', () => {
    expect(tokenExpiry(new Date('2026-11-15T00:00:00Z'))).toBe('2027-05-14T00:00:00.000Z');
  });
  it('allows at most 365 days', () => {
    expect(tokenExpiry(new Date('2026-11-15T00:00:00Z'), 365)).toBe('2027-11-15T00:00:00.000Z');
    expect(() => tokenExpiry(new Date(), 366)).toThrow('1–365 days');
    expect(() => tokenExpiry(new Date(), 0)).toThrow('1–365 days');
  });
  it('rejects expired tokens including the exact expiry time', () => {
    const now = new Date('2026-11-15T00:00:00Z');
    expect(tokenExpired('2026-11-14T23:59:59Z', now)).toBe(true);
    expect(tokenExpired('2026-11-15T00:00:00Z', now)).toBe(true);
    expect(tokenExpired('2026-11-15T00:00:01Z', now)).toBe(false);
  });
});