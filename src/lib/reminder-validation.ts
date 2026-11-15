export const PROJECT_ESCALATION_MAX_HOURS = 48;
export const PROJECT_ESCALATION_LIMIT_MESSAGE = "Must be 48 hours or less: reports can only be filed for 3 days.";

export function escalationHoursError(ruleKey: string, hours: number): string | null {
  return (ruleKey === "daily_site_report" || ruleKey === "labour_attendance") && hours > PROJECT_ESCALATION_MAX_HOURS
    ? PROJECT_ESCALATION_LIMIT_MESSAGE
    : null;
}