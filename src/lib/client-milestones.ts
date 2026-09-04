/**
 * Client-facing milestone tracker.
 *
 * Clients must never see internal stage codes (S-1, D-2, E-5, PR-3 ...).
 * Instead the portal shows exactly six fixed milestones. The mapping below is
 * explicit and identical for every project, so the client experience is
 * consistent regardless of which internal pipeline (habitainer / ads) the
 * project runs on.
 */

export interface ClientMilestoneDef {
  key: string;
  label: string;
  description: string;
  /** Internal stage codes that roll up into this milestone (habitainer + ads). */
  codes: string[];
}

export const CLIENT_MILESTONES: ClientMilestoneDef[] = [
  {
    key: "shell_core",
    label: "Shell & Core",
    description: "Primary structure and building envelope",
    codes: ["PR-1", "PR-2", "A-11", "A-12"],
  },
  {
    key: "builder_finish",
    label: "Builder finish",
    description: "Base finishes, services and fit-out",
    codes: ["PR-3", "A-13"],
  },
  {
    key: "interiors",
    label: "Interiors",
    description: "Interior finishing package",
    codes: ["E-7", "A-10"],
  },
  {
    key: "addons",
    label: "Addons",
    description: "Additional works and approved variations",
    codes: ["E-9"],
  },
  {
    key: "civil",
    label: "Civil",
    description: "Foundations and on-site civil works",
    codes: ["PR-4", "PR-6", "A-14"],
  },
  {
    key: "handover",
    label: "Handover",
    description: "Delivery, snagging and final handover",
    codes: ["PR-5", "PR-7"],
  },
];

export type ClientMilestoneStatus = "not_started" | "in_progress" | "complete";

export interface ClientMilestoneResult extends ClientMilestoneDef {
  status: ClientMilestoneStatus;
  /** 0-100 progress across the mapped internal stages. */
  percent: number;
  /** Latest completion date across mapped stages, when the milestone is done. */
  completedOn: string | null;
}

interface StageLike {
  stage_code?: string | null;
  status?: string | null;
  actual_date?: string | null;
}

export function computeClientMilestones(stages: StageLike[]): ClientMilestoneResult[] {
  return CLIENT_MILESTONES.map((m) => {
    const mapped = stages.filter((s) => s.stage_code && m.codes.includes(s.stage_code));
    if (mapped.length === 0) {
      return { ...m, status: "not_started" as const, percent: 0, completedOn: null };
    }

    const done = mapped.filter((s) => s.status === "Completed" || s.status === "Skipped");
    const active = mapped.some((s) => s.status === "In Progress" || s.status === "Blocked");
    const percent = Math.round((done.length / mapped.length) * 100);

    let status: ClientMilestoneStatus = "not_started";
    if (done.length === mapped.length) status = "complete";
    else if (active || done.length > 0) status = "in_progress";

    const dates = done.map((s) => s.actual_date).filter(Boolean) as string[];
    const completedOn =
      status === "complete" && dates.length > 0
        ? dates.sort().slice(-1)[0]
        : null;

    return { ...m, status, percent, completedOn };
  });
}
