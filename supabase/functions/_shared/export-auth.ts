import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
export const service = () => createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Access-Control-Allow-Headers': `${corsHeaders['Access-Control-Allow-Headers']}, x-export-token`, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}
export async function director(req: Request, db: ReturnType<typeof service>): Promise<string | null> {
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) return null;
  const { data: allowed, error: roleError } = await db.rpc('is_tier1_or_super', { _uid: data.user.id });
  const { data: profile } = await db.from('profiles').select('is_active').eq('auth_user_id', data.user.id).maybeSingle();
  return allowed && !roleError && profile?.is_active ? data.user.id : null;
}