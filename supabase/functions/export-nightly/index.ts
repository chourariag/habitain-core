import { authenticateCronRequest } from '../_shared/cron-auth.ts';
import { director, service, json } from '../_shared/export-auth.ts';
import { EXPORT_SCHEMA } from '../_shared/export-schema.ts';
import { expiredFolder, istDate, toCsv } from '../_shared/export-utils.ts';

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return json({});
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const db = service();
  let runId: string | undefined;
  const files: { path: string; latest_path: string; rows: number }[] = [];
  const counts: Record<string, number> = {};
  let actor: string | null = null;
  try {
    const body = await req.json();
    if (!body || !['manual', 'scheduled'].includes(body.trigger)) return json({ error: 'Invalid trigger' }, 400);
    if (body.trigger === 'scheduled') {
      const rejected = authenticateCronRequest(req);
      if (rejected) return json({ error: 'Invalid scheduler authentication' }, rejected.status);
    } else {
      actor = await director(req, db);
      if (!actor) return json({ error: 'Forbidden' }, 403);
    }
    const { data: run, error: startError } = await db.from('export_log').insert({ trigger: body.trigger, created_by: actor, updated_by: actor }).select('id').single();
    if (startError || !run) return json({ error: 'Another export is running, or the run could not be recorded' }, 409);
    runId = run.id;
    const { data: rates, error: rateError } = await db.rpc('export_hourly_rates');
    if (rateError) throw rateError;
    const rateMap = new Map((rates ?? []).map((row: any) => [row.worker_id, Number(row.effective_hourly_rate ?? 0)]));
    const date = istDate();
    // Produce every dated file first; publish latest only after all sources succeeded.
    const csvFiles: { name: string; csv: string }[] = [];
    for (const schema of EXPORT_SCHEMA) {
      const columns = schema.columns.map(column => column.name);
      let rows: Record<string, unknown>[] = [];
      if (schema.table === 'labour_worker_rates') rows = rates ?? [];
      else {
        const selected = columns.filter(column => !['effective_hourly_rate', 'amount'].includes(column) || schema.table !== 'labour_attendance');
        for (let offset = 0; ; offset += 500) {
          let query = db.from(schema.table).select(selected.join(',')).order('id').range(offset, offset + 499);
          if (schema.table === 'daily_measurements') query = query.eq('trade', 'daily_site_report');
          const { data, error } = await query;
          if (error) throw error;
          const page = (data ?? []) as unknown as Record<string, unknown>[];
          rows.push(...page);
          if (page.length < 500) break;
        }
        if (schema.table === 'labour_attendance') rows = rows.map(row => {
          const rate = rateMap.get(String(row.worker_id)) ?? 0;
          return { ...row, effective_hourly_rate: rate, amount: Number(row.hours) * rate };
        });
      }
      const name = `${schema.table}_v${schema.version}.csv`;
      const csv = toCsv(columns, rows);
      const path = `${date}/${name}`;
      const { error } = await db.storage.from('exports').upload(path, csv, { upsert: true, contentType: 'text/csv; charset=utf-8' });
      if (error) throw error;
      counts[schema.table] = rows.length;
      files.push({ path, latest_path: `latest/${name}`, rows: rows.length });
      csvFiles.push({ name, csv });
    }
    for (const file of csvFiles) {
      const { error } = await db.storage.from('exports').upload(`latest/${file.name}`, file.csv, { upsert: true, contentType: 'text/csv; charset=utf-8' });
      if (error) throw error;
    }
    // List with pagination. Never read, copy, or delete any other bucket.
    const roots: string[] = [];
    for (let offset = 0; ; offset += 100) {
      const { data, error } = await db.storage.from('exports').list('', { limit: 100, offset, sortBy: { column: 'name', order: 'asc' } });
      if (error) throw error;
      roots.push(...(data ?? []).filter(item => expiredFolder(item.name, date)).map(item => item.name));
      if ((data ?? []).length < 100) break;
    }
    for (const folder of roots) {
      const paths: string[] = [];
      for (let offset = 0; ; offset += 100) {
        const { data, error } = await db.storage.from('exports').list(folder, { limit: 100, offset });
        if (error) throw error;
        paths.push(...(data ?? []).filter(item => item.id).map(item => `${folder}/${item.name}`));
        if ((data ?? []).length < 100) break;
      }
      for (let offset = 0; offset < paths.length; offset += 100) {
        const { error } = await db.storage.from('exports').remove(paths.slice(offset, offset + 100));
        if (error) throw error;
      }
    }
    const { error } = await db.from('export_log').update({ status: 'success', files, row_counts: counts, updated_at: new Date().toISOString(), updated_by: actor }).eq('id', runId);
    if (error) throw error;
    return json({ id: runId, status: 'success', files, row_counts: counts });
  } catch {
    if (runId) await db.from('export_log').update({ status: 'failed', files, row_counts: counts, error: 'Export failed; latest may be incomplete. Retry Export Now.', updated_at: new Date().toISOString(), updated_by: actor }).eq('id', runId);
    return json({ error: 'Export failed', id: runId }, 500);
  }
});