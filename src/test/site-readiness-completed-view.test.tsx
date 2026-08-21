import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { SiteReadinessChecklist } from "@/components/site/SiteReadinessChecklist";

const mockFrom = vi.hoisted(() => vi.fn());

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (...args: any[]) => mockFrom(...args),
  },
}));

const completedRecord = {
  id: "sr-1",
  project_id: "proj-1",
  is_complete: true,
  submitted_at: "2026-08-15T10:30:00Z",
  dry_run_video_url: "https://example.com/dry-run.mp4",
};

function buildSiteReadinessQuery(data: any[]) {
  return {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        order: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve({ data, error: null })),
        })),
      })),
    })),
  };
}

beforeEach(() => {
  mockFrom.mockImplementation((table: string) => {
    if (table === "site_readiness") return buildSiteReadinessQuery([completedRecord]);
    return buildSiteReadinessQuery([]);
  });
});

describe("Site Hub completed Site Readiness view", () => {
  it("renders the confirmed checklist and dry-run video for a non-submit role", async () => {
    render(
      <SiteReadinessChecklist
        projectId="proj-1"
        userRole="finance_manager"
        onReadinessConfirmed={() => {}}
      />
    );

    expect(await screen.findByText("Site Readiness Confirmed")).toBeInTheDocument();
    const videoLink = await screen.findByText("View Dry Run Video");
    expect(videoLink).toBeInTheDocument();
    expect(videoLink.closest("a")).toHaveAttribute("href", "https://example.com/dry-run.mp4");
  });

  it("renders the confirmed checklist regardless of siteReady state (i.e., when existing.is_complete is true)", async () => {
    // When the site_readiness row is complete, the component should render the
    // read-only view even if the user's role cannot submit or edit.
    render(
      <SiteReadinessChecklist
        projectId="proj-1"
        userRole={null}
        onReadinessConfirmed={() => {}}
      />
    );

    expect(await screen.findByText("Site Readiness Confirmed")).toBeInTheDocument();
    expect(await screen.findByText("View Dry Run Video")).toBeInTheDocument();
  });
});
