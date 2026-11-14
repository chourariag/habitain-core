export const SITE_REPORT_SAVE_FAILURE = "Could not save the report. Please try again.";

const RULE_MESSAGES = new Set([
  "One photo is required for every elevation",
  "Site clean tick and photo are required",
  "Enter progress on at least one task, or explain in notes why no work happened",
  "Only the person who submitted this report can edit it",
  "Only the submitter can edit this report",
  "Only the last 3 days can be reported",
  "Future dates are not allowed",
  "No elevations defined for this project",
  "No access to this project",
  "You cannot write site reports for this project",
  "Task not in this project",
  "BOQ line not in this project",
  "Report not found",
  "Elevation not found",
]);

export function siteReportErrorMessage(error: { message?: string | null }): string {
  const message = error.message?.trim();
  return message && RULE_MESSAGES.has(message) ? message : SITE_REPORT_SAVE_FAILURE;
}