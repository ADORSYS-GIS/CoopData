import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import {
  CORRELATION_HEADER,
  expectRequest,
  installCorrelationInterceptor,
  resolveEndpoint,
  takeCorrelationId,
} from "./correlation";

describe("correlation", () => {
  describe("resolveEndpoint", () => {
    it("substitutes encoded path params", () => {
      expect(resolveEndpoint("/api/v1/a/{id}/b/{name}", { id: "x 1", name: "y" })).toBe(
        "/api/v1/a/x%201/b/y",
      );
    });
  });

  describe("takeCorrelationId", () => {
    it("returns the id registered for the method and path, once", () => {
      const release = expectRequest("POST", "/api/v1/users", "id-1");

      expect(takeCorrelationId("POST", "http://localhost/api/v1/users?x=1")).toBe("id-1");
      expect(takeCorrelationId("POST", "http://localhost/api/v1/users")).toBeUndefined();
      release();
    });

    it("ignores other methods and paths", () => {
      const release = expectRequest("PUT", "/api/v1/users/1", "id-2");

      expect(takeCorrelationId("POST", "/api/v1/users/1")).toBeUndefined();
      expect(takeCorrelationId("PUT", "/api/v1/users/2")).toBeUndefined();
      release();
    });

    it("attaches nothing when two in-flight writes share method and path", () => {
      const releaseA = expectRequest("POST", "/api/v1/members", "id-a");
      const releaseB = expectRequest("POST", "/api/v1/members", "id-b");

      expect(takeCorrelationId("POST", "/api/v1/members")).toBeUndefined();
      releaseA();
      releaseB();
    });

    it("forgets a registration once released", () => {
      expectRequest("DELETE", "/api/v1/x/1", "id-3")();

      expect(takeCorrelationId("DELETE", "/api/v1/x/1")).toBeUndefined();
    });
  });

  describe("installCorrelationInterceptor", () => {
    const originalFetch = vi.fn<typeof fetch>();

    beforeAll(() => {
      window.fetch = originalFetch;
      installCorrelationInterceptor();
    });

    beforeEach(() => {
      originalFetch.mockReset();
      originalFetch.mockResolvedValue(new Response(null, { status: 204 }));
    });

    it("adds the registered id to a raw fetch write", async () => {
      const release = expectRequest("POST", "/api/v1/members", "id-raw");

      await window.fetch("/api/v1/members", { method: "POST", body: "{}" });

      const headers = new Headers(originalFetch.mock.calls[0][1]?.headers);
      expect(headers.get(CORRELATION_HEADER)).toBe("id-raw");
      release();
    });

    it("leaves requests that already carry an id untouched", async () => {
      const release = expectRequest("POST", "/api/v1/members", "id-registered");

      await window.fetch("/api/v1/members", {
        method: "POST",
        headers: { [CORRELATION_HEADER]: "id-outbox" },
      });

      const headers = new Headers(originalFetch.mock.calls[0][1]?.headers);
      expect(headers.get(CORRELATION_HEADER)).toBe("id-outbox");
      expect(takeCorrelationId("POST", "/api/v1/members")).toBe("id-registered");
      release();
    });
  });
});
