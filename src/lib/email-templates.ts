// HStack-branded email templates. Each returns { subject, html, text }.
// Brand: Rolex Green #006039.

const APP_URL = "https://h-stack.com";
const LOGO_URL = `${APP_URL}/logo.png`;

const wrap = (title: string, inner: string, ctaUrl?: string, ctaLabel = "Open HStack") => `
<!doctype html><html><body style="margin:0;padding:0;background:#F7F7F7;font-family:Inter,Arial,sans-serif;color:#1a1a1a;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F7F7F7;padding:24px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e6e6e6;">
        <tr><td style="background:#006039;padding:20px 28px;">
          <img src="${LOGO_URL}" alt="HStack" height="32" style="display:block;border:0;outline:none;color:#ffffff;font-weight:700;font-size:20px;">
        </td></tr>
        <tr><td style="padding:28px;">
          <h1 style="margin:0 0 12px;font-family:Montserrat,Arial,sans-serif;color:#006039;font-size:20px;">${title}</h1>
          <div style="font-size:14px;line-height:1.55;color:#333;">${inner}</div>
          ${ctaUrl ? `<p style="margin:24px 0 0;"><a href="${ctaUrl}" style="background:#006039;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:600;display:inline-block;">${ctaLabel}</a></p>` : ""}
        </td></tr>
        <tr><td style="background:#fafafa;padding:16px 28px;border-top:1px solid #eee;font-size:12px;color:#777;">
          You're receiving this because you have an HStack account.
          <br><a href="${APP_URL}/notifications" style="color:#006039;">Manage notifications</a> · <a href="${APP_URL}/unsubscribe" style="color:#777;">Unsubscribe</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

const esc = (s: string) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

export function tplMilestone(opts: { projectName: string; milestone: string; details?: string; navigateTo?: string }) {
  const subject = `${opts.projectName} — ${opts.milestone} reached`;
  const url = `${APP_URL}${opts.navigateTo || "/"}`;
  const html = wrap("Milestone reached 🎯",
    `<p><strong>${esc(opts.projectName)}</strong> has reached <strong>${esc(opts.milestone)}</strong>.</p>${opts.details ? `<p>${esc(opts.details)}</p>` : ""}`,
    url, "View project");
  return { subject, html, text: `${subject}\n\n${opts.details || ""}\n${url}` };
}

export function tplOverdue(opts: { projectName: string; stage: string; daysOverdue: number; navigateTo?: string }) {
  const subject = `⚠️ Overdue: ${opts.stage} — ${opts.projectName}`;
  const url = `${APP_URL}${opts.navigateTo || "/design"}`;
  const html = wrap("Stage overdue",
    `<p><strong>${esc(opts.stage)}</strong> for <strong>${esc(opts.projectName)}</strong> is <strong style="color:#F40009;">${opts.daysOverdue} day(s) overdue</strong>.</p><p>Please review and update the status.</p>`,
    url, "Open design schedule");
  return { subject, html, text: `${subject}\n${url}` };
}

export function tplGfcKickoff(opts: { projectName: string; deadline: string; navigateTo?: string }) {
  const subject = `Action Required: GFC Kickoff Meeting — ${opts.projectName}`;
  const url = `${APP_URL}${opts.navigateTo || "/"}`;
  const html = wrap("GFC Kickoff Meeting required",
    `<p>GFC Budget was approved for <strong>${esc(opts.projectName)}</strong>. A kickoff meeting and Project Setup upload are required by <strong>${esc(opts.deadline)}</strong> (72 hours).</p>`,
    url, "Open project");
  return { subject, html, text: `${subject}\nDeadline: ${opts.deadline}\n${url}` };
}

export function tplArchiveReady(opts: { projectName: string; reportUrl?: string; zipUrl?: string }) {
  const subject = `${opts.projectName} — Archive Ready for Download`;
  const inner = `
    <p>The project archive for <strong>${esc(opts.projectName)}</strong> is ready.</p>
    <ul>
      ${opts.reportUrl ? `<li><a href="${opts.reportUrl}" style="color:#006039;">Cloud report</a></li>` : ""}
      ${opts.zipUrl ? `<li><a href="${opts.zipUrl}" style="color:#006039;">Download ZIP</a></li>` : ""}
    </ul>`;
  return { subject, html: wrap("Archive ready", inner, APP_URL, "Open HStack"), text: `${subject}\n${opts.reportUrl || ""}\n${opts.zipUrl || ""}` };
}

export function tplGeneral(opts: { title: string; body: string; navigateTo?: string }) {
  const subject = `HStack — ${opts.title}`;
  const url = `${APP_URL}${opts.navigateTo || "/"}`;
  return {
    subject,
    html: wrap(esc(opts.title), `<p>${esc(opts.body)}</p>`, url),
    text: `${subject}\n\n${opts.body}\n${url}`,
  };
}
