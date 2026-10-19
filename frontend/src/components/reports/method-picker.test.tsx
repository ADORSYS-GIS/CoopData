import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("@/context/OrganizationLabelsContext", () => ({
  useOrganizationLabelsContext: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options ? `${key} ${JSON.stringify(options)}` : key,
  }),
}));

import { MethodPicker } from "./method-picker";

const editions = () => screen.getAllByRole("radio");

describe("MethodPicker", () => {
  it("always shows both editions, with their approved counts", () => {
    render(
      <MethodPicker
        counts={{ standard: 3, questionnaire: 1 }}
        value=""
        onSelect={vi.fn()}
        year="2025"
      />,
    );

    expect(editions()).toHaveLength(2);
    expect(screen.getByText(/reportExport\.method\.count \{"count":3\}/)).toBeInTheDocument();
    expect(screen.getByText(/reportExport\.method\.count \{"count":1\}/)).toBeInTheDocument();
    expect(screen.getByText("reportExport.method.choose")).toBeInTheDocument();
  });

  it("disables an edition without data instead of hiding it", () => {
    const onSelect = vi.fn();
    render(
      <MethodPicker
        counts={{ standard: 2, questionnaire: 0 }}
        value="standard"
        onSelect={onSelect}
        year="2025"
      />,
    );

    const [standard, questionnaire] = editions();
    expect(standard).toHaveAttribute("aria-checked", "true");
    expect(questionnaire).toBeDisabled();
    expect(screen.getByText(/noneForYear \{"year":"2025"\}/)).toBeInTheDocument();
    expect(screen.getByText(/reportExport\.method\.auto/)).toBeInTheDocument();

    fireEvent.click(questionnaire!);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("selects the edition the user clicks", () => {
    const onSelect = vi.fn();
    render(
      <MethodPicker
        counts={{ standard: 1, questionnaire: 1 }}
        value=""
        onSelect={onSelect}
        year="2025"
      />,
    );

    fireEvent.click(editions()[1]!);

    expect(onSelect).toHaveBeenCalledWith("questionnaire");
  });
});
