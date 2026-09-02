import { describe, it, expect } from "vitest";
import { cn } from "./utils";

describe("cn() — Tailwind class merger", () => {
  it("merges simple class names", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("merges multiple class names", () => {
    expect(cn("flex", "items-center", "p-4")).toBe("flex items-center p-4");
  });

  it("filters out falsy values", () => {
    const shouldInclude = false;
    expect(cn("foo", shouldInclude && "bar", undefined, "baz")).toBe("foo baz");
  });

  it("handles null as falsy", () => {
    expect(cn("foo", null, "bar")).toBe("foo bar");
  });

  it("handles empty string as falsy", () => {
    expect(cn("foo", "", "bar")).toBe("foo bar");
  });

  it("handles zero as falsy", () => {
    expect(cn("foo", 0, "bar")).toBe("foo bar");
  });

  it("handles conditional classes with boolean", () => {
    const isActive = true;
    const isDisabled = false;
    expect(cn("base", isActive && "active", isDisabled && "disabled")).toBe("base active");
  });

  it("handles conditional classes with false", () => {
    const isActive = false;
    expect(cn("base", isActive && "active")).toBe("base");
  });

  it("handles template literal inputs", () => {
    const size = "lg";
    expect(cn("button", `btn-${size}`)).toBe("button btn-lg");
  });

  it("handles clsx type inputs", () => {
    expect(cn(["foo", "bar"])).toBe("foo bar");
  });

  it("handles nested arrays", () => {
    expect(cn("foo", [["bar", "baz"]])).toBe("foo bar baz");
  });

  it("handles no arguments", () => {
    expect(cn()).toBe("");
  });

  it("deduplicates conflicting Tailwind classes (twMerge behavior)", () => {
    expect(cn("p-4 p-6")).toBe("p-6");
    expect(cn("p-2 p-4 p-6")).toBe("p-6");
    expect(cn("text-red text-blue")).toBe("text-blue");
  });
});
