// Fire-and-forget technical error capture.
// Never throws — a logging failure must never mask the original error.

export async function logTechnicalError(params: {
  functionName: string;
  error: unknown;
  userId?: string | null;
  req?: Request;
  context?: Record<string, unknown>;
}): Promise<void> {
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) return;

    const e = params.error;
    const message = e instanceof Error ? e.message : String(e);
    const stack = e instanceof Error ? (e.stack ?? null) : null;

    let requestPath: string | null = null;
    try {
      requestPath = params.req ? new URL(params.req.url).pathname : null;
    } catch {
      requestPath = null;
    }

    await fetch(`${url}/rest/v1/error_log`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        function_name: params.functionName,
        error_message: message.slice(0, 4000),
        error_stack: stack ? stack.slice(0, 8000) : null,
        request_path: requestPath,
        user_id: params.userId ?? null,
        context: params.context ?? {},
      }),
    });
  } catch (loggingError) {
    console.error("[error-log] capture failed:", loggingError);
  }
}
