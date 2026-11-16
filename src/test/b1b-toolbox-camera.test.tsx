import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { ToolboxCamera } from "@/components/labour/ToolboxCamera";

describe("toolbox talk camera", () => {
  it("contains no file input, gallery picker or drop zone", () => {
    const { container } = render(<ToolboxCamera projectName="Test" onCaptured={() => undefined} />);
    expect(container.querySelector('[data-testid="toolbox-camera"]')).not.toBeNull();
    expect(container.querySelectorAll('input[type="file"]').length).toBe(0);
    expect(container.querySelectorAll("input").length).toBe(0);
    expect(container.innerHTML).not.toMatch(/ondrop|gallery picker|accept=/i);
  });
});
