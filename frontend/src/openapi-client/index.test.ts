import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/services/shared/authService", () => ({
  getAccessToken: vi.fn().mockResolvedValue("token"),
}));
vi.mock("sonner", () => ({ toast: { warning: vi.fn(), dismiss: vi.fn() } }));
vi.mock("i18next", () => ({
  default: { t: (key: string) => `t:${key}` },
}));

const cloudflarePage =
  "<!DOCTYPE html><html><body><h1>Bad gateway Error code 502</h1></body></html>";

let nextResponse: () => Response;
let apiClient: typeof import("./index").apiClient;

beforeAll(async () => {
  // openapi-fetch keeps the fetch that exists when the client is created.
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.resolve(nextResponse())),
  );
  vi.stubEnv("VITE_API_BASE_URL", "http://localhost:3000");
  ({ apiClient } = await import("./index"));
});

describe("apiClient error handling", () => {
  it("replaces an HTML gateway page with a short translated message", async () => {
    nextResponse = () =>
      new Response(cloudflarePage, {
        status: 502,
        headers: { "content-type": "text/html; charset=UTF-8" },
      });

    const { error, response } = await apiClient.GET("/api/v1/apex/cooperatives");

    expect(response.status).toBe(502);
    expect(error).toMatchObject({
      error: "service_unavailable",
      message: "t:errors.serviceUnavailable",
    });
    expect(JSON.stringify(error)).not.toContain("<html");
  });

  it("keeps a JSON error from the backend as it is", async () => {
    nextResponse = () =>
      new Response(JSON.stringify({ error: "not_found", message: "Cooperative not found" }), {
        status: 404,
        headers: { "content-type": "application/json" },
      });

    const { error } = await apiClient.GET("/api/v1/apex/cooperatives");

    expect(error).toMatchObject({ error: "not_found", message: "Cooperative not found" });
  });
});
