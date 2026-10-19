import { describe, it, expect } from "vitest";
import type { TFunction } from "i18next";
import { describeSyncFailure, describeSyncItem } from "./describeSyncItem";
import type { SyncQueueItem } from "./offlineDb";

const t = ((key: string) => key) as unknown as TFunction;

const item = (overrides: Partial<SyncQueueItem>): SyncQueueItem => ({
  correlationId: "c",
  userId: "u",
  endpoint: "/api/v1/x",
  method: "POST",
  createdAt: 0,
  retryCount: 0,
  status: "failed",
  ...overrides,
});

describe("describeSyncItem", () => {
  it.each([
    ["/api/v1/cooperative/submissions/{id}/sections/{section}", "PATCH", "update · section"],
    ["/api/v1/cooperative/submissions", "POST", "create · submission"],
    ["/api/v1/cooperative/non-financial/loans/{id}", "PUT", "update · loans"],
    ["/api/v1/ministry/federations/{id}/invitations", "POST", "create · invitation"],
    ["/api/v1/somewhere/else", "DELETE", "delete · change"],
  ] as const)("names %s (%s)", (endpoint, method, expected) => {
    expect(describeSyncItem(item({ endpoint, method }), t)).toBe(
      expected.replace(/^(\w+) · (\w+)$/, "sync.action.$1 · sync.subject.$2"),
    );
  });
});

describe("describeSyncFailure", () => {
  it("explains a network failure when the server never answered", () => {
    expect(describeSyncFailure(item({}), t)).toBe("sync.reason.network");
  });

  it("uses plain explanations for permission and missing-record refusals", () => {
    expect(describeSyncFailure(item({ lastStatus: 403 }), t)).toBe("sync.reason.forbidden");
    expect(describeSyncFailure(item({ lastStatus: 404 }), t)).toBe("sync.reason.notFound");
  });

  it("shows the server's own message for other refusals", () => {
    expect(
      describeSyncFailure(item({ lastStatus: 409, lastError: "Already exists for 2023" }), t),
    ).toBe("Already exists for 2023");
  });
});
