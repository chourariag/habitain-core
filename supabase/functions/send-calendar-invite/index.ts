// Stub: send a Zoho Calendar invite. Wire to Zoho API once OAuth creds are configured.
// Input: { attendee_emails: string[], title: string, date: string, time: string, notes?: string }
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { attendee_emails = [], title, date, time, notes = "" } = await req.json();
    console.log("[send-calendar-invite STUB]", { attendee_emails, title, date, time, notes });

    // TODO: Wire to Zoho Calendar API once ZOHO_CLIENT_ID + ZOHO_CLIENT_SECRET + ZOHO_REFRESH_TOKEN are set.
    //   1) POST https://accounts.zoho.in/oauth/v2/token  (refresh_token grant) → access_token
    //   2) POST https://calendar.zoho.in/api/v1/calendars/{calendarUid}/events
    //      body: { eventdata: { title, dateandtime: { start, end, timezone }, description: notes, attendees: [...] } }

    return new Response(
      JSON.stringify({ success: true, stubbed: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
