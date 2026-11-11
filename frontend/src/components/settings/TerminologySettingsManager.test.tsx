import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { TerminologySettingsManager } from "./TerminologySettingsManager";

const labels = ["ministry", "federation", "apex", "cooperative"].map((key) => ({
  key,
  label: `${key} name`,
  short_label: key.slice(0, 3),
  plural_label: `${key}s`,
  description: "",
  icon: "",
  translations: {},
}));

const reversed = [...labels].reverse();
const mutateAsync = vi.fn().mockResolvedValue({});

vi.mock("@/hooks/settings/useOrganizationLabels", () => ({
  DEFAULT_ORGANIZATION_LABELS: [],
  useOrganizationLabels: () => ({ data: reversed, isLoading: false }),
  useUpdateOrganizationLabel: () => ({ mutateAsync, isPending: false }),
}));

vi.mock("@/context/OrganizationLabelsContext", () => ({
  useOrganizationLabelsContext: () => ({
    getLabel: (key: string) => `${key} name`,
  }),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

describe("TerminologySettingsManager", () => {
  it("lists the levels from the top down whatever order the server returns", () => {
    render(<TerminologySettingsManager />);

    const titles = screen.getAllByRole("heading", { level: 4 }).map((h) => h.textContent);

    expect(titles.map((t) => t?.split(" ")[0])).toEqual([
      "ministry",
      "federation",
      "apex",
      "cooperative",
    ]);
  });

  it("closes the translation panels once the changes are saved", async () => {
    render(<TerminologySettingsManager />);
    fireEvent.click(screen.getAllByRole("button", { name: /translate/i })[0]);
    expect(screen.getByText(/translations/i)).toBeTruthy();
    fireEvent.change(screen.getAllByRole("textbox")[0], { target: { value: "Changed" } });

    fireEvent.click(screen.getByRole("button", { name: /save all changes/i }));

    await waitFor(() => expect(screen.queryByText(/^translations$/i)).toBeNull());
  });
});
