import { describe, expect, it } from 'vitest';
import { EXPORT_SCHEMA } from '../../supabase/functions/_shared/export-schema';
import { expiredFolder, hashToken, istDate, LINK_SECONDS, RETENTION_DAYS, sanitize, toCsv, wageAmount } from '../../supabase/functions/_shared/export-utils';
describe('P8 export rules', () => {
  it('exports hourly wages and amounts but not salary, bank, ID numbers or auth fields', () => {
    expect(EXPORT_SCHEMA).toHaveLength(17);
    expect(new Set(EXPORT_SCHEMA.map(schema => schema.table)).size).toBe(17);
    for (const schema of EXPORT_SCHEMA) for (const column of schema.columns) expect(column.name).not.toMatch(/salary|payroll|bank|aadhaar|aadhar|pan_number|pan_no|token|password|secret/i);
    expect(EXPORT_SCHEMA.find(schema => schema.table === 'labour_worker_rates')?.columns.map(column => column.name)).toContain('effective_hourly_rate');
    expect(EXPORT_SCHEMA.find(schema => schema.table === 'labour_attendance')?.columns.map(column => column.name)).toContain('amount');
  });
  it('keeps 60-day dated folders and latest, removing only older export dates', () => {
    expect(RETENTION_DAYS).toBe(60);
    expect(expiredFolder('2026-09-15', '2026-11-15')).toBe(true);
    expect(expiredFolder('2026-09-16', '2026-11-15')).toBe(false);
    expect(expiredFolder('latest', '2026-11-15')).toBe(false);
    expect(expiredFolder('site-report-photos', '2026-11-15')).toBe(false);
  });
  it('uses IST date and a five-minute URL lifetime', () => {
    expect(istDate(new Date('2026-11-14T20:00:00Z'))).toBe('2026-11-15');
    expect(LINK_SECONDS).toBe(300);
  });
  it('writes plain amounts and properly escaped UTF-8 CSV metadata', () => {
    expect(wageAmount(6, 110.58)).toBe(663.48);
    expect(toCsv(['hours', 'amount', 'flags'], [{ hours: 8, amount: 750, flags: ['no_exif'] }])).toBe('hours,amount,flags\r\n8,750,"[""no_exif""]"\r\n');
    expect(toCsv(['path'], [{ path: 'é,a"b' }])).toContain('"é,a""b"');
  });
  it('removes nested sensitive fields and hashes tokens without preserving plaintext', async () => {
    expect(sanitize({ flags: { bank_account: '123', aadhaar: '123', no_exif: true } })).toEqual({ flags: { no_exif: true } });
    expect(await hashToken('example')).toBe('50d858e0985ecc7f60418aaf0cc5ab587f42c2570a884095a9e8ccacd0f6545c');
  });
});