import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NfTable } from "./NfTable";

const pageHook = vi.fn();

vi.mock("@/hooks/non-financial/useNfRecordsPage", () => ({
  useNfRecordsPage: (...args: unknown[]) => pageHook(...args),
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      String(options?.defaultValue ?? key).replace(/\{\{(\w+)\}\}/g, (_, name: string) =>
        String(options?.[name] ?? ""),
      ),
  }),
}));
vi.mock("@/components/app-shell", () => ({
  Card: ({
    title,
    action,
    children,
  }: {
    title: string;
    action?: React.ReactNode;
    children: React.ReactNode;
  }) => (
    <section>
      <h2>{title}</h2>
      {action}
      {children}
    </section>
  ),
  StatusPill: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

const fetchPage = vi.fn();

const renderTable = (total: number) =>
  render(
    <NfTable
      title="Membership"
      columns={["member_id"]}
      queryKey="nf-members"
      fetchPage={fetchPage}
      params={{ submission_id: "s1" }}
      total={total}
    />,
  );

describe("NfTable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pageHook.mockReturnValue({
      isLoading: false,
      data: { data: [{ member_id: "SB1" }], total: 120 },
    });
  });

  it("is folded and loads no rows until it is opened", () => {
    renderTable(120);

    // key, fetchPage, params, page, page size, enabled
    expect(pageHook.mock.calls[0]?.[5]).toBe(false);
    expect(screen.queryByText("SB1")).toBeNull();
  });

  it("loads a page of 50 when it is opened and shows where the reader is", async () => {
    renderTable(120);

    await userEvent.click(
      screen.getByRole("button", { name: "submissions.detail.nfDatabases.btnExpand" }),
    );

    const last = pageHook.mock.calls.at(-1) ?? [];
    expect(last[3]).toBe(1);
    expect(last[4]).toBe(50);
    expect(last[5]).toBe(true);
    expect(screen.getByText("SB1")).toBeTruthy();
    expect(screen.getByText("1–50 of 120")).toBeTruthy();
  });

  it("asks for the next page", async () => {
    renderTable(120);
    await userEvent.click(
      screen.getByRole("button", { name: "submissions.detail.nfDatabases.btnExpand" }),
    );

    await userEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(pageHook.mock.calls.at(-1)?.[3]).toBe(2);
    expect(screen.getByText("51–100 of 120")).toBeTruthy();
  });

  it("has no pager when everything fits on one page", async () => {
    renderTable(30);
    await userEvent.click(
      screen.getByRole("button", { name: "submissions.detail.nfDatabases.btnExpand" }),
    );

    expect(screen.queryByRole("button", { name: "Next" })).toBeNull();
  });
});
