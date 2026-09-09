import { describe, it, expect } from "vitest";
import { validatePassword, isPasswordValid } from "./passwordPolicy";

describe("validatePassword()", () => {
  it("flags every character rule for an empty password", () => {
    const rules = validatePassword("").filter((r) => r.key !== "notUsername");
    expect(rules.every((r) => !r.met)).toBe(true);
  });

  it("accepts a password meeting all requirements", () => {
    const rules = validatePassword("Strong1@pass");
    expect(rules.every((r) => r.met)).toBe(true);
  });

  it("rejects a password that is too short", () => {
    expect(validatePassword("A1@b").find((r) => r.key === "minLength")?.met).toBe(false);
  });

  it("rejects a password with no uppercase letter", () => {
    expect(validatePassword("strong1@pass").find((r) => r.key === "uppercase")?.met).toBe(false);
  });

  it("rejects a password with no lowercase letter", () => {
    expect(validatePassword("STRONG1@PASS").find((r) => r.key === "lowercase")?.met).toBe(false);
  });

  it("rejects a password with no digit", () => {
    expect(validatePassword("Strong@pass").find((r) => r.key === "digit")?.met).toBe(false);
  });

  it("rejects a password with no special character", () => {
    expect(validatePassword("Strong1pass").find((r) => r.key === "special")?.met).toBe(false);
  });

  it("rejects a password equal to the username", () => {
    expect(
      validatePassword("john@coop.test", "john@coop.test").find((r) => r.key === "notUsername")
        ?.met,
    ).toBe(false);
  });

  it("accepts a password different from the username", () => {
    expect(
      validatePassword("Strong1@pass", "john@coop.test").find((r) => r.key === "notUsername")?.met,
    ).toBe(true);
  });
});

describe("isPasswordValid()", () => {
  it("returns false for weak passwords", () => {
    expect(isPasswordValid("password123")).toBe(false);
    expect(isPasswordValid("12345678")).toBe(false);
  });

  it("returns true for a compliant password", () => {
    expect(isPasswordValid("Strong1@pass")).toBe(true);
  });
});
