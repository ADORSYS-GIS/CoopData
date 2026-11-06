import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { MambuBranchField } from "./MambuBranchField";
import { apiClient } from "@/openapi-client";

vi.mock("@/openapi-client", () => ({
  apiClient: { GET: vi.fn(), POST: vi.fn(), PUT: vi.fn(), DELETE: vi.fn() },
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_key: string, opts?: { defaultValue?: string; name?: string; id?: string }) =>
      (opts?.defaultValue ?? _key)
        .replace("{{name}}", opts?.name ?? "")
        .replace("{{id}}", opts?.id ?? ""),
  }),
}));

let current = "";
const Harness = () => {
  const [value, setValue] = useState("");
  current = value;
  return (
    <QueryClientProvider client={new QueryClient()}>
      <MambuBranchField value={value} onChange={setValue} />
    </QueryClientProvider>
  );
};

const type = (text: string) => userEvent.type(screen.getByLabelText(/mambu branch/i), text);
const search = () => userEvent.click(screen.getByRole("button", { name: /search/i }));

describe("MambuBranchField", () => {
  beforeEach(() => vi.clearAllMocks());

  it("keeps Search disabled until something is typed", async () => {
    render(<Harness />);
    expect(screen.getByRole("button", { name: /search/i })).toBeDisabled();
    await type("khutu");
    expect(screen.getByRole("button", { name: /search/i })).toBeEnabled();
  });

  it("lists matches by name and fills the ID when one is chosen", async () => {
    vi.mocked(apiClient.GET).mockResolvedValue({
      data: [
        { id: "ES0006", name: "Asikhutulisane SACCO", available: true },
        { id: "ES0009", name: "Asikhutulisane Two", available: true },
      ],
    } as never);
    render(<Harness />);
    await type("asikhu");
    await search();
    await userEvent.click(await screen.findByRole("button", { name: /asikhutulisane sacco/i }));
    expect(current).toBe("ES0006");
    expect(
      await screen.findByText(/selected: asikhutulisane sacco \(es0006\)/i),
    ).toBeInTheDocument();
  });

  it("selects the branch by itself when the typed text is exactly one ID", async () => {
    vi.mocked(apiClient.GET).mockResolvedValue({
      data: [{ id: "ES0006", name: "Asikhutulisane SACCO", available: true }],
    } as never);
    render(<Harness />);
    await type("es0006");
    await search();
    expect(await screen.findByText(/selected: asikhutulisane sacco/i)).toBeInTheDocument();
    expect(current).toBe("ES0006");
  });

  it("says so when no free branch matches", async () => {
    vi.mocked(apiClient.GET).mockResolvedValue({ data: [] } as never);
    render(<Harness />);
    await type("zzzz");
    await search();
    expect(await screen.findByText(/no free mambu branch matches/i)).toBeInTheDocument();
  });

  it("shows the error when the text is too short", async () => {
    vi.mocked(apiClient.GET).mockResolvedValue({
      error: { message: "Type at least 3 letters of the SACCO name or its Mambu ID" },
    } as never);
    render(<Harness />);
    await type("ab");
    await search();
    expect(await screen.findByText(/type at least 3 letters/i)).toBeInTheDocument();
  });
});
