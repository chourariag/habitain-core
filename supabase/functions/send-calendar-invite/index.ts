// Send a calendar invite by email (Resend) with a real .ics attachment.
// Input: { attendee_emails: string[], title: string, date: "YYYY-MM-DD", time: "HH:MM",
//          duration_minutes?: number, notes?: string, meeting_link?: string, organizer_email?: string }
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2.49.4";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM = Deno.env.get("RESEND_FROM") || "HStack <notify@altree.in>";
const IST_OFFSET_MIN = 330;

function toUtcStamp(date: string, time: string, addMinutes = 0): string {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const ms = Date.UTC(y, (m ?? 1) - 1, d ?? 1, hh ?? 0, mm ?? 0) - IST_OFFSET_MIN * 60000 + addMinutes * 60000;
  return new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function esc(s: string) {
  return String(s).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    if (!RESEND_API_KEY) return json({ success: false, error: "RESEND_API_KEY not configured" }, 500);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ success: false, error: "Unauthorized" }, 401);
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (claimsError || !claimsData?.claims) return json({ success: false, error: "Unauthorized" }, 401);

    const body = await req.json();
    const attendees: string[] = Array.isArray(body.attendee_emails)
      ? [...new Set(body.attendee_emails.filter((e: unknown) => typeof e === "string" && /.+@.+\..+/.test(e)))]
      : [];
    const title = String(body.title || "").slice(0, 200);
    const date = String(body.date || "");
    const time = String(body.time || "");
    const duration = Number(body.duration_minutes) > 0 ? Number(body.duration_minutes) : 60;
    const notes = String(body.notes || "");
    const meetingLink = String(body.meeting_link || "");

    if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}/.test(time)) {
      return json({ success: false, error: "Missing or invalid title/date/time" }, 400);
    }
    if (attendees.length === 0) {
      return json({ success: false, error: "No attendee email addresses available for this invite" }, 400);
    }

    const uid = `${crypto.randomUUID()}@hstack`;
    const description = [notes, meetingLink ? `Join: ${meetingLink}` : ""].filter(Boolean).join("\n\n");
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//HStack//Kickoff//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:REQUEST",
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTAMP:${toUtcStamp(date, time)}`,
      `DTSTART:${toUtcStamp(date, time)}`,
      `DTEND:${toUtcStamp(date, time, duration)}`,
      `SUMMARY:${esc(title)}`,
      description ? `DESCRIPTION:${esc(description)}` : "",
      meetingLink ? `LOCATION:${esc(meetingLink)}` : "",
      ...attendees.map((e) => `ATTENDEE;RSVP=TRUE;CN=${e}:mailto:${e}`),
      "END:VEVENT",
      "END:VCALENDAR",
    ].filter(Boolean).join("\r\n");

    const html = `
      <div style="font-family:Arial,sans-serif;color:#1A1A1A">
        <h2 style="color:#006039;margin:0 0 8px">${title}</h2>
        <p style="margin:0 0 4px"><strong>Date:</strong> ${date.split("-").reverse().join("/")}</p>
        <p style="margin:0 0 4px"><strong>Time:</strong> ${time} IST</p>
        ${meetingLink ? `<p style="margin:0 0 4px"><strong>Link:</strong> <a href="${meetingLink}">${meetingLink}</a></p>` : ""}
        ${notes ? `<p style="margin:12px 0 0;white-space:pre-wrap">${notes}</p>` : ""}
        <p style="margin:16px 0 0;font-size:12px;color:#666">Add to your calendar using the attached invite.</p>
      </div>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM,
        to: attendees,
        subject: title,
        html,
        attachments: [{ filename: "invite.ics", content: btoa(ics) }],
      }),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error("Resend error", res.status, payload);
      return json({ success: false, error: payload?.message || `Resend ${res.status}` }, 502);
    }

    return json({ success: true, sent_to: attendees, id: payload?.id ?? null });
  } catch (err) {
    console.error("send-calendar-invite failed", err);
    return json({ success: false, error: (err as Error).message }, 500);
  }
});
