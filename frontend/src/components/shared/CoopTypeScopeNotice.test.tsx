import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CoopTypeScopeNotice } from "@/components/shared/CoopTypeScopeNotice";

const state = vi.hoisted(() => ({ role: "ministry" as string | undefined, toastInfo: vi.fn() }));

vi.mock("@/context/AuthContext", () => ({ useAuth: () => ({ role: state.role }) }));
vi.mock("sonner", () => ({ toast: { info: state.toastInfo } }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe("CoopTypeScopeNotice", () => {
  beforeEach(() => {
    state.toastInfo.mockClear();
    state.role = "ministry";
  });

  it("pops the banner every time the page opens and keeps the info icon", () => {
    const { unmount } = render(<CoopTypeScopeNotice page="analytics" />);
    unmount();
    render(<CoopTypeScopeNotice page="analytics" />);

    expect(state.toastInfo).toHaveBeenCalledTimes(2);
    expect(state.toastInfo).toHaveBeenCalledWith(
      "scopeNotice.analytics",
      expect.objectContaining({ duration: 6000 }),
    );
    expect(screen.getByLabelText("More information")).toBeInTheDocument();
  });

  it("shows each page's own message", () => {
    render(<CoopTypeScopeNotice page="basicBenchmarking" />);

    expect(state.toastInfo).toHaveBeenCalledWith(
      "scopeNotice.basicBenchmarking",
      expect.anything(),
    );
  });

  it("stays silent for cooperative users", () => {
    state.role = "cooperative";

    render(<CoopTypeScopeNotice page="analytics" />);

    expect(state.toastInfo).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("More information")).not.toBeInTheDocument();
  });
});
