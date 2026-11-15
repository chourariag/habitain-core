import { service, director, json } from '../_shared/export-auth.ts';
import { hashToken } from '../_shared/export-utils.ts';
import { tokenExpiry } from '../_shared/export-token-expiry.ts';
Deno.serve(async req => {
  if (req.method === 'OPTIONS') return json({});
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const db = service();
  const actor = await director(req, db);
  if (!actor) return json({ error: 'Forbidden' }, 403);
  try {
    const body = await req.json();
    if (body.action === 'status') {
      const [sizes, tokens] = await Promise.all([db.rpc('export_storage_sizes'), db.from('export_tokens').select('id,label,created_at,last_used_at,expires_at,revoked_at').order('created_at', { ascending: false })]);
      if (sizes.error || tokens.error) throw new Error('Status unavailable');
      return json({ sizes: sizes.data, tokens: tokens.data });
    }
    if (body.action === 'create') {
      if (typeof body.label !== 'string' || !body.label.trim() || body.label.length > 100) return json({ error: 'Label must be 1–100 characters' }, 400);
      const days = body.expires_in_days ?? 180;
      if (!Number.isInteger(days) || days < 1 || days > 365) return json({ error: 'Token expiry must be 1–365 days' }, 400);
      const created = new Date();
      const token = 'hexp_' + Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join('');
      const expires_at = tokenExpiry(created, days);
      const { data, error } = await db.from('export_tokens').insert({ label: body.label.trim(), token_hash: await hashToken(token), created_by: actor, updated_by: actor, created_at: created.toISOString(), expires_at }).select('id').single();
      if (error) throw error;
      return json({ id: data.id, token, expires_at }, 201);
    }
    if (body.action === 'revoke') {
      if (typeof body.id !== 'string' || !/^[a-f0-9-]{36}$/.test(body.id)) return json({ error: 'Invalid token ID' }, 400);
      const { data, error } = await db.from('export_tokens').update({ revoked_at: new Date().toISOString(), updated_by: actor, updated_at: new Date().toISOString() }).eq('id', body.id).is('revoked_at', null).select('id').maybeSingle();
      if (error) throw error;
      return data ? json({ revoked: true }) : json({ error: 'Token not found or already revoked' }, 404);
    }
    return json({ error: 'Invalid action' }, 400);
  } catch { return json({ error: 'Export administration failed' }, 500); }
});