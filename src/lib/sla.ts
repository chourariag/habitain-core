// Helpers for the 4-hour Labour Claim SLA timer.
export const SLA_HOURS = 4;
export const SLA_MS = SLA_HOURS * 60 * 60 * 1000;

export type SlaState = "green" | "amber" | "red";

export function getSlaInfo(submittedAt: string | Date) {
  const submitted = typeof submittedAt === "string" ? new Date(submittedAt) : submittedAt;
  const elapsed = Date.now() - submitted.getTime();
  const remaining = SLA_MS - elapsed;
  const breached = remaining <= 0;
  const state: SlaState = breached ? "red" : remaining < 60 * 60 * 1000 ? "amber" : "green";

  const fmt = (ms: number) => {
    const abs = Math.abs(ms);
    const h = Math.floor(abs / 3600000);
    const m = Math.floor((abs % 3600000) / 60000);
    return `${h}h ${m}m`;
  };

  const elapsedMin = Math.floor(elapsed / 60000);
  const submittedLabel =
    elapsedMin < 60 ? `${elapsedMin} min ago` : `${Math.floor(elapsedMin / 60)}h ${elapsedMin % 60}m ago`;

  return {
    breached,
    state,
    remainingMs: remaining,
    elapsedMs: elapsed,
    submittedLabel,
    remainingLabel: breached ? `${fmt(remaining)} overdue` : `${fmt(remaining)} remaining`,
    color: state === "green" ? "#006039" : state === "amber" ? "#D4860A" : "#F40009",
  };
}
