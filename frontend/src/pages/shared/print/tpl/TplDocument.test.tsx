import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TplDocument, type PageSpec } from "@/pages/shared/print/tpl/TplDocument";

const spec = (title: string, no?: string): PageSpec => ({
  toc: no ? { no, title } : undefined,
  render: () => <p>{title}</p>,
});

const renderDoc = (pages: PageSpec[]) =>
  render(
    <TplDocument
      frame={{ headLeft: "L", headRight: "R", footLeft: "FL", footMid: "FM" }}
      cover={{
        kicker: "K",
        title: ["Report"],
        entity: "Entity",
        entityNote: "Note",
        badge: "RESTRICTED",
        meta: [{ label: "Year", value: "2026" }],
        footLeft: "a",
        footRight: "b",
      }}
      front={{ particulars: [["A", "1", "B", "2"]], basis: "Basis text" }}
      pages={pages}
    />,
  );

describe("TplDocument", () => {
  it("numbers pages after the cover and states the total on every page", () => {
    const { container } = renderDoc([spec("One", "1"), spec("Two", "2")]);

    const labels = [...container.querySelectorAll(".run-bot span:nth-child(3)")].map(
      (n) => n.textContent,
    );

    expect(labels).toEqual(["Page 2 of 4", "Page 3 of 4", "Page 4 of 4"]);
  });

  it("lists sections in Contents with the page they start on", () => {
    const { container } = renderDoc([spec("One", "1"), spec("Continued"), spec("Annex", "A")]);

    const rows = [...container.querySelectorAll("table.toc tr")].map((tr) => tr.textContent);

    expect(rows).toEqual(["1One3", "AAnnex5"]);
  });

  it("includes Document Control, basis of preparation and the status legend", () => {
    const { container } = renderDoc([spec("One", "1")]);

    expect(container.textContent).toContain("Document Control");
    expect(container.textContent).toContain("Basis text");
    expect(container.textContent).toContain("Unverified");
  });
});
