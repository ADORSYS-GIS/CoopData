import { afterEach, describe, expect, it, vi } from "vitest";

import { onEditAccessLost, reportIfEditAccessLost } from "@/services/shared/editAccessEvents";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("reportIfEditAccessLost", () => {
  let unsubscribe: () => void = () => undefined;

  afterEach(() => unsubscribe());

  it("announces a not_editor refusal with the backend message", async () => {
    const handler = vi.fn();
    unsubscribe = onEditAccessLost(handler);

    await reportIfEditAccessLost(
      json(409, { error: "not_editor", message: "The Apex has taken this submission back." }),
    );

    expect(handler).toHaveBeenCalledWith({ message: "The Apex has taken this submission back." });
  });

  it("ignores other conflicts and errors", async () => {
    const handler = vi.fn();
    unsubscribe = onEditAccessLost(handler);

    await reportIfEditAccessLost(json(409, { error: "conflict", message: "Duplicate period" }));
    await reportIfEditAccessLost(json(403, { error: "not_editor" }));
    await reportIfEditAccessLost(new Response("oops", { status: 409 }));

    expect(handler).not.toHaveBeenCalled();
  });

  it("leaves the body readable for the caller", async () => {
    const response = json(409, { error: "not_editor", message: "x" });

    await reportIfEditAccessLost(response);

    await expect(response.json()).resolves.toEqual({ error: "not_editor", message: "x" });
  });
});
