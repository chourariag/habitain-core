import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SiteReadinessChecklist } from "@/components/site/SiteReadinessChecklist";

const mockFrom = vi.hoisted(() => vi.fn());

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (...args: string[]) => mockFrom(...args),
    storage: {
      from: (bucket: string) => ({
        createSignedUrl: async (path: string) => ({
          data: { signedUrl: `https://signed.example/${bucket}/${path}` },
          error: null,
        }),
        upload: async () => ({ data: { path: "p" }, error: null }),
        remove: async () => ({ data: [], error: null }),
      }),
    },
  },
}));

const completedRecord: Record<string, unknown> = {
  id: "sr-1",
  project_id: "proj-1",
  is_complete: true,
  submitted_at: "2026-08-15T10:30:00Z",
  dry_run_video_url: "https://example.com/dry-run.mp4",
};

function buildSiteReadinessQuery(data: Record<string, unknown>[]) {
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
    const videoButton = await screen.findByText("View Dry Run Video");
    expect(videoButton).toBeInTheDocument();
    // Signed URLs are minted on click (private bucket) — assert the click opens one.
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    fireEvent.click(videoButton);
    await waitFor(() => expect(openSpy).toHaveBeenCalled());
    expect(openSpy.mock.calls[0][0]).toContain("https://signed.example/dry-run-videos/");
    openSpy.mockRestore();
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
